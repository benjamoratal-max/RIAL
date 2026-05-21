import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, CheckCircle2, Loader2, Unplug } from 'lucide-react'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { Button, classNames } from './UI'
import { toast } from 'react-hot-toast'

interface BrokerCalendarSettingsProps {
  token: string
}

interface CalendarStatus {
  configured: boolean
  connected: boolean
  connectedAt: string | null
}

export function BrokerCalendarSettings({ token }: BrokerCalendarSettingsProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<CalendarStatus>('/api/calendar/status', { token })
      setStatus(data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  async function handleConnect() {
    setConnecting(true)
    try {
      const { url } = await api<{ url: string }>('/api/calendar/auth/url', { token })
      window.location.href = url
    } catch (err) {
      toast.error(getErrorMessage(err))
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('brokerCalendar.loading')}
      </div>
    )
  }

  if (!status?.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        {t('brokerCalendar.notConfiguredServer')}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-rial-cream-dark/40 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('brokerCalendar.title')}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('brokerCalendar.description')}
      </p>

      {status.connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t('brokerCalendar.connected')}</p>
              {status.connectedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('brokerCalendar.connectedAt', {
                    date: new Date(status.connectedAt).toLocaleString(),
                  })}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleConnect} disabled={connecting}>
            {t('brokerCalendar.reconnect')}
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={connecting}
          icon={connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
          className={classNames('bg-blue-600 hover:bg-blue-700 text-white border-0')}
        >
          {connecting ? t('brokerCalendar.connecting') : t('brokerCalendar.connect')}
        </Button>
      )}

      {!status.connected && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Unplug className="w-3.5 h-3.5" />
          {t('brokerCalendar.disconnectedHint')}
        </p>
      )}
    </div>
  )
}
