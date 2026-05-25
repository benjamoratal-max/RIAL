import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutGrid,
  Map as MapIcon,
  Heart,
  MessageCircle,
  User,
} from 'lucide-react'
import { classNames } from './UI'

export type MobileNavTab = 'explore' | 'map' | 'favorites' | 'messages' | 'profile'

type MobileBottomNavProps = {
  user: any
  showMap: boolean
  activeTab: MobileNavTab
  messageCount: number
  notificationCount: number
  onExplore: () => void
  onToggleMap: () => void
  onFavorites: () => void
  onMessages: () => void
  onProfile: () => void
}

function NavItem({
  label,
  active,
  onClick,
  badge,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  badge?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={classNames(
        'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors',
        active ? 'text-rial-navy dark:text-rial-gold' : 'text-rial-muted dark:text-slate-400'
      )}
    >
      <span
        className={classNames(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
          active
            ? 'bg-rial-gold/35 text-rial-navy dark:bg-rial-accent/25 dark:text-rial-gold'
            : 'text-inherit'
        )}
      >
        {children}
      </span>
      <span className="max-w-full truncate text-[10px] font-medium leading-tight">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

export function MobileBottomNav({
  user,
  showMap,
  activeTab,
  messageCount,
  notificationCount,
  onExplore,
  onToggleMap,
  onFavorites,
  onMessages,
  onProfile,
}: MobileBottomNavProps) {
  const { t } = useTranslation()

  return (
    <nav
      className="rial-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-rial-gold/30 bg-white/95 shadow-[0_-8px_24px_-8px_rgba(11,22,35,0.12)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-950/95 md:hidden"
      aria-label={t('app.mobileNav.label')}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        <NavItem
          label={t('app.mobileNav.explore')}
          active={!showMap && activeTab === 'explore'}
          onClick={onExplore}
        >
          <LayoutGrid className="h-5 w-5" strokeWidth={1.75} />
        </NavItem>
        <NavItem
          label={t('app.mobileNav.map')}
          active={showMap}
          onClick={onToggleMap}
        >
          <MapIcon className="h-5 w-5" strokeWidth={1.75} />
        </NavItem>
        <NavItem
          label={t('app.mobileNav.favorites')}
          active={activeTab === 'favorites'}
          onClick={onFavorites}
        >
          <Heart className={classNames('h-5 w-5', user && 'fill-current')} strokeWidth={1.75} />
        </NavItem>
        <NavItem
          label={t('app.mobileNav.messages')}
          active={activeTab === 'messages'}
          onClick={onMessages}
          badge={user ? messageCount : undefined}
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
        </NavItem>
        {user ? (
          <NavItem
            label={t('app.mobileNav.profile')}
            active={activeTab === 'profile'}
            onClick={onProfile}
            badge={notificationCount}
          >
            <User className="h-5 w-5" strokeWidth={1.75} />
          </NavItem>
        ) : (
          <NavItem label={t('app.mobileNav.profile')} active={false} onClick={onProfile}>
            <User className="h-5 w-5" strokeWidth={1.75} />
          </NavItem>
        )}
      </div>
    </nav>
  )
}
