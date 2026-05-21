import { useState } from 'react'
import { classNames } from './UI'

type RialBrandSize = 'sm' | 'md' | 'lg' | 'xl'
type RialBrandSurface = 'light' | 'dark'

const sizeConfig: Record<
  RialBrandSize,
  { mark: string; name: string; tagline: string; gap: string; stack: boolean }
> = {
  sm: {
    mark: 'h-11 w-11',
    name: 'text-[11px] font-bold leading-tight',
    tagline: 'text-[9px] tracking-[0.14em]',
    gap: 'gap-1.5',
    stack: true,
  },
  md: {
    mark: 'h-14 w-14',
    name: 'text-xl font-bold',
    tagline: 'text-[10px] tracking-[0.18em]',
    gap: 'gap-3',
    stack: false,
  },
  lg: {
    mark: 'h-[4.5rem] w-[4.5rem] md:h-20 md:w-20',
    name: 'text-2xl md:text-3xl font-bold',
    tagline: 'text-[10px] md:text-xs tracking-[0.22em]',
    gap: 'gap-4',
    stack: false,
  },
  xl: {
    mark: 'h-20 w-20 md:h-24 md:w-24 lg:h-28 lg:w-28',
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
  surface,
  onError,
}: {
  className: string
  surface: RialBrandSurface
  onError: () => void
}) {
  return (
    <img
      src="/rial-logo.png"
      alt=""
      className={classNames(
        className,
        'shrink-0 object-contain bg-transparent p-0',
        surface === 'dark'
          ? 'mix-blend-screen brightness-110 contrast-[1.02]'
          : 'mix-blend-multiply'
      )}
      onError={onError}
    />
  )
}

export function RialBrand({
  name,
  tagline,
  size = 'md',
  showTagline = true,
  surface = 'light',
  className,
}: {
  name: string
  tagline?: string
  size?: RialBrandSize
  showTagline?: boolean
  /** Fondo claro (header) u oscuro (sidebar) — ajusta texto y mezcla del logo */
  surface?: RialBrandSurface
  className?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const cfg = sizeConfig[size]
  const onDark = surface === 'dark'

  return (
    <div
      className={classNames(
        'flex min-w-0',
        cfg.stack ? 'flex-col items-center text-center' : 'flex-row items-center',
        cfg.gap,
        className
      )}
    >
      {!imgFailed ? (
        <BrandMark
          className={cfg.mark}
          surface={surface}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <MarkFallback className={cfg.mark} surface={surface} />
      )}
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
    </div>
  )
}
