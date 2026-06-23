/**
 * Web Push en el cliente: pide permiso, suscribe el dispositivo (vía el service worker
 * del PWA) y registra la suscripción en el backend para recibir notificaciones del
 * sistema operativo aunque la app esté cerrada.
 *
 * Nota: el service worker solo se registra en builds de producción (ver main.tsx). En
 * `npm run dev` no hay SW, por lo que el push no estará disponible (se informa con
 * `reason: 'no-sw'`). Para probar en local: `npm run build && npm run preview`.
 */
import { api } from './api'

export type PushAvailability =
  | { supported: true; permission: NotificationPermission; subscribed: boolean }
  | { supported: false; reason: 'unsupported' | 'no-sw' }

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/** ¿El navegador soporta Web Push? (API presente) */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Devuelve la registración del SW si existe (no espera indefinidamente en dev). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  // `ready` no resuelve si no hay SW (dev). Le ponemos un timeout corto.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ])
}

/** Estado actual del push para decidir qué mostrar en la UI. */
export async function getPushAvailability(): Promise<PushAvailability> {
  if (!isPushSupported()) return { supported: false, reason: 'unsupported' }
  const reg = await getRegistration()
  if (!reg) return { supported: false, reason: 'no-sw' }
  const sub = await reg.pushManager.getSubscription()
  return { supported: true, permission: Notification.permission, subscribed: Boolean(sub) }
}

/**
 * Activa las notificaciones push para este dispositivo. Pide permiso, suscribe y
 * registra en el backend. Devuelve true si quedó suscrito.
 */
export async function enablePush(token: string): Promise<boolean> {
  if (!isPushSupported()) throw new Error('Tu navegador no soporta notificaciones push')

  const reg = await getRegistration()
  if (!reg) throw new Error('El service worker no está activo (usá una build de producción para probar push)')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado')

  // Clave pública VAPID del backend.
  const cfg = (await api('/api/push/vapid-public-key')) as { enabled: boolean; publicKey: string | null }
  if (!cfg?.enabled || !cfg.publicKey) throw new Error('El servidor no tiene el push habilitado')

  // Reutiliza la suscripción existente o crea una nueva.
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    })
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  await api('/api/push/subscribe', {
    method: 'POST',
    token,
    body: { endpoint: json.endpoint, keys: json.keys },
  })
  return true
}

/** Desactiva las notificaciones push en este dispositivo. */
export async function disablePush(token: string): Promise<void> {
  if (!isPushSupported()) return
  const reg = await getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  try {
    await sub.unsubscribe()
  } catch {
    /* ignorar */
  }
  await api('/api/push/unsubscribe', { method: 'POST', token, body: { endpoint } }).catch(() => {})
}
