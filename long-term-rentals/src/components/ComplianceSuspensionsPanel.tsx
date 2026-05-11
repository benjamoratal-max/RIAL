import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Ban, CheckCircle2, X } from 'lucide-react'
import { Button, LoadingSpinner } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

interface ComplianceSuspensionsPanelProps {
  token: string
  onClose: () => void
}

type SuspensionItem = {
  id: number
  userId?: number | null
  propertyId?: number | null
  reason: string
  status: string
  createdAt: string
  liftedAt?: string | null
  user?: { id: number; name: string | null; email: string | null; role: string } | null
  property?: { id: number; title: string | null; location: string | null } | null
}

export function ComplianceSuspensionsPanel({ token, onClose }: ComplianceSuspensionsPanelProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<SuspensionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [liftingId, setLiftingId] = useState<number | null>(null)

  useEffect(() => {
    if (token) {
      loadSuspensions()
    }
  }, [token])

  async function loadSuspensions() {
    setLoading(true)
    try {
      const data = await api('/api/compliance/suspensions', { token })
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) {
      toast.error(getErrorMessage(err))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function liftSuspension(id: number) {
    setLiftingId(id)
    try {
      await api(`/api/compliance/suspensions/${id}/lift`, {
        method: 'POST',
        token,
      })
      toast.success(t('compliance.suspensionLifted'))
      await loadSuspensions()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLiftingId(null)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('compliance.suspensionsTitle')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.suspensionsSubtitle')}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
            {t('common.close')}
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" text={t('app.loadingSuspensions')} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
                {t('compliance.noActiveSuspensions')}
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-rose-500 dark:text-rose-300" />
                      <div className="truncate">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {t('compliance.suspensionLabel')} #{item.id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      {item.user && (
                        <span>
                          {t('compliance.userLabel')}: {item.user.name || t('compliance.noName')} · {item.user.email || t('compliance.noEmail')} · {item.user.role}
                        </span>
                      )}
                      {item.property && (
                        <span>
                          {t('compliance.propertyLabel')}: #{item.property.id} · {item.property.title || t('profile.untitledProperty')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      {t('compliance.reasonLabel')}: {item.reason}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={liftingId === item.id}
                      onClick={() => liftSuspension(item.id)}
                      icon={<CheckCircle2 className="w-3 h-3" />}
                    >
                      {liftingId === item.id ? t('compliance.lifting') : t('compliance.liftSuspension')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

