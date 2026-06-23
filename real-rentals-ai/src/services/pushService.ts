/**
 * Web Push: envío de notificaciones al dispositivo (PWA) aunque la app esté cerrada.
 *
 * Usa el protocolo Web Push con claves VAPID. Si VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 * no están configuradas, `isPushEnabled()` devuelve false y el envío se omite en
 * silencio (las notificaciones in-app de la campanita siguen funcionando igual).
 */
import webpush from 'web-push';
import prisma from '../lib/prisma';
import config from '../config/env';
import { logger } from '../utils/logger';

let configured = false;

/** ¿Están las claves VAPID configuradas? Si no, el push queda desactivado. */
export function isPushEnabled(): boolean {
  return Boolean(config.vapidPublicKey && config.vapidPrivateKey);
}

/** Clave pública VAPID que el frontend necesita para suscribir el dispositivo. */
export function getVapidPublicKey(): string | null {
  return config.vapidPublicKey ?? null;
}

/** Configura web-push una sola vez (perezoso). */
function ensureConfigured() {
  if (configured) return;
  if (!isPushEnabled()) return;
  webpush.setVapidDetails(
    config.vapidSubject || 'mailto:soporte@rial.com',
    config.vapidPublicKey!,
    config.vapidPrivateKey!
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** URL a abrir al tocar la notificación (ruta relativa del frontend). */
  url?: string;
  tag?: string;
};

/**
 * Envía una notificación push a TODOS los dispositivos suscritos de un usuario.
 * Elimina automáticamente las suscripciones muertas (404/410). Best-effort:
 * nunca lanza, para no romper el flujo de pago/reserva que la dispara.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!isPushEnabled()) return;
  ensureConfigured();

  let subs: Array<{ id: number; endpoint: string; p256dh: string; auth: string }> = [];
  try {
    subs = await (prisma as any).pushSubscription.findMany({ where: { userId } });
  } catch (err) {
    logger.warn('No se pudieron leer las suscripciones push', 'Push');
    return;
  }
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        const status = err?.statusCode;
        // 404/410 → el navegador revocó la suscripción: la borramos.
        if (status === 404 || status === 410) {
          await (prisma as any).pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        } else {
          logger.warn(`Fallo al enviar push (status=${status})`, 'Push');
        }
      }
    })
  );
}
