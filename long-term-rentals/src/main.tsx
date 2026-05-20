import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { APP_VERSION } from './appVersion'

/** Elimina SW/caché viejos (mostraban el bug "fecha del servidor" en alquiler). */
async function purgeLegacyCaches(): Promise<boolean> {
  const versionKey = 'rial-app-version'
  const rentalFixKey = 'rial-rental-date-fix-v3'
  const prevVersion = localStorage.getItem(versionKey)
  const rentalFixApplied = localStorage.getItem(rentalFixKey) === '1'
  const needsPurge = prevVersion !== APP_VERSION || !rentalFixApplied
  if (!needsPurge) return false

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
  localStorage.setItem(versionKey, APP_VERSION)
  localStorage.setItem(rentalFixKey, '1')
  window.location.reload()
  return true
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Mensajes claros para la pantalla global de error (p. ej. chunks tras deploy). */
function getErrorBoundaryFriendlyCopy(error: Error | null): {
  title: string
  description: string
  detail?: string
} {
  const msg = (error?.message ?? '').trim()
  const lower = msg.toLowerCase()

  if (
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('loading chunk') ||
    lower.includes('dynamically imported module')
  ) {
    return {
      title: 'Actualiza la página',
      description:
        'Suele ocurrir cuando publicamos una nueva versión: el navegador aún tenía archivos anteriores. Al recargar se descarga la versión correcta.',
      detail: msg || undefined,
    }
  }

  if (lower.includes('failed to fetch') || error?.name === 'TypeError') {
    return {
      title: 'Problema de conexión',
      description:
        'No pudimos comunicarnos con el servidor. Comprueba tu conexión a internet y vuelve a intentarlo en unos segundos.',
      detail: msg || undefined,
    }
  }

  return {
    title: 'Algo salió mal',
    description:
      'La aplicación encontró un error inesperado. Recargar suele resolverlo; si el problema continúa, prueba más tarde o contacta con soporte.',
    detail: msg || undefined,
  }
}

function ErrorBoundaryFallback({
  error,
  onReload,
}: {
  error: Error | null
  onReload: () => void
}) {
  const { title, description, detail } = getErrorBoundaryFriendlyCopy(error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rial-cream via-white to-slate-100 px-4 py-12 font-sans">
      <div className="w-full max-w-md animate-fade-in-up rounded-2xl border border-rial-cream-dark/60 bg-white/90 p-8 shadow-soft backdrop-blur-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-rial-navy/5 ring-1 ring-rial-navy/10">
          <svg
            className="h-7 w-7 text-rial-navy"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-center text-xl font-semibold tracking-tight text-rial-navy">
          {title}
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-rial-muted">
          {description}
        </p>

        {detail ? (
          <details className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-left">
            <summary className="cursor-pointer select-none text-xs font-medium text-slate-600 outline-none hover:text-rial-navy">
              Detalle técnico
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-slate-500">
              {detail}
            </pre>
          </details>
        ) : null}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onReload}
            className="btn-gradient inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-medium shadow-md transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-rial-gold focus:ring-offset-2 sm:w-auto"
          >
            Recargar página
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Si el error se repite, borra la caché del sitio o prueba en una ventana privada.
        </p>
      </div>
    </div>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryFallback
          error={this.state.error}
          onReload={() => {
            this.setState({ hasError: false, error: null })
            window.location.reload()
          }}
        />
      )
    }

    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

if (import.meta.env.DEV) {
  console.log('Starting React app...')
}

async function bootstrap() {
  const reloaded = await purgeLegacyCaches()
  if (reloaded) return
  if (!rootElement) throw new Error('Root element not found')

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap().catch((error) => {
  console.error('Error rendering React app:', error)
  const err = error instanceof Error ? error : new Error(String(error))
  const { title, description, detail } = getErrorBoundaryFriendlyCopy(err)
  const safeDetail = detail ? escapeHtml(detail) : ''
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui,sans-serif;background:linear-gradient(135deg,#F5F1E9 0%,#ffffff 45%,#f1f5f9 100%);padding:2rem;">
      <div style="width:100%;max-width:28rem;border-radius:1rem;border:1px solid rgba(232,226,214,0.85);background:rgba(255,255,255,0.92);padding:2rem;box-shadow:0 2px 15px -3px rgba(0,0,0,0.07),0 10px 20px -2px rgba(0,0,0,0.04);">
        <div style="margin:0 auto 1.5rem;width:3.5rem;height:3.5rem;display:flex;align-items:center;justify-content:center;border-radius:1rem;background:rgba(11,22,35,0.06);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0B1623" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        </div>
        <h1 style="margin:0;text-align:center;font-size:1.25rem;font-weight:600;color:#0B1623;">${safeTitle}</h1>
        <p style="margin:0.75rem 0 0;text-align:center;font-size:0.875rem;line-height:1.6;color:#5C6570;">${safeDescription}</p>
        ${safeDetail ? `<pre style="margin-top:1rem;max-height:8rem;overflow:auto;padding:0.75rem;border-radius:0.75rem;background:#f8fafc;font-size:11px;line-height:1.4;color:#64748b;white-space:pre-wrap;word-break:break-word;">${safeDetail}</pre>` : ''}
        <div style="margin-top:1.75rem;text-align:center;">
          <button type="button" onclick="location.reload()" style="cursor:pointer;border:none;border-radius:0.75rem;padding:0.75rem 1.25rem;font-size:0.875rem;font-weight:500;color:#F5F1E9;background:linear-gradient(to right,#0B1623,#152535);box-shadow:0 4px 14px rgba(11,22,35,0.25);">Recargar página</button>
        </div>
        <p style="margin-top:1.5rem;text-align:center;font-size:0.75rem;color:#94a3b8;">Si el error se repite, borra la caché del sitio o prueba en una ventana privada.</p>
      </div>
    </div>
  `
})
