import React, { useState } from 'react'
import { classNames } from './UI'

type RialBrandSize = 'sm' | 'md' | 'lg'

const sizeConfig: Record<
  RialBrandSize,
  { mark: string; name: string; tagline: string; gap: string; stack: boolean }
> = {
  sm: {
    mark: 'h-10 w-10 text-lg',
    name: 'text-sm font-bold',
    tagline: 'text-[9px] tracking-[0.14em]',
    gap: 'gap-2',
    stack: true,
  },
  md: {
    mark: 'h-14 w-14 text-xl',
    name: 'text-xl font-bold',
    tagline: 'text-[10px] tracking-[0.18em]',
    gap: 'gap-3',
    stack: false,
  },
  lg: {
    mark: 'h-16 w-16 md:h-[4.5rem] md:w-[4.5rem] text-2xl md:text-3xl',
    name: 'text-2xl md:text-4xl font-bold',
    tagline: 'text-[10px] md:text-xs tracking-[0.22em]',
    gap: 'gap-4',
    stack: false,
  },
}

function MarkFallback({ className }: { className: string }) {
  return (
    <div
      className={classNames(
        className,
        'flex items-center justify-center rounded-2xl bg-gradient-to-br from-rial-navy via-rial-navy-light to-rial-navy',
        'font-display font-bold text-rial-gold shadow-lg ring-2 ring-rial-gold/50'
      )}
      aria-hidden
    >
      R
    </div>
  )
}

export function RialBrand({
  name,
  tagline,
  size = 'md',
  showTagline = true,
  className,
}: {
  name: string
  tagline?: string
  size?: RialBrandSize
  showTagline?: boolean
  className?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const cfg = sizeConfig[size]

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
        <img
          src="/rial-logo.png"
          alt=""
          className={classNames(
            cfg.mark,
            'shrink-0 rounded-2xl object-cover shadow-md ring-2 ring-rial-gold/45'
          )}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <MarkFallback className={cfg.mark} />
      )}
      <div className={classNames('min-w-0', cfg.stack && 'max-w-[72px]')}>
        <span
          className={classNames(
            cfg.name,
            'block leading-none tracking-tight',
            'bg-gradient-to-r from-rial-navy via-rial-navy-light to-rial-gold bg-clip-text text-transparent',
            'dark:from-rial-cream dark:via-rial-gold dark:to-rial-cream'
          )}
        >
          {name}
        </span>
        {showTagline && tagline && (
          <p
            className={classNames(
              cfg.tagline,
              'mt-1 font-semibold uppercase text-rial-muted dark:text-slate-400',
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
