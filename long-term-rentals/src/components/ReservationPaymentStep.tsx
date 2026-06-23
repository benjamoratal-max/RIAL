import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Clock, CreditCard, DollarSign, Loader2 } from 'lucide-react'
import { Button, classNames } from './UI'
import { api } from '../utils/api'
import { toast } from 'react-hot-toast'

export type ReservationRecord = {
  id: number
  status: string
  depositAmount: number
  balanceAmount: number
  totalAmount: number
  balanceDueAt?: string | null
  msRemaining?: number
  hoursRemaining?: number
  property?: { title?: string; location?: string }
}

interface ReservationPaymentStepProps {
  reservationId: number
  token: string
  onCompleted?: () => void
  /** Mensaje a mostrar al volver de Stripe Checkout. */
  notice?: 'success' | 'cancel' | null
  /** session_id de Stripe Checkout (success_url); confirma el pago sin esperar al webhook. */
  sessionId?: string | null
  /**
   * Tras volver de Stripe, el webhook puede tardar unos segundos en confirmar el
   * cobro. Con autoRefresh activado, el componente reconsulta el estado varias veces
   * para reflejar el cambio sin que el usuario tenga que recargar.
   */
  autoRefresh?: boolean
}

function formatUsd(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatCountdown(ms: number) {
  if (ms <= 0) return '0:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ReservationPaymentStep({ reservationId, token, onCompleted, notice = null, sessionId = null, autoRefresh = false }: ReservationPaymentStepProps) {
  const { t } = useTranslation()
  const [reservation, setReservation] = useState<ReservationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<'deposit' | 'balance' | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [tick, setTick] = useState(0)

  // Saber si el cobro real con Stripe está activo (cambia el texto informativo).
  useEffect(() => {
    let active = true
    api('/api/reservations/config')
      .then((cfg: any) => {
        if (active) setStripeEnabled(Boolean(cfg?.stripeEnabled))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const data = (await api(`/api/reservations/${reservationId}`, { token })) as ReservationRecord
      setReservation(data)
      return data
    } catch (e: any) {
      toast.error(e?.message || t('reservation.loadError'))
      return null
    } finally {
      setLoading(false)
    }
  }, [reservationId, token, t])

  useEffect(() => {
    load()
  }, [load])

  // Mensaje al volver de Stripe Checkout (la confirmación real llega por webhook).
  useEffect(() => {
    if (notice === 'success') toast.success(t('reservation.paymentSuccess'))
    else if (notice === 'cancel') toast(t('reservation.paymentCancelled'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice])

  // Al volver de Stripe con session_id, confirmamos el pago de inmediato (no hace falta
  // esperar al webhook ni tener stripe listen corriendo en otra terminal).
  useEffect(() => {
    if (notice !== 'success' || !sessionId) return
    let cancelled = false
    ;(async () => {
      try {
        await api(`/api/reservations/${reservationId}/confirm-checkout`, {
          method: 'POST',
          token,
          body: { sessionId },
        })
        if (!cancelled) await load()
      } catch {
        // El webhook o el autoRefresh pueden confirmar después.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice, sessionId, reservationId, token])

  // Tras volver de Stripe, el webhook tarda unos segundos: reconsultamos el estado
  // varias veces hasta detectar el avance (deposit_paid o completed).
  useEffect(() => {
    if (!autoRefresh || notice !== 'success') return
    let attempts = 0
    const initialStatus = reservation?.status
    const id = window.setInterval(async () => {
      attempts += 1
      const data = await load()
      if (attempts >= 10 || (data && data.status !== initialStatus && data.status !== 'pending_deposit')) {
        window.clearInterval(id)
      }
    }, 3000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, notice])

  useEffect(() => {
    if (reservation?.status !== 'deposit_paid') return
    const id = window.setInterval(() => {
      setTick((n) => n + 1)
      load()
    }, 30000)
    return () => window.clearInterval(id)
  }, [reservation?.status, load])

  useEffect(() => {
    if (reservation?.status !== 'deposit_paid' || !reservation.msRemaining) return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [reservation?.status, reservation?.msRemaining])

  const msRemaining = React.useMemo(() => {
    if (!reservation?.balanceDueAt) return reservation?.msRemaining ?? 0
    return Math.max(0, new Date(reservation.balanceDueAt).getTime() - Date.now())
  }, [reservation?.balanceDueAt, reservation?.msRemaining, tick])

  // Si Stripe está activo, el backend responde { checkoutUrl } y redirigimos a la
  // página de pago alojada por Stripe. Si no, es el modo simulado y volvemos a cargar.
  const redirectToCheckout = (url: string) => {
    setRedirecting(true)
    toast.loading(t('reservation.redirecting'), { id: 'stripe-redirect' })
    window.location.assign(url)
  }

  const payDeposit = async () => {
    setPaying('deposit')
    try {
      const res: any = await api(`/api/reservations/${reservationId}/pay-deposit`, {
        method: 'POST',
        token,
        body: { paymentMethod: 'stripe' },
      })
      if (res?.checkoutUrl) {
        redirectToCheckout(res.checkoutUrl)
        return
      }
      toast.success(t('reservation.depositPaid'))
      await load()
    } catch (e: any) {
      toast.error(e?.message || t('reservation.payError'))
    } finally {
      setPaying(null)
    }
  }

  const payBalance = async () => {
    setPaying('balance')
    try {
      const res: any = await api(`/api/reservations/${reservationId}/pay-balance`, {
        method: 'POST',
        token,
        body: { paymentMethod: 'stripe' },
      })
      if (res?.checkoutUrl) {
        redirectToCheckout(res.checkoutUrl)
        return
      }
      toast.success(t('reservation.balancePaid'))
      onCompleted?.()
      await load()
    } catch (e: any) {
      toast.error(e?.message || t('reservation.payError'))
    } finally {
      setPaying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-rial-gold" />
      </div>
    )
  }

  if (!reservation) return null

  if (reservation.status === 'completed') {
    return (
      <motion.div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Check className="mx-auto h-12 w-12 text-emerald-600 mb-3" />
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">{t('reservation.completedTitle')}</h3>
        <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-2">{t('reservation.completedBody')}</p>
      </motion.div>
    )
  }

  if (reservation.status === 'expired') {
    return (
      <motion.div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/40"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-3" />
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">{t('reservation.expiredTitle')}</h3>
        <p className="text-sm text-red-800 dark:text-red-200 mt-2">{t('reservation.expiredBody')}</p>
      </motion.div>
    )
  }

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reservation.title')}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('reservation.subtitle')}</p>
        {reservation.property?.title && (
          <p className="text-sm font-medium text-rial-navy dark:text-rial-gold mt-2">
            {reservation.property.title} · {reservation.property.location}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500">{t('reservation.total')}</p>
          <p className="text-lg font-semibold">{formatUsd(reservation.totalAmount)}</p>
        </div>
        <div className="rounded-xl border border-rial-gold/40 bg-rial-gold/10 p-4">
          <p className="text-xs text-gray-500">{t('reservation.depositLabel')}</p>
          <p className="text-lg font-semibold">{formatUsd(reservation.depositAmount)}</p>
          <p className="text-[10px] text-gray-500">{t('reservation.depositPercent')}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500">{t('reservation.balanceLabel')}</p>
          <p className="text-lg font-semibold">{formatUsd(reservation.balanceAmount)}</p>
        </div>
      </div>

      {reservation.status === 'pending_deposit' && (
        <div className="rounded-2xl border border-rial-cream-dark/50 bg-white p-5 dark:border-slate-600 dark:bg-slate-900/60">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{t('reservation.depositInstructions')}</p>
          <Button
            onClick={payDeposit}
            disabled={paying !== null || redirecting}
            icon={paying === 'deposit' || redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            {t('reservation.payDeposit', { amount: formatUsd(reservation.depositAmount) })}
          </Button>
        </div>
      )}

      {reservation.status === 'deposit_paid' && (
        <div className="space-y-4">
          <div
            className={classNames(
              'rounded-2xl border p-4 flex items-start gap-3',
              msRemaining > 0
                ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
            )}
          >
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('reservation.deadlineTitle')}</p>
              <p className="text-2xl font-mono font-bold mt-1">{formatCountdown(msRemaining)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('reservation.deadlineWarning')}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="text-sm text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
              <Check className="h-4 w-4" />
              {t('reservation.depositConfirmed')}
            </p>
          </div>

          <Button
            onClick={payBalance}
            disabled={paying !== null || redirecting || msRemaining <= 0}
            icon={paying === 'balance' || redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            {t('reservation.payBalance', { amount: formatUsd(reservation.balanceAmount) })}
          </Button>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {stripeEnabled ? t('reservation.securePayment') : t('reservation.simulatedPayment')}
      </p>
    </motion.div>
  )
}
