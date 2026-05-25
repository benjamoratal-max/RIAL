import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, MapPin, DollarSign, Plus, X, Upload, FileText, Image as ImageIcon, Trash2, Video, TrendingUp, Clock, Calendar } from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { toast } from 'react-hot-toast'
import { validatePropertyForm } from '../utils/validation'
import { api } from '../utils/api'
import { PropertyLocationPicker, type MapLocationValue } from './PropertyLocationPicker'

const MIN_PHOTOS = 8
const MAX_PHOTOS = 30
const RENTAL_MONTH_OPTIONS = [3, 6, 12] as const

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface CreatePropertyFormProps {
  token?: string
  currentUser?: any
  onCreated?: () => void
}

type BrokerProfileState = {
  verificationStatus: string
} | null

export function CreatePropertyForm({ token, currentUser, onCreated }: CreatePropertyFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    rooms: '',
    bathrooms: '',
    images: ''
  })
  const [rentalMonths, setRentalMonths] = useState<Record<3 | 6 | 12, boolean>>({ 3: false, 6: false, 12: false })
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [ownerDniDocument, setOwnerDniDocument] = useState<File | null>(null)
  const [contractOrTitle, setContractOrTitle] = useState<File | null>(null)
  const [videoTourFile, setVideoTourFile] = useState<File | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [suggestedPricing, setSuggestedPricing] = useState<{ suggestedRentMin: number; suggestedRentMax: number; estimatedDaysToPlace: number; similarCount: number } | null>(null)
  const [mapPin, setMapPin] = useState<MapLocationValue | null>(null)
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfileState>(null)
  const [brokerProfileLoading, setBrokerProfileLoading] = useState(false)

  const isAdminPublisher = currentUser?.role === 'admin'
  const isBrokerRole =
    currentUser?.role === 'broker' ||
    currentUser?.role === 'broker_admin' ||
    currentUser?.role === 'broker_applicant'
  const canUsePublishForm = isAdminPublisher || isBrokerRole

  const brokerStatus =
    brokerProfile?.verificationStatus ||
    currentUser?.brokerProfile?.verificationStatus ||
    currentUser?.brokerVerificationStatus ||
    null

  const canPublish =
    !!currentUser &&
    (isAdminPublisher || (isBrokerRole && brokerStatus === 'approved'))

  const selectedRentalMonths = useMemo(
    () => RENTAL_MONTH_OPTIONS.filter((m) => rentalMonths[m]),
    [rentalMonths]
  )

  useEffect(() => {
    if (!token || !isBrokerRole || isAdminPublisher) return
    let cancelled = false
    setBrokerProfileLoading(true)
    api('/api/brokers/me', { token })
      .then((data: any) => {
        if (cancelled) return
        setBrokerProfile(data?.profile ?? null)
      })
      .catch(() => {
        if (!cancelled) setBrokerProfile(null)
      })
      .finally(() => {
        if (!cancelled) setBrokerProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, isBrokerRole, isAdminPublisher, currentUser?.id])

  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f))
    setImagePreviewUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [imageFiles])

  useEffect(() => {
    if (!form.location || form.location.trim().length < 3) {
      setSuggestedPricing(null)
      return
    }
    let cancelled = false
    api(`/api/properties/suggest-price?location=${encodeURIComponent(form.location.trim())}`)
      .then((data: any) => {
        if (!cancelled && data) setSuggestedPricing(data)
      })
      .catch(() => {
        if (!cancelled) setSuggestedPricing(null)
      })
    return () => {
      cancelled = true
    }
  }, [form.location])

  const clearFileErrors = (field: string) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const toggleRentalMonth = (month: 3 | 6 | 12) => {
    setRentalMonths((prev) => ({ ...prev, [month]: !prev[month] }))
    clearFileErrors('rentalMonths')
  }

  if (!currentUser || !canUsePublishForm) {
    return null
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter((f) => f.type.startsWith('image/'))
    if (valid.length !== files.length) toast.error(t('createProperty.imagesOnly'))
    setImageFiles((prev) => [...prev, ...valid].slice(0, MAX_PHOTOS))
    clearFileErrors('images')
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    clearFileErrors('images')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canPublish) {
      toast.error(t('createProperty.brokerNotApproved'))
      return
    }

    const validation = validatePropertyForm({
      ...form,
      rooms: form.rooms,
      bathrooms: form.bathrooms,
      imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
      images: imageFiles.length > 0 ? '' : form.images,
      ownerDniDocument: ownerDniDocument ?? undefined,
      contractOrTitle: contractOrTitle ?? undefined,
      videoTourFile: videoTourFile ?? undefined,
      rentalMonths: selectedRentalMonths,
      mapPin,
    })
    if (!validation.isValid) {
      const errorMap: { [key: string]: string } = {}
      validation.errors.forEach((err) => {
        errorMap[err.field] = err.message
      })
      setErrors(errorMap)
      toast.error(t('createProperty.fixErrors'))
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      const imagesPayload =
        imageFiles.length >= MIN_PHOTOS
          ? await Promise.all(imageFiles.map((f) => fileToDataUrl(f)))
          : form.images.split(',').map((s) => s.trim()).filter(Boolean)

      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        location: form.location.trim(),
        rooms: form.rooms ? Number(form.rooms) : undefined,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        images: imagesPayload,
        rentalMonths: selectedRentalMonths,
        latitude: mapPin!.lat,
        longitude: mapPin!.lng,
        ownerDniDocumentUrl: await fileToDataUrl(ownerDniDocument!),
        contractOrTitleUrl: await fileToDataUrl(contractOrTitle!),
        videoTourUrl: await fileToDataUrl(videoTourFile!),
      }

      const res = (await api('/api/properties', { method: 'POST', token, body: payload })) as any
      if (res?.duplicateAlerts?.length > 0) {
        toast(t('createProperty.possibleDuplicateWarning'), { icon: '⚠️', duration: 6000 })
      }
      setForm({ title: '', description: '', price: '', location: '', rooms: '', bathrooms: '', images: '' })
      setRentalMonths({ 3: false, 6: false, 12: false })
      setImageFiles([])
      setOwnerDniDocument(null)
      setContractOrTitle(null)
      setVideoTourFile(null)
      setSuggestedPricing(null)
      setMapPin(null)
      setIsExpanded(false)
      onCreated?.()
      toast.success(t('createProperty.publishedVerified', { defaultValue: t('createProperty.publishedSuccess') }))
    } catch (error: any) {
      const details = error?.details as Array<{ path?: string; message?: string }> | undefined
      const failureMessages = Array.isArray(details)
        ? details.map((d) => d.message).filter(Boolean) as string[]
        : []
      if (failureMessages.length > 0) {
        const errorMap: { [key: string]: string } = { listing: failureMessages[0] }
        details!.forEach((d, i) => {
          const field = d.path?.split('.')[0] || 'listing'
          if (d.message) errorMap[field === 'listing' && i > 0 ? `listing_${i}` : field] = d.message
        })
        setErrors(errorMap)
        failureMessages.slice(0, 4).forEach((msg) => toast.error(msg, { duration: 7000 }))
      } else {
        toast.error(error.message || t('createProperty.publishError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusBanner = () => {
    if (isAdminPublisher) {
      return (
        <p className="mb-3 rounded-xl border border-rial-gold/40 bg-rial-gold-soft/40 px-3 py-2 text-sm text-rial-navy dark:border-rial-accent/30 dark:bg-slate-800/60 dark:text-rial-cream">
          {t('createProperty.adminCanPublish')}
        </p>
      )
    }
    if (brokerProfileLoading) {
      return (
        <p className="mb-3 text-sm text-rial-muted dark:text-slate-400">{t('createProperty.checkingBrokerStatus')}</p>
      )
    }
    if (brokerStatus === 'approved') {
      return (
        <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-400">{t('createProperty.brokerApproved')}</p>
      )
    }
    if (brokerStatus === 'pending_review') {
      return (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t('createProperty.brokerPending')}
        </p>
      )
    }
    if (brokerStatus === 'rejected') {
      return (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {t('createProperty.brokerRejected')}
        </p>
      )
    }
    return (
      <p className="mb-3 rounded-xl border border-rial-cream-dark/50 bg-rial-cream-dark/30 px-3 py-2 text-sm text-rial-ink dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
        {t('createProperty.brokerNotApplied')}
      </p>
    )
  }

  return (
    <motion.div
      className="rounded-2xl border border-rial-cream-dark/40 bg-white/90 p-4 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/85"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="font-semibold text-lg text-gray-900 dark:text-white">{t('createProperty.title')}</div>
        {canPublish && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            icon={isExpanded ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          >
            {isExpanded ? t('createProperty.close') : t('createProperty.newProperty')}
          </Button>
        )}
      </div>

      {statusBanner()}

      {canPublish && (
        <p className="mb-3 text-xs text-rial-muted dark:text-slate-400">{t('createProperty.autoVerificationHint')}</p>
      )}

      {errors.listing && (
        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          {errors.listing}
        </p>
      )}

      <AnimatePresence>
        {isExpanded && canPublish && (
          <motion.form
            className="grid gap-4 md:grid-cols-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
          >
            <div>
              <Input
                placeholder={t('createProperty.titlePlaceholder')}
                value={form.title}
                onChange={(value) => {
                  setForm({ ...form, title: value })
                  if (errors.title) setErrors((prev) => ({ ...prev, title: '' }))
                }}
                icon={<Home className="w-4 h-4" />}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>
            <div>
              <Input
                placeholder={t('createProperty.locationPlaceholder')}
                value={form.location}
                onChange={(value) => {
                  setForm({ ...form, location: value })
                  if (errors.location) setErrors((prev) => ({ ...prev, location: '' }))
                }}
                icon={<MapPin className="w-4 h-4" />}
              />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
            </div>

            <div className="md:col-span-2">
              <PropertyLocationPicker
                value={mapPin}
                onChange={(v) => {
                  setMapPin(v)
                  clearFileErrors('mapPin')
                }}
              />
              {errors.mapPin && <p className="text-red-500 text-xs mt-1">{errors.mapPin}</p>}
            </div>

            {/* Meses de alquiler — obligatorio al menos uno */}
            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar className="h-4 w-4 text-rial-gold" />
                {t('createProperty.rentalMonthsLabel')} <span className="text-red-500">*</span>
              </label>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{t('createProperty.rentalMonthsHint')}</p>
              <div className="flex flex-wrap gap-3">
                {RENTAL_MONTH_OPTIONS.map((month) => {
                  const active = rentalMonths[month]
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => toggleRentalMonth(month)}
                      className={classNames(
                        'rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all',
                        active
                          ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md dark:bg-rial-gold dark:text-rial-navy dark:border-rial-gold'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-rial-gold dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                      )}
                    >
                      {t('createProperty.rentalMonthOption', { months: month })}
                    </button>
                  )
                })}
              </div>
              {errors.rentalMonths && <p className="text-red-500 text-xs mt-1">{errors.rentalMonths}</p>}
            </div>

            <div>
              <Input
                type="number"
                placeholder={t('createProperty.pricePlaceholder')}
                value={form.price}
                onChange={(value) => {
                  setForm({ ...form, price: value })
                  if (errors.price) setErrors((prev) => ({ ...prev, price: '' }))
                }}
                icon={<DollarSign className="w-4 h-4" />}
              />
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
              {suggestedPricing && (
                <div className="mt-2 rounded-xl border border-rial-cream-dark/50 bg-rial-cream-dark/35 p-3 dark:border-slate-600 dark:bg-slate-800/70">
                  <div className="flex items-center gap-2 text-sm font-medium text-rial-navy dark:text-rial-cream">
                    <TrendingUp className="h-4 w-4 text-rial-gold" />
                    {t('createProperty.suggestedPricing')}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    ${suggestedPricing.suggestedRentMin.toLocaleString()} – ${suggestedPricing.suggestedRentMax.toLocaleString()} USD/mes
                    {suggestedPricing.similarCount > 0 && (
                      <span className="text-rial-navy dark:text-rial-gold">
                        {' '}
                        ({suggestedPricing.similarCount} {t('createProperty.similarInZone')})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <Clock className="w-3 h-3" />
                    {t('createProperty.estimatedDaysToPlace', { days: suggestedPricing.estimatedDaysToPlace })}
                  </p>
                </div>
              )}
            </div>
            <div>
              <Input
                type="number"
                placeholder={t('createProperty.roomsPlaceholder')}
                value={form.rooms}
                onChange={(value) => {
                  setForm({ ...form, rooms: value })
                  if (errors.rooms) setErrors((prev) => ({ ...prev, rooms: '' }))
                }}
                icon={<Home className="w-4 h-4" />}
              />
              {errors.rooms && <p className="text-red-500 text-xs mt-1">{errors.rooms}</p>}
            </div>
            <div>
              <Input
                type="number"
                placeholder={t('createProperty.bathroomsPlaceholder')}
                value={form.bathrooms}
                onChange={(value) => {
                  setForm({ ...form, bathrooms: value })
                  if (errors.bathrooms) setErrors((prev) => ({ ...prev, bathrooms: '' }))
                }}
                icon={<FileText className="w-4 h-4" />}
              />
              {errors.bathrooms && <p className="text-red-500 text-xs mt-1">{errors.bathrooms}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('createProperty.photosLabel')} <span className="text-red-500">*</span> ({t('createProperty.photosMin', { min: MIN_PHOTOS })})
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {imageFiles.map((file, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={imagePreviewUrls[i]}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={t('createProperty.removePhoto')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {imageFiles.length < MAX_PHOTOS && (
                  <label className="w-20 h-20 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {imageFiles.length} / {MIN_PHOTOS} {t('createProperty.photosMinimum')}
              </p>
              {errors.images && <p className="text-red-500 text-xs mt-1">{errors.images}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('createProperty.ownerDniLabel')} <span className="text-red-500">*</span>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                <FileText className="w-8 h-8 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {ownerDniDocument ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{ownerDniDocument.name}</span>
                  ) : (
                    <span className="text-sm text-gray-500">{t('createProperty.ownerDniUpload')}</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f && !f.type.startsWith('image/')) {
                      toast.error(t('createProperty.ownerDniImageOnly'))
                      e.target.value = ''
                      return
                    }
                    setOwnerDniDocument(f || null)
                    clearFileErrors('ownerDniDocument')
                    e.target.value = ''
                  }}
                />
              </label>
              {errors.ownerDniDocument && <p className="text-red-500 text-xs mt-1">{errors.ownerDniDocument}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('createProperty.contractLabel')} <span className="text-red-500">*</span>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                <ImageIcon className="w-8 h-8 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {contractOrTitle ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{contractOrTitle.name}</span>
                  ) : (
                    <span className="text-sm text-gray-500">{t('createProperty.contractUpload')}</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    setContractOrTitle(e.target.files?.[0] || null)
                    clearFileErrors('contractOrTitle')
                    e.target.value = ''
                  }}
                />
              </label>
              {errors.contractOrTitle && <p className="text-red-500 text-xs mt-1">{errors.contractOrTitle}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('createProperty.videoTourLabel')} <span className="text-red-500">*</span>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                <Video className="w-8 h-8 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {videoTourFile ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{videoTourFile.name}</span>
                  ) : (
                    <span className="text-sm text-gray-500">{t('createProperty.videoTourUpload')}</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    setVideoTourFile(e.target.files?.[0] || null)
                    clearFileErrors('videoTourFile')
                    e.target.value = ''
                  }}
                />
              </label>
              {errors.videoTourFile && <p className="text-red-500 text-xs mt-1">{errors.videoTourFile}</p>}
            </div>

            <div className="md:col-span-2">
              <textarea
                className="input w-full"
                placeholder={t('createProperty.descriptionPlaceholder')}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setIsExpanded(false)}>
                {t('createProperty.cancel')}
              </Button>
              <Button type="submit" icon={<Plus className="w-4 h-4" />} disabled={isSubmitting}>
                {isSubmitting ? t('createProperty.publishing') : t('createProperty.publish')}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
