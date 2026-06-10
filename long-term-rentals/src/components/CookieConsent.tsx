import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Cookie } from 'lucide-react'
import { Button } from './UI'

const COOKIE_CONSENT_KEY = 'rial_cookie_consent'

export type CookieConsentValue = 'accepted' | 'rejected'

/** Lee la decisión guardada (o null si el usuario aún no eligió). */
export function getCookieConsent(): CookieConsentValue | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    return raw === 'accepted' || raw === 'rejected' ? raw : null
  } catch {
    return null
  }
}

/**
 * Banner de consentimiento de cookies. Se muestra hasta que el usuario acepta
 * o rechaza; la decisión se guarda en localStorage para no volver a mostrarlo.
 */
export function CookieConsent() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Mostrar solo si todavía no hay una decisión guardada.
    if (getCookieConsent() === null) setVisible(true)
  }, [])

  const decide = (value: CookieConsentValue) => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, value)
    } catch {
      // Si localStorage falla (modo privado/cuota), igual cerramos el banner.
    }
    setVisible(false)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[90000] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          role="dialog"
          aria-live="polite"
          aria-label={t('cookies.title')}
        >
          <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-rial-gold/40 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-rial-accent/25 dark:bg-slate-900/95 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rial-gold/20 text-rial-navy dark:bg-rial-accent/20 dark:text-rial-gold">
                  <Cookie className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-rial-navy dark:text-rial-cream">{t('cookies.title')}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-rial-muted dark:text-slate-400">
                    {t('cookies.message')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col md:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:w-full md:flex-1"
                  onClick={() => decide('rejected')}
                >
                  {t('cookies.reject')}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 sm:w-full md:flex-1"
                  onClick={() => decide('accepted')}
                >
                  {t('cookies.accept')}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
