import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { FileText, CheckCircle2, XCircle, Clock, X } from 'lucide-react'
import { Button, LoadingSpinner, classNames } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'

interface LeadApplicationReadinessProps {
  token: string
  leadId: number
  role: 'broker' | 'renter' | 'admin'
  onClose: () => void
}

type LeadDocument = {
  id: number
  type: string
  status: 'pending' | 'received' | 'approved' | 'rejected'
  url?: string | null
}

const DOC_LABELS: Record<string, string> = {
  id: 'Documento de identidad',
  id_photo: 'Foto del documento (DNI) - solo documento',
  id_selfie: 'Selfie con el DNI en la mano',
  income_proof: 'Comprobante de ingresos',
  employment: 'Comprobante de empleo',
  reference: 'Referencias',
  pet: 'Documentación de mascotas',
  other: 'Otro documento',
}

export function LeadApplicationReadiness({ token, leadId, role, onClose }: LeadApplicationReadinessProps) {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState<LeadDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string>('')
  const [uploadingUrl, setUploadingUrl] = useState<string>('')

  const isBroker = role === 'broker' || role === 'admin'
  const isRenter = role === 'renter'

  useEffect(() => {
    loadDocuments()
  }, [leadId, token])

  async function loadDocuments() {
    setLoading(true)
    try {
      const data = await api(`/api/leads/${leadId}/documents`, { token })
      setDocuments(Array.isArray(data?.documents) ? data.documents : data.documents ?? [])
    } catch (err) {
      toast.error(getErrorMessage(err))
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  async function saveDocuments(nextDocs: LeadDocument[]) {
    if (!isBroker) return
    setSaving(true)
    try {
      await api(`/api/leads/${leadId}/documents`, {
        method: 'PATCH',
        token,
        body: {
          documents: nextDocs.map((d) => ({
            id: d.id,
            type: d.type,
            status: d.status,
            url: d.url,
          })),
        },
      })
      toast.success(t('applicationReadiness.checklistUpdated'))
      await loadDocuments()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const overallStatus = (() => {
    if (!documents.length) return 'not_ready'
    const hasPending = documents.some((d) => d.status === 'pending')
    const hasRejected = documents.some((d) => d.status === 'rejected')
    const allApproved = documents.every((d) => d.status === 'approved')
    if (allApproved) return 'ready'
    if (hasRejected || hasPending) return 'partial'
    return 'partial'
  })()

  const stats = (() => {
    const total = documents.length
    const approved = documents.filter((d) => d.status === 'approved').length
    const received = documents.filter((d) => d.status === 'received').length
    const pending = documents.filter((d) => d.status === 'pending').length
    const rejected = documents.filter((d) => d.status === 'rejected').length
    return { total, approved, received, pending, rejected }
  })()

  async function handleRenterUpload() {
    if (!isRenter) return
    if (!uploadingDocType || !uploadingUrl) {
      toast.error(t('applicationReadiness.selectTypeAndLink'))
      return
    }
    setSaving(true)
    try {
      await api(`/api/leads/${leadId}/documents/upload`, {
        method: 'POST',
        token,
        body: {
          type: uploadingDocType,
          url: uploadingUrl,
        },
      })
      toast.success(t('applicationReadiness.documentSentToBroker'))
      setUploadingUrl('')
      await loadDocuments()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const renderStatusBadge = () => {
    if (overallStatus === 'ready') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          {t('applicationReadiness.ready')}
        </span>
      )
    }
    if (overallStatus === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200">
          <Clock className="w-3 h-3" />
          {t('applicationReadiness.partiallyReady')}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200">
        <XCircle className="w-3 h-3" />
          {t('applicationReadiness.notReady')}
      </span>
    )
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
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('applicationReadiness.title')}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('applicationReadiness.subtitle')}
              </div>
              {!loading && documents.length > 0 && (
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 space-x-2">
                  <span>{t('applicationReadiness.total')}: {stats.total}</span>
                  <span>{t('applicationReadiness.approved')}: {stats.approved}</span>
                  <span>{t('applicationReadiness.received')}: {stats.received}</span>
                  <span>{t('applicationReadiness.pending')}: {stats.pending}</span>
                  {stats.rejected > 0 && <span>{t('applicationReadiness.rejected')}: {stats.rejected}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {renderStatusBadge()}
            <Button variant="ghost" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
              {t('common.close')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" text={t('applicationReadiness.loadingDocuments')} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {documents.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                {t('applicationReadiness.noDocuments')}
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-900 dark:text-white">
                        {DOC_LABELS[doc.type] || doc.type}
                      </div>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 dark:text-blue-400 underline truncate"
                        >
                          Ver archivo
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={classNames(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        doc.status === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200'
                          : doc.status === 'received'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                          : doc.status === 'rejected'
                          ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200'
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200'
                      )}
                    >
                      {doc.status}
                    </span>
                    {isBroker && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            saveDocuments(
                              documents.map((d) =>
                                d.id === doc.id ? { ...d, status: 'approved' } : d
                              )
                            )
                          }
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            saveDocuments(
                              documents.map((d) =>
                                d.id === doc.id ? { ...d, status: 'rejected' } : d
                              )
                            )
                          }
                        >
                          ×
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!loading && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 space-y-2">
            {isBroker && (
              <div>
                {t('applicationReadiness.expectedStatusPrefix')}
                <span className="font-medium text-emerald-600 dark:text-emerald-300"> {t('applicationReadiness.ready')}</span> =
                {t('applicationReadiness.expectedStatusSuffix')} <span className="font-medium">{t('applicationReadiness.approvedLower')}</span>.
              </div>
            )}
            {isRenter && (
              <div className="space-y-2">
                <div>
                  {t('applicationReadiness.renterInfoPrefix')}
                  <span className="font-medium"> {t('applicationReadiness.approvedLower')}</span> {t('applicationReadiness.renterInfoSuffix')}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <select
                    className="w-full sm:w-40 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                    value={uploadingDocType}
                    onChange={(e) => setUploadingDocType(e.target.value)}
                  >
                    <option value="">{t('applicationReadiness.documentType')}</option>
                    <option value="id_photo">{DOC_LABELS.id_photo}</option>
                    <option value="id_selfie">{DOC_LABELS.id_selfie}</option>
                    {/* Compatibilidad con leads ya creados con el tipo antiguo `id` */}
                    <option value="id">{DOC_LABELS.id}</option>
                    <option value="income_proof">{DOC_LABELS.income_proof}</option>
                    <option value="employment">{DOC_LABELS.employment}</option>
                    <option value="reference">{DOC_LABELS.reference}</option>
                    <option value="pet">{DOC_LABELS.pet}</option>
                    <option value="other">{DOC_LABELS.other}</option>
                  </select>
                  <input
                    type="url"
                    placeholder={t('applicationReadiness.fileLinkPlaceholder')}
                    className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-100"
                    value={uploadingUrl}
                    onChange={(e) => setUploadingUrl(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={handleRenterUpload}
                  >
                    {saving ? t('applicationReadiness.sending') : t('applicationReadiness.sendDocument')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

