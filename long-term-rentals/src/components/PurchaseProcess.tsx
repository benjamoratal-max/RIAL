import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  FileText,
  Check,
  ArrowRight,
  ArrowLeft,
  User,
  DollarSign,
  Home,
  CreditCard,
  Bot,
  Send,
  FileCheck,
  Download,
  Upload,
  AlertCircle,
  Loader2,
  Percent,
  Building2
} from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { PhoneInput } from './PhoneInput'

interface PurchaseProcessProps {
  property: any
  user: any
  token: string | null
  onClose: () => void
  onComplete?: () => void
}

interface BrokerMessage {
  id: string
  role: 'user' | 'broker'
  content: string
  timestamp: Date
}

export function PurchaseProcess({ property, user, token, onClose, onComplete }: PurchaseProcessProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const salePrice = property?.salePrice ?? property?.price ? (property.price as number) * 200 : 0
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    dni: '',
    address: '',
    financingType: 'cash' as 'cash' | 'loan' | 'leasing',
    downPayment: Math.round(salePrice * 0.2).toString(),
    identityDocument: null as File | null,
    incomeProof: null as File | null,
    proofOfFunds: null as File | null,
    agreeToTerms: false,
    agreeToPrivacy: false
  })
  const [brokerMessages, setBrokerMessages] = useState<BrokerMessage[]>([
    {
      id: '1',
      role: 'broker',
      content: `¡Hola! 👋 Soy tu broker virtual de RIAL App. Te ayudaré durante todo el proceso de **compra** de **${property?.title ?? 'esta propiedad'}**.

Estoy aquí para:
• Explicarte cada paso del proceso de compra
• Responder tus dudas sobre el contrato de compraventa
• Ayudarte con la documentación necesaria
• Guiarte en la firma digital

¿Tienes alguna pregunta antes de comenzar?`,
      timestamp: new Date()
    }
  ])
  const [brokerInput, setBrokerInput] = useState('')
  const [isBrokerTyping, setIsBrokerTyping] = useState(false)
  const [showBroker, setShowBroker] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isValidPhone = (phone: string) => {
    if (!phone) return false
    const cleaned = phone.replace(/\s/g, '')
    return /^\+\d{1,4}\d{8,}$/.test(cleaned) || /^\+\d{1,4}\s?\d{4,}$/.test(cleaned)
  }
  const isValidDNI = (dni: string) => /^[A-Za-z0-9]{6,}$/.test(dni)

  const validateStep = (step: number): string[] => {
    const errors: string[] = []
    switch (step) {
      case 1:
        if (!formData.fullName || formData.fullName.trim().length < 3) errors.push('El nombre completo debe tener al menos 3 caracteres')
        if (!formData.email || !isValidEmail(formData.email)) errors.push('Debe ingresar un email válido')
        if (!formData.phone || !isValidPhone(formData.phone)) errors.push('Debe ingresar un teléfono válido con prefijo internacional')
        if (!formData.dni || !isValidDNI(formData.dni)) errors.push('Debe ingresar un DNI válido (mínimo 6 caracteres)')
        if (!formData.address || formData.address.trim().length < 5) errors.push('Debe ingresar una dirección válida')
        break
      case 2:
        if (formData.financingType !== 'cash' && (!formData.downPayment || parseInt(formData.downPayment) <= 0)) {
          errors.push('Debe ingresar un anticipo válido')
        }
        if (formData.financingType !== 'cash' && parseInt(formData.downPayment) > salePrice) {
          errors.push('El anticipo no puede superar el precio de venta')
        }
        break
      case 3:
        if (!formData.identityDocument) errors.push('Debe subir el documento de identidad')
        if (!formData.incomeProof) errors.push('Debe subir el comprobante de ingresos')
        if (!formData.proofOfFunds) errors.push('Debe subir el comprobante de fondos o preaprobación crediticia')
        break
      case 4:
        if (!formData.agreeToTerms) errors.push('Debe aceptar los términos y condiciones')
        if (!formData.agreeToPrivacy) errors.push('Debe aceptar la política de privacidad')
        break
      default:
        break
    }
    return errors
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [brokerMessages])

  useEffect(() => {
    const errors = validateStep(currentStep)
    setValidationErrors(prev => {
      const newErrors = { ...prev }
      if (errors.length > 0) newErrors[currentStep] = errors
      else delete newErrors[currentStep]
      return newErrors
    })
  }, [formData, currentStep])

  if (!property) return null

  const steps = [
    { id: 1, title: 'Información Personal', icon: User },
    { id: 2, title: 'Detalles de la Compra', icon: DollarSign },
    { id: 3, title: 'Documentación', icon: FileText },
    { id: 4, title: 'Revisar Contrato', icon: FileCheck },
    { id: 5, title: 'Firma Digital', icon: Check }
  ]

  async function processBrokerQuestion(question: string): Promise<string> {
    const lower = question.toLowerCase()
    if (lower.includes('precio') || lower.includes('cuesta') || lower.includes('valor')) {
      return `**Precio de la propiedad:**\n\n💰 **Valor de venta:** $${salePrice.toLocaleString()}\n\n**Opciones de financiamiento:**\n• **Contado:** Pago total al cierre\n• **Crédito hipotecario:** Con anticipo desde 20%\n• **Leasing inmobiliario:** Cuotas mensuales con opción a compra\n\n¿Quieres más detalles sobre alguna opción?`
    }
    if (lower.includes('documento') || lower.includes('papel') || lower.includes('necesito')) {
      return `**Documentos para compra:**\n\n1. **Documento de identidad** (DNI/pasaporte)\n2. **Comprobante de ingresos** (últimos 3 meses)\n3. **Comprobante de fondos** o preaprobación crediticia\n\nTodos en PDF o imagen clara. ¿Alguna duda?`
    }
    if (lower.includes('contrato') || lower.includes('escritura')) {
      return `El contrato de compraventa incluye:\n• Identificación de las partes\n• Descripción de la propiedad\n• Precio y forma de pago\n• Obligaciones de cada parte\n• Plazo de entrega de llaves\n\nTras la firma, se iniciará el proceso de escrituración.`
    }
    if (lower.includes('hola') || lower.includes('hi')) {
      return `¡Hola! Estoy aquí para ayudarte con la compra de **${property?.title}**. Estás en el paso ${currentStep} de ${steps.length}. ¿En qué puedo ayudarte?`
    }
    return `Entiendo tu pregunta sobre la compra. Para esta propiedad el precio es $${salePrice.toLocaleString()}. Si necesitas más detalles sobre documentos, financiamiento o el contrato, pregúntame específicamente.`
  }

  async function handleBrokerSend() {
    if (!brokerInput.trim() || isBrokerTyping) return
    const userMsg: BrokerMessage = { id: Date.now().toString(), role: 'user', content: brokerInput, timestamp: new Date() }
    setBrokerMessages(prev => [...prev, userMsg])
    setBrokerInput('')
    setIsBrokerTyping(true)
    await new Promise(r => setTimeout(r, 600))
    try {
      const response = await processBrokerQuestion(brokerInput)
      setBrokerMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'broker', content: response, timestamp: new Date() }])
    } catch {
      setBrokerMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'broker', content: 'Disculpa, hubo un error. ¿Puedes reformular tu pregunta?', timestamp: new Date() }])
    } finally {
      setIsBrokerTyping(false)
    }
  }

  function handleFileUpload(field: 'identityDocument' | 'incomeProof' | 'proofOfFunds', file: File | null) {
    setFormData(prev => ({ ...prev, [field]: file }))
  }

  function handleNext() {
    const errors = validateStep(currentStep)
    if (errors.length > 0) {
      setValidationErrors(prev => ({ ...prev, [currentStep]: errors }))
      return
    }
    setValidationErrors(prev => {
      const n = { ...prev }
      delete n[currentStep]
      return n
    })
    if (currentStep < steps.length) setCurrentStep(prev => prev + 1)
  }

  function handleStepClick(stepId: number) {
    if (stepId < currentStep || (stepId === currentStep + 1 && validateStep(currentStep).length === 0)) {
      setCurrentStep(stepId)
      setValidationErrors({})
    }
  }

  function handlePrevious() {
    if (currentStep > 1) setCurrentStep(prev => prev - 1)
  }

  async function handleSubmit() {
    try {
      await new Promise(r => setTimeout(r, 1500))
      onComplete?.()
      onClose()
    } catch (e) {
      console.error('Error submitting purchase:', e)
    }
  }

  const canProceed = () => validateStep(currentStep).length === 0
  const canNavigateToStep = (target: number) => target < currentStep || (target === currentStep + 1 && canProceed())

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-500 to-teal-600">
          <div>
            <h2 className="text-2xl font-bold text-white">Proceso de Compra</h2>
            <p className="text-sm text-white/80">{property?.title || 'Propiedad'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowBroker(!showBroker)} className="text-white hover:bg-white/20" icon={<Bot className="w-5 h-5" />}>
              {showBroker ? 'Ocultar' : 'Broker'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20" icon={<X className="w-5 h-5" />}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {steps.map((step, idx) => {
                  const Icon = step.icon
                  const isActive = currentStep === step.id
                  const isCompleted = currentStep > step.id
                  const canNav = canNavigateToStep(step.id)
                  const stepErrors = validationErrors[step.id] || []
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <button
                          type="button"
                          onClick={() => handleStepClick(step.id)}
                          disabled={!canNav && !isActive && !isCompleted}
                          className={classNames(
                            'w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all',
                            !canNav && !isActive && !isCompleted ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110',
                            isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-emerald-500 text-white' : canNav ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                          )}
                        >
                          {isCompleted ? <Check className="w-6 h-6" /> : stepErrors.length ? <AlertCircle className="w-6 h-6 text-red-500" /> : <Icon className="w-6 h-6" />}
                        </button>
                        <span className={classNames('text-xs text-center', isActive ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400')}>{step.title}</span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={classNames('h-1 flex-1 mx-2 -mt-6', isCompleted ? 'bg-green-500' : isActive ? 'bg-emerald-500' : canNav ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-200 dark:bg-gray-700 opacity-50')} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Información Personal</h3>
                    {validationErrors[1]?.length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400">
                            {validationErrors[1].map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      <Input placeholder="Nombre completo *" value={formData.fullName} onChange={v => setFormData(p => ({ ...p, fullName: v }))} icon={<User className="w-4 h-4" />} />
                      <Input type="email" placeholder="Email *" value={formData.email} onChange={v => setFormData(p => ({ ...p, email: v }))} icon={<User className="w-4 h-4" />} />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Teléfono *</label>
                        <PhoneInput value={formData.phone} onChange={v => setFormData(p => ({ ...p, phone: v }))} placeholder="Número de teléfono" />
                      </div>
                      <Input placeholder="DNI / Documento *" value={formData.dni} onChange={v => setFormData(p => ({ ...p, dni: v }))} icon={<User className="w-4 h-4" />} />
                      <div className="md:col-span-2">
                        <Input placeholder="Dirección actual *" value={formData.address} onChange={v => setFormData(p => ({ ...p, address: v }))} icon={<Home className="w-4 h-4" />} />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Detalles de la Compra</h3>
                    {validationErrors[2]?.length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400">{validationErrors[2].map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Precio de venta</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">${salePrice.toLocaleString()}</p>
                        </div>
                        <Building2 className="w-12 h-12 text-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modalidad de pago *</label>
                      <select
                        value={formData.financingType}
                        onChange={e => setFormData(p => ({ ...p, financingType: e.target.value as 'cash' | 'loan' | 'leasing' }))}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="cash">Contado (pago total)</option>
                        <option value="loan">Crédito hipotecario</option>
                        <option value="leasing">Leasing inmobiliario</option>
                      </select>
                    </div>
                    {formData.financingType !== 'cash' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anticipo / Enganche (USD) *</label>
                        <Input
                          type="number"
                          placeholder="Ej: 100000"
                          value={formData.downPayment}
                          onChange={v => setFormData(p => ({ ...p, downPayment: v }))}
                          icon={<Percent className="w-4 h-4" />}
                        />
                        <p className="text-xs text-gray-500 mt-1">Recomendado: 20% o más del valor</p>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Documentación</h3>
                    {validationErrors[3]?.length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400">{validationErrors[3].map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400">Sube los documentos en PDF o imagen clara.</p>
                    {[
                      { key: 'identityDocument' as const, label: 'Documento de Identidad' },
                      { key: 'incomeProof' as const, label: 'Comprobante de Ingresos (últimos 3 meses)' },
                      { key: 'proofOfFunds' as const, label: 'Comprobante de fondos o preaprobación crediticia' }
                    ].map(({ key, label }) => (
                      <div key={key} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label} *</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => handleFileUpload(key, e.target.files?.[0] || null)}
                            className="hidden"
                            id={key}
                          />
                          <label htmlFor={key} className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors flex items-center justify-center gap-2">
                            <Upload className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">{formData[key]?.name || 'Clic para subir'}</span>
                          </label>
                          {formData[key] && (
                            <Button variant="outline" size="sm" onClick={() => handleFileUpload(key, null)} icon={<X className="w-4 h-4" />}>Eliminar</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Contrato de Compraventa</h3>
                    {validationErrors[4]?.length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400">{validationErrors[4].map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300">
                      <h4 className="font-semibold mb-2">CONTRATO DE COMPRAVENTA</h4>
                      <p>Entre <strong>{formData.fullName}</strong> (Comprador) y el vendedor de <strong>{property?.title}</strong>.</p>
                      <div className="mt-4 space-y-2">
                        <p><strong>1. OBJETO:</strong> Venta de la propiedad en {property?.location || 'ubicación indicada'}.</p>
                        <p><strong>2. PRECIO:</strong> ${salePrice.toLocaleString()} ({formData.financingType === 'cash' ? 'contado' : formData.financingType === 'loan' ? 'crédito hipotecario' : 'leasing'}).
                          {formData.financingType !== 'cash' && ` Anticipo: $${parseInt(formData.downPayment || '0').toLocaleString()}`}
                        </p>
                        <p><strong>3. ESCRITURACIÓN:</strong> Se realizará ante escribano público en el plazo acordado.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.agreeToTerms} onChange={e => setFormData(p => ({ ...p, agreeToTerms: e.target.checked }))} className="mt-1 w-4 h-4 text-emerald-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">He leído y acepto los términos del contrato de compraventa</span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.agreeToPrivacy} onChange={e => setFormData(p => ({ ...p, agreeToPrivacy: e.target.checked }))} className="mt-1 w-4 h-4 text-emerald-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Acepto la política de privacidad</span>
                      </label>
                    </div>
                    <Button variant="outline" icon={<Download className="w-4 h-4" />} onClick={() => alert('Descargando contrato en PDF...')}>Descargar contrato en PDF</Button>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Firma Digital</h3>
                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">Al firmar, aceptas todos los términos del contrato de compraventa. La firma tiene validez legal.</p>
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                        <FileCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{formData.fullName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Firma digital válida</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1} icon={<ArrowLeft className="w-4 h-4" />}>Anterior</Button>
              {currentStep < steps.length ? (
                <Button onClick={handleNext} disabled={!canProceed()} icon={<ArrowRight className="w-4 h-4" />}>Siguiente</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canProceed()} icon={<Check className="w-4 h-4" />}>Completar Proceso</Button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showBroker && (
              <motion.div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}>
                <div className="p-4 border-b bg-gradient-to-r from-emerald-500 to-teal-600">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><Bot className="w-5 h-5 text-white" /></div>
                    <div>
                      <h3 className="font-semibold text-white">Broker Virtual</h3>
                      <p className="text-xs text-white/80">Proceso de compra</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {brokerMessages.map(m => (
                    <div key={m.id} className={classNames('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {m.role === 'broker' && <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0"><Bot className="w-5 h-5 text-white" /></div>}
                      <div className={classNames('max-w-[80%] rounded-2xl px-4 py-3 text-sm', m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md')}>
                        <div className="whitespace-pre-wrap">{m.content.split('**').map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}</div>
                      </div>
                      {m.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0"><span className="text-xs font-semibold">Tú</span></div>}
                    </div>
                  ))}
                  {isBrokerTyping && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center"><Bot className="w-5 h-5 text-white" /></div>
                      <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={brokerInput}
                      onChange={e => setBrokerInput(e.target.value)}
                      onKeyPress={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBrokerSend() } }}
                      placeholder="Pregunta al broker..."
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <Button onClick={handleBrokerSend} disabled={!brokerInput.trim() || isBrokerTyping} icon={isBrokerTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
