import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Users, AlertTriangle, CheckCircle, Clock, X, Shield } from 'lucide-react'
import { Button, classNames } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'

interface Lead {
  id: number
  userId: number
  propertyId: number
  status: string
  createdAt: string
  riskScore: number | null
  redFlags: string[]
  needsFollowUp: boolean
  priorityScore: number
  user: { id: number; name: string; email: string; verified: boolean }
  property: { id: number; title: string }
}

interface OwnerLeadsPanelProps {
  token: string
  onClose: () => void
}

export function OwnerLeadsPanel({ token, onClose }: OwnerLeadsPanelProps) {
  const { t } = useTranslation()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<number | null>(null)

  useEffect(() => {
    loadLeads()
  }, [token])

  async function loadLeads() {
    setLoading(true)
    try {
      const data = await api('/api/analytics/owner/leads', { token })
      setLeads(data.leads || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  async function markResponded(id: number) {
    setMarkingId(id)
    try {
      await api(`/api/leases/${id}/responded`, { method: 'PATCH', token })
      toast.success(t('ownerLeads.markedResponded'))
      await loadLeads()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setMarkingId(null)
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
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-rial-navy dark:text-rial-gold" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ownerLeads.title')}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />} />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('app.loadingProcess')}</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('ownerLeads.noLeads')}</div>
        ) : (
          <ul className="overflow-y-auto flex-1 p-4 space-y-4">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className={classNames(
                  'p-4 rounded-xl border',
                  lead.needsFollowUp
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{lead.user.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{lead.user.email}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {lead.property.title} · {new Date(lead.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.needsFollowUp && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                        <Clock className="w-3 h-3" />
                        {t('ownerLeads.needsFollowUp')}
                      </span>
                    )}
                    <span
                      className={classNames(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        lead.status === 'approved'
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                          : lead.status === 'rejected'
                            ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      )}
                    >
                      {lead.status === 'pending' ? t('ownerLeads.pending') : lead.status === 'approved' ? t('ownerLeads.approved') : t('ownerLeads.rejected')}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {lead.riskScore != null && (
                    <span
                      className={classNames(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        lead.riskScore >= 50 ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200' : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                      )}
                    >
                      <Shield className="w-3 h-3" />
                      {t('ownerLeads.riskScore')}: {lead.riskScore}/100
                    </span>
                  )}
                  {!lead.user.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200">
                      {t('ownerLeads.notVerified')}
                    </span>
                  )}
                </div>
                {lead.redFlags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {lead.redFlags.map((flag) => (
                      <span
                        key={flag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
                {lead.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={markingId !== null}
                      onClick={() => markResponded(lead.id)}
                      icon={markingId === lead.id ? undefined : <CheckCircle className="w-4 h-4" />}
                    >
                      {markingId === lead.id ? '...' : t('ownerLeads.markResponded')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}
