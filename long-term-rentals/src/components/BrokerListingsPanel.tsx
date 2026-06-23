import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Bell,
  BellOff,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Users,
  X,
} from 'lucide-react'
import { Button, classNames } from './UI'
import { api } from '../utils/api'
import { toast } from 'react-hot-toast'
import {
  disablePush,
  enablePush,
  getPushAvailability,
  type PushAvailability,
} from '../utils/webPush'

type ActiveReservation = {
  id: number
  status: string
  tenantName: string | null
  durationMonths: number
  startDate: string | null
  totalAmount: number
  depositAmount: number
  balanceAmount: number
  depositPaidAt: string | null
  balanceDueAt: string | null
  balancePaidAt: string | null
}

type BrokerListing = {
  id: number
  title: string
  location: string
  price: number
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  area: number | null
  available: boolean
  verified: boolean
  createdAt: string
  image: string | null
  rentalStatus: 'available' | 'reserved' | 'rented'
  views: number
  leadsCount: number
  requestsCount: number
  reservationsCount: number
  activeReservation: ActiveReservation | null
}

type MineResponse = {
  summary: { total: number; available: number; reserved: number; rented: number }
  properties: BrokerListing[]
}

interface BrokerListingsPanelProps {
  token: string | null
  onClose: () => void
}

function fmtMoney(n: number) {
  return `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function BrokerListingsPanel({ token, onClose }: BrokerListingsPanelProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<MineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [push, setPush] = useState<PushAvailability | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = (await api('/api/properties/mine', { token })) as MineResponse
      setData(res)
    } catch (e: any) {
      toast.error(e?.message || t('brokerListings.loadError'))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    getPushAvailability().then(setPush).catch(() => setPush(null))
  }, [])

  const togglePush = async () => {
    if (!token) return
    setPushBusy(true)
    try {
      if (push?.supported && push.subscribed) {
        await disablePush(token)
        toast.success(t('brokerListings.pushDisabled'))
      } else {
        await enablePush(token)
        toast.success(t('brokerListings.pushEnabled'))
      }
      setPush(await getPushAvailability())
    } catch (e: any) {
      toast.error(e?.message || t('brokerListings.pushError'))
    } finally {
      setPushBusy(false)
    }
  }

  const statusBadge = (status: BrokerListing['rentalStatus']) => {
    const map = {
      available: { label: t('brokerListings.statusAvailable'), cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
      reserved: { label: t('brokerListings.statusReserved'), cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
      rented: { label: t('brokerListings.statusRented'), cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
    } as const
    const s = map[status]
    return <span className={classNames('text-xs px-2.5 py-1 rounded-full font-medium', s.cls)}>{s.label}</span>
  }

  const pushButton = () => {
    if (push && !push.supported) {
      return (
        <span className="text-xs text-gray-400" title={push.reason}>
          {push.reason === 'no-sw' ? t('brokerListings.pushNeedsBuild') : t('brokerListings.pushUnsupported')}
        </span>
      )
    }
    const subscribed = push?.supported && push.subscribed
    return (
      <Button
        variant="outline"
        onClick={togglePush}
        disabled={pushBusy}
        icon={pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : subscribed ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      >
        {subscribed ? t('brokerListings.disableNotifications') : t('brokerListings.enableNotifications')}
      </Button>
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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4 gap-3">
          <div>
            <div className="font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-rial-gold" />
              {t('brokerListings.title')}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('brokerListings.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pushButton()}
            <Button variant="outline" onClick={load} icon={<RefreshCw className="w-4 h-4" />}>
              {t('brokerListings.refresh')}
            </Button>
            <Button variant="outline" onClick={onClose} icon={<X className="w-4 h-4" />}>
              {t('brokerListings.close')}
            </Button>
          </div>
        </div>

        {data?.summary && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <SummaryCard label={t('brokerListings.total')} value={data.summary.total} cls="text-gray-900 dark:text-white" />
            <SummaryCard label={t('brokerListings.statusAvailable')} value={data.summary.available} cls="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard label={t('brokerListings.statusReserved')} value={data.summary.reserved} cls="text-amber-600 dark:text-amber-400" />
            <SummaryCard label={t('brokerListings.statusRented')} value={data.summary.rented} cls="text-sky-600 dark:text-sky-400" />
          </div>
        )}

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-rial-gold" />
            </div>
          ) : !data || data.properties.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-16">{t('brokerListings.empty')}</div>
          ) : (
            <div className="space-y-3">
              {data.properties.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900/40"
                >
                  <div className="flex gap-4">
                    {p.image ? (
                      <img src={p.image} alt={p.title} className="w-24 h-24 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                        <Building2 className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">{p.title}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{p.location}</div>
                        </div>
                        {statusBadge(p.rentalStatus)}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-gray-900 dark:text-white">{fmtMoney(p.price)}/mes</span>
                        <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {p.views}</span>
                        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {p.leadsCount} {t('brokerListings.leads')}</span>
                        <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {t('brokerListings.published')} {fmtDate(p.createdAt)}</span>
                      </div>

                      {p.activeReservation && (
                        <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 text-xs space-y-1.5">
                          <div className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200">
                            {p.rentalStatus === 'rented' ? (
                              <CheckCircle2 className="w-4 h-4 text-sky-600" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-600" />
                            )}
                            {p.rentalStatus === 'rented'
                              ? t('brokerListings.rentedTo', { name: p.activeReservation.tenantName || '—' })
                              : t('brokerListings.reservedBy', { name: p.activeReservation.tenantName || '—' })}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-gray-600 dark:text-gray-400">
                            <Detail label={t('brokerListings.total')} value={fmtMoney(p.activeReservation.totalAmount)} />
                            <Detail label={t('brokerListings.duration')} value={`${p.activeReservation.durationMonths} ${t('brokerListings.months')}`} />
                            <Detail label={t('brokerListings.deposit')} value={fmtMoney(p.activeReservation.depositAmount)} />
                            <Detail label={t('brokerListings.balance')} value={fmtMoney(p.activeReservation.balanceAmount)} />
                            <Detail label={t('brokerListings.startDate')} value={fmtDate(p.activeReservation.startDate)} />
                            <Detail label={t('brokerListings.depositPaidAt')} value={fmtDateTime(p.activeReservation.depositPaidAt)} />
                            {p.rentalStatus === 'reserved' ? (
                              <Detail label={t('brokerListings.balanceDue')} value={fmtDateTime(p.activeReservation.balanceDueAt)} highlight />
                            ) : (
                              <Detail label={t('brokerListings.rentedOn')} value={fmtDateTime(p.activeReservation.balancePaidAt)} highlight />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function SummaryCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="text-center rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3">
      <div className={classNames('text-2xl font-bold', cls)}>{value}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  )
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className={classNames('font-medium', highlight ? 'text-rial-navy dark:text-rial-gold' : 'text-gray-800 dark:text-gray-200')}>
        {value}
      </span>
    </div>
  )
}
