import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, MapPin, DollarSign, Plus, X, Upload, FileText, Image as ImageIcon, Trash2, Video, TrendingUp, Clock } from 'lucide-react'
import { Button, Input } from './UI'
import { toast } from 'react-hot-toast'
import { validatePropertyForm } from '../utils/validation'
import { api } from '../utils/api'

const MIN_PHOTOS = 8
const MAX_PHOTOS = 30

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
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [ownerDniDocument, setOwnerDniDocument] = useState<File | null>(null)
  const [contractOrTitle, setContractOrTitle] = useState<File | null>(null)
  const [videoTourFile, setVideoTourFile] = useState<File | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [suggestedPricing, setSuggestedPricing] = useState<{ suggestedRentMin: number; suggestedRentMax: number; estimatedDaysToPlace: number; similarCount: number } | null>(null)
  const canCreate =
    !!currentUser &&
    (currentUser.role === 'broker' || currentUser.role === 'broker_admin') &&
    // Permitir crear solo si el backend ya marcó el perfil como aprobado (si esta info está disponible en el objeto user)
    (currentUser.brokerProfile?.verificationStatus === 'approved' || currentUser.brokerVerificationStatus === 'approved')

  useEffect(() => {
    const urls = imageFiles.map(f => URL.createObjectURL(f))
    setImagePreviewUrls(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
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
      .catch(() => { if (!cancelled) setSuggestedPricing(null) })
    return () => { cancelled = true }
  }, [form.location])

  const clearFileErrors = (field: string) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  if (!canCreate) {
    return (
      <motion.div
        className="rounded-2xl border border-dashed border-rial-cream-dark/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/85"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">
          Solo cuentas de <span className="font-semibold">broker verificado</span> pueden publicar propiedades en RIAL.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Si eres propietario o usuario final, puedes usar la app para buscar propiedades y contactar brokers verificados. Si quieres publicar como broker,
          completa el onboarding de broker y espera la aprobación de tu cuenta.
        </p>
      </motion.div>
    )
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter(f => f.type.startsWith('image/'))
    if (valid.length !== files.length) toast.error('Solo se aceptan imágenes (JPG, PNG, etc.)')
    setImageFiles(prev => {
      const next = [...prev, ...valid].slice(0, MAX_PHOTOS)
      return next
    })
    clearFileErrors('images')
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    clearFileErrors('images')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validatePropertyForm({
      ...form,
      rooms: form.rooms,
      bathrooms: form.bathrooms,
      imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
      images: imageFiles.length > 0 ? '' : form.images,
      ownerDniDocument: ownerDniDocument ?? undefined,
      contractOrTitle: contractOrTitle ?? undefined,
      videoTourFile: videoTourFile ?? undefined
    })
    if (!validation.isValid) {
      const errorMap: { [key: string]: string } = {}
      validation.errors.forEach(err => {
        errorMap[err.field] = err.message
      })
      setErrors(errorMap)
      toast.error(t('createProperty.fixErrors'))
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      let imagesPayload: string[]
      if (imageFiles.length >= MIN_PHOTOS) {
        imagesPayload = await Promise.all(imageFiles.map(f => fileToDataUrl(f)))
      } else {
        imagesPayload = form.images.split(',').map(s => s.trim()).filter(Boolean)
      }
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        location: form.location,
        rooms: form.rooms ? Number(form.rooms) : undefined,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        images: imagesPayload
      }
      if (ownerDniDocument) {
        payload.ownerDniDocument = await fileToDataUrl(ownerDniDocument)
      }
      if (contractOrTitle) {
        payload.contractOrTitle = await fileToDataUrl(contractOrTitle)
      }
      if (videoTourFile) {
        payload.videoTour = await fileToDataUrl(videoTourFile)
      }
      const res = await api('/api/properties', { method: 'POST', token, body: payload }) as any
      if (res?.duplicateAlerts?.length > 0) {
        toast(t('createProperty.possibleDuplicateWarning'), { icon: '⚠️', duration: 6000 })
      }
      setForm({ title: '', description: '', price: '', location: '', rooms: '', bathrooms: '', images: '' })
      setImageFiles([])
      setOwnerDniDocument(null)
      setContractOrTitle(null)
      setVideoTourFile(null)
      setSuggestedPricing(null)
      setIsExpanded(false)
      onCreated?.()
      toast.success(t('createProperty.publishedSuccess'))
    } catch (error: any) {
      toast.error(error.message || t('createProperty.publishError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      className="rounded-2xl border border-rial-cream-dark/40 bg-white/90 p-4 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/85"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-lg text-gray-900 dark:text-white">{t('createProperty.title')}</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          icon={isExpanded ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        >
          {isExpanded ? t('createProperty.close') : t('createProperty.newProperty')}
        </Button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.form
            className="grid md:grid-cols-2 gap-4"
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
                  if (errors.title) setErrors(prev => ({ ...prev, title: '' }))
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
                  if (errors.location) setErrors(prev => ({ ...prev, location: '' }))
                }}
                icon={<MapPin className="w-4 h-4" />}
              />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
            </div>
            <div>
              <Input
                type="number"
                placeholder={t('createProperty.pricePlaceholder')}
                value={form.price}
                onChange={(value) => {
                  setForm({ ...form, price: value })
                  if (errors.price) setErrors(prev => ({ ...prev, price: '' }))
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
                      <span className="text-rial-navy dark:text-rial-gold"> ({suggestedPricing.similarCount} {t('createProperty.similarInZone')})</span>
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
                  if (errors.rooms) setErrors(prev => ({ ...prev, rooms: '' }))
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
                  if (errors.bathrooms) setErrors(prev => ({ ...prev, bathrooms: '' }))
                }}
                icon={<FileText className="w-4 h-4" />}
              />
              {errors.bathrooms && <p className="text-red-500 text-xs mt-1">{errors.bathrooms}</p>}
            </div>

            {/* Fotos de la propiedad: mínimo 8 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fotos de la propiedad <span className="text-red-500">*</span> (mínimo {MIN_PHOTOS})
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
                      aria-label="Quitar foto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {imageFiles.length < MAX_PHOTOS && (
                  <label className="w-20 h-20 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {imageFiles.length} / {MIN_PHOTOS} mínimo (máx. {MAX_PHOTOS})
              </p>
              {errors.images && <p className="text-red-500 text-xs mt-1">{errors.images}</p>}
            </div>

            {/* DNI del propietario */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Foto de tu DNI (documento de identidad) <span className="text-red-500">*</span>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                <FileText className="w-8 h-8 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {ownerDniDocument ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
                      {ownerDniDocument.name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">Subir foto o PDF del DNI</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setOwnerDniDocument(f || null)
                    clearFileErrors('ownerDniDocument')
                    e.target.value = ''
                  }}
                />
              </label>
              {errors.ownerDniDocument && (
                <p className="text-red-500 text-xs mt-1">{errors.ownerDniDocument}</p>
              )}
            </div>

            {/* Contrato o título de la propiedad */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contrato o título de la propiedad <span className="text-red-500">*</span>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                <ImageIcon className="w-8 h-8 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {contractOrTitle ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
                      {contractOrTitle.name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">Subir contrato o título (imagen o PDF)</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setContractOrTitle(f || null)
                    clearFileErrors('contractOrTitle')
                    e.target.value = ''
                  }}
                />
              </label>
              {errors.contractOrTitle && (
                <p className="text-red-500 text-xs mt-1">{errors.contractOrTitle}</p>
              )}
            </div>

            {/* Video tour */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Video tour de la propiedad <span className="text-red-500">*</span>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-rial-gold bg-gray-50 dark:bg-gray-800/50">
                <Video className="w-8 h-8 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {videoTourFile ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
                      {videoTourFile.name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">Subir video tour (MP4, WebM, etc.)</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setVideoTourFile(f || null)
                    clearFileErrors('videoTourFile')
                    e.target.value = ''
                  }}
                />
              </label>
              {errors.videoTourFile && (
                <p className="text-red-500 text-xs mt-1">{errors.videoTourFile}</p>
              )}
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
                {isSubmitting ? 'Publicando…' : t('createProperty.publish')}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
