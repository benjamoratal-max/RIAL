import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button, classNames } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'

export interface NotificationPanelProps {
  token: string | null
  user: any
  onClose: () => void
}

export function NotificationPanel({ token, user, onClose }: NotificationPanelProps) {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      loadNotifications()
    }
  }, [token])

  async function loadNotifications() {
    try {
      const data = await api('/api/notifications', { token })
      setNotifications(data)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id: number) {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'PATCH', token })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function markAllAsRead() {
    try {
      await api('/api/notifications/read-all', { method: 'PATCH', token })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function deleteNotification(id: number) {
    try {
      await api(`/api/notifications/${id}`, { method: 'DELETE', token })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (!user) return null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={classNames(
          'flex max-h-[min(92dvh,100%)] w-full min-w-0 flex-col overflow-hidden bg-white dark:bg-gray-800',
          'rounded-t-2xl shadow-xl sm:max-w-2xl sm:rounded-2xl',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]',
          'px-[max(1rem,env(safe-area-inset-left))] sm:px-6',
          'pr-[max(1rem,env(safe-area-inset-right))]'
        )}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-panel-title"
      >
        <div className="mb-3 flex min-w-0 flex-col gap-3 border-b border-gray-100 pb-3 dark:border-gray-700 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="notifications-panel-title"
            className="min-w-0 shrink text-base font-semibold text-gray-900 dark:text-white sm:text-lg"
          >
            {t('notifications.title')}
          </h2>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 justify-center !px-2 text-xs sm:!px-3 sm:text-sm"
              onClick={markAllAsRead}
              icon={<Check className="h-4 w-4 shrink-0" />}
            >
              <span className="truncate">{t('notifications.markAllRead')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 justify-center !px-2 text-xs sm:!px-3 sm:text-sm"
              onClick={onClose}
              icon={<X className="h-4 w-4 shrink-0" />}
            >
              <span className="truncate">{t('notifications.close')}</span>
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="space-y-2 pb-1">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('notifications.loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('notifications.none')}
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={classNames(
                    'rounded-xl border p-3',
                    notification.read
                      ? 'bg-gray-50 dark:bg-gray-700'
                      : 'border-rial-cream-dark/50 bg-rial-cream-dark/40 dark:border-slate-600 dark:bg-slate-800/90'
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-medium text-gray-900 dark:text-white">
                        {notification.title}
                      </div>
                      <div className="mt-0.5 break-words text-sm text-gray-600 dark:text-gray-400">
                        {notification.message}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(notification.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5 self-end sm:self-start">
                      {!notification.read && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="!px-2.5"
                          onClick={() => markAsRead(notification.id)}
                          icon={<Check className="h-4 w-4" />}
                          title={t('notifications.read')}
                          aria-label={t('notifications.read')}
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="!px-2.5"
                        onClick={() => deleteNotification(notification.id)}
                        icon={<X className="h-4 w-4" />}
                        title={t('notifications.delete')}
                        aria-label={t('notifications.delete')}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
