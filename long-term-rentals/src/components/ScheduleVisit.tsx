import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Calendar, Clock, Video, MapPin, X, Send } from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'

interface PropertyBasic {
  id: number
  title: string
  location?: string
}

interface ScheduleVisitProps {
  property: PropertyBasic
  token: string | null
  user: any
  onClose: () => void
  onSuccess?: () => void
}

const TIME_SLOTS = [
  { value: '09:00', labelKey: 'visitSlot_morning1' },
  { value: '10:00', labelKey: 'visitSlot_morning2' },
  { value: '11:00', labelKey: 'visitSlot_morning3' },
  { value: '12:00', labelKey: 'visitSlot_noon' },
  { value: '14:00', labelKey: 'visitSlot_afternoon1' },
  { value: '15:00', labelKey: 'visitSlot_afternoon2' },
  { value: '16:00', labelKey: 'visitSlot_afternoon3' },
  { value: '17:00', labelKey: 'visitSlot_afternoon4' },
  { value: '18:00', labelKey: 'visitSlot_evening' }
]

const VISIT_TYPES = [
  { value: 'in_person', labelKey: 'visitTypeInPerson', icon: MapPin },
  { value: 'video_call', labelKey: 'visitTypeVideo', icon: Video }
]

function getMinDate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function ScheduleVisit({ property, token, user, onClose, onSuccess }: ScheduleVisitProps) {
  const { t } = useTranslation()
  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [visitType, setVisitType] = useState<'in_person' | 'video_call'>('in_person')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = date && timeSlot && (token != null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !token) return
    setSubmitting(true)
    try {
      await api(`/api/properties/${property.id}/visits`, {
        method: 'POST',
        token,
        body: {
          date,
          time: timeSlot,
          visitType,
          message: message.trim() || undefined
        }
      })
      toast.success(t('scheduleVisit.success'))
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-rial-cream-dark/50 bg-rial-cream shadow-xl dark:border-slate-700 dark:bg-slate-900"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rial-cream-dark/50 dark:bg-slate-800">
                <Calendar className="h-5 w-5 text-rial-navy dark:text-rial-gold" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('scheduleVisit.title')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[220px]" title={property.title}>
                  {property.title}
                </p>
                {property.location && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {property.location}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />} />
          </div>

          {!user || !token ? (
            <div className="py-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">{t('scheduleVisit.loginRequired')}</p>
              <Button onClick={onClose}>{t('common.close')}</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('scheduleVisit.date')}
                </label>
                <Input
                  placeholder={t('scheduleVisit.selectDate')}
                  type="date"
                  value={date}
                  onChange={(v) => setDate(v)}
                  min={getMinDate()}
                  icon={<Calendar className="w-4 h-4" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('scheduleVisit.time')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setTimeSlot(timeSlot === slot.value ? '' : slot.value)}
                      className={classNames(
                        'px-3 py-2 rounded-xl text-sm font-medium transition-all border',
                        timeSlot === slot.value
                          ? 'border-rial-navy bg-rial-navy text-rial-cream dark:border-rial-navy dark:bg-rial-navy'
                          : 'border-rial-cream-dark/50 bg-white text-slate-700 hover:border-rial-gold dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-rial-gold'
                      )}
                    >
                      {t(`scheduleVisit.${slot.labelKey}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('scheduleVisit.visitType')}
                </label>
                <div className="flex gap-3">
                  {VISIT_TYPES.map(({ value, labelKey, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setVisitType(value as 'in_person' | 'video_call')}
                      className={classNames(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                        visitType === value
                          ? 'border-rial-navy bg-rial-navy text-rial-cream dark:border-rial-navy dark:bg-rial-navy'
                          : 'border-rial-cream-dark/50 bg-white text-slate-700 hover:border-rial-gold dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-rial-gold'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {t(`scheduleVisit.${labelKey}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('scheduleVisit.messageOptional')}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('scheduleVisit.messagePlaceholder')}
                  className="min-h-[80px] w-full resize-y rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-navy focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-rial-cream"
                  maxLength={500}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!canSubmit || submitting}
                  icon={<Send className="w-4 h-4" />}
                >
                  {submitting ? t('scheduleVisit.sending') : t('scheduleVisit.submit')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
