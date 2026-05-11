import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Users, Flame, CheckCircle2, Clock, Calendar, X, ArrowRight, FileText, Sparkles } from 'lucide-react'
import { Button, LoadingSpinner, classNames } from './UI'
import { LeadApplicationReadiness } from './LeadApplicationReadiness'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'

interface BrokerLeadsDashboardProps {
  token: string
  user: any
  onClose: () => void
}

interface Lead {
  id: number
  renter?: { id: number; name: string; email: string } | null
  property?: { id: number; title: string; location: string | null } | null
  stage: string
  urgency?: 'low' | 'medium' | 'high' | null
  intentScore?: number | null
  probability?: number | null
  nextStep?: string | null
  nextStepDueAt?: string | null
  createdAt: string
  lastInteractionAt?: string | null
}

type PipelineResponse = {
  stages: Record<string, Lead[]>
}

const STAGE_ORDER: string[] = [
  'new_inquiry',
  'contacted',
  'pre_qualified',
  'showing_proposed',
  'showing_scheduled',
  'showing_completed',
  'interested',
  'documents_requested',
  'documents_received',
  'screening_in_progress',
  'broker_review',
  'application_ready',
  'negotiation',
  'lease_ready',
  'signed',
  'lost',
]

function getStageLabel(stage: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    new_inquiry: t('brokerLeads.stages.new_inquiry'),
    contacted: t('brokerLeads.stages.contacted'),
    pre_qualified: t('brokerLeads.stages.pre_qualified'),
    showing_proposed: t('brokerLeads.stages.showing_proposed'),
    showing_scheduled: t('brokerLeads.stages.showing_scheduled'),
    showing_completed: t('brokerLeads.stages.showing_completed'),
    interested: t('brokerLeads.stages.interested'),
    documents_requested: t('brokerLeads.stages.documents_requested'),
    documents_received: t('brokerLeads.stages.documents_received'),
    screening_in_progress: t('brokerLeads.stages.screening_in_progress'),
    broker_review: t('brokerLeads.stages.broker_review'),
    application_ready: t('brokerLeads.stages.application_ready'),
    negotiation: t('brokerLeads.stages.negotiation'),
    lease_ready: t('brokerLeads.stages.lease_ready'),
    signed: t('brokerLeads.stages.signed'),
    lost: t('brokerLeads.stages.lost'),
  }
  return map[stage] || stage
}

