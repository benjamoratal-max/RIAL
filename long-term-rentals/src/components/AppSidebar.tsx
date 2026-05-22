import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  LayoutGrid,
  Map as MapIcon,
  MessageCircle,
  Bell,
  User,
  Settings,
  GitCompare,
  Sun,
  Moon,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Shield,
  Users,
  Heart,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { classNames } from './UI'
import { RialBrand } from './RialBrand'

type AppSidebarProps = {
  user: any
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  showMap: boolean
  onToggleMap: () => void
  onScrollHome: () => void
  notificationCount: number
  messageCount: number
  onOpenNotifications: () => void
  onOpenChat: () => void
  onOpenPayments: () => void
  onOpenAlerts: () => void
  onOpenComparison: () => void
  onOpenProfile: () => void
  onOpenOwnerLeads: () => void
  onOpenBrokerLeads: () => void
  onOpenAnalytics: () => void
  onOpenAdminRequests: () => void
  favoritesSlot: React.ReactNode
}

function RailButton({
  active,
  onClick,
  title,
  children,
  badge,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  badge?: number
}) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={classNames(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-rial-gold focus-visible:ring-offset-2 focus-visible:ring-offset-rial-navy',
        active
          ? 'bg-rial-gold text-rial-navy shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]'
          : 'text-rial-cream/75 hover:bg-rial-accent/20 hover:text-rial-gold'
      )}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </motion.button>
  )
}

export function AppSidebar({
  user,
  darkMode,
  setDarkMode,
  showMap,
  onToggleMap,
  onScrollHome,
  notificationCount,
  messageCount,
  onOpenNotifications,
  onOpenChat,
  onOpenPayments,
  onOpenAlerts,
  onOpenComparison,
  onOpenProfile,
  onOpenOwnerLeads,
  onOpenBrokerLeads,
  onOpenAnalytics,
  onOpenAdminRequests,
  favoritesSlot,
}: AppSidebarProps) {
  const { t } = useTranslation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreOpen])

  const loginFirst = () => toast.error(t('app.sidebar.loginRequired'))

  const showLeadsMore =
    user &&
    (user.role === 'owner' ||
      user.role === 'admin' ||
      user.role === 'broker' ||
      user.role === 'broker_admin')

  const showAnalyticsMore =
    user &&
    (user.role === 'owner' ||
      user.role === 'admin' ||
      user.role === 'broker' ||
      user.role === 'broker_admin')

  return (
    <aside
      className="sticky top-0 z-30 flex h-screen w-[5.5rem] shrink-0 flex-col border-r border-rial-gold/25 bg-gradient-to-b from-rial-navy via-[#0f2138] to-rial-navy py-4 shadow-[inset_3px_0_0_0_rgba(185,226,255,0.35)]"
      aria-label={t('app.sidebar.mainNav')}
    >
      <div className="flex flex-col items-center px-1.5 pb-2">
        <RialBrand
          name={t('app.name')}
          size="sm"
          surface="dark"
          logoPresentation="lightBadge"
          showLabel={false}
          showTagline={false}
          className="pointer-events-none w-full select-none justify-center"
        />
      </div>

      <nav className="mt-6 flex flex-1 flex-col items-center gap-2 px-2" role="navigation">
        <RailButton
          active={!showMap}
          onClick={onScrollHome}
          title={t('app.sidebar.explore')}
        >
          <LayoutGrid className="h-5 w-5" strokeWidth={1.75} />
        </RailButton>

        <RailButton active={showMap} onClick={onToggleMap} title={t('app.sidebar.map')}>
          <MapIcon className="h-5 w-5" strokeWidth={1.75} />
        </RailButton>

        {user ? (
          <div className="flex flex-col items-center">{favoritesSlot}</div>
        ) : (
          <RailButton onClick={loginFirst} title={t('app.sidebar.favorites')}>
            <Heart className="h-5 w-5 text-rial-cream/80" strokeWidth={1.75} />
          </RailButton>
        )}

        <RailButton
          onClick={user ? onOpenChat : loginFirst}
          title={t('app.sidebar.messages')}
          badge={user ? messageCount : undefined}
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
        </RailButton>

        <RailButton
          onClick={user ? onOpenNotifications : loginFirst}
          title={t('app.sidebar.notifications')}
          badge={user ? notificationCount : undefined}
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
        </RailButton>

        <RailButton onClick={user ? onOpenProfile : loginFirst} title={t('app.sidebar.profile')}>
          <User className="h-5 w-5" strokeWidth={1.75} />
        </RailButton>
      </nav>

      <div className="relative mt-auto flex flex-col items-center gap-2 px-2 pb-2" ref={moreRef}>
        <RailButton onClick={() => setMoreOpen((o) => !o)} active={moreOpen} title={t('app.sidebar.more')}>
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </RailButton>

        <AnimatePresence>
          {moreOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-rial-cream-dark/40 bg-rial-cream py-1.5 text-rial-ink shadow-xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rial-cream-dark/50 dark:hover:bg-slate-800"
                onClick={() => {
                  onOpenComparison()
                  setMoreOpen(false)
                }}
              >
                <GitCompare className="h-4 w-4 shrink-0 opacity-70" />
                {t('app.sidebar.compare')}
              </button>
              {user && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rial-cream-dark/50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onOpenPayments()
                    setMoreOpen(false)
                  }}
                >
                  <CreditCard className="h-4 w-4 shrink-0 opacity-70" />
                  {t('app.sidebar.payments')}
                </button>
              )}
              {user && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rial-cream-dark/50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onOpenAlerts()
                    setMoreOpen(false)
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 opacity-70" />
                  {t('app.sidebar.alerts')}
                </button>
              )}
              {showAnalyticsMore && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rial-cream-dark/50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onOpenAnalytics()
                    setMoreOpen(false)
                  }}
                >
                  <BarChart3 className="h-4 w-4 shrink-0 opacity-70" />
                  {t('app.sidebar.analytics')}
                </button>
              )}
              {showLeadsMore && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rial-cream-dark/50 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (user.role === 'broker' || user.role === 'broker_admin') {
                      onOpenBrokerLeads()
                    } else {
                      onOpenOwnerLeads()
                    }
                    setMoreOpen(false)
                  }}
                >
                  <Users className="h-4 w-4 shrink-0 opacity-70" />
                  {user.role === 'broker' || user.role === 'broker_admin'
                    ? t('app.sidebar.brokerLeads')
                    : t('app.sidebar.ownerLeads')}
                </button>
              )}
              {user?.role === 'admin' && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rial-cream-dark/50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onOpenAdminRequests()
                    setMoreOpen(false)
                  }}
                >
                  <Shield className="h-4 w-4 shrink-0 opacity-70" />
                  {t('app.sidebar.admin')}
                </button>
              )}
              <div className="my-1 border-t border-rial-cream-dark/30 dark:border-slate-700" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rial-cream-dark/50 dark:hover:bg-slate-800"
                onClick={() => {
                  setDarkMode(!darkMode)
                  setMoreOpen(false)
                }}
              >
                {darkMode ? (
                  <Sun className="h-4 w-4 shrink-0 opacity-70" />
                ) : (
                  <Moon className="h-4 w-4 shrink-0 opacity-70" />
                )}
                {darkMode ? t('app.sidebar.themeLight') : t('app.sidebar.themeDark')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
