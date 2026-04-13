import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ShieldAlert, Check, X, Loader2, Users } from 'lucide-react'
import { Button } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'

interface AdminRequest {
  id: number
  email: string
  name?: string
  reason?: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

interface AdminRequestsPanelProps {
  token: string
  onClose: () => void
  onApproved?: () => void
}

export function AdminRequestsPanel({ token, onClose, onApproved }: AdminRequestsPanelProps) {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)

  useEffect(() => {
    loadRequests()
  }, [token])

  async function loadRequests() {
    setLoading(true)
    try {
      const data = await api('/api/admin/requests', { token })
      setRequests(Array.isArray(data?.requests) ? data.requests : data ?? [])
    } catch (err) {
      console.error('Error loading admin requests:', err)
      setRequests([])
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: number) {
    setActionId(id)
    try {
      await api(`/api/admin/requests/${id}/approve`, { method: 'POST', token })
      toast.success(t('adminRequests.approved'))
      await loadRequests()
      onApproved?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(id: number) {
    setActionId(id)
    try {
      await api(`/api/admin/requests/${id}/reject`, { method: 'POST', token })
      toast.success(t('adminRequests.rejected'))
      await loadRequests()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setActionId(null)
    }
  }

  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('adminRequests.title')}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">{t('adminRequests.none')}</p>
          </div>
        ) : (
          <ul className="space-y-3 overflow-y-auto flex-1 pr-1">
            {pending.map((req) => (
              <li
                key={req.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex flex-col gap-2">
                  <div className="font-medium text-gray-900 dark:text-white">{req.email}</div>
                  {req.name && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">{req.name}</div>
                  )}
                  {req.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">&quot;{req.reason}&quot;</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      icon={actionId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      disabled={actionId !== null}
                      onClick={() => handleApprove(req.id)}
                    >
                      {t('adminRequests.approve')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      icon={actionId === req.id ? undefined : <X className="w-4 h-4" />}
                      disabled={actionId !== null}
                      onClick={() => handleReject(req.id)}
                    >
                      {t('adminRequests.reject')}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}
