import { useState } from 'react'
import { classNames } from './UI'

type RialBrandSize = 'sm' | 'md' | 'lg' | 'xl'
type RialBrandSurface = 'light' | 'dark'
/** plain = PNG transparente; lightBadge = tarjeta blanca (sidebar sobre navy) */
type LogoPresentation = 'plain' | 'lightBadge'

const LOGO_SRC = '/rial-logo.png?v=3'

const sizeConfig: Record<
  RialBrandSize,
  { mark: string; name: string; tagline: string; gap: string; stack: boolean }
> = {
  sm: {
    mark: 'h-[3.25rem] w-auto max-w-[5rem]',
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
}: {
  name: string
  tagline?: string
  size?: RialBrandSize
  showTagline?: boolean
  showLabel?: boolean
  /** Fondo claro (header) u oscuro (sidebar) — ajusta color del texto si showLabel */
  surface?: RialBrandSurface
  /** Sidebar: lightBadge (fondo blanco detrás del logo) */
  logoPresentation?: LogoPresentation
  className?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const cfg = sizeConfig[size]
  const onDark = surface === 'dark'
  const showText = showLabel || imgFailed

  return (
    <div
      className={classNames(
        'flex min-w-0',
        showText && cfg.stack ? 'flex-col items-center text-center' : 'flex-row items-center',
        showText ? cfg.gap : '',
        className
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
}
