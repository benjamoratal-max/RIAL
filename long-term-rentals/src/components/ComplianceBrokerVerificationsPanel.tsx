import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Check, X, Info, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

interface BrokerProfile {
  id: number
  fullName: string
  brokerageName?: string | null
  licenseNumber?: string | null
  licenseState?: string | null
  licenseType?: string | null
  licenseExpiration?: string | null
  verificationStatus: string
  createdAt: string
  user: {
    id: number
    name: string
    email: string
    role: string
  }
}

interface ComplianceBrokerVerificationsPanelProps {
  token: string
  onClose: () => void
}

export function ComplianceBrokerVerificationsPanel({ token, onClose }: ComplianceBrokerVerificationsPanelProps) {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<BrokerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)

  useEffect(() => {
    loadPending()
  }, [token])

  async function loadPending() {
    setLoading(true)
    try {
      const data = await api('/api/compliance/brokers/pending', { token })
      setProfiles(Array.isArray(data?.items) ? data.items : data.items ?? [])
    } catch (err) {
      toast.error(getErrorMessage(err))
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  async function decide(id: number, action: 'approve' | 'reject' | 'more_info' | 'suspend') {
    setActionId(id)
    try {
      await api(`/api/compliance/brokers/${id}/decision`, {
        method: 'POST',
        token,
        body: { action },
      })
      toast.success(
        action === 'approve'
          ? t('compliance.brokerApproved')
          : action === 'reject'
          ? t('compliance.brokerRejected')
          : action === 'more_info'
          ? t('compliance.moreInfoRequested')
          : t('compliance.brokerSuspended')
      )
      await loadPending()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setActionId(null)
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
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-rial-navy dark:text-rial-gold" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('compliance.brokerVerificationsTitle')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.brokerVerificationsSubtitle')}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>

        <div className="mb-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {t('compliance.brokerValidationHint')}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-rial-gold" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
            {t('compliance.noPendingBrokers')}
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto space-y-3 pr-1">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {p.fullName || p.user.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {p.user.email} · {p.user.role}
                    </div>
                    {p.brokerageName && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {t('compliance.brokerageLabel')}: {p.brokerageName}
                      </div>
                    )}
                    {p.licenseNumber && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {t('compliance.licenseLabel')}: {p.licenseNumber}{' '}
                        {p.licenseType && `(${p.licenseType})`}{' '}
                        {p.licenseState && `· ${p.licenseState}`}{' '}
                        {p.licenseExpiration &&
                          `· ${t('compliance.licenseExpiresShort')} ${new Date(p.licenseExpiration).toLocaleDateString()}`}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200">
                    {p.verificationStatus}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>
                    {t('compliance.createdLabel')}: {new Date(p.createdAt).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    {t('compliance.profileIdLabel')}: {p.id}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionId === p.id}
                    onClick={() => decide(p.id, 'more_info')}
                  >
                    {t('compliance.moreInfo')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionId === p.id}
                    onClick={() => decide(p.id, 'reject')}
                  >
                    {t('compliance.reject')}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={actionId === p.id}
                    icon={actionId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    onClick={() => decide(p.id, 'approve')}
                  >
                    {t('compliance.approve')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}

