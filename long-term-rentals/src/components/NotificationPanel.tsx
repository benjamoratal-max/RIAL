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
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function markAllAsRead() {
    try {
      await api('/api/notifications/read-all', { method: 'PATCH', token })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function deleteNotification(id: number) {
    try {
      await api(`/api/notifications/${id}`, { method: 'DELETE', token })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (!user) return null

  return (
    <motion.div 
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-lg text-gray-900 dark:text-white">{t('notifications.title')}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllAsRead} icon={<Check className="w-4 h-4" />}>
              {t('notifications.markAllRead')}
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
              {t('notifications.close')}
            </Button>
          </div>
        </div>

        <motion.div 
          className="overflow-y-auto max-h-[60vh] space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400">{t('notifications.loading')}</div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">{t('notifications.none')}</div>
          ) : (
            notifications.map((notification) => (
              <motion.div 
                key={notification.id} 
                className={classNames(
                  'p-3 rounded-xl border',
                  notification.read ? 'bg-gray-50 dark:bg-gray-700' : 'border-rial-cream-dark/50 bg-rial-cream-dark/40 dark:border-slate-600 dark:bg-slate-800/90'
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: notification.id * 0.05 }}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{notification.title}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{notification.message}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!notification.read && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        icon={<Check className="w-4 h-4" />}
                      >
                        {t('notifications.read')}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                      icon={<X className="w-4 h-4" />}
                    >
                      {t('notifications.delete')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
