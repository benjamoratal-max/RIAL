import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { classNames } from './UI'
import { getPasswordRequirements } from '../utils/validation'

interface PasswordRequirementsHintProps {
  password: string
}

export function PasswordRequirementsHint({ password }: PasswordRequirementsHintProps) {
  const { t } = useTranslation()

  if (!password) return null

  const requirements = getPasswordRequirements(password)
  const allMet = requirements.every((r) => r.met)

  return (
    <div
      className={classNames(
        'mt-2 rounded-lg border px-3 py-2 text-xs',
        allMet
          ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200'
          : 'border-rial-cream-dark/50 bg-rial-cream/50 text-rial-ink dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300'
      )}
      role="status"
      aria-live="polite"
    >
      <p className="mb-1.5 font-medium">{t('auth.passwordRequirements.title')}</p>
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li
            key={req.id}
            className={classNames(
              'flex items-center gap-2',
              req.met ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-slate-400'
            )}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden />
            )}
            <span>{t(`auth.passwordRequirements.${req.id}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