export function BrokerLeadsDashboard({ token, user, onClose }: BrokerLeadsDashboardProps) {
  const { t } = useTranslation()
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingLeadId, setUpdatingLeadId] = useState<number | null>(null)
  const [selectedLeadForDocs, setSelectedLeadForDocs] = useState<Lead | null>(null)
  const [aiSummaries, setAiSummaries] = useState<Record<number, string>>({})
  const [aiLoadingLeadId, setAiLoadingLeadId] = useState<number | null>(null)
  const [pipelineSummary, setPipelineSummary] = useState<string | null>(null)
  const [loadingPipelineSummary, setLoadingPipelineSummary] = useState(false)

  const isBroker = user && (user.role === 'broker' || user.role === 'broker_admin')

  useEffect(() => {
    if (token && isBroker) {
      loadPipeline()
    }
  }, [token, isBroker])

  async function loadPipeline() {
    setLoading(true)
    try {
      const data = await api('/api/leads/pipeline', { token })
      setPipeline(data)
    } catch (err) {
      toast.error(getErrorMessage(err))
      setPipeline({ stages: {} })
    } finally {
      setLoading(false)
    }
  }

  async function loadPipelineSummary() {
    if (!token) return
    setLoadingPipelineSummary(true)
    try {
      const res = await api('/api/ai/broker/pipeline-summary', {
        method: 'GET',
        token,
      })
      if (res?.summary) {
        setPipelineSummary(res.summary as string)
      } else if (res?.error) {
        toast.error(typeof res.error === 'string' ? res.error : t('brokerLeads.errors.pipelineSummary'))
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoadingPipelineSummary(false)
    }
  }

  async function loadAiSummary(lead: Lead) {
    if (!token) return
    setAiLoadingLeadId(lead.id)
    try {
      const res = await api('/api/ai/broker/lead-summary', {
        method: 'POST',
        token,
        body: { leadId: lead.id },
      })
      if (res?.summary) {
        setAiSummaries((prev) => ({ ...prev, [lead.id]: res.summary as string }))
      } else if (res?.error) {
        toast.error(typeof res.error === 'string' ? res.error : t('brokerLeads.errors.leadSummary'))
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setAiLoadingLeadId(null)
    }
  }

  async function moveLead(lead: Lead, direction: 'forward' | 'backward') {
    const currentIndex = STAGE_ORDER.indexOf(lead.stage || 'new_inquiry')
    if (currentIndex === -1) return

    const nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1
    if (nextIndex < 0 || nextIndex >= STAGE_ORDER.length) return

    const nextStage = STAGE_ORDER[nextIndex]
    setUpdatingLeadId(lead.id)
    try {
      await api(`/api/leads/${lead.id}/stage`, {
        method: 'PATCH',
        token,
        body: { stage: nextStage },
      })
      await loadPipeline()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUpdatingLeadId(null)
    }
  }

  if (!isBroker) return null

  if (loading) {
    return (
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <LoadingSpinner size="lg" text={t('brokerLeads.loadingLeads')} />
        </motion.div>
      </motion.div>
    )
  }

  const stages = pipeline?.stages || {}
  const allLeads: Lead[] = Object.values(stages).flat()
  const totalLeads = allLeads.length
  const hotLeads = allLeads.filter((l) => l.urgency === 'high').length

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('brokerLeads.title')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('brokerLeads.subtitle')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
            {t('common.close')}
          </Button>
        </div>

        {/* Resumen superior + IA Capa 2 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border border-rial-cream-dark/40 bg-rial-cream-dark/35 p-3 dark:border-slate-600 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center justify-between">
              <Users className="h-4 w-4 text-rial-navy dark:text-rial-gold" />
              <span className="text-lg font-semibold font-serif text-rial-navy dark:text-rial-cream">{totalLeads}</span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{t('brokerLeads.totalLeads')}</div>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20">
            <div className="flex items-center justify-between mb-1">
              <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span className="text-lg font-semibold text-rose-700 dark:text-rose-300">{hotLeads}</span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{t('brokerLeads.hotLeads')}</div>
          </div>
          <div className="md:col-span-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{t('brokerLeads.aiSummaryLabel')}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={loadPipelineSummary}
                disabled={loadingPipelineSummary}
              >
                {loadingPipelineSummary ? t('brokerLeads.generating') : t('brokerLeads.viewAiSummary')}
              </Button>
            </div>
            {pipelineSummary && (
              <div className="text-[11px] text-gray-700 dark:text-gray-200 whitespace-pre-line max-h-28 overflow-y-auto">
                {pipelineSummary}
              </div>
            )}
          </div>
        </div>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex items-start gap-4 min-h-[280px]">
            {STAGE_ORDER.map((stageKey) => {
              const columnLeads = stages[stageKey] || []
              if (!columnLeads.length && !['new_inquiry', 'contacted', 'pre_qualified', 'signed', 'lost'].includes(stageKey)) {
                // Ocultar columnas completamente vacías salvo algunas principales
                return null
              }
              return (
                <div
                  key={stageKey}
                  className="flex-1 min-w-[220px] max-w-[260px] bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-3 border border-gray-200/60 dark:border-gray-700/60"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                      {getStageLabel(stageKey, t)}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{columnLeads.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
                    {columnLeads.length === 0 ? (
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 italic py-4 text-center">
                        {t('brokerLeads.noLeadsInStage')}
                      </div>
                    ) : (
                      columnLeads.map((lead) => (
                        <motion.div
                          key={lead.id}
                          className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {lead.renter?.name || t('brokerLeads.unnamedLead')}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                {lead.property?.title || t('brokerLeads.noPropertyAssigned')}
                              </div>
                            </div>
                            {lead.urgency && (
                              <span
                                className={classNames(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                  lead.urgency === 'high'
                                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200'
                                    : lead.urgency === 'medium'
                                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200'
                                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200'
                                )}
                              >
                                {lead.urgency === 'high' && <Flame className="w-3 h-3" />}
                                {lead.urgency === 'medium' && <Clock className="w-3 h-3" />}
                                {lead.urgency === 'low' && <CheckCircle2 className="w-3 h-3" />}
                                {lead.urgency}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                            {lead.intentScore != null && (
                              <div>
                                {t('brokerLeads.intentScore')}: <strong>{lead.intentScore}</strong>/100
                              </div>
                            )}
                            {lead.probability != null && (
                              <div>
                                Prob. cierre: <strong>{lead.probability}</strong>%
                              </div>
                            )}
                            {lead.nextStep && (
                              <div className="truncate">
                                {t('brokerLeads.nextStep')}: <span className="font-medium">{lead.nextStep}</span>
                              </div>
                            )}
                            {lead.nextStepDueAt && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(lead.nextStepDueAt).toLocaleString()}
                              </div>
                            )}
                            {aiSummaries[lead.id] && (
                              <div className="mt-1 rounded-lg border border-rial-cream-dark/30 bg-rial-cream-dark/30 p-2 text-[11px] text-gray-700 whitespace-pre-line dark:border-slate-600 dark:bg-slate-800/60 dark:text-gray-200">
                                {aiSummaries[lead.id]}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => loadAiSummary(lead)}
                              disabled={aiLoadingLeadId === lead.id}
                              icon={<Sparkles className="w-3 h-3" />}
                            >
                              {aiLoadingLeadId === lead.id ? t('brokerLeads.aiLoadingShort') : t('brokerLeads.aiSummaryShort')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedLeadForDocs(lead)}
                              icon={<FileText className="w-3 h-3" />}
                            >
                              Docs
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingLeadId === lead.id}
                              onClick={() => moveLead(lead, 'forward')}
                              icon={<ArrowRight className="w-3 h-3" />}
                            >
                              {updatingLeadId === lead.id ? '...' : t('brokerLeads.advance')}
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {selectedLeadForDocs && (
          <LeadApplicationReadiness
            token={token}
            leadId={selectedLeadForDocs.id}
            role="broker"
            onClose={() => setSelectedLeadForDocs(null)}
          />
        )}
      </motion.div>
    </motion.div>
  )
}

