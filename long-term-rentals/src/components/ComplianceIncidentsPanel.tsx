import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flag, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { Button, LoadingSpinner, classNames } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

interface ComplianceIncidentsPanelProps {
  token: string
  onClose: () => void
}

type Incident = {
  id: number
  type: string
  severity: string
  status: string
  propertyId?: number | null
  leadId?: number | null
  userId?: number | null
  notes?: string | null
  createdAt: string
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
  critical: 'bg-rose-200 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
}

export function ComplianceIncidentsPanel({ token, onClose }: ComplianceIncidentsPanelProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      loadIncidents()
    }
  }, [token])

  async function loadIncidents() {
    setLoading(true)
    try {
      const data = await api('/api/compliance/incidents', { token })
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('compliance.incidentsTitle')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.incidentsSubtitle')}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
            {t('common.close')}
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" text={t('app.loadingIncidents')} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
                {t('compliance.noOpenIncidents')}
              </div>
            ) : (
              items.map((incident) => (
                <div
                  key={incident.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-300" />
                      <div className="truncate">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {incident.type} · #{incident.id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(incident.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      {incident.propertyId && <span>{t('compliance.propertyLabel')}: #{incident.propertyId}</span>}
                      {incident.leadId && <span>{t('compliance.leadLabel')}: #{incident.leadId}</span>}
                      {incident.userId && <span>{t('compliance.userLabel')}: #{incident.userId}</span>}
                      <span
                        className={classNames(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold',
                          SEVERITY_COLORS[incident.severity] || 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
                        )}
                      >
                        {incident.severity}
                      </span>
                      <span
                        className={classNames(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold',
                          incident.status === 'open'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                            : incident.status === 'in_review'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
                        )}
                      >
                        {incident.status}
                      </span>
                    </div>
                    {incident.notes && (
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                        {incident.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast(t('compliance.incidentActionsPending'))
                      }}
                    >
                      {t('compliance.manage')}
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

