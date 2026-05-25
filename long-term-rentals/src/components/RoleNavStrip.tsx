import { classNames } from './UI'

export type RoleNavItem = { key: string; label: string }

const pillClass = (active: boolean) =>
  classNames(
    'shrink-0 snap-start whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
    active
      ? 'border-rial-navy bg-rial-navy text-rial-cream'
      : 'border-rial-gold/35 bg-white/90 text-rial-ink hover:border-rial-accent/50 hover:bg-rial-gold-soft/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-rial-accent/40'
  )

const selectClass =
  'w-full min-w-0 rounded-xl border border-rial-gold/35 bg-white px-3 py-2.5 text-sm text-rial-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

type RoleNavStripProps = {
  items: RoleNavItem[]
  value: string
  onChange: (key: string) => void
  className?: string
  mobileAriaLabel?: string
}

/** Navegación por rol: menú desplegable en móvil, pills con scroll horizontal en desktop. */
export function RoleNavStrip({ items, value, onChange, className, mobileAriaLabel }: RoleNavStripProps) {
  return (
    <div className={classNames('w-full min-w-0', className)}>
      <select
        className={classNames(selectClass, 'md:hidden')}
        value={value}
        aria-label={mobileAriaLabel}
        onChange={(e) => onChange(e.target.value)}
      >
        {items.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>

      <div
        className="rial-role-nav-scroll hidden w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-0.5 pt-0.5 md:flex"
        role="tablist"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={value === item.key}
            className={pillClass(value === item.key)}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
