import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ListChecks, X } from 'lucide-react'
import { Button, LoadingSpinner } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

interface ComplianceAuditLogsPanelProps {
  token: string
  onClose: () => void
}

type AuditLogItem = {
  id: number
  actorId?: number | null
  action: string
  entityType: string
  entityId?: number | null
  metadata?: string | null
  createdAt: string
}

export function ComplianceAuditLogsPanel({ token, onClose }: ComplianceAuditLogsPanelProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      loadLogs()
    }
  }, [token])

  async function loadLogs() {
    setLoading(true)
    try {
      const data = await api('/api/compliance/audit-logs', { token })
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) {
      toast.error(getErrorMessage(err))
      setItems([])
    } finally {
      setLoading(false)
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
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px=5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-rial-navy dark:text-rial-gold" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('compliance.auditLogsTitle')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.auditLogsSubtitle')}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
            {t('common.close')}
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" text={t('compliance.loadingAuditLogs')} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs text-gray-700 dark:text-gray-200">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
                {t('compliance.noRecentAuditLogs')}
              </div>
            ) : (
              items.map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70"
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="font-mono text-[11px]">
                      #{log.id} · {log.action}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    <span>{t('compliance.actorIdLabel')}: {log.actorId ?? t('compliance.system')}</span>
                    <span>
                      {t('compliance.entityLabel')}: {log.entityType}
                      {log.entityId != null && ` #${log.entityId}`}
                    </span>
                  </div>
                  {log.metadata && (
                    <pre className="mt-1 bg-black/5 dark:bg-black/20 rounded-lg p-2 overflow-x-auto text-[10px] text-gray-700 dark:text-gray-100">
                      {log.metadata}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

