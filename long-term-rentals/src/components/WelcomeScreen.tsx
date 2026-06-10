import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Globe, ArrowRight } from 'lucide-react'
import { setAppLanguage, getAppLanguage } from '../i18n'
import { RialBrand } from './RialBrand'
import { AuthPanel } from './AuthPanel'

interface WelcomeScreenProps {
  requires2FA?: boolean
  twoFactorMethod?: string | null
  onLogin: (credentials: { email: string; password: string; twoFactorCode?: string; recaptchaToken?: string }) => void
  onVerify2FA?: (code: string) => void
  onRegister: (data: { name: string; email: string; password: string; role: string }) => void
  onContinueAsGuest: () => void
}

/**
 * Primera pantalla de la app: el usuario inicia sesión, se registra o entra
 * como invitado. Si entra como invitado, sólo verá propiedades, detalles y mapa.
 */
export function WelcomeScreen({
  requires2FA,
  twoFactorMethod,
  onLogin,
  onVerify2FA,
  onRegister,
  onContinueAsGuest,
}: WelcomeScreenProps) {
  const { t } = useTranslation()

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-rial-cream via-white to-rial-sky/40 px-4 py-8 font-sans text-rial-ink dark:from-slate-950 dark:via-slate-900 dark:to-rial-navy/60 dark:text-slate-100">
      <div className="rial-accent-bar absolute inset-x-0 top-0 opacity-80" aria-hidden />

      {/* Selector de idioma arriba a la derecha */}
      <div className="absolute right-3 top-4 flex items-center gap-2 sm:right-5">
        <Globe className="h-4 w-4 text-rial-muted dark:text-slate-400" aria-hidden />
        <select
          value={getAppLanguage()}
          onChange={(e) => setAppLanguage(e.target.value)}
          className="rounded-xl border border-rial-cream-dark/60 bg-white px-2 py-1.5 text-sm text-rial-ink focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          title={t('profile.language')}
          aria-label={t('profile.language')}
        >
          <option value="es">{t('profile.spanish')}</option>
          <option value="en">{t('profile.english')}</option>
        </select>
      </div>

      <motion.div
        className="flex w-full max-w-md flex-col items-center gap-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <RialBrand
            name={t('app.name')}
            tagline={t('app.tagline')}
            size="lg"
            showLabel={false}
            showTagline={false}
            surface="light"
          />
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-rial-navy dark:text-rial-cream md:text-3xl">
              {t('welcome.title')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-rial-muted dark:text-slate-400">
              {t('welcome.subtitle')}
            </p>
          </div>
        </div>

        <div className="w-full">
          <AuthPanel
            requires2FA={requires2FA}
            twoFactorMethod={twoFactorMethod}
            onLogin={onLogin}
            onVerify2FA={onVerify2FA}
            onRegister={onRegister}
            onLogout={() => {}}
          />
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full items-center gap-3 text-xs uppercase tracking-[0.2em] text-rial-muted dark:text-slate-500">
            <span className="h-px flex-1 bg-rial-cream-dark/60 dark:bg-slate-700" />
            {t('welcome.or')}
            <span className="h-px flex-1 bg-rial-cream-dark/60 dark:bg-slate-700" />
          </div>
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-rial-navy underline-offset-4 transition-colors hover:bg-white/60 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rial-gold dark:text-rial-gold dark:hover:bg-slate-800/60"
          >
            {t('welcome.continueAsGuest')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="max-w-xs text-center text-xs text-rial-muted dark:text-slate-500">
            {t('welcome.guestNote')}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
