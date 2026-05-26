import { useState } from 'react'
import { classNames } from './UI'

type RialBrandSize = 'sm' | 'md' | 'lg' | 'xl' | 'header'
type RialBrandSurface = 'light' | 'dark'
/** plain = PNG transparente; sidebarDeck = franja integrada en el rail; lightBadge = tarjeta (legacy) */
type LogoPresentation = 'plain' | 'sidebarDeck' | 'lightBadge'

const LOGO_SRC = '/rial-logo.png?v=3'

const sizeConfig: Record<
  RialBrandSize,
  { mark: string; name: string; tagline: string; gap: string; stack: boolean }
> = {
  sm: {
    mark: 'h-11 w-full max-w-[4.75rem]',
    name: 'text-[11px] font-bold leading-tight',
    tagline: 'text-[9px] tracking-[0.14em]',
    gap: 'gap-1.5',
    stack: true,
  },
  md: {
    mark: 'h-16 w-auto max-w-[11rem]',
    name: 'text-xl font-bold',
    tagline: 'text-[10px] tracking-[0.18em]',
    gap: 'gap-3',
    stack: false,
  },
  lg: {
    mark: 'h-20 w-auto max-w-[14rem] md:h-[5.5rem] md:max-w-[16rem]',
    name: 'text-2xl md:text-3xl font-bold',
    tagline: 'text-[10px] md:text-xs tracking-[0.22em]',
    gap: 'gap-4',
    stack: false,
  },
  xl: {
    mark: 'h-24 w-auto max-w-[18rem] md:h-28 md:max-w-[20rem] lg:h-32 lg:max-w-[22rem]',
    name: 'text-2xl md:text-4xl font-bold',
    tagline: 'text-[10px] md:text-xs tracking-[0.22em]',
    gap: 'gap-4 md:gap-5',
    stack: false,
  },
  header: {
    mark: 'h-12 w-auto max-w-[9.5rem] sm:h-14 sm:max-w-[11rem] md:h-24 md:max-w-[18rem] lg:h-28 lg:max-w-[22rem]',
    name: 'text-xl md:text-4xl font-bold',
    tagline: 'text-[9px] md:text-xs tracking-[0.18em]',
    gap: 'gap-3 md:gap-5',
    stack: false,
  },
}

function MarkFallback({ className, surface }: { className: string; surface: RialBrandSurface }) {
  return (
    <div
      className={classNames(
        className,
        'flex items-center justify-center rounded-xl font-display font-bold',
        surface === 'dark'
          ? 'bg-rial-navy-light text-rial-gold ring-1 ring-rial-gold/40'
          : 'bg-gradient-to-br from-rial-navy via-rial-navy-light to-rial-navy text-rial-gold ring-2 ring-rial-gold/50 shadow-lg'
      )}
      aria-hidden
    >
      R
    </div>
  )
}

function BrandMark({
  className,
  presentation,
  onError,
}: {
  className: string
  presentation: LogoPresentation
  onError: () => void
}) {
  const img = (
    <img
      src={LOGO_SRC}
      alt="RIAL Real Estate AI"
      className={classNames(className, 'shrink-0 object-contain object-center')}
      onError={onError}
    />
  )

  if (presentation === 'sidebarDeck') {
    return (
      <div className="w-full border-b border-rial-gold/30 bg-gradient-to-b from-rial-cream via-rial-gold-soft/50 to-rial-navy-light px-2 py-3">
        <div className="flex items-center justify-center">{img}</div>
      </div>
    )
  }

  if (presentation === 'lightBadge') {
    return (
      <div
        className={classNames(
          'flex items-center justify-center rounded-xl bg-white p-2',
          'shadow-md ring-1 ring-rial-gold/50 ring-offset-1 ring-offset-rial-navy'
        )}
      >
        {img}
      </div>
    )
  }

  return img
}

export function RialBrand({
  name,
  tagline,
  size = 'md',
  showTagline = true,
  /** Si false, solo muestra el PNG (incluye nombre y tagline en la imagen) */
  showLabel = false,
  surface = 'light',
  logoPresentation = 'plain',
  className,
  onClick,
  clickLabel,
}: {
  name: string
  tagline?: string
  size?: RialBrandSize
  showTagline?: boolean
  showLabel?: boolean
  /** Fondo claro (header) u oscuro (sidebar) — ajusta color del texto si showLabel */
  surface?: RialBrandSurface
  /** Sidebar: sidebarDeck (franja integrada en el rail) */
  logoPresentation?: LogoPresentation
  className?: string
  /** Si se define, el logo actúa como botón (p. ej. volver al inicio). */
  onClick?: () => void
  clickLabel?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const cfg = sizeConfig[size]
  const onDark = surface === 'dark'
  const showText = showLabel || imgFailed

  const isSidebarDeck = logoPresentation === 'sidebarDeck'

  const inner = (
    <div
      className={classNames(
        isSidebarDeck ? 'block w-full' : 'flex min-w-0',
        !isSidebarDeck && showText && cfg.stack ? 'flex-col items-center text-center' : !isSidebarDeck ? 'flex-row items-center' : '',
        !isSidebarDeck && showText ? cfg.gap : '',
        !onClick ? className : undefined
      )}
    >
      {!imgFailed ? (
        <BrandMark
          className={cfg.mark}
          presentation={logoPresentation}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <MarkFallback className={cfg.mark} surface={surface} />
      )}
      {showText && (
        <div className={classNames('min-w-0', cfg.stack && 'w-full px-0.5')}>
          <span
            className={classNames(
              cfg.name,
              'block tracking-tight',
              onDark
                ? 'text-rial-cream'
                : classNames(
                    'leading-none',
                    'bg-gradient-to-r from-rial-navy via-rial-navy-light to-rial-gold bg-clip-text text-transparent',
                    'dark:from-rial-cream dark:via-rial-gold dark:to-rial-cream'
                  )
            )}
          >
            {name}
          </span>
          {showTagline && tagline && (
            <p
              className={classNames(
                cfg.tagline,
                'mt-1 font-semibold uppercase',
                onDark ? 'text-rial-cream/65' : 'text-rial-muted dark:text-slate-400',
                cfg.stack && 'leading-tight'
              )}
            >
              {tagline}
            </p>
          )}
        </div>
      )}
    </div>
  )

  if (!onClick) return inner

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={clickLabel ?? name}
      className={classNames(
        'min-w-0 rounded-lg text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rial-gold focus-visible:ring-offset-2',
        className
      )}
    >
      {inner}
    </button>
  )
}
