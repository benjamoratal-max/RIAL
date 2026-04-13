import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  FileText, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Calendar, 
  DollarSign, 
  Home, 
  CreditCard,
  Bot,
  Send,
  FileCheck,
  Download,
  Upload,
  AlertCircle,
  Info,
  Sparkles,
  Loader2,
  Pencil,
  Trash2
} from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { PhoneInput } from './PhoneInput'
import { DEFAULT_OLLAMA_MODEL } from '../utils/generativeAI'
import type { BrokerContext } from '../utils/brokerAI'

interface RentalProcessProps {
  property: any
  user: any
  token: string
  onClose: () => void
  onComplete?: () => void
}

interface BrokerMessage {
  id: string
  role: 'user' | 'broker'
  content: string
  timestamp: Date
}

export function RentalProcess({ property, user, token, onClose, onComplete }: RentalProcessProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    dni: '',
    address: '',
    startDate: '',
    duration: '12',
    monthlyRent: property?.price ?? 0,
    deposit: property?.deposit ?? 0,
    identityDocument: null as File | null,
    selfieWithId: null as File | null,
    incomeProof: null as File | null,
    bankStatement: null as File | null,
    agreeToTerms: false,
    agreeToPrivacy: false,
    /** Firma dibujada en canvas (data URL) */
    signatureDataUrl: null as string | null,
    /** Firma subida como archivo de imagen */
    signatureFile: null as File | null
  })
  const [brokerMessages, setBrokerMessages] = useState<BrokerMessage[]>([
    {
      id: '1',
      role: 'broker',
      content: `¡Hola! 👋 Soy tu broker virtual de RIAL App. Te ayudaré durante todo el proceso de alquiler de **${property?.title ?? 'esta propiedad'}**. 

Estoy aquí para:
• Explicarte cada paso del proceso
• Responder tus dudas sobre el contrato
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
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw')
  const [signatureUploadPreview, setSignatureUploadPreview] = useState<string | null>(null)
  // Fecha del servidor (fuente de verdad; no se usa la del dispositivo para evitar manipulación)
  const [serverToday, setServerToday] = useState<string | null>(null)
  const [serverDateError, setServerDateError] = useState(false)

  useEffect(() => {
    fetch('/api/server-date')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('No ok'))))
      .then((data: { date: string }) => setServerToday(data.date || null))
      .catch(() => setServerDateError(true))
  }, [])

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isValidPhone = (phone: string) => {
    if (!phone) return false
    const cleaned = phone.replace(/\s/g, '')
    return /^\+\d{1,4}\d{8,}$/.test(cleaned) || /^\+\d{1,4}\s?\d{4,}$/.test(cleaned)
  }
  const isValidDNI = (dni: string) => /^[A-Za-z0-9]{6,}$/.test(dni)

  const isTodayOrFutureDate = (dateString: string, minDate: string) => {
    if (!dateString || !minDate) return false
    return dateString >= minDate
  }
  const validateStep = (step: number): string[] => {
    const errors: string[] = []
    switch (step) {
      case 1:
        if (!formData.fullName || formData.fullName.trim().length < 3) errors.push('El nombre completo debe tener al menos 3 caracteres')
        if (!formData.email || !isValidEmail(formData.email)) errors.push('Debe ingresar un email válido')
        if (!formData.phone || !isValidPhone(formData.phone)) errors.push('Debe ingresar un teléfono válido con prefijo internacional (ej: +54 11 1234-5678)')
        if (!formData.dni || !isValidDNI(formData.dni)) errors.push('Debe ingresar un DNI válido (mínimo 6 caracteres)')
        if (!formData.address || formData.address.trim().length < 5) errors.push('Debe ingresar una dirección válida')
        break
      case 2:
        if (serverDateError) errors.push('No se pudo verificar la fecha con el servidor. Intente de nuevo.')
        else if (!serverToday) errors.push('Espere a que se cargue la fecha válida.')
        else if (!formData.startDate) errors.push('Debe seleccionar una fecha de inicio')
        else if (!isTodayOrFutureDate(formData.startDate, serverToday)) errors.push('La fecha de inicio debe ser hoy o una fecha futura.')
        if (!formData.duration) errors.push('Debe seleccionar una duración')
        break
      case 3:
        if (!formData.identityDocument) errors.push('Debe subir el documento de identidad')
        if (!formData.selfieWithId) errors.push('Debe subir la selfie con cédula en mano')
        if (!formData.incomeProof) errors.push('Debe subir el comprobante de ingresos')
        if (!formData.bankStatement) errors.push('Debe subir el estado de cuenta bancario')
        break
      case 4:
        if (!formData.agreeToTerms) errors.push('Debe aceptar los términos y condiciones')
        if (!formData.agreeToPrivacy) errors.push('Debe aceptar la política de privacidad')
        break
      case 5:
        if (!formData.signatureDataUrl && !formData.signatureFile) {
          errors.push('Debe dibujar su firma en el recuadro o subir una imagen de su firma')
        }
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
      if (errors.length > 0) {
        newErrors[currentStep] = errors
      } else {
        delete newErrors[currentStep]
      }
      return newErrors
    })
  }, [formData, currentStep])

  const steps = [
    { id: 1, title: 'Información Personal', icon: User },
    { id: 2, title: 'Detalles del Alquiler', icon: Calendar },
    { id: 3, title: 'Documentación', icon: FileText },
    { id: 4, title: 'Revisar Contrato', icon: FileCheck },
    { id: 5, title: 'Firma Digital', icon: Check }
  ]

  // Broker virtual con IA mejorado (HÍBRIDO: reglas + generativa)
  async function processBrokerQuestion(question: string): Promise<string> {
    // Usar el nuevo motor de broker AI
    const brokerAI = await import('../utils/brokerAI')
    const { GenerativeAIService } = await import('../utils/generativeAI')
    
    const brokerContext: BrokerContext = {
      currentStep,
      totalSteps: steps.length,
      stepName: steps[currentStep - 1]?.title || '',
      formData: {
        monthlyRent: formData.monthlyRent,
        deposit: formData.deposit,
        duration: formData.duration,
        startDate: formData.startDate
      },
      property: {
        title: property?.title,
        price: property?.price,
        location: property?.location
      },
      user: {
        name: user?.name,
        role: user?.role
      },
      conversationHistory: [], // Se actualizará en generateBrokerResponse
      userNeeds: []
    }
    
    // Análisis de intención del broker
    const intent = brokerAI.analyzeBrokerIntent(question, brokerContext)
    
    // ESTRATEGIA HÍBRIDA: Reglas para casos específicos, IA generativa para preguntas complejas
    const useRuleBased = intent.confidence > 0.7 && [
      'documents', 'contract', 'pricing', 'timeline', 'security', 'step_help'
    ].includes(intent.intent)
    
    if (useRuleBased) {
      // Usar sistema de reglas (más rápido y preciso para casos conocidos)
      return brokerAI.generateBrokerResponse(question, brokerContext)
    }
    
    // Para preguntas complejas o no cubiertas -> usar IA generativa
    try {
      const token = localStorage.getItem('token')
      const apiBase = import.meta.env.VITE_API_URL || ''
      const generativeAI = new GenerativeAIService({
        provider: (import.meta.env.VITE_AI_PROVIDER as 'openai' | 'anthropic' | 'ollama' | 'local') || 'ollama',
        apiKey: import.meta.env.VITE_AI_API_KEY,
        model: import.meta.env.VITE_AI_MODEL || DEFAULT_OLLAMA_MODEL,
        baseURL: apiBase ? `${apiBase.replace(/\/$/, '')}/api/ai` : (token ? '/api/ai' : undefined),
        ollamaBaseURL: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
      })
      
      const result = await generativeAI.generateResponse(question, {
        conversationHistory: brokerContext.conversationHistory.map((h: BrokerContext['conversationHistory'][number]) => ({
          question: h.question,
          answer: undefined,
          intent: h.intent,
          timestamp: h.timestamp
        })),
        currentStep: brokerContext.currentStep,
        totalSteps: brokerContext.totalSteps,
        stepName: brokerContext.stepName,
        userRole: 'tenant',
        userPreferences: {},
        brokerFlow: true,
        formData: brokerContext.formData,
        property: brokerContext.property,
        properties: property ? [property] : undefined
      })
      
      return result.answer
    } catch (error) {
      console.error('Error con IA generativa en broker, usando fallback:', error)
      // Fallback a sistema de reglas
      return brokerAI.generateBrokerResponse(question, brokerContext)
    }
  }
  
  // Función legacy mantenida para compatibilidad
  async function processBrokerQuestionLegacy(question: string): Promise<string> {
    const lowerQuestion = question.toLowerCase()
    
    // Análisis contextual del proceso de alquiler
    if (lowerQuestion.includes('hola') || lowerQuestion.includes('hi')) {
      return `¡Hola! 👋 Estoy aquí para ayudarte con el proceso de alquiler de **${property?.title || 'esta propiedad'}**. 

Actualmente estás en el paso ${currentStep} de ${steps.length}: **${steps[currentStep - 1]?.title}**.

¿En qué puedo ayudarte específicamente?`
    }

    if (lowerQuestion.includes('documento') || lowerQuestion.includes('papel') || lowerQuestion.includes('necesito')) {
      return `Para completar el proceso de alquiler, necesitarás:

**Documentos requeridos:**
1. **Documento de identidad** (DNI, pasaporte o licencia) — debe estar vigente y legible
2. **Selfie con cédula en mano** (foto de tu rostro sosteniendo tu documento, para verificación)
3. **Comprobante de ingresos** (últimos 3 meses) — recibos de sueldo, extractos bancarios o declaración jurada
4. **Estado de cuenta bancario** (últimos 2 meses) — para verificar solvencia económica

**Consejos:**
• Asegúrate de que los documentos estén en formato PDF o imagen clara
• Verifica que la información sea legible
• Si tienes dudas sobre algún documento, puedo ayudarte

¿Necesitas ayuda con algún documento específico?`
    }

    if (lowerQuestion.includes('contrato') || lowerQuestion.includes('términos') || lowerQuestion.includes('cláusula')) {
      return `El contrato de alquiler es los **Términos y Condiciones de Alquiler – RIAL APP (Inquilino/Locatario)**. Los verás completos en el paso "Revisar Contrato".

**Resumen de lo que incluyen:**
• **Relación:** El alquiler es entre vos (Locatario) y el Propietario (Locador). RIAL es la plataforma de gestión.
• **Pago:** Solo tarjeta de crédito; débito automático para alquiler, seña, garantía y cargos por daños/mora.
• **Seña 50%** al confirmar; el saldo debe estar acreditado antes del Acceso Digital.
• **Alquiler 3 meses:** se cobran los 3 meses por adelantado + 1 mes de Garantía.
• **Mora:** Si no pagás en 15 días, el Locador puede resolver el contrato y restringir el Acceso Digital.
• **Acceso Digital** (código/QR): personal e intransferible; compartirlo es incumplimiento grave.
• **Devolución:** misma condición que entrega; daños/faltantes se cobran de la Garantía o de la tarjeta.
• **Ley:** República del Paraguay.

Para esta reserva: **Duración** ${formData.duration} meses, **renta** $${formData.monthlyRent.toLocaleString()}/mes, **depósito** $${formData.deposit.toLocaleString()}, **inicio** ${formData.startDate || 'A definir'}.

¿Querés que te aclare alguna cláusula en particular?`
    }

    if (lowerQuestion.includes('precio') || lowerQuestion.includes('cuesta') || lowerQuestion.includes('depósito')) {
      return `**Desglose de costos:**

💰 **Renta mensual:** $${formData.monthlyRent.toLocaleString()}/mes
💵 **Depósito:** $${formData.deposit.toLocaleString()} (se devuelve al finalizar)
📅 **Duración:** ${formData.duration} meses
📊 **Total del contrato:** $${(formData.monthlyRent * parseInt(formData.duration)).toLocaleString()}

**Notas importantes:**
• El depósito se retiene como garantía y se devuelve al finalizar el contrato
• La renta se paga mensualmente por adelantado
• No hay comisiones adicionales en RIAL App

¿Tienes alguna pregunta sobre los pagos?`
    }

    if (lowerQuestion.includes('cuánto') || lowerQuestion.includes('tiempo') || lowerQuestion.includes('demora')) {
      return `**Tiempo estimado del proceso:**

⏱️ **Completar formulario:** 5-10 minutos
📄 **Revisión de documentos:** 24-48 horas
✅ **Aprobación:** 1-3 días hábiles
✍️ **Firma del contrato:** Inmediata (digital)
🔑 **Entrega de llaves:** Coordinada con el propietario

**Total estimado:** 2-5 días hábiles

El proceso es completamente digital y automatizado, lo que lo hace más rápido que los procesos tradicionales. ¿Hay algo específico que te preocupe sobre los tiempos?`
    }

    if (lowerQuestion.includes('seguro') || lowerQuestion.includes('garantía') || lowerQuestion.includes('protección')) {
      return `**Garantías y protecciones:**

🛡️ **RIAL App garantiza:**
• Propiedades verificadas y documentadas
• Contratos legales y protegidos
• Sistema de resolución de disputas
• Soporte durante todo el proceso

**Tu depósito está protegido:**
• Se mantiene en custodia durante el contrato
• Se devuelve íntegramente al finalizar (si no hay daños)
• Proceso transparente de inspección

**Seguro de alquiler (opcional):**
• Puedes contratar un seguro para proteger tus pertenencias
• No es obligatorio pero es recomendable

¿Quieres más información sobre alguna garantía específica?`
    }

    // Respuesta contextual basada en el paso actual
    const stepContext = {
      1: 'Estás completando tu información personal. Asegúrate de que todos los datos sean correctos.',
      2: 'Estás definiendo los detalles del alquiler: fecha de inicio y duración.',
      3: 'Estás subiendo los documentos necesarios. Asegúrate de que estén claros y legibles.',
      4: 'Estás revisando el contrato. Lee cuidadosamente todos los términos.',
      5: 'Estás a punto de firmar digitalmente. Una vez firmado, el contrato será legalmente vinculante.'
    }

    return `${stepContext[currentStep as keyof typeof stepContext] || 'Estoy aquí para ayudarte en cualquier paso del proceso.'}

**Próximos pasos:**
${steps.slice(currentStep).map((s, i) => `${i + 1}. ${s.title}`).join('\n')}

¿Tienes alguna pregunta específica sobre el proceso?`
  }

  async function handleBrokerSend() {
    if (!brokerInput.trim() || isBrokerTyping) return

    const userMessage: BrokerMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: brokerInput,
      timestamp: new Date()
    }

    setBrokerMessages(prev => [...prev, userMessage])
    setBrokerInput('')
    setIsBrokerTyping(true)

    await new Promise(resolve => setTimeout(resolve, 800))

    try {
      const response = await processBrokerQuestion(brokerInput)
      
      const brokerMessage: BrokerMessage = {
        id: (Date.now() + 1).toString(),
        role: 'broker',
        content: response,
        timestamp: new Date()
      }

      setBrokerMessages(prev => [...prev, brokerMessage])
    } catch (error) {
      console.error('Error processing broker question:', error)
    } finally {
      setIsBrokerTyping(false)
    }
  }

  function handleFileUpload(field: 'identityDocument' | 'selfieWithId' | 'incomeProof' | 'bankStatement', file: File | null) {
    setFormData(prev => ({ ...prev, [field]: file }))
  }

  // --- Firma digital: coordenadas en canvas (soporta escalado CSS)
  function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function handleSignatureStart(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const isTouch = 'touches' in e
    const clientX = isTouch ? e.touches[0].clientX : e.clientX
    const clientY = isTouch ? e.touches[0].clientY : e.clientY
    const { x, y } = getCanvasPoint(canvas, clientX, clientY)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  function handleSignatureMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const isTouch = 'touches' in e
    const clientX = isTouch ? e.touches[0].clientX : e.clientX
    const clientY = isTouch ? e.touches[0].clientY : e.clientY
    const { x, y } = getCanvasPoint(canvas, clientX, clientY)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handleSignatureEnd() {
    setIsDrawing(false)
  }

  function clearSignatureCanvas() {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setFormData(prev => ({ ...prev, signatureDataUrl: null, signatureFile: null }))
    setSignatureUploadPreview(null)
  }

  function saveDrawnSignature() {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const isEmpty = !ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((_, i) => i % 4 === 3 && _ > 0)
    if (isEmpty) return
    const dataUrl = canvas.toDataURL('image/png')
    setFormData(prev => ({ ...prev, signatureDataUrl: dataUrl, signatureFile: null }))
    setSignatureUploadPreview(null)
  }

  function handleSignatureFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (signatureUploadPreview) URL.revokeObjectURL(signatureUploadPreview)
    setFormData(prev => ({ ...prev, signatureFile: file, signatureDataUrl: null }))
    setSignatureUploadPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function removeUploadedSignature() {
    setFormData(prev => ({ ...prev, signatureFile: null }))
    if (signatureUploadPreview) {
      URL.revokeObjectURL(signatureUploadPreview)
    }
    setSignatureUploadPreview(null)
  }

  // Inicializar canvas cuando se entra al paso 5 (firma)
  useEffect(() => {
    if (currentStep !== 5) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [currentStep])

  // Mantener vista previa de firma subida si volvemos al paso 5
  useEffect(() => {
    if (currentStep === 5 && formData.signatureFile && !signatureUploadPreview) {
      setSignatureUploadPreview(URL.createObjectURL(formData.signatureFile))
    }
  }, [currentStep, formData.signatureFile])

  function handleNext() {
    // Validar el paso actual antes de avanzar
    const errors = validateStep(currentStep)
    if (errors.length > 0) {
      // Mostrar errores y prevenir el avance
      setValidationErrors(prev => ({ ...prev, [currentStep]: errors }))
      return // IMPORTANTE: No avanzar si hay errores
    }
    
    // Solo avanzar si no hay errores
    // Limpiar errores del paso actual
    setValidationErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[currentStep]
      return newErrors
    })
    
    // Avanzar al siguiente paso solo si estamos dentro del rango
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1)
    }
  }

  function handleStepClick(stepId: number) {
    // Solo permitir navegación si el paso está disponible
    if (canNavigateToStep(stepId)) {
      setCurrentStep(stepId)
      // Limpiar errores al cambiar de paso
      setValidationErrors({})
    } else {
      // Si no puede navegar, mostrar errores del paso que está bloqueando
      const blockingStep = stepId > currentStep ? currentStep : stepId
      const errors = validateStep(blockingStep)
      if (errors.length > 0) {
        setValidationErrors(prev => ({ ...prev, [blockingStep]: errors }))
      }
    }
  }

  function handlePrevious() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  async function handleSubmit() {
    // Aquí se enviaría la información al backend
    try {
      // Simular envío
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      if (onComplete) {
        onComplete()
      }
      onClose()
    } catch (error) {
      console.error('Error submitting rental process:', error)
    }
  }

  // Función para verificar si se puede avanzar (sin actualizar estado durante render)
  const canProceed = (): boolean => {
    const errors = validateStep(currentStep)
    return errors.length === 0
  }

  // Función para obtener y mostrar errores del paso actual
  const getCurrentStepErrors = (): string[] => {
    return validateStep(currentStep)
  }

  // Verificar si un paso está completado (para deshabilitar clics en el progress bar)
  const isStepCompleted = (stepId: number) => {
    const errors = validateStep(stepId)
    return errors.length === 0
  }

  // Verificar si se puede navegar a un paso específico
  const canNavigateToStep = (targetStep: number): boolean => {
    // Puede ir hacia atrás siempre
    if (targetStep < currentStep) return true
    
    // Para avanzar, todos los pasos anteriores (incluyendo el actual) deben estar completos
    // No permitir saltar pasos sin completarlos
    for (let i = 1; i <= currentStep; i++) {
      const errors = validateStep(i)
      if (errors.length > 0) {
        return false // No puede avanzar si hay errores en pasos anteriores o actual
      }
    }
    
    // Si el paso objetivo es mayor que el actual + 1, no permitir saltar
    if (targetStep > currentStep + 1) {
      return false // No permitir saltar pasos
    }
    
    return true
  }

  if (!property) {
    console.error('RentalProcess: property is required')
    return null
  }

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
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600">
          <div>
            <h2 className="text-2xl font-bold text-white">Proceso de Alquiler Virtual</h2>
            <p className="text-sm text-white/80">{property?.title || 'Propiedad'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBroker(!showBroker)}
              className="text-white hover:bg-white/20"
              icon={<Bot className="w-5 h-5" />}
            >
              {showBroker ? 'Ocultar' : 'Broker'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
              icon={<X className="w-5 h-5" />}
            >
              Cerrar
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Contenido principal */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  const isActive = currentStep === step.id
                  const isCompleted = currentStep > step.id
                  const canNavigate = canNavigateToStep(step.id)
                  const stepErrors = validationErrors[step.id] || []
                  
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <button
                          type="button"
                          onClick={() => handleStepClick(step.id)}
                          disabled={!canNavigate}
                          className={classNames(
                            'w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all',
                            !canNavigate && !isActive && !isCompleted ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110',
                            isCompleted ? 'bg-green-500 text-white' :
                            isActive ? 'bg-blue-500 text-white' :
                            canNavigate ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600' :
                            'bg-gray-200 dark:bg-gray-700 text-gray-400'
                          )}
                          title={!canNavigate && !isActive ? 'Completa los pasos anteriores primero' : step.title}
                        >
                          {isCompleted ? (
                            <Check className="w-6 h-6" />
                          ) : stepErrors.length > 0 ? (
                            <AlertCircle className="w-6 h-6 text-red-500" />
                          ) : (
                            <Icon className="w-6 h-6" />
                          )}
                        </button>
                        <span className={classNames(
                          'text-xs text-center',
                          isActive ? 'text-blue-600 dark:text-blue-400 font-medium' :
                          'text-gray-500 dark:text-gray-400'
                        )}>
                          {step.title}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={classNames(
                          'h-1 flex-1 mx-2 -mt-6',
                          isCompleted ? 'bg-green-500' :
                          isActive ? 'bg-blue-500' :
                          canNavigate ? 'bg-gray-200 dark:bg-gray-700' :
                          'bg-gray-200 dark:bg-gray-700 opacity-50'
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Step 1: Información Personal */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Información Personal</h3>
                    {validationErrors[1] && validationErrors[1].length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                              Por favor, completa los siguientes campos:
                            </p>
                            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                              {validationErrors[1].map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Input
                          placeholder="Nombre completo *"
                          value={formData.fullName}
                          onChange={(value) => {
                            setFormData(prev => ({ ...prev, fullName: value }))
                            // Limpiar error al escribir
                            if (validationErrors[1]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[1]) {
                                  newErrors[1] = newErrors[1].filter(e => !e.includes('nombre completo'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          icon={<User className="w-4 h-4" />}
                        />
                      </div>
                      <div>
                        <Input
                          type="email"
                          placeholder="Email *"
                          value={formData.email}
                          onChange={(value) => {
                            setFormData(prev => ({ ...prev, email: value }))
                            if (validationErrors[1]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[1]) {
                                  newErrors[1] = newErrors[1].filter(e => !e.includes('email'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          icon={<User className="w-4 h-4" />}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Teléfono *
                        </label>
                        <PhoneInput
                          value={formData.phone}
                          onChange={(value) => {
                            setFormData(prev => ({ ...prev, phone: value }))
                            if (validationErrors[1]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[1]) {
                                  newErrors[1] = newErrors[1].filter(e => !e.includes('teléfono'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          placeholder="Número de teléfono"
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="DNI / Documento de identidad *"
                          value={formData.dni}
                          onChange={(value) => {
                            setFormData(prev => ({ ...prev, dni: value }))
                            if (validationErrors[1]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[1]) {
                                  newErrors[1] = newErrors[1].filter(e => !e.includes('DNI'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          icon={<User className="w-4 h-4" />}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          placeholder="Dirección actual *"
                          value={formData.address}
                          onChange={(value) => {
                            setFormData(prev => ({ ...prev, address: value }))
                            if (validationErrors[1]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[1]) {
                                  newErrors[1] = newErrors[1].filter(e => !e.includes('dirección'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          icon={<Home className="w-4 h-4" />}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Detalles del Alquiler */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Detalles del Alquiler</h3>
                    {validationErrors[2] && validationErrors[2].length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                              Por favor, completa los siguientes campos:
                            </p>
                            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                              {validationErrors[2].map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Fecha de inicio *
                        </label>
                        {serverDateError && (
                          <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                            No se pudo obtener la fecha del servidor. Recargue la página o intente más tarde.
                          </p>
                        )}
                        <Input
                          type="date"
                          min={serverToday ?? undefined}
                          value={formData.startDate}
                          placeholder={serverToday ? 'Selecciona fecha' : 'Cargando fecha...'}
                          disabled={!serverToday || serverDateError}
                          onChange={(value) => {
                            setFormData(prev => ({ ...prev, startDate: value }))
                            if (validationErrors[2]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[2]) {
                                  newErrors[2] = newErrors[2].filter(e => !e.includes('fecha'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          icon={<Calendar className="w-4 h-4" />}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Duración (meses) *
                        </label>
                        <select
                          value={formData.duration}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, duration: e.target.value }))
                            if (validationErrors[2]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[2]) {
                                  newErrors[2] = newErrors[2].filter(e => !e.includes('duración'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecciona duración</option>
                          <option value="3">3 meses</option>
                          <option value="6">6 meses</option>
                          <option value="12">12 meses</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Renta mensual</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                              ${formData.monthlyRent.toLocaleString()}/mes
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Depósito</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                              ${formData.deposit.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Documentación */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Documentación Requerida</h3>
                    {validationErrors[3] && validationErrors[3].length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                              Por favor, sube los siguientes documentos:
                            </p>
                            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                              {validationErrors[3].map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Sube los siguientes documentos en formato PDF o imagen. Asegúrate de que sean claros y legibles.
                    </p>
                    
                    {[
                      { key: 'identityDocument', label: 'Documento de Identidad', required: true, accept: '.pdf,.jpg,.jpeg,.png' },
                      { key: 'selfieWithId', label: 'Selfie con cédula en mano', required: true, accept: 'image/*,.jpg,.jpeg,.png' },
                      { key: 'incomeProof', label: 'Comprobante de Ingresos (últimos 3 meses)', required: true, accept: '.pdf,.jpg,.jpeg,.png' },
                      { key: 'bankStatement', label: 'Estado de Cuenta Bancario (últimos 2 meses)', required: true, accept: '.pdf,.jpg,.jpeg,.png' }
                    ].map((doc) => (
                      <div key={doc.key} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {doc.label} {doc.required && <span className="text-red-500">*</span>}
                        </label>
                        {doc.key === 'selfieWithId' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Una foto de tu rostro sosteniendo tu cédula/documento de identidad, para verificación.
                          </p>
                        )}
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept={doc.accept}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              handleFileUpload(doc.key as any, file)
                              // Limpiar error al subir archivo
                              if (file && validationErrors[3]) {
                                setValidationErrors(prev => {
                                  const newErrors = { ...prev }
                                  if (newErrors[3]) {
                                    const docLabel = doc.label.toLowerCase()
                                    newErrors[3] = newErrors[3].filter(e => !e.toLowerCase().includes(docLabel))
                                  }
                                  return newErrors
                                })
                              }
                            }}
                            className="hidden"
                            id={doc.key}
                          />
                          <label
                            htmlFor={doc.key}
                            className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
                          >
                            <Upload className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formData[doc.key as keyof typeof formData] 
                                ? (formData[doc.key as keyof typeof formData] as File)?.name 
                                : 'Haz clic para subir archivo'}
                            </span>
                          </label>
                          {formData[doc.key as keyof typeof formData] && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleFileUpload(doc.key as any, null)
                                // Limpiar error al eliminar archivo
                                if (validationErrors[3]) {
                                  setValidationErrors(prev => {
                                    const newErrors = { ...prev }
                                    if (newErrors[3]) {
                                      const docLabel = doc.label.toLowerCase()
                                      newErrors[3] = newErrors[3].filter(e => !e.toLowerCase().includes(docLabel))
                                    }
                                    return newErrors
                                  })
                                }
                              }}
                              icon={<X className="w-4 h-4" />}
                            >
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 4: Revisar Contrato */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Contrato de Alquiler</h3>
                    {validationErrors[4] && validationErrors[4].length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                              Por favor, acepta los siguientes términos:
                            </p>
                            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                              {validationErrors[4].map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                        <p className="font-semibold text-base">TÉRMINOS Y CONDICIONES DE ALQUILER – RIAL APP (INQUILINO/LOCATARIO)</p>
                        <p>Última actualización: 13 de febrero de 2026</p>
                        <p>Estos Términos y Condiciones (los &quot;Términos&quot;) regulan el uso de RIAL App (&quot;RIAL&quot;) para alquilar inmuebles publicados en la plataforma. Al presionar &quot;Acepto&quot;, confirmar una reserva/alquiler o registrar una tarjeta, el usuario que alquila (&quot;Locatario&quot;) acepta estos Términos, las condiciones específicas de la Publicación (precio, fechas, inmueble, reglas del anuncio) y cualquier política mostrada en el proceso de contratación (en conjunto, el &quot;Contrato de Alquiler&quot;).</p>
                        <p><strong>Relación contractual:</strong> El alquiler se celebra entre el Locatario y el Propietario/Anfitrión (&quot;Locador&quot;). RIAL actúa como plataforma tecnológica de gestión (publicación, reserva, mensajería y cobros), salvo que se indique expresamente lo contrario.</p>

                        <h4 className="font-semibold mb-1">1) Definiciones</h4>
                        <p><strong>Publicación:</strong> Anuncio del inmueble en RIAL con descripción, precio, fechas, capacidad y reglas.</p>
                        <p><strong>Reserva/Alquiler:</strong> Confirmación del inmueble para un período determinado.</p>
                        <p><strong>Seña:</strong> Pago inicial equivalente al 50% (cuando aplique).</p>
                        <p><strong>Garantía (Depósito de Seguridad):</strong> Monto destinado a cubrir daños, faltantes, limpieza extraordinaria o deudas del Locatario.</p>
                        <p><strong>Acceso Digital:</strong> Ingreso sin llaves (código, QR, token, cerradura inteligente u otro).</p>

                        <h4 className="font-semibold mb-1">2) Medio de pago único: tarjeta de crédito asociada a la cuenta (débito automático)</h4>
                        <p><strong>2.1 Exclusividad del medio de pago.</strong> El Locatario reconoce y acepta que el único medio de pago disponible en RIAL es una tarjeta de crédito vinculada a su cuenta. No se aceptan transferencias, efectivo, depósitos, billeteras u otros medios.</p>
                        <p><strong>2.2 Autorización expresa de débito automático (cargos recurrentes).</strong> Al registrar una tarjeta y/o aceptar estos Términos, el Locatario autoriza expresa e irrevocablemente (mientras exista una reserva vigente o montos pendientes) a RIAL y/o al procesador de pagos designado por RIAL a debitar/cargar automáticamente en dicha tarjeta, sin necesidad de aviso previo y sin requerir autorizaciones adicionales por cada cobro, todos los importes derivados del Contrato de Alquiler, incluyendo, sin limitación: alquiler(es) del período contratado; Seña y/o saldo cuando corresponda; Garantía cuando corresponda (incluida su retención total/parcial); cargos por daños, faltantes, limpieza extraordinaria, penalidades, consumos impagos o diferencias no cubiertas por la Garantía; montos adeudados por mora, reintentos de cobro y/o costos asociados por incumplimiento (si aplicaran y estuvieran permitidos).</p>
                        <p><strong>2.3 Fechas de cobro.</strong> Los importes se debitarán en las fechas correspondientes del alquiler y/o del calendario de pagos que figure en la Publicación, en la confirmación de reserva o en el checkout de RIAL (las &quot;Fechas de Cobro&quot;). El Locatario acepta que los cargos se realizarán automáticamente en cada Fecha de Cobro.</p>
                        <p><strong>2.4 Obligación de mantener tarjeta válida y fondos disponibles.</strong> El Locatario es responsable de: mantener una tarjeta vigente y habilitada; actualizar datos cuando cambie o venza; asegurar límite y fondos disponibles para el cobro. Si la tarjeta es rechazada, vencida, bloqueada o sin límite, ello no libera al Locatario de sus obligaciones y se considerará incumplimiento.</p>
                        <p><strong>2.5 Notificaciones y comprobantes.</strong> RIAL podrá (cuando sea posible) emitir comprobantes, recibos o notificaciones por app/email/WhatsApp, pero el Locatario acepta que no son condición para que el cobro sea válido ni para que se ejecute el débito.</p>
                        <p><strong>2.6 Reintentos de cobro.</strong> Ante un rechazo, RIAL podrá efectuar reintentos automáticos de cobro. El estado de &quot;pago pendiente&quot; no suspende las obligaciones del Locatario.</p>

                        <h4 className="font-semibold mb-1">3) Condiciones de pago del alquiler (Seña, saldo y regla 3 meses)</h4>
                        <p><strong>3.1 Seña del 50% al alquilar desde la app.</strong> Al confirmar el alquiler, el Locatario podrá abonar una Seña del 50% del monto correspondiente (según el flujo disponible). La Seña se imputa al total.</p>
                        <p><strong>3.2 Saldo y condición para habilitar acceso.</strong> El saldo y cualquier importe exigible debe estar acreditado antes de habilitar el Acceso Digital. Si no se acredita, no habrá habilitación de acceso.</p>
                        <p><strong>3.3 Regla obligatoria: contrato/alquiler por 3 meses.</strong> Si el Locatario contrata un alquiler de 3 (tres) meses, acepta que se cobrará: los 3 meses completos por adelantado, más 1 (un) mes adicional en concepto de Garantía, todo en un solo cobro (o en el flujo equivalente que muestre la app) y antes de habilitarse el Acceso Digital.</p>

                        <h4 className="font-semibold mb-1">4) Mora, falta de pago y cancelación por incumplimiento (15 días)</h4>
                        <p><strong>4.1 Mora automática.</strong> La falta de pago total o parcial genera mora automática, sin necesidad de intimación.</p>
                        <p><strong>4.2 Cancelación/Resolución a los 15 días.</strong> Si el Locatario no regulariza el pago dentro de 15 (quince) días corridos desde el vencimiento, el Locador podrá cancelar y/o resolver el alquiler, con estas consecuencias: pérdida del derecho de uso/ocupación; obligación de desocupar y permitir la restitución; aplicación de Garantía a deudas/daños; cobro de diferencias pendientes mediante la tarjeta asociada y/o reclamo por vías legales.</p>
                        <p><strong>4.3 Restricción del Acceso Digital por mora.</strong> En caso de mora, si es técnica y legalmente posible, el Locador y/o RIAL podrán suspender o restringir el Acceso Digital hasta regularización.</p>

                        <h4 className="font-semibold mb-1">5) Acceso al inmueble (sin llaves): código/QR y responsabilidad</h4>
                        <p><strong>5.1 Acceso Digital.</strong> No hay llaves físicas. El ingreso se realiza mediante Acceso Digital.</p>
                        <p><strong>5.2 Personal e intransferible.</strong> El Locatario se obliga a no compartir ni divulgar el Acceso Digital. Todo acceso con esa credencial se presume realizado por el Locatario o bajo su responsabilidad.</p>
                        <p><strong>5.3 Uso indebido = incumplimiento grave.</strong> Compartir/divulgar/manipular el acceso constituye incumplimiento grave y habilita deshabilitación del acceso, cancelación/resolución y cargos por daños/costos (incluida ejecución de Garantía).</p>

                        <h4 className="font-semibold mb-1">6) Estado del inmueble y devolución (misma condición)</h4>
                        <p><strong>6.1 Estándar de condición.</strong> El inmueble debe devolverse en las mismas condiciones en que fue entregado, conforme evidencia razonable (fotos/video/checklist digital/informes).</p>
                        <p><strong>6.2 Daños o mal estado: ejecución de garantía y cargos adicionales.</strong> Si hay daños, faltantes, suciedad extraordinaria o deudas: se podrá ejecutar total/parcialmente la Garantía, y si no alcanza, se autoriza el cobro automático del remanente a la tarjeta registrada.</p>

                        <h4 className="font-semibold mb-1">7) Conducta, uso permitido y reglas del anuncio</h4>
                        <p>El Locatario debe respetar capacidad, destino permitido, reglamentos, convivencia y reglas de la Publicación. Queda prohibido subalquilar o ceder sin autorización. Incumplimientos pueden derivar en cargos, restricción de acceso o cancelación del alquiler.</p>

                        <h4 className="font-semibold mb-1">8) Cancelaciones, cambios y no presentación</h4>
                        <p>Aplican las políticas mostradas en RIAL al contratar y/o las reglas del anuncio. Lo aceptado en checkout/confirmación prevalece para esa reserva.</p>

                        <h4 className="font-semibold mb-1">9) Disputas de cobro, contracargos y fraude</h4>
                        <p>Si el Locatario desconoce un cargo, debe iniciar primero el reclamo por los canales de soporte de RIAL. El uso de contracargos (chargebacks) de forma fraudulenta o abusiva podrá implicar suspensión de cuenta, cancelación de reservas y acciones de cobro/reclamo, sin perjuicio de lo que corresponda legalmente.</p>

                        <h4 className="font-semibold mb-1">10) Rol de RIAL</h4>
                        <p>RIAL facilita la gestión tecnológica y de cobros, pero no reemplaza las obligaciones del Locador ni del Locatario. RIAL podrá suspender cuentas ante fraude, incumplimientos o riesgos de seguridad.</p>

                        <h4 className="font-semibold mb-1">11) Aceptación electrónica y prueba</h4>
                        <p>El click de aceptación, el registro de tarjeta, comprobantes de pago y logs del sistema constituyen evidencia válida del consentimiento y de la operatoria.</p>

                        <h4 className="font-semibold mb-1">12) Ley aplicable y jurisdicción</h4>
                        <p>Se rige por las leyes de la República del Paraguay, en lo aplicable.</p>

                        <p className="pt-2 border-t border-gray-200 dark:border-gray-600 mt-4">Al aceptar, el Locatario <strong>{formData.fullName}</strong> confirma el alquiler de la propiedad <strong>{property?.title}</strong> ({property?.location || 'ubicación indicada'}) bajo estos Términos.</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.agreeToTerms}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))
                            if (validationErrors[4]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[4]) {
                                  newErrors[4] = newErrors[4].filter(e => !e.includes('términos'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          He leído y acepto los términos y condiciones del contrato de alquiler
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.agreeToPrivacy}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, agreeToPrivacy: e.target.checked }))
                            if (validationErrors[4]) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                if (newErrors[4]) {
                                  newErrors[4] = newErrors[4].filter(e => !e.includes('privacidad'))
                                }
                                return newErrors
                              })
                            }
                          }}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Acepto la política de privacidad y el tratamiento de mis datos personales
                        </span>
                      </label>
                    </div>
                    
                    <Button
                      variant="outline"
                      icon={<Download className="w-4 h-4" />}
                      onClick={() => {
                        // Generar PDF del contrato
                        alert('Descargando contrato en PDF...')
                      }}
                    >
                      Descargar contrato en PDF
                    </Button>
                  </div>
                )}

                {/* Step 5: Firma Digital - dibujar o subir imagen */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Firma Digital</h3>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                        Al firmar digitalmente, aceptas todos los términos del contrato de alquiler. Puedes <strong>dibujar tu firma</strong> en el recuadro o <strong>subir una imagen</strong> de tu firma (PNG, JPG).
                      </p>

                      {/* Ya tiene firma guardada: mostrar vista previa y opción de cambiar */}
                      {(formData.signatureDataUrl || formData.signatureFile || signatureUploadPreview) && (
                        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tu firma</p>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white flex items-center justify-center min-h-[100px] min-w-[200px] max-w-full">
                              {(formData.signatureDataUrl || signatureUploadPreview) && (
                                <img src={formData.signatureDataUrl || signatureUploadPreview || ''} alt="Firma" className="max-h-28 w-auto object-contain" />
                              )}
                              {formData.signatureFile && !signatureUploadPreview && (
                                <span className="text-sm text-gray-500">Imagen de firma cargada</span>
                              )}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => { clearSignatureCanvas(); removeUploadedSignature(); setSignatureMode('draw') }} icon={<Trash2 className="w-4 h-4" />}>
                              Cambiar firma
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{formData.fullName} — Firma digital válida legalmente</p>
                        </div>
                      )}

                      {/* Opciones: Dibujar o Subir */}
                      {!formData.signatureDataUrl && !formData.signatureFile && (
                        <>
                          <div className="flex gap-2 mb-4">
                            <button
                              type="button"
                              onClick={() => setSignatureMode('draw')}
                              className={classNames(
                                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                                signatureMode === 'draw'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                              )}
                            >
                              <Pencil className="w-4 h-4" /> Dibujar firma
                            </button>
                            <button
                              type="button"
                              onClick={() => setSignatureMode('upload')}
                              className={classNames(
                                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                                signatureMode === 'upload'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                              )}
                            >
                              <Upload className="w-4 h-4" /> Subir imagen
                            </button>
                          </div>

                          {signatureMode === 'draw' && (
                            <div className="space-y-3">
                              <div className="border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-800 touch-none">
                                <canvas
                                  ref={signatureCanvasRef}
                                  width={400}
                                  height={200}
                                  className="w-full max-w-full h-auto block cursor-crosshair border-0"
                                  style={{ touchAction: 'none' }}
                                  onMouseDown={handleSignatureStart}
                                  onMouseMove={handleSignatureMove}
                                  onMouseUp={handleSignatureEnd}
                                  onMouseLeave={handleSignatureEnd}
                                  onTouchStart={handleSignatureStart}
                                  onTouchMove={handleSignatureMove}
                                  onTouchEnd={handleSignatureEnd}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={clearSignatureCanvas} icon={<Trash2 className="w-4 h-4" />}>
                                  Limpiar
                                </Button>
                                <Button size="sm" onClick={saveDrawnSignature} icon={<Check className="w-4 h-4" />}>
                                  Usar esta firma
                                </Button>
                              </div>
                            </div>
                          )}

                          {signatureMode === 'upload' && (
                            <div className="space-y-3">
                              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <Upload className="w-10 h-10 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Haz clic o arrastra una imagen de tu firma (PNG, JPG)</span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/webp"
                                  className="hidden"
                                  onChange={handleSignatureFileChange}
                                />
                              </label>
                              {signatureUploadPreview && (
                                <div className="flex items-center gap-2">
                                  <img src={signatureUploadPreview} alt="Vista previa firma" className="max-h-20 rounded border border-gray-200 dark:border-gray-600" />
                                  <Button variant="outline" size="sm" onClick={removeUploadedSignature}>Quitar</Button>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Anterior
              </Button>
              
              {currentStep < steps.length ? (
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleNext()
                  }}
                  disabled={!canProceed()}
                  icon={<ArrowRight className="w-4 h-4" />}
                  title={!canProceed() ? 'Completa todos los campos requeridos para continuar' : ''}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSubmit()
                  }}
                  disabled={!canProceed()}
                  icon={<Check className="w-4 h-4" />}
                  title={!canProceed() ? 'Completa todos los campos requeridos para finalizar' : ''}
                >
                  Completar Proceso
                </Button>
              )}
            </div>
          </div>

          {/* Broker Virtual Sidebar */}
          <AnimatePresence>
            {showBroker && (
              <motion.div
                className="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Broker Virtual</h3>
                      <p className="text-xs text-white/80">Asistente con IA</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {brokerMessages.map((message) => (
                    <div
                      key={message.id}
                      className={classNames(
                        'flex gap-3',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role === 'broker' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div
                        className={classNames(
                          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md'
                        )}
                      >
                        <div className="whitespace-pre-wrap">
                          {message.content.split('**').map((part, i) => 
                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                          )}
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tú</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isBrokerTyping && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
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
                      onChange={(e) => setBrokerInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleBrokerSend()
                        }
                      }}
                      placeholder="Pregunta al broker..."
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      onClick={handleBrokerSend}
                      disabled={!brokerInput.trim() || isBrokerTyping}
                      icon={isBrokerTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    />
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

