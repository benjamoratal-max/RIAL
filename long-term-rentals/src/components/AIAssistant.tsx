import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, X, Sparkles, Loader2, Home, MapPin, DollarSign, Star, TrendingUp } from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { analyzeIntent } from '../utils/aiEngine'
import type { ConversationMemory } from '../utils/aiEngine'
import { generateIntentResponse } from '../utils/responseGenerator'
import type { ResponseContext } from '../utils/responseGenerator'
import { generateSmartSuggestions, generateFollowUpSuggestions } from '../utils/smartSuggestions'
import { GenerativeAIService, DEFAULT_OLLAMA_MODEL } from '../utils/generativeAI'
import { RIAL_BROKER_WELCOME_MESSAGE } from '../utils/rialBrokerPrompt'
import { LearningSystem } from '../utils/learningSystem'
import { AIFeedback } from './AIFeedback'
import { useTranslation } from 'react-i18next'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  properties?: any[]
  context?: {
    mentionedProperties?: number[]
    mentionedLocations?: string[]
    priceRange?: { min: number; max: number }
    preferences?: any
  }
}

type PendingAssistantAction =
  | {
      type: 'apply_filters'
      payload: {
        location?: string
        minPrice?: number
        maxPrice?: number
        bedrooms?: number
        bathrooms?: number
        petsAllowed?: boolean
        furnished?: boolean
        parking?: boolean
      }
      summary: string
    }
  | {
      type: 'open_property' | 'request_visit' | 'start_prequalification'
      payload: { propertyId: number }
      summary: string
    }

// Usar ConversationMemory del motor de IA

interface AIAssistantProps {
  properties: any[]
  onClose: () => void
  onPropertyClick?: (propertyId: number) => void
  /** Permite que la IA ajuste filtros de búsqueda de la app (location, precio, etc.) */
  onSearchFiltersChange?: (partialFilters: {
    location?: string
    minPrice?: number
    maxPrice?: number
    bedrooms?: number
    bathrooms?: number
    petsAllowed?: boolean
    furnished?: boolean
    parking?: boolean
  }) => void
  /** Permite disparar, desde el chat, el flujo de "solicitar visita" sobre una propiedad concreta */
  onRequestVisit?: (propertyId: number) => void
  /** Permite disparar, desde el chat, el flujo de "revisar elegibilidad / pre-calificación" sobre una propiedad concreta */
  onStartPrequalification?: (propertyId: number) => void
  /** Si es false, se oculta el panel pero se mantiene la conversación (no se desmonta) */
  isOpen?: boolean
}

export function AIAssistant({
  properties,
  onClose,
  onPropertyClick,
  onSearchFiltersChange,
  onRequestVisit,
  onStartPrequalification,
  isOpen = true,
}: AIAssistantProps) {
  const { t, i18n } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: RIAL_BROKER_WELCOME_MESSAGE,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [currentKnowledgeId, setCurrentKnowledgeId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const generativeAI = useRef<GenerativeAIService | null>(null)
  const pendingActionRef = useRef<PendingAssistantAction | null>(null)
  const contextRef = useRef<ConversationMemory>({
    userPreferences: {},
    mentionedProperties: [],
    conversationHistory: [],
    entities: {
      properties: new Map(),
      locations: new Set(),
      prices: [],
      features: new Set()
    }
  })

  function isConfirmationIntent(text: string): boolean {
    const lower = text.toLowerCase()
    return ['si', 'sí', 'dale', 'ok', 'okay', 'confirmo', 'confirmar', 'hazlo', 'do it', 'yes'].some((token) =>
      lower.includes(token)
    )
  }

  function isCancellationIntent(text: string): boolean {
    const lower = text.toLowerCase()
    return ['no', 'cancelar', 'cancela', 'stop', 'detener', 'no gracias', 'mejor no'].some((token) =>
      lower.includes(token)
    )
  }

  function mergeIntentWithMemory(intentAnalysis: ReturnType<typeof analyzeIntent>) {
    const merged = {
      ...intentAnalysis,
      entities: {
        ...intentAnalysis.entities,
        locations: [...intentAnalysis.entities.locations],
        features: [...intentAnalysis.entities.features],
        prices: [...intentAnalysis.entities.prices],
        requirements: { ...intentAnalysis.entities.requirements },
      },
    }

    if (merged.entities.locations.length === 0 && contextRef.current.entities.locations.size > 0) {
      merged.entities.locations = Array.from(contextRef.current.entities.locations).slice(-2)
    }

    if (merged.entities.features.length === 0 && contextRef.current.userPreferences.requiredFeatures?.length) {
      merged.entities.features = contextRef.current.userPreferences.requiredFeatures.slice(-3)
    }

    if (!merged.entities.requirements.bedrooms && contextRef.current.userPreferences.minBedrooms) {
      merged.entities.requirements.bedrooms = contextRef.current.userPreferences.minBedrooms
    }

    if (!merged.entities.requirements.bathrooms && contextRef.current.userPreferences.minBathrooms) {
      merged.entities.requirements.bathrooms = contextRef.current.userPreferences.minBathrooms
    }

    if (
      !merged.entities.requirements.maxPrice &&
      merged.entities.prices.length === 0 &&
      contextRef.current.userPreferences.budget?.max
    ) {
      merged.entities.requirements.maxPrice = contextRef.current.userPreferences.budget.max
    }

    if (
      merged.entities.properties.length === 0 &&
      contextRef.current.mentionedProperties.length > 0 &&
      ['property_details', 'rental_process', 'requirements'].includes(merged.intent)
    ) {
      merged.entities.properties = [contextRef.current.mentionedProperties[0]]
    }

    return merged
  }

  function executePendingAction(action: PendingAssistantAction) {
    if (action.type === 'apply_filters' && onSearchFiltersChange) {
      onSearchFiltersChange(action.payload)
      return
    }
    if (action.type === 'open_property' && onPropertyClick) {
      onPropertyClick(action.payload.propertyId)
      return
    }
    if (action.type === 'request_visit' && onRequestVisit) {
      onRequestVisit(action.payload.propertyId)
      return
    }
    if (action.type === 'start_prequalification' && onStartPrequalification) {
      onStartPrequalification(action.payload.propertyId)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Inicializar servicio de IA generativa
  useEffect(() => {
    const token = localStorage.getItem('token')
    const apiBase = import.meta.env.VITE_API_URL || ''
    generativeAI.current = new GenerativeAIService({
      provider: (import.meta.env.VITE_AI_PROVIDER as 'openai' | 'anthropic' | 'ollama' | 'local') || 'ollama',
      apiKey: import.meta.env.VITE_AI_API_KEY,
      model: import.meta.env.VITE_AI_MODEL || DEFAULT_OLLAMA_MODEL,
      baseURL: apiBase ? `${apiBase.replace(/\/$/, '')}/api/ai` : (token ? '/api/ai' : undefined),
      ollamaBaseURL: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
    })
    
    // Cargar base de conocimiento
    generativeAI.current.loadKnowledgeBase()
  }, [])

  // Función estable para extraer entidades (useCallback evita recreación en cada render)
  const extractEntities = useCallback((text: string, allProperties: any[]) => {
    const lowerText = text.toLowerCase()
    const mentionedProperties = contextRef.current.mentionedProperties
    const bedroomKeywords = ['habitaciones', 'habitación', 'hab', 'cuartos', 'rooms', 'dormitorios', 'bedrooms', 'recámaras', 'recamaras']
    const bathroomKeywords = ['baños', 'baño', 'banos', 'bathrooms', 'bathroom', 'toilet', 'toilets', 'ensuite']
    const priceKeywords = ['$', 'usd', 'eur', 'cad', 'mxn', 'ars', 'cop', 'pen', 'soles', '€', 's/', 'precio', 'presupuesto', 'budget', 'costo', 'coste', 'rent', 'alquiler', 'mensual', 'mensuales', 'precio máximo', 'precio maximo']

    const entities = {
      properties: [] as number[],
      locations: [] as string[],
      prices: [] as number[],
      features: [] as string[],
      requirements: {} as { bedrooms?: number; bathrooms?: number }
    }

    const numberMatches = [...text.matchAll(/\d+(?:[.,]\d+)?/g)]
    numberMatches.forEach(match => {
      const raw = match[0]
      const normalized = raw.replace(/[^\d.,]/g, '')
      const numeric = parseFloat(normalized.replace(/\./g, '').replace(',', '.'))
      if (isNaN(numeric)) return

      const index = match.index ?? 0
      const before = lowerText.slice(Math.max(0, index - 15), index)
      const after = lowerText.slice(index + raw.length, index + raw.length + 15)
      const around = `${before} ${after}`

      if (bedroomKeywords.some(kw => around.includes(kw))) {
        entities.requirements.bedrooms = Math.max(entities.requirements.bedrooms ?? 0, Math.round(numeric))
        return
      }
      if (bathroomKeywords.some(kw => around.includes(kw))) {
        entities.requirements.bathrooms = Math.max(entities.requirements.bathrooms ?? 0, Math.round(numeric))
        return
      }
      if (priceKeywords.some(kw => before.includes(kw) || after.includes(kw))) {
        entities.prices.push(numeric)
      }
    })

    const allLocations = [...new Set(allProperties.map((p: any) => p.location ?? p.property?.location).filter(Boolean))]
    allLocations.forEach((loc: string) => {
      const locParts: string[] = loc.toLowerCase().split(/[,\s]+/)
      if (locParts.some((part: string) => lowerText.includes(part))) {
        entities.locations.push(loc)
      }
    })

    const featureMap: { [key: string]: string[] } = {
      'piscina': ['piscina', 'pileta', 'pool', 'swimming pool', 'natación'],
      'gimnasio': ['gimnasio', 'gym', 'fitness', 'ejercicio'],
      'mascotas': ['mascotas', 'pet friendly', 'perros', 'gatos', 'pets', 'acepta mascotas'],
      'amueblado': ['amueblado', 'furnished', 'muebles', 'con muebles'],
      'estacionamiento': ['estacionamiento', 'parking', 'cochera', 'garage', 'cochera cubierta', 'cochera descubierta'],
      'balcón': ['balcón', 'balcon', 'balcony', 'terraza', 'terrace'],
      'ascensor': ['ascensor', 'elevator', 'elevador'],
      'wifi': ['wifi', 'wi-fi', 'internet', 'conexión', 'conexion'],
      'aire acondicionado': ['aire acondicionado', 'ac', 'climatización', 'climatizacion', 'aire'],
      'calefacción': ['calefacción', 'calefaccion', 'heating', 'calor'],
      'seguridad': ['seguridad', 'security', 'portería', 'porteria', 'vigilancia', '24 horas', '24h'],
      'lavadero': ['lavadero', 'lavandería', 'lavanderia', 'laundry'],
      'cocina': ['cocina', 'kitchen', 'cocina completa', 'cocina integrada'],
      'universidad': ['universidad', 'university', 'cerca universidad', 'cerca de universidad'],
      'hospital': ['hospital', 'cerca hospital', 'cerca de hospital'],
      'centro': ['centro', 'centro de la ciudad', 'downtown', 'cerca del centro'],
      'transporte': ['transporte público', 'transporte publico', 'metro', 'subte', 'bus', 'estación', 'estacion']
    }
    Object.keys(featureMap).forEach(feature => {
      if (featureMap[feature].some(keyword => lowerText.includes(keyword))) {
        entities.features.push(feature)
      }
    })

    if (lowerText.includes('esa') || lowerText.includes('esta') || lowerText.includes('la que')) {
      mentionedProperties.forEach((propId: number) => entities.properties.push(propId))
    }

    return entities
  }, [])

  // Función para entender el contexto de la conversación
  function understandContext(question: string, allProperties: any[]): {
    intent: string
    entities: ReturnType<typeof extractEntities>
    references: {
      previousProperties?: number[]
      previousLocations?: string[]
      previousBudget?: { min: number; max: number }
    }
  } {
    const lowerQuestion = question.toLowerCase()
    const entities = extractEntities(question, allProperties)
    
    // Detectar intención - Sistema expandido
    let intent = 'general'
    
    // INQUILINOS - Búsqueda
    if (lowerQuestion.includes('buscar') || lowerQuestion.includes('encontrar') || lowerQuestion.includes('quiero') || 
        lowerQuestion.includes('mostrame') || lowerQuestion.includes('muéstrame') || lowerQuestion.includes('tenés') ||
        lowerQuestion.includes('tienes') || lowerQuestion.includes('hay algo') || lowerQuestion.includes('opciones')) {
      intent = 'search'
    } 
    // Comparación
    else if (lowerQuestion.includes('comparar') || lowerQuestion.includes('diferencia') || lowerQuestion.includes('vs') ||
             lowerQuestion.includes('versus') || lowerQuestion.includes('cuál es mejor')) {
      intent = 'compare'
    } 
    // Recomendaciones
    else if (lowerQuestion.includes('recomendar') || lowerQuestion.includes('mejor') || lowerQuestion.includes('sugerir') ||
             lowerQuestion.includes('recomendación') || lowerQuestion.includes('recomendaciones')) {
      intent = 'recommend'
    } 
    // Precios
    else if (lowerQuestion.includes('cuánto') || lowerQuestion.includes('precio') || lowerQuestion.includes('cuesta') ||
             lowerQuestion.includes('costo') || lowerQuestion.includes('valor') || lowerQuestion.includes('depósito') ||
             lowerQuestion.includes('deposito') || lowerQuestion.includes('garantía') || lowerQuestion.includes('garantia')) {
      intent = 'price'
    } 
    // Ubicación
    else if (lowerQuestion.includes('dónde') || lowerQuestion.includes('donde') || lowerQuestion.includes('ubicación') ||
             lowerQuestion.includes('ubicacion') || lowerQuestion.includes('zona') || lowerQuestion.includes('barrio') ||
             lowerQuestion.includes('cerca de') || lowerQuestion.includes('cerca del') || lowerQuestion.includes('cerca la')) {
      intent = 'location'
    } 
    // Características/Detalles de propiedad
    else if (lowerQuestion.includes('características') || lowerQuestion.includes('caracteristicas') || 
             lowerQuestion.includes('tiene') || lowerQuestion.includes('incluye') || lowerQuestion.includes('amenities') ||
             lowerQuestion.includes('disponible desde') || lowerQuestion.includes('amoblado') || lowerQuestion.includes('mascotas') ||
             lowerQuestion.includes('estacionamiento') || lowerQuestion.includes('parking') || lowerQuestion.includes('cochera') ||
             lowerQuestion.includes('expensas') || lowerQuestion.includes('reglas') || lowerQuestion.includes('segura') ||
             lowerQuestion.includes('internet') || lowerQuestion.includes('wifi') || lowerQuestion.includes('personas pueden')) {
      intent = 'property_details'
    }
    // Proceso de alquiler
    else if (lowerQuestion.includes('cómo alquilar') || lowerQuestion.includes('como alquilar') || 
             lowerQuestion.includes('reservar') || lowerQuestion.includes('paso a paso') || lowerQuestion.includes('proceso') ||
             lowerQuestion.includes('visita') || lowerQuestion.includes('videollamada') || lowerQuestion.includes('coordin') ||
             lowerQuestion.includes('rechaza') || lowerQuestion.includes('solicitud') || lowerQuestion.includes('adelantado')) {
      intent = 'rental_process'
    }
    // Requisitos y documentación
    else if (lowerQuestion.includes('documentos') || lowerQuestion.includes('requisitos') || lowerQuestion.includes('garante') ||
             lowerQuestion.includes('fiador') || lowerQuestion.includes('estudiante') || lowerQuestion.includes('extranjero') ||
             lowerQuestion.includes('freelancer') || lowerQuestion.includes('independiente') || lowerQuestion.includes('ingresos') ||
             lowerQuestion.includes('historial crediticio') || lowerQuestion.includes('comprobantes')) {
      intent = 'requirements'
    }
    // Contratos y plazos
    else if (lowerQuestion.includes('contrato') || lowerQuestion.includes('plazo') || lowerQuestion.includes('renovar') ||
             lowerQuestion.includes('aumento') || lowerQuestion.includes('irse antes') || lowerQuestion.includes('terminar') ||
             lowerQuestion.includes('tiempo mínimo') || lowerQuestion.includes('tiempo minimo') || lowerQuestion.includes('pdf')) {
      intent = 'contract'
    }
    // Pagos
    else if (lowerQuestion.includes('pago') || lowerQuestion.includes('pagar') || lowerQuestion.includes('factura') ||
             lowerQuestion.includes('recibo') || lowerQuestion.includes('método de pago') || lowerQuestion.includes('metodo de pago') ||
             lowerQuestion.includes('devuelven') || lowerQuestion.includes('tarde') || lowerQuestion.includes('adelantado') ||
             lowerQuestion.includes('historial de pagos')) {
      intent = 'payment'
    }
    // Soporte y problemas
    else if (lowerQuestion.includes('problema') || lowerQuestion.includes('reclamo') || lowerQuestion.includes('cancelar') ||
             lowerQuestion.includes('reportar') || lowerQuestion.includes('reseña') || lowerQuestion.includes('resena') ||
             lowerQuestion.includes('no responde') || lowerQuestion.includes('mantenimiento') || lowerQuestion.includes('duplicado')) {
      intent = 'support'
    }
    // Cuenta de usuario
    else if (lowerQuestion.includes('cuenta') || lowerQuestion.includes('registro') || lowerQuestion.includes('sesión') ||
             lowerQuestion.includes('sesion') || lowerQuestion.includes('contraseña') || lowerQuestion.includes('contrasena') ||
             lowerQuestion.includes('mail') || lowerQuestion.includes('email') || lowerQuestion.includes('teléfono') ||
             lowerQuestion.includes('telefono') || lowerQuestion.includes('perfil') || lowerQuestion.includes('eliminar cuenta') ||
             lowerQuestion.includes('cerrar sesión') || lowerQuestion.includes('cerrar sesion')) {
      // Distinguir entre cuenta de inquilino y propietario
      if (lowerQuestion.includes('propietario') || lowerQuestion.includes('empresa') || lowerQuestion.includes('inmobiliaria') ||
          lowerQuestion.includes('nombre empresa') || lowerQuestion.includes('equipo') || lowerQuestion.includes('datos bancarios')) {
        intent = 'owner_account'
      } else {
        intent = 'account'
      }
    }
    // PROPIETARIOS - Publicación
    else if (lowerQuestion.includes('publicar') || lowerQuestion.includes('publicación') || lowerQuestion.includes('publicacion') ||
             lowerQuestion.includes('anuncio') || lowerQuestion.includes('fotos') || lowerQuestion.includes('editar precio') ||
             lowerQuestion.includes('pausar') || lowerQuestion.includes('reactivar') || lowerQuestion.includes('marcar no disponible')) {
      intent = 'publish'
    }
    // Propietarios - Gestión
    else if (lowerQuestion.includes('solicitudes') || lowerQuestion.includes('candidatos') || lowerQuestion.includes('postuló') ||
             lowerQuestion.includes('postulo') || lowerQuestion.includes('aceptar') || lowerQuestion.includes('rechazar') ||
             lowerQuestion.includes('bloquear usuario') || lowerQuestion.includes('requisitos mínimos')) {
      intent = 'owner_management'
    }
    // Propietarios - Precios y comisiones
    else if (lowerQuestion.includes('comisión') || lowerQuestion.includes('comision') || lowerQuestion.includes('recibo el pago') ||
             lowerQuestion.includes('historial de pagos') || (lowerQuestion.includes('propietario') && lowerQuestion.includes('precio')) ||
             lowerQuestion.includes('depósito mayor') || lowerQuestion.includes('deposito mayor')) {
      intent = 'owner_pricing'
    }
    // Propietarios - Contratos y reglas
    else if ((lowerQuestion.includes('contrato') || lowerQuestion.includes('reglas') || lowerQuestion.includes('condiciones')) &&
             (lowerQuestion.includes('propietario') || lowerQuestion.includes('rial genera') || lowerQuestion.includes('mi propio contrato') ||
              lowerQuestion.includes('firma digital') || lowerQuestion.includes('firma presencial'))) {
      intent = 'owner_contract'
    }
    // Propietarios - Cancelaciones y conflictos
    else if (
      (lowerQuestion.includes('cancelar') || lowerQuestion.includes('penalizaciones') || lowerQuestion.includes('inquilino rompe') ||
        lowerQuestion.includes('reportar problema') || lowerQuestion.includes('daños')) &&
      (
        lowerQuestion.includes('propietario') ||
        (Array.isArray(contextRef.current.conversationHistory) &&
          contextRef.current.conversationHistory.some(
            (h: any) =>
              typeof h === 'string' && h.toLowerCase().includes('propietario')
          )
        )
      )
    ) {
      intent = 'owner_cancel'
    }
    // Plataforma RIAL
    else if (lowerQuestion.includes('qué es rial') || lowerQuestion.includes('que es rial') || lowerQuestion.includes('rial es') ||
             lowerQuestion.includes('inmobiliaria') || lowerQuestion.includes('airbnb') || lowerQuestion.includes('booking') ||
             lowerQuestion.includes('países') || lowerQuestion.includes('paises') || lowerQuestion.includes('ciudades disponibles')) {
      intent = 'platform_info'
    }
    // Seguridad y verificación
    else if (lowerQuestion.includes('verificar') || lowerQuestion.includes('verificación') || lowerQuestion.includes('verificacion') ||
             lowerQuestion.includes('identidad') || lowerQuestion.includes('estafa') || lowerQuestion.includes('seguro') ||
             lowerQuestion.includes('confianza') || lowerQuestion.includes('propiedades reales') || lowerQuestion.includes('falso')) {
      intent = 'security'
    }
    // Políticas
    else if (lowerQuestion.includes('términos') || lowerQuestion.includes('terminos') || lowerQuestion.includes('condiciones') ||
             lowerQuestion.includes('política') || lowerQuestion.includes('politica') || lowerQuestion.includes('privacidad') ||
             lowerQuestion.includes('datos personales') || lowerQuestion.includes('discriminación') || lowerQuestion.includes('discriminacion') ||
             lowerQuestion.includes('cancelación') || lowerQuestion.includes('cancelacion')) {
      intent = 'policies'
    }
    // Preguntas avanzadas - Recomendaciones personalizadas
    else if (lowerQuestion.includes('trabajo desde casa') || lowerQuestion.includes('home office') || lowerQuestion.includes('tranquilo') ||
             lowerQuestion.includes('seguro') && lowerQuestion.includes('zona') || lowerQuestion.includes('transporte público') ||
             lowerQuestion.includes('transporte publico') || lowerQuestion.includes('pareja joven')) {
      intent = 'advanced_recommend'
    }
    // Explicaciones de conceptos
    else if (lowerQuestion.includes('qué es') || lowerQuestion.includes('que es') || lowerQuestion.includes('significa') ||
             lowerQuestion.includes('amoblado parcial') || lowerQuestion.includes('indexado') || lowerQuestion.includes('plazo fijo')) {
      intent = 'explain_concept'
    }
    // Cálculos
    else if (lowerQuestion.includes('si gano') || lowerQuestion.includes('cuánto tengo que pagar') || lowerQuestion.includes('cuanto tengo que pagar') ||
             lowerQuestion.includes('aumenta') && lowerQuestion.includes('cuánto') || lowerQuestion.includes('aumenta') && lowerQuestion.includes('cuanto')) {
      intent = 'calculate'
    }
    // Sobre el chatbot
    else if (lowerQuestion.includes('qué podés hacer') || lowerQuestion.includes('que podes hacer') || lowerQuestion.includes('podés hacer') ||
             lowerQuestion.includes('podes hacer') || lowerQuestion.includes('de dónde sacás') || lowerQuestion.includes('de donde sacas') ||
             lowerQuestion.includes('ver mis datos') || lowerQuestion.includes('modificar contrato') || lowerQuestion.includes('qué cosas no podés')) {
      intent = 'chatbot_info'
    }
    // Errores técnicos
    else if (lowerQuestion.includes('error') || lowerQuestion.includes('no funciona') || lowerQuestion.includes('no me deja') ||
             lowerQuestion.includes('no llega') || lowerQuestion.includes('cargando') || lowerQuestion.includes('subir fotos') ||
             lowerQuestion.includes('idioma') || lowerQuestion.includes('versión móvil') || lowerQuestion.includes('version movil')) {
      intent = 'technical'
    }

    // Detectar referencias a conversación anterior
    const references = {
      previousProperties: contextRef.current.mentionedProperties,
      previousLocations: Array.from(contextRef.current.entities.locations),
      previousBudget: contextRef.current.userPreferences.budget
    }

    // Detectar referencias pronominales
    if (lowerQuestion.includes('esa') || lowerQuestion.includes('esta') || lowerQuestion.includes('la que mencionaste')) {
      if (contextRef.current.mentionedProperties.length > 0) {
        entities.properties = [...contextRef.current.mentionedProperties]
      }
    }

    return { intent, entities, references }
  }

  // Función mejorada para razonar y generar respuesta inteligente (HÍBRIDA)
  async function processQuestion(question: string): Promise<string> {
    const allProperties = properties.map(item => item.property || item)

    const pendingAction = pendingActionRef.current
    if (pendingAction) {
      if (isConfirmationIntent(question)) {
        executePendingAction(pendingAction)
        pendingActionRef.current = null
        return `Perfecto, ya ejecuté esto: ${pendingAction.summary}. ¿Quieres que te ayude con otro ajuste?`
      }
      if (isCancellationIntent(question)) {
        pendingActionRef.current = null
        return 'Listo, cancelé esa acción. Si quieres, te propongo otra alternativa.'
      }
      return `Tengo una acción pendiente: ${pendingAction.summary}. ¿La confirmas? (responde "sí" para ejecutar o "no" para cancelar).`
    }
    
    // Usar el nuevo motor de IA para análisis avanzado
    const intentAnalysisBase = analyzeIntent(question, allProperties, contextRef.current)
    const intentAnalysis = mergeIntentWithMemory(intentAnalysisBase)
    
    // ESTRATEGIA HÍBRIDA: Reglas para casos específicos, IA generativa para el resto
    
    // 1. Casos específicos con confianza suficiente -> usar sistema de reglas (más rápido, estable y controlable)
    const useRuleBased = intentAnalysis.confidence >= 0.6 && 
      ['search', 'compare', 'price', 'location', 'property_details', 'recommend'].includes(intentAnalysis.intent)
    
    if (useRuleBased) {
      // Antes de generar la respuesta, si es una intención de búsqueda, ajustar filtros globales de la app
      if (intentAnalysis.intent === 'search' && onSearchFiltersChange) {
        // Extraer filtros clave desde entidades
        const entities = intentAnalysis.entities
        const primaryLocation = entities.locations[0]

        const hasPriceRange = entities.requirements.maxPrice || entities.requirements.minPrice || entities.prices.length > 0
        let minPrice: number | undefined
        let maxPrice: number | undefined
        if (entities.requirements.minPrice) minPrice = entities.requirements.minPrice
        if (entities.requirements.maxPrice) maxPrice = entities.requirements.maxPrice
        if (!maxPrice && entities.prices.length > 0) {
          maxPrice = Math.max(...entities.prices)
        }

        const bedrooms = entities.requirements.bedrooms
        const bathrooms = entities.requirements.bathrooms

        const features = (entities.features || []).map(f => f.toLowerCase())
        const petsAllowed = features.some(f => f.includes('mascota') || f.includes('pet'))
        const furnished = features.some(f => f.includes('amueblado') || f.includes('furnished'))
        const parking = features.some(f => f.includes('estacionamiento') || f.includes('parking') || f.includes('cochera'))

        const pendingFilters = {
          location: primaryLocation,
          minPrice,
          maxPrice,
          bedrooms,
          bathrooms,
          petsAllowed,
          furnished,
          parking,
        }

        const hasAnyFilter =
          Boolean(primaryLocation) ||
          Boolean(minPrice) ||
          Boolean(maxPrice) ||
          Boolean(bedrooms) ||
          Boolean(bathrooms) ||
          Boolean(petsAllowed) ||
          Boolean(furnished) ||
          Boolean(parking)

        if (hasAnyFilter) {
          const summaryParts: string[] = []
          if (primaryLocation) summaryParts.push(`ubicación: ${primaryLocation}`)
          if (minPrice || maxPrice) summaryParts.push(`precio: ${minPrice ? `$${minPrice}` : 'sin mínimo'} - ${maxPrice ? `$${maxPrice}` : 'sin máximo'}`)
          if (bedrooms) summaryParts.push(`${bedrooms}+ habitaciones`)
          if (bathrooms) summaryParts.push(`${bathrooms}+ baños`)
          if (petsAllowed) summaryParts.push('mascotas')
          if (furnished) summaryParts.push('amueblado')
          if (parking) summaryParts.push('estacionamiento')

          pendingActionRef.current = {
            type: 'apply_filters',
            payload: pendingFilters,
            summary: `aplicar filtros (${summaryParts.join(', ')})`,
          }
        }
      }

      const responseContext: ResponseContext = {
        allProperties,
        memory: contextRef.current,
        intent: intentAnalysis,
      }
      const response = generateIntentResponse(responseContext)

      // Actualizar memoria
      contextRef.current.conversationHistory.push({
        question,
        intent: intentAnalysis.intent,
        entities: intentAnalysis.entities,
        timestamp: new Date(),
      })
      contextRef.current.lastIntent = intentAnalysis.intent

      // Si el usuario pregunta por el proceso de alquiler / visitas y mencionó una propiedad, abrir su ficha
      if (
        (intentAnalysis.intent === 'rental_process' || intentAnalysis.intent === 'requirements') &&
        intentAnalysis.entities.properties.length > 0
      ) {
        const targetId = intentAnalysis.entities.properties[0]
        if (onPropertyClick) {
          const selectedProperty = allProperties.find((p: any) => Number(p.id) === Number(targetId))
          const propertyTitle = selectedProperty?.title || `#${targetId}`
          pendingActionRef.current = {
            type: 'open_property',
            payload: { propertyId: targetId },
            summary: `abrir la propiedad ${propertyTitle}`,
          }
        }
        // Para solicitudes explícitas de visita o pre-calificación, usar callbacks específicos si existen
        const lower = question.toLowerCase()
        if (onRequestVisit && (lower.includes('visita') || lower.includes('ver departamento') || lower.includes('mostrar'))) {
          const selectedProperty = allProperties.find((p: any) => Number(p.id) === Number(targetId))
          const propertyTitle = selectedProperty?.title || `#${targetId}`
          pendingActionRef.current = {
            type: 'request_visit',
            payload: { propertyId: targetId },
            summary: `iniciar solicitud de visita para ${propertyTitle}`,
          }
        }
        if (
          onStartPrequalification &&
          (lower.includes('precalificar') ||
            lower.includes('pre-calificar') ||
            lower.includes('aplicar') ||
            lower.includes('aplicación') ||
            lower.includes('aplicacion') ||
            lower.includes('elegible') ||
            lower.includes('elegibilidad'))
        ) {
          const selectedProperty = allProperties.find((p: any) => Number(p.id) === Number(targetId))
          const propertyTitle = selectedProperty?.title || `#${targetId}`
          pendingActionRef.current = {
            type: 'start_prequalification',
            payload: { propertyId: targetId },
            summary: `iniciar pre-calificación para ${propertyTitle}`,
          }
        }
      }

      if (pendingActionRef.current) {
        return `${response}\n\nAntes de ejecutar cambios en la app, ¿confirmas que lo haga? Acción: ${pendingActionRef.current.summary}.`
      }

      return response
    }
    
    // 2. Para todo lo demás -> usar IA generativa (más flexible y capaz)
    if (generativeAI.current) {
      try {
        // Construir historial de conversación con respuestas anteriores
        // Usar los mensajes del estado para obtener las respuestas reales
        const conversationHistoryWithAnswers = contextRef.current.conversationHistory.map((h) => {
          // Buscar la respuesta correspondiente en los mensajes del estado
          const userMsgIndex = messages.findIndex(m => 
            m.role === 'user' && m.content.trim() === h.question.trim()
          )
          // Si existe una respuesta previa de asistente, usarla; si no, verificar si h tiene answer (puede que no exista la propiedad)
          const answer =
            userMsgIndex >= 0 && messages[userMsgIndex + 1]?.role === 'assistant'
              ? messages[userMsgIndex + 1].content
              : (typeof (h as any).answer !== 'undefined' ? (h as any).answer : undefined);

          return {
            question: h.question,
            answer: answer,
            intent: h.intent,
            timestamp: h.timestamp
          }
        })

        const result = await generativeAI.current.generateResponse(question, {
          properties: allProperties,
          conversationHistory: conversationHistoryWithAnswers,
          userPreferences: contextRef.current.userPreferences,
          userRole: contextRef.current.userProfile?.role
        })
        
        // Guardar knowledgeId para feedback
        setCurrentKnowledgeId(result.knowledgeId || null)
        
        // Actualizar memoria de conversación ANTES de agregar la nueva pregunta
        // (para que la próxima vez incluya la respuesta)
        const newHistoryEntry = {
          question,
          answer: result.answer, // Guardar la respuesta para el próximo turno
          intent: intentAnalysis.intent,
          entities: intentAnalysis.entities,
          timestamp: new Date()
        }
        
        // Verificar si ya existe una entrada para esta pregunta
        const existingIndex = contextRef.current.conversationHistory.findIndex(
          h => h.question.trim() === question.trim()
        )
        
        if (existingIndex >= 0) {
          // Actualizar entrada existente
          contextRef.current.conversationHistory[existingIndex] = newHistoryEntry
        } else {
          // Agregar nueva entrada
          contextRef.current.conversationHistory.push(newHistoryEntry)
        }
        
        contextRef.current.lastIntent = intentAnalysis.intent
        
        // Analizar calidad de la respuesta
        const qualityAnalysis = LearningSystem.analyzeResponseQuality(
          question,
          result.answer
        )
        
        // Si la calidad es baja, mejorar la respuesta
        if (qualityAnalysis.quality < 0.6 && result.knowledgeId) {
          console.warn('Respuesta de baja calidad detectada:', qualityAnalysis.improvements)
        }
        
        return result.answer
      } catch (error: any) {
        console.error('Error con IA generativa, usando fallback:', error)
        // Mostrar mensaje útil si es error de Ollama
        if (error.message && error.message.includes('Ollama')) {
          const model = import.meta.env.VITE_AI_MODEL || DEFAULT_OLLAMA_MODEL
          return `⚠️ ${error.message}\n\nPor favor, asegúrate de tener Ollama instalado y ejecutándose. Puedes descargarlo desde https://ollama.ai\n\nUna vez instalado, ejecuta: ollama pull ${model}`
        }
        // Continuar con fallback
      }
    }
    
    // 3. Fallback a sistema de reglas si IA generativa falla
    
    // Actualizar preferencias del usuario basadas en entidades extraídas
    if (intentAnalysis.entities.locations.length > 0) {
      intentAnalysis.entities.locations.forEach(loc => contextRef.current.entities.locations.add(loc))
      if (!contextRef.current.userPreferences.preferredLocations) {
        contextRef.current.userPreferences.preferredLocations = []
      }
      intentAnalysis.entities.locations.forEach(loc => {
        if (!contextRef.current.userPreferences.preferredLocations!.includes(loc)) {
          contextRef.current.userPreferences.preferredLocations!.push(loc)
        }
      })
    }
    
    if (intentAnalysis.entities.prices.length > 0 || intentAnalysis.entities.requirements.maxPrice) {
      const maxPrice = intentAnalysis.entities.requirements.maxPrice || Math.max(...intentAnalysis.entities.prices)
      const minPrice = intentAnalysis.entities.requirements.minPrice || Math.min(...intentAnalysis.entities.prices)
      contextRef.current.userPreferences.budget = {
        min: minPrice || 0,
        max: maxPrice
      }
    }
    
    if (intentAnalysis.entities.requirements.bedrooms) {
      contextRef.current.userPreferences.minBedrooms = intentAnalysis.entities.requirements.bedrooms
    }
    
    if (intentAnalysis.entities.requirements.bathrooms) {
      contextRef.current.userPreferences.minBathrooms = intentAnalysis.entities.requirements.bathrooms
    }
    
    if (intentAnalysis.entities.features.length > 0) {
      intentAnalysis.entities.features.forEach(feature => {
        contextRef.current.entities.features.add(feature)
        if (!contextRef.current.userPreferences.requiredFeatures) {
          contextRef.current.userPreferences.requiredFeatures = []
        }
        if (!contextRef.current.userPreferences.requiredFeatures.includes(feature)) {
          contextRef.current.userPreferences.requiredFeatures.push(feature)
        }
      })
    }
    
    if (intentAnalysis.entities.lifestyle && intentAnalysis.entities.lifestyle.length > 0) {
      contextRef.current.userPreferences.lifestyle = intentAnalysis.entities.lifestyle
    }
    
    // Guardar propiedades mencionadas
    if (intentAnalysis.entities.properties.length > 0) {
      intentAnalysis.entities.properties.forEach(id => {
        if (!contextRef.current.mentionedProperties.includes(id)) {
          contextRef.current.mentionedProperties.push(id)
        }
      })
    }
    
    // Actualizar memoria
    contextRef.current.conversationHistory.push({
      question,
      intent: intentAnalysis.intent,
      entities: intentAnalysis.entities,
      timestamp: new Date()
    })
    contextRef.current.lastIntent = intentAnalysis.intent
    
    // Generar respuesta usando el nuevo generador
    const responseContext: ResponseContext = {
      allProperties,
      memory: contextRef.current,
      intent: intentAnalysis
    }
    
    const response = generateIntentResponse(responseContext)
    
    // Actualizar propiedades mencionadas en la respuesta
    if (intentAnalysis.entities.properties.length > 0) {
      contextRef.current.mentionedProperties = [
        ...new Set([...contextRef.current.mentionedProperties, ...intentAnalysis.entities.properties])
      ]
    }
    
    return response
  }
  
  // Mantener función legacy para compatibilidad (se eliminará gradualmente)
  async function processQuestionLegacy(question: string): Promise<string> {
    const lowerQuestion = question.toLowerCase()
    
    // Análisis de propiedades disponibles
    const allProperties = properties.map(item => item.property || item)
    const totalProperties = allProperties.length
    const avgPrice = allProperties.reduce((sum, p) => sum + (p.price || 0), 0) / totalProperties || 0
    const locations = [...new Set(allProperties.map(p => p.location).filter(Boolean))]
    const priceRange = {
      min: Math.min(...allProperties.map(p => p.price || 0)),
      max: Math.max(...allProperties.map(p => p.price || 0))
    }

    // Entender contexto (legacy)
    const context = understandContext(question, allProperties)
    
    // Actualizar contexto de conversación
    contextRef.current.conversationHistory.push({
      question,
      intent: context.intent,
      entities: context.entities,
      timestamp: new Date()
    })
    if (context.entities.locations.length > 0) {
      context.entities.locations.forEach(loc => contextRef.current.entities.locations.add(loc))
    }
    if (context.entities.prices.length > 0) {
      contextRef.current.userPreferences.budget = {
        min: Math.min(...context.entities.prices),
        max: Math.max(...context.entities.prices)
      }
    }
    if (context.entities.requirements?.bedrooms) {
      contextRef.current.userPreferences.minBedrooms = context.entities.requirements.bedrooms
    }
    if (context.entities.requirements?.bathrooms) {
      contextRef.current.userPreferences.minBathrooms = context.entities.requirements.bathrooms
    }

    // Procesar según intención y contexto (legacy)
    switch (context.intent) {
      case 'search': {
        // Búsqueda inteligente con contexto
        let filtered = [...allProperties]
        
        // Usar ubicaciones del contexto si no se mencionaron nuevas
        const searchLocations = context.entities.locations.length > 0 
          ? context.entities.locations 
          : context.references.previousLocations || []
        
        if (searchLocations.length > 0) {
          filtered = filtered.filter(p => searchLocations.some(loc => p.location === loc))
        }
        
        // Usar presupuesto del contexto
        const budget = context.entities.prices.length > 0 
          ? { min: 0, max: Math.max(...context.entities.prices) }
          : context.references.previousBudget || contextRef.current.userPreferences.budget
        
        if (budget) {
          filtered = filtered.filter(p => (p.price || 0) <= budget.max)
        }
        
        // Filtrar por características
        if (context.entities.features.length > 0) {
          filtered = filtered.filter(p => {
            const allAmenities = [
              ...(p.amenities || []),
              ...(p.buildingAmenities || []),
              ...(p.safety || []),
              ...(p.highlights || [])
            ].map((a: string) => a.toLowerCase())
            
            return context.entities.features.every(feature => {
              const featureLower = feature.toLowerCase()
              // Buscar coincidencias en amenities
              return allAmenities.some((amenity: string) => {
                if (featureLower === 'piscina' || featureLower === 'pileta') {
                  return amenity.includes('piscina') || amenity.includes('pileta') || amenity.includes('pool')
                }
                if (featureLower === 'gimnasio' || featureLower === 'gym') {
                  return amenity.includes('gimnasio') || amenity.includes('gym') || amenity.includes('fitness')
                }
                if (featureLower === 'mascotas' || featureLower === 'pet') {
                  return amenity.includes('mascota') || amenity.includes('pet') || amenity.includes('perro') || amenity.includes('gato')
                }
                if (featureLower === 'amueblado') {
                  return amenity.includes('amueblado') || amenity.includes('furnished') || amenity.includes('mueble')
                }
                if (featureLower === 'estacionamiento' || featureLower === 'parking' || featureLower === 'cochera') {
                  return amenity.includes('estacionamiento') || amenity.includes('parking') || amenity.includes('cochera') || amenity.includes('garage')
                }
                if (featureLower === 'balcón' || featureLower === 'balcon' || featureLower === 'terraza') {
                  return amenity.includes('balcón') || amenity.includes('balcon') || amenity.includes('terraza') || amenity.includes('terrace')
                }
                if (featureLower === 'ascensor') {
                  return amenity.includes('ascensor') || amenity.includes('elevator')
                }
                if (featureLower === 'wifi' || featureLower === 'internet') {
                  return amenity.includes('wifi') || amenity.includes('internet') || amenity.includes('wi-fi')
                }
                if (featureLower === 'aire acondicionado' || featureLower === 'aire' || featureLower === 'ac') {
                  return amenity.includes('aire') || amenity.includes('ac') || amenity.includes('climatización') || amenity.includes('climatizacion')
                }
                if (featureLower === 'calefacción' || featureLower === 'calefaccion') {
                  return amenity.includes('calefacción') || amenity.includes('calefaccion') || amenity.includes('heating')
                }
                if (featureLower === 'seguridad' || featureLower === 'portería' || featureLower === 'porteria') {
                  return amenity.includes('seguridad') || amenity.includes('portería') || amenity.includes('porteria') || amenity.includes('vigilancia') || amenity.includes('guardia')
                }
                return amenity.includes(featureLower)
              })
            })
          })
        }
        
        // Filtros adicionales por palabras clave en la pregunta
        if (lowerQuestion.includes('monoambiente') || lowerQuestion.includes('estudio')) {
          filtered = filtered.filter(p => (p.bedrooms || 0) <= 1)
        }
        if (lowerQuestion.includes('alquiler mínimo') || lowerQuestion.includes('contrato mínimo')) {
          const monthsMatch = lowerQuestion.match(/(\d+)\s*(mes|meses)/)
          if (monthsMatch) {
            // Guardar preferencia de tiempo mínimo
            contextRef.current.userPreferences.minContractMonths = parseInt(monthsMatch[1])
          }
        }
        if (lowerQuestion.includes('cerca de') || lowerQuestion.includes('cerca del') || lowerQuestion.includes('cerca la')) {
          // Ya se maneja con locations, pero podemos mejorar la búsqueda
        }

        const bedroomRequirement = context.entities.requirements.bedrooms ?? contextRef.current.userPreferences.minBedrooms
        if (bedroomRequirement) {
          filtered = filtered.filter(p => (p.bedrooms || 0) >= bedroomRequirement)
        }

        const bathroomRequirement = context.entities.requirements.bathrooms ?? contextRef.current.userPreferences.minBathrooms
        if (bathroomRequirement) {
          filtered = filtered.filter(p => (p.bathrooms || 0) >= bathroomRequirement)
        }
        
        // Ordenar inteligentemente
        if (lowerQuestion.includes('barato') || lowerQuestion.includes('económico')) {
          filtered = filtered.sort((a, b) => (a.price || 0) - (b.price || 0))
        } else if (lowerQuestion.includes('mejor') || lowerQuestion.includes('recomendar')) {
          filtered = filtered.sort((a, b) => {
            const scoreA = (a.averageRating || 0) * 10 - (a.price || 0) / 100
            const scoreB = (b.averageRating || 0) * 10 - (b.price || 0) / 100
            return scoreB - scoreA
          })
        }
        
        if (filtered.length === 0) {
          return `No encontré propiedades que coincidan con tus criterios${searchLocations.length > 0 ? ` en ${searchLocations.join(', ')}` : ''}${budget ? ` por menos de $${budget.max.toLocaleString()}` : ''}. ¿Te gustaría que ajuste los filtros?`
        }
        
        // Guardar propiedades mencionadas en el contexto
        const mentionedIds = filtered.slice(0, 5).map(p => p.id)
        contextRef.current.mentionedProperties = mentionedIds
        
        const requirementsSummary = []
        if (bedroomRequirement) requirementsSummary.push(`${bedroomRequirement}+ habitaciones`)
        if (bathroomRequirement) requirementsSummary.push(`${bathroomRequirement}+ baños`)

        return `Encontré **${filtered.length} propiedades**${searchLocations.length > 0 ? ` en ${searchLocations.join(', ')}` : ''}${budget ? ` por menos de $${budget.max.toLocaleString()}/mes` : ''}${requirementsSummary.length ? ` que cumplen con ${requirementsSummary.join(' y ')}` : ''}:\n\n${filtered.slice(0, 5).map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location || 'Ubicación no especificada'}\n   💰 $${(p.price || 0).toLocaleString()}/mes${p.averageRating ? `\n   ⭐ ${p.averageRating.toFixed(1)}/5` : ''}`).join('\n\n')}${filtered.length > 5 ? `\n\n...y ${filtered.length - 5} más.` : ''}\n\n¿Te interesa alguna en particular? Puedo darte más detalles.`
      }
      
      case 'compare': {
        // Comparación inteligente
        const propsToCompare = context.entities.properties.length > 0
          ? allProperties.filter(p => context.entities.properties.includes(p.id))
          : contextRef.current.mentionedProperties.length > 0
            ? allProperties.filter(p => contextRef.current.mentionedProperties.includes(p.id))
            : []
        
        if (propsToCompare.length < 2) {
          return 'Para comparar, necesito que menciones al menos 2 propiedades. Puedes decirme "compara las propiedades en South Beach" o mencionar propiedades específicas.'
        }
        
        const comparison = propsToCompare.slice(0, 4).map(p => ({
          title: p.title || 'Sin título',
          price: p.price || 0,
          location: p.location || 'No especificada',
          rating: p.averageRating || 0
        }))
        
        const avgPrice = comparison.reduce((sum, p) => sum + p.price, 0) / comparison.length
        const priceRange = {
          min: Math.min(...comparison.map(p => p.price)),
          max: Math.max(...comparison.map(p => p.price))
        }
        
        return `Comparando **${comparison.length} propiedades**:\n\n${comparison.map((p, i) => `${i + 1}. **${p.title}**\n   💰 $${p.price.toLocaleString()}/mes\n   📍 ${p.location}${p.rating > 0 ? `\n   ⭐ ${p.rating.toFixed(1)}/5` : ''}`).join('\n\n')}\n\n**Análisis:**\n• Precio promedio: $${Math.round(avgPrice).toLocaleString()}/mes\n• Rango: $${priceRange.min.toLocaleString()} - $${priceRange.max.toLocaleString()}/mes\n• Diferencia: $${(priceRange.max - priceRange.min).toLocaleString()}/mes\n\n¿Quieres que profundice en alguna comparación específica?`
      }
      
      case 'recommend': {
        // Recomendación inteligente basada en contexto
        let candidates = [...allProperties]
        
        // Aplicar filtros del contexto
        const storedPreferences = contextRef.current.userPreferences
        if (storedPreferences.budget) {
          candidates = candidates.filter(p => (p.price || 0) <= storedPreferences.budget!.max)
        }

        if (storedPreferences.minBedrooms) {
          candidates = candidates.filter(p => (p.bedrooms || 0) >= storedPreferences.minBedrooms!)
        }

        if (storedPreferences.minBathrooms) {
          candidates = candidates.filter(p => (p.bathrooms || 0) >= storedPreferences.minBathrooms!)
        }
        
        if (contextRef.current.entities.locations.size > 0) {
          const preferredLocs = Array.from(contextRef.current.entities.locations)
          candidates = candidates.filter(p => preferredLocs.some(loc => p.location === loc))
        }
        
        // Calcular score de recomendación
        const scored = candidates.map(p => {
          const priceScore = contextRef.current.userPreferences.budget 
            ? Math.max(0, 100 - ((p.price || 0) / contextRef.current.userPreferences.budget!.max) * 100)
            : 50
          const ratingScore = (p.averageRating || 0) * 20
          const totalScore = priceScore * 0.4 + ratingScore * 0.6
          return { ...p, score: totalScore }
        }).sort((a, b) => b.score - a.score).slice(0, 3)
        
        if (scored.length === 0) {
          return 'No tengo suficientes propiedades que coincidan con tus preferencias para hacer una recomendación. ¿Podrías contarme más sobre lo que buscas?'
        }
        
        contextRef.current.mentionedProperties = scored.map(p => p.id)
        
        return `Basándome en${contextRef.current.userPreferences.budget ? ` tu presupuesto de hasta $${contextRef.current.userPreferences.budget.max.toLocaleString()}` : ''}${contextRef.current.entities.locations.size > 0 ? ` y tu interés en ${Array.from(contextRef.current.entities.locations).join(', ')}` : ''}, te recomiendo:\n\n${scored.map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location || 'Ubicación no especificada'}\n   💰 $${(p.price || 0).toLocaleString()}/mes\n   ⭐ ${(p.averageRating || 0).toFixed(1)}/5\n   🎯 Score: ${Math.round(p.score)}/100`).join('\n\n')}\n\n¿Quieres más detalles sobre alguna de estas?`
      }
      
      case 'price': {
        // Análisis de precios con contexto
        if (context.entities.locations.length > 0) {
          const propsInLocation = allProperties.filter(p => context.entities.locations.includes(p.location))
          if (propsInLocation.length > 0) {
            const locPrices = propsInLocation.map(p => p.price || 0)
            const locAvg = locPrices.reduce((a, b) => a + b, 0) / locPrices.length
            const locMin = Math.min(...locPrices)
            const locMax = Math.max(...locPrices)
            
            return `En **${context.entities.locations[0]}**:\n• Precio promedio: **$${Math.round(locAvg).toLocaleString()}/mes**\n• Rango: **$${locMin.toLocaleString()} - $${locMax.toLocaleString()}/mes**\n• Total de propiedades: **${propsInLocation.length}**\n\n¿Te interesa alguna propiedad en particular de esta zona?`
          }
        }
        
        if (lowerQuestion.includes('promedio')) {
          return `El precio promedio de nuestras propiedades es de **$${Math.round(avgPrice).toLocaleString()}/mes**. El rango va desde **$${priceRange.min.toLocaleString()}/mes** hasta **$${priceRange.max.toLocaleString()}/mes**.`
        }
        
        if (lowerQuestion.includes('más barato') || lowerQuestion.includes('más económico')) {
          const cheapest = allProperties.sort((a, b) => (a.price || 0) - (b.price || 0))[0]
          contextRef.current.mentionedProperties = [cheapest.id]
          return `La propiedad más económica es **"${cheapest.title || 'Sin título'}"** en ${cheapest.location || 'ubicación no especificada'} por **$${(cheapest.price || 0).toLocaleString()}/mes**. ¿Quieres más información sobre esta propiedad?`
        }
        
        return `Nuestras propiedades tienen precios que van desde **$${priceRange.min.toLocaleString()}/mes** hasta **$${priceRange.max.toLocaleString()}/mes**, con un promedio de **$${Math.round(avgPrice).toLocaleString()}/mes**. ${contextRef.current.userPreferences.budget ? `Veo que mencionaste un presupuesto de hasta $${contextRef.current.userPreferences.budget.max.toLocaleString()}, tengo varias opciones en ese rango.` : '¿Tienes un presupuesto en mente?'}`
      }
      
      case 'location': {
        if (context.entities.locations.length > 0) {
          const locationMatch = context.entities.locations[0]
          const propsInLocation = allProperties.filter(p => p.location === locationMatch)
          
          if (propsInLocation.length > 0) {
            contextRef.current.entities.locations.add(locationMatch)
            contextRef.current.mentionedProperties = propsInLocation.slice(0, 5).map(p => p.id)
            
            return `En **${locationMatch}** tenemos **${propsInLocation.length} propiedades** disponibles:\n\n${propsInLocation.slice(0, 5).map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   💰 $${(p.price || 0).toLocaleString()}/mes${p.averageRating ? `\n   ⭐ ${p.averageRating.toFixed(1)}/5` : ''}`).join('\n\n')}${propsInLocation.length > 5 ? `\n\n...y ${propsInLocation.length - 5} más.` : ''}\n\n¿Te interesa alguna en particular?`
          }
        }
        
        return `Tenemos propiedades en las siguientes ubicaciones:\n\n${locations.slice(0, 10).map(loc => `• ${loc}`).join('\n')}${locations.length > 10 ? `\n\n...y ${locations.length - 10} ubicaciones más.` : ''}\n\n${contextRef.current.entities.locations.size > 0 ? `Veo que has mostrado interés en ${Array.from(contextRef.current.entities.locations).join(', ')}. ` : ''}¿Te interesa alguna ubicación en particular?`
      }

      case 'property_details': {
        // Detalles de propiedades específicas
        const currentProp = context.entities.properties.length > 0 
          ? allProperties.find(p => p.id === context.entities.properties[0])
          : contextRef.current.mentionedProperties.length > 0
            ? allProperties.find(p => p.id === contextRef.current.mentionedProperties[0])
            : null

        if (currentProp) {
          if (lowerQuestion.includes('disponible desde')) {
            return `La propiedad **"${currentProp.title}"** está ${currentProp.availableNow ? 'disponible ahora' : 'disponible próximamente'}. Puedes contactar al propietario para coordinar la fecha de ingreso.`
          }
          if (lowerQuestion.includes('precio incluye') || lowerQuestion.includes('expensas') || lowerQuestion.includes('mantenimiento') || lowerQuestion.includes('servicios')) {
            const hoa = currentProp.hoa ? ` Las expensas son de $${currentProp.hoa.toLocaleString()}/mes.` : ''
            return `El precio de **$${currentProp.price.toLocaleString()}/mes** es el alquiler base.${hoa} Los servicios (luz, gas, agua, internet) generalmente corren por cuenta del inquilino, pero esto puede variar según el contrato. Te recomiendo confirmarlo con el propietario.`
          }
          if (lowerQuestion.includes('amoblado') || lowerQuestion.includes('muebles')) {
            const hasFurnished = currentProp.amenities?.some((a: string) => a.toLowerCase().includes('amueblado')) || false
            return `La propiedad **"${currentProp.title}"** está ${hasFurnished ? 'amueblada' : 'sin amueblar'}. ${hasFurnished ? 'Incluye muebles básicos.' : 'El inquilino debe proveer su propio mobiliario.'}`
          }
          if (lowerQuestion.includes('mascotas')) {
            const petFriendly = currentProp.amenities?.some((a: string) => a.toLowerCase().includes('pet') || a.toLowerCase().includes('mascota')) || 
                               currentProp.buildingAmenities?.some((a: string) => a.toLowerCase().includes('pet')) || false
            return `La propiedad **"${currentProp.title}"** ${petFriendly ? 'acepta mascotas' : 'no acepta mascotas'}. ${petFriendly ? 'Puedes consultar con el propietario sobre restricciones específicas (tamaño, cantidad, etc.).' : 'Si tienes mascotas, te recomiendo buscar otras opciones que sí las acepten.'}`
          }
          if (lowerQuestion.includes('reglas') || lowerQuestion.includes('normas')) {
            return `Cada propiedad puede tener reglas específicas establecidas por el propietario. Para **"${currentProp.title}"**, te recomiendo:\n\n• Revisar la descripción completa de la propiedad\n• Consultar directamente con el propietario sobre reglas específicas\n• Revisar el contrato antes de firmar\n\nLas reglas comunes incluyen: no fumar, horarios de ruido, mantenimiento del espacio, etc.`
          }
          if (lowerQuestion.includes('estacionamiento') || lowerQuestion.includes('parking') || lowerQuestion.includes('cochera')) {
            const parking = currentProp.parking || 0
            return `La propiedad **"${currentProp.title}"** ${parking > 0 ? `tiene ${parking} ${parking === 1 ? 'cochera' : 'cocheras'} incluida${parking === 1 ? '' : 's'}` : 'no incluye estacionamiento'}. ${parking > 0 ? 'El estacionamiento está incluido en el precio del alquiler.' : 'Puedes consultar opciones de estacionamiento cercanas o si el propietario ofrece cocheras adicionales por un costo extra.'}`
          }
          if (lowerQuestion.includes('segura') || lowerQuestion.includes('seguridad')) {
            const safety = currentProp.safety || []
            return `La propiedad **"${currentProp.title}"** cuenta con las siguientes medidas de seguridad:\n\n${safety.length > 0 ? safety.map((s: string) => `• ${s}`).join('\n') : '• Información de seguridad disponible en la descripción completa'}\n\nPara más detalles sobre la seguridad de la zona, te recomiendo visitar la propiedad o consultar con el propietario.`
          }
          if (lowerQuestion.includes('cerca') || lowerQuestion.includes('supermercado') || lowerQuestion.includes('colegio') || lowerQuestion.includes('transporte')) {
            return `Para conocer qué hay cerca de **"${currentProp.title}"** en ${currentProp.location}, te recomiendo:\n\n• Revisar el mapa interactivo de la propiedad\n• Consultar con el propietario sobre puntos de interés cercanos\n• Usar herramientas de mapas (Google Maps, etc.) con la dirección exacta\n\nLa propiedad está ubicada en ${currentProp.location}, una zona con buena conectividad.`
          }
          if (lowerQuestion.includes('trabajo desde casa') || lowerQuestion.includes('home office') || lowerQuestion.includes('internet') || lowerQuestion.includes('wifi')) {
            const hasOffice = currentProp.amenities?.some((a: string) => a.toLowerCase().includes('office') || a.toLowerCase().includes('trabajo')) || false
            return `La propiedad **"${currentProp.title}"** ${hasOffice ? 'incluye un espacio de trabajo/home office' : 'puede adaptarse para trabajo remoto'}. ${hasOffice ? 'Cuenta con un área específica para trabajar desde casa.' : 'Aunque no tiene un espacio dedicado, puedes usar cualquier habitación como oficina.'} En cuanto al internet, te recomiendo consultar con el propietario sobre la velocidad y proveedores disponibles en la zona.`
          }
          if (lowerQuestion.includes('personas pueden') || lowerQuestion.includes('capacidad')) {
            const beds = currentProp.beds || currentProp.bedrooms || 1
            return `La propiedad **"${currentProp.title}"** tiene capacidad para aproximadamente **${beds} ${beds === 1 ? 'persona' : 'personas'}** cómodamente, considerando que tiene ${currentProp.bedrooms || 1} ${currentProp.bedrooms === 1 ? 'habitación' : 'habitaciones'} y ${currentProp.beds || beds} ${currentProp.beds === 1 ? 'cama' : 'camas'}. El número exacto puede variar según la configuración y tamaño de las habitaciones.`
          }
        }
        return 'Para darte detalles específicos sobre una propiedad, necesito que me indiques cuál te interesa. Puedes decirme "esta propiedad" si ya la estás viendo, o mencionar el nombre o ubicación.'
      }

      case 'rental_process': {
        // Proceso para alquilar/reservar
        if (lowerQuestion.includes('cómo alquilar') || lowerQuestion.includes('como alquilar') || lowerQuestion.includes('paso a paso')) {
          return `**Proceso para alquilar en RIAL:**\n\n1. **Busca y selecciona** la propiedad que te interese\n2. **Revisa los detalles** completos (precio, ubicación, características)\n3. **Haz clic en "Solicitar alquiler"** o "Contactar propietario"\n4. **Completa tu perfil** si aún no lo has hecho (datos personales, verificación)\n5. **Envía tu solicitud** con la información requerida\n6. **Espera la respuesta** del propietario (generalmente en 24-48 horas)\n7. **Si es aceptada**, coordina la visita y revisión del contrato\n8. **Firma el contrato** (digital o presencial según acuerden)\n9. **Realiza el pago inicial** (depósito + primer mes)\n10. **¡Recibe las llaves!** 🎉\n\n¿Tienes alguna pregunta específica sobre algún paso?`
        }
        if (lowerQuestion.includes('reservar')) {
          return `Para **reservar una propiedad** en RIAL:\n\n• **No hay reserva previa sin aprobación**: Primero debes enviar una solicitud y esperar que el propietario la apruebe\n• **Depósito de reserva**: Algunos propietarios pueden pedir un depósito de reserva (generalmente 1 mes de alquiler) que se aplica al depósito de garantía si se concreta el alquiler\n• **Tiempo de respuesta**: Los propietarios suelen responder en 24-48 horas\n• **Si es rechazada**: El depósito de reserva (si se pagó) se devuelve completamente\n\n¿Quieres saber más sobre el proceso de solicitud?`
        }
        if (lowerQuestion.includes('pagar') && lowerQuestion.includes('adelantado') || lowerQuestion.includes('reservar')) {
          return `**Pago por adelantado para reservar:**\n\n• Algunos propietarios pueden solicitar un **depósito de reserva** (generalmente equivalente a 1 mes de alquiler)\n• Este depósito **se aplica al depósito de garantía** si el alquiler se concreta\n• Si el propietario **rechaza tu solicitud**, el depósito se devuelve completamente\n• Si **tú cancelas** después de ser aceptado, pueden aplicar penalizaciones según las políticas\n• El pago se realiza de forma segura a través de la plataforma RIAL\n\n¿Tienes alguna propiedad específica en mente?`
        }
        if (lowerQuestion.includes('rechaza') || lowerQuestion.includes('rechazo')) {
          return `Si el propietario **rechaza tu solicitud**:\n\n• Recibirás una notificación explicando el motivo (si el propietario lo comparte)\n• **No se te cobra nada** - no hay penalización para ti\n• Si pagaste un depósito de reserva, **se te devuelve completamente**\n• Puedes **seguir buscando** otras propiedades sin restricciones\n• Tu perfil y calificaciones **no se ven afectadas** negativamente\n\nRIAL te ayuda a encontrar la propiedad perfecta. ¿Quieres que te recomiende otras opciones?`
        }
        if (lowerQuestion.includes('visita') || lowerQuestion.includes('coordinar')) {
          return `**Cómo coordinar una visita:**\n\n1. **Una vez aceptada tu solicitud**, el propietario te contactará\n2. **Acuerden fecha y hora** que funcione para ambos\n3. **Puedes hacer visita presencial** o solicitar videollamada si prefieres\n4. **Durante la visita**, revisa:\n   • Estado real de la propiedad\n   • Funcionamiento de servicios\n   • Zona y vecindario\n   • Cualquier duda que tengas\n5. **Después de la visita**, confirma si quieres proceder con el alquiler\n\n¿Necesitas ayuda para coordinar una visita específica?`
        }
        if (lowerQuestion.includes('videollamada')) {
          return `**Sí, puedes hacer videollamada** en lugar de visita presencial:\n\n• Muchos propietarios ofrecen esta opción, especialmente para inquilinos que están lejos\n• **Solicítala** cuando envíes tu solicitud o al contactar al propietario\n• Durante la videollamada puedes:\n   • Ver la propiedad en tiempo real\n   • Hacer preguntas\n   • Revisar detalles específicos\n• **Recomendación**: Si es posible, combina videollamada + visita presencial antes de firmar\n\n¿Te interesa alguna propiedad en particular?`
        }
        if (lowerQuestion.includes('dos personas') && lowerQuestion.includes('misma propiedad')) {
          return `Si **dos personas reservan la misma propiedad al mismo tiempo**:\n\n• RIAL funciona con un sistema de **solicitudes en orden de llegada**\n• El propietario revisa las solicitudes y puede aceptar la primera que cumpla los requisitos\n• **Si tu solicitud es aceptada primero**, la propiedad queda reservada para ti\n• Si otra persona fue aceptada antes, recibirás una notificación y la propiedad aparecerá como "no disponible"\n• **Transparencia**: Puedes ver en tiempo real si hay otras solicitudes pendientes\n\nMi recomendación: Envía tu solicitud lo antes posible si te interesa una propiedad.`
        }
        return 'Sobre el proceso de alquiler en RIAL, puedo ayudarte con:\n\n• Cómo hacer una solicitud\n• Coordinar visitas\n• Entender el proceso de aprobación\n• Pagos y depósitos\n• Firmar contratos\n\n¿Qué te gustaría saber específicamente?'
      }

      case 'requirements': {
        // Requisitos y documentación
        if (lowerQuestion.includes('documentos')) {
          return `**Documentos necesarios para alquilar en RIAL:**\n\n📄 **Documentos básicos:**\n• DNI o documento de identidad vigente\n• Comprobante de ingresos (últimos 3 meses)\n• Constancia de empleo o certificado laboral\n• Referencias personales o laborales (opcional pero recomendado)\n\n📄 **Para garantía:**\n• Recibo de sueldo o comprobante de ingresos\n• Si usas garante: DNI y comprobante de ingresos del garante\n• Historial crediticio (algunos propietarios lo solicitan)\n\n📄 **Adicionales (según el caso):**\n• Si eres estudiante: constancia de estudios y comprobante de ingresos del garante\n• Si eres extranjero: pasaporte y visa/residencia vigente\n• Si eres freelancer: declaraciones de impuestos o estados de cuenta\n\n¿Tienes alguna situación específica?`
        }
        if (lowerQuestion.includes('estudiante') && (lowerQuestion.includes('sin ingresos') || lowerQuestion.includes('ingresos fijos'))) {
          return `**Sí, puedes alquilar siendo estudiante sin ingresos fijos:**\n\n• Necesitarás un **garante/fiador** que tenga ingresos comprobables\n• El garante debe demostrar ingresos suficientes (generalmente 3x el valor del alquiler)\n• Algunos propietarios aceptan **garantías bancarias** o depósitos mayores\n• Puedes presentar **becas o ayudas estudiantiles** como ingreso complementario\n• Algunas propiedades ofrecen **contratos especiales para estudiantes**\n\nTe recomiendo buscar propiedades que especifiquen "acepta estudiantes" o contactar directamente para consultar.`
        }
        if (lowerQuestion.includes('garante') || lowerQuestion.includes('fiador')) {
          return `**Sobre garantes/fiadores:**\n\n• **¿Necesitas garante?** Depende del propietario y tu perfil crediticio\n• **¿Qué tipo de garantía aceptan?**\n   - Garante personal (familiar o conocido con ingresos comprobables)\n   - Garantía bancaria o de seguros\n   - Depósito de garantía mayor (2-3 meses en lugar de 1)\n• **Requisitos del garante:**\n   - Ingresos comprobables (generalmente 3x el valor del alquiler)\n   - DNI y documentación en regla\n   - Buena calificación crediticia\n• **Si no tienes garante**: Algunos propietarios aceptan depósitos mayores o garantías alternativas\n\n¿Tienes alguna pregunta específica sobre garantías?`
        }
        if (lowerQuestion.includes('freelancer') || lowerQuestion.includes('independiente')) {
          return `**Alquilar siendo freelancer o trabajador independiente:**\n\n✅ **Sí, puedes alquilar**, pero necesitarás:\n\n• **Comprobantes de ingresos** (últimos 6-12 meses):\n   - Estados de cuenta bancarios\n   - Declaraciones de impuestos\n   - Facturas emitidas\n   - Contratos de trabajo o proyectos\n• **Historial crediticio positivo** (ayuda mucho)\n• Algunos propietarios pueden pedir:\n   - Depósito de garantía mayor\n   - Garante adicional\n   - Comprobantes de ingresos más extensos\n\n💡 **Consejo**: Prepara tu documentación con anticipación y sé transparente sobre tu situación laboral.`
        }
        if (lowerQuestion.includes('extranjero')) {
          return `**Alquilar siendo extranjero:**\n\n✅ **Sí, puedes alquilar en RIAL siendo extranjero**, necesitarás:\n\n• **Documentación migratoria:**\n   - Pasaporte vigente\n   - Visa o residencia temporal/permanente\n   - Comprobante de domicilio en el país\n• **Comprobantes de ingresos** (pueden ser del país de origen o local)\n• **Referencias** (si es posible, de propietarios anteriores)\n• Algunos propietarios pueden pedir:\n   - Depósito de garantía mayor\n   - Garante local\n   - Traducción de documentos (si no están en español)\n\nRIAL tiene propiedades disponibles para extranjeros. ¿En qué ciudad estás buscando?`
        }
        if (lowerQuestion.includes('comprobantes de ingresos')) {
          return `**Comprobantes de ingresos aceptados:**\n\n• **Recibo de sueldo** (últimos 3 meses)\n• **Constancia de empleo** con sueldo declarado\n• **Estados de cuenta bancarios** (últimos 3-6 meses)\n• **Declaraciones de impuestos** (para independientes)\n• **Certificados de ingresos** emitidos por contador\n• **Contratos de trabajo** con especificación de sueldo\n• **Para estudiantes**: Constancia de beca o ingresos del garante\n\nLos propietarios generalmente buscan que tus ingresos sean **al menos 3 veces el valor del alquiler mensual**.`
        }
        if (lowerQuestion.includes('historial crediticio')) {
          return `**Sobre historial crediticio:**\n\n• **No siempre es obligatorio**, pero ayuda mucho en tu solicitud\n• Si tienes **buen historial crediticio**, es más probable que te aprueben\n• Si **no tienes historial** o es limitado:\n   - Puedes ofrecer depósito de garantía mayor\n   - Buscar garante con buen historial\n   - Mostrar estabilidad laboral y de ingresos\n• Algunos propietarios son más flexibles que otros\n• **RIAL no penaliza** a usuarios sin historial crediticio\n\n¿Tienes alguna preocupación específica sobre tu perfil?`
        }
        return 'Sobre requisitos y documentación, puedo ayudarte con:\n\n• Qué documentos necesitas\n• Requisitos para estudiantes\n• Garantes y fiadores\n• Trabajadores independientes\n• Extranjeros\n• Comprobantes de ingresos\n\n¿Qué necesitas saber específicamente?'
      }

      case 'contract': {
        // Contratos y plazos
        if (lowerQuestion.includes('tiempo mínimo') || lowerQuestion.includes('tiempo minimo') || lowerQuestion.includes('plazo mínimo')) {
          return `**Tiempo mínimo de alquiler:**\n\n• La mayoría de propiedades tienen un **mínimo de 12 meses**\n• Algunas propiedades ofrecen contratos de **6 meses** (menos comunes)\n• Contratos **temporales** (menos de 6 meses) son menos frecuentes\n• El plazo mínimo se especifica en cada anuncio\n• Puedes negociar el plazo con el propietario antes de firmar\n\n¿Estás buscando un contrato de corto o largo plazo?`
        }
        if (lowerQuestion.includes('renovar')) {
          return `**Sobre renovación de contrato:**\n\n✅ **Sí, puedes renovar** tu contrato al terminar el plazo:\n\n• **Contacta al propietario** con al menos 2-3 meses de anticipación\n• **Negocien las nuevas condiciones** (precio, plazo, etc.)\n• Si ambos están de acuerdo, se puede:\n   - Renovar con el mismo contrato\n   - Firmar un nuevo contrato con condiciones actualizadas\n   - Extender el contrato existente\n• **Aumentos**: Generalmente se aplican según índices o acuerdos previos\n• **Si no renuevas**: Debes desocupar la propiedad al finalizar el contrato\n\n¿Tu contrato está por vencer?`
        }
        if (lowerQuestion.includes('irse antes') || lowerQuestion.includes('terminar antes') || lowerQuestion.includes('cancelar contrato')) {
          return `**Si quieres irte antes de que termine el contrato:**\n\n⚠️ **Importante**: Esto depende de las cláusulas de tu contrato específico:\n\n• **Algunos contratos** permiten terminación anticipada con aviso previo (generalmente 2-3 meses)\n• **Puede haber penalizaciones**:\n   - Pérdida del depósito de garantía\n   - Pago de meses restantes\n   - Multa por terminación anticipada\n• **Opciones**:\n   - Negociar con el propietario una salida amigable\n   - Buscar un reemplazo (subarrendamiento, si está permitido)\n   - Revisar cláusulas de fuerza mayor\n\n💡 **Recomendación**: Revisa tu contrato y habla con el propietario. Muchos son flexibles si das aviso con tiempo.`
        }
        if (lowerQuestion.includes('aumento') || lowerQuestion.includes('ajusta')) {
          return `**Sobre aumentos de alquiler:**\n\n• Los aumentos generalmente se aplican **anualmente** o según lo acordado en el contrato\n• **Cómo se calcula**:\n   - Índice de inflación (IPC)\n   - Índices inmobiliarios específicos\n   - Porcentaje acordado en el contrato\n   - Negociación directa con el propietario\n• **Aviso previo**: El propietario debe avisarte con anticipación (generalmente 60-90 días)\n• **Todo debe estar especificado** en tu contrato\n• Si tienes dudas, **revisa tu contrato** o consulta con el propietario\n\n¿Tienes alguna pregunta específica sobre aumentos?`
        }
        if (lowerQuestion.includes('ver mi contrato') || lowerQuestion.includes('dónde está mi contrato')) {
          return `**Para ver tu contrato:**\n\n• **En la app/web de RIAL**: Ve a "Mis Alquileres" → Selecciona tu propiedad → "Ver Contrato"\n• **En tu email**: Busca el correo con el contrato firmado que recibiste al concretar el alquiler\n• **Solicitar copia**: Puedes pedirle una copia al propietario o a RIAL si no la encuentras\n• **Contratos digitales**: Están disponibles en tu cuenta de RIAL en cualquier momento\n\n¿Necesitas ayuda para acceder a tu contrato?`
        }
        if (lowerQuestion.includes('pdf') || lowerQuestion.includes('copia del contrato')) {
          return `**Sí, puedes obtener una copia del contrato en PDF:**\n\n• **Desde la app/web**: Ve a tu propiedad → "Descargar Contrato PDF"\n• **Por email**: Solicita al propietario o a RIAL que te envíen una copia\n• **Todos los contratos** firmados en RIAL están disponibles en formato digital\n• Puedes **imprimirlo** si necesitas una copia física\n• **Mantén una copia** para tus registros personales\n\n¿Necesitas ayuda para descargarlo?`
        }
        return 'Sobre contratos y plazos, puedo ayudarte con:\n\n• Tiempos mínimos de alquiler\n• Renovaciones\n• Terminación anticipada\n• Aumentos\n• Acceso a contratos\n\n¿Qué te gustaría saber?'
      }

      case 'payment': {
        // Pagos, depósitos y facturación
        if (lowerQuestion.includes('formas de pago') || lowerQuestion.includes('método de pago') || lowerQuestion.includes('metodo de pago')) {
          return `**Formas de pago aceptadas en RIAL:**\n\n💳 **Métodos disponibles:**\n• Tarjeta de crédito/débito\n• Transferencia bancaria\n• Depósito en cuenta\n• Algunos propietarios aceptan efectivo (coordinado directamente)\n• Pagos digitales (según disponibilidad en tu país)\n\n🔒 **Seguridad**: Todos los pagos se procesan de forma segura a través de la plataforma RIAL.\n\n¿Quieres configurar un método de pago?`
        }
        if (lowerQuestion.includes('cuándo pagar') && lowerQuestion.includes('primer mes')) {
          return `**Cuándo pagar el primer mes:**\n\n• Generalmente se paga **al firmar el contrato** o **al recibir las llaves**\n• El pago incluye:\n   - Primer mes de alquiler\n   - Depósito de garantía (1-2 meses)\n   - Posibles gastos administrativos\n• **Antes de pagar**: Asegúrate de haber revisado la propiedad y el contrato\n• El pago se realiza a través de RIAL de forma segura\n\n¿Tienes alguna pregunta sobre el proceso de pago inicial?`
        }
        if (lowerQuestion.includes('depósito de garantía') || lowerQuestion.includes('deposito de garantia')) {
          return `**Sobre el depósito de garantía:**\n\n• Generalmente es **1-2 meses de alquiler** (varía según el propietario y país)\n• Se usa para cubrir:\n   - Daños a la propiedad (más allá del desgaste normal)\n   - Pagos pendientes\n   - Limpieza profunda si es necesaria\n• **Se devuelve** al finalizar el contrato si la propiedad está en buen estado\n• **Tiempo de devolución**: Generalmente 15-30 días después de entregar la propiedad\n• **Deducciones**: Solo se hacen por daños reales, con justificación\n\n¿Tienes alguna pregunta específica sobre depósitos?`
        }
        if (lowerQuestion.includes('cuándo me devuelven') || lowerQuestion.includes('cuando me devuelven')) {
          return `**Cuándo te devuelven el depósito:**\n\n• **Generalmente 15-30 días** después de entregar la propiedad\n• **Proceso**:\n   1. Entregas la propiedad en buen estado\n   2. El propietario hace una inspección final\n   3. Si todo está bien, se procesa la devolución\n   4. Recibes el depósito (menos cualquier deducción justificada)\n• **Deducciones**: Solo por daños reales, con documentación\n• **Si hay desacuerdo**: Puedes contactar a RIAL para mediación\n\n¿Estás por terminar tu contrato?`
        }
        if (lowerQuestion.includes('pagar tarde') || lowerQuestion.includes('pago tarde')) {
          return `**Si pagas tarde:**\n\n⚠️ **Consecuencias posibles:**\n\n• **Intereses moratorios** (según lo especificado en tu contrato)\n• **Recordatorios** del propietario y de RIAL\n• **Afecta tu calificación** como inquilino\n• **En casos extremos**: Puede llevar a terminación del contrato\n\n💡 **Recomendaciones:**\n• Comunícate con el propietario **antes** de la fecha de vencimiento si sabes que vas a pagar tarde\n• Muchos propietarios son comprensivos si hay comunicación\n• Configura **recordatorios** o **pagos automáticos** para evitar olvidos\n\n¿Necesitas ayuda para configurar pagos automáticos?`
        }
        if (lowerQuestion.includes('pagar varios meses') || lowerQuestion.includes('adelantado')) {
          return `**Sí, puedes pagar varios meses por adelantado:**\n\n✅ **Ventajas:**\n• Puede ayudarte a **negociar un mejor precio**\n• **Descuentos** por pago anticipado (según el propietario)\n• **Tranquilidad** de no tener que recordar pagos mensuales\n• Puede mejorar tu **perfil como inquilino**\n\n📋 **Consideraciones:**\n• Asegúrate de tener el dinero disponible\n• Revisa el contrato para ver si hay cláusulas sobre pagos anticipados\n• **Negocia** con el propietario antes de hacer el pago\n\n¿Estás considerando pagar por adelantado?`
        }
        if (lowerQuestion.includes('historial de pagos') || lowerQuestion.includes('pagos anteriores')) {
          return `**Para ver tu historial de pagos:**\n\n• **En la app/web**: Ve a "Mis Alquileres" → Tu propiedad → "Historial de Pagos"\n• Ahí verás:\n   - Todos los pagos realizados\n   - Fechas y montos\n   - Estado de cada pago (completado, pendiente, etc.)\n   - Método de pago usado\n• **Exportar**: Puedes descargar un resumen en PDF si lo necesitas\n\n¿Necesitas ayuda para acceder a tu historial?`
        }
        if (lowerQuestion.includes('recibo') || lowerQuestion.includes('factura')) {
          return `**Sobre recibos y facturas:**\n\n✅ **Sí, puedes descargar recibos/facturas:**\n\n• **Después de cada pago**: Se genera automáticamente un recibo\n• **Acceso**: Ve a "Historial de Pagos" → Selecciona el pago → "Descargar Recibo"\n• **Formato**: Disponible en PDF\n• **Uso**: Para declaraciones de impuestos, comprobantes, etc.\n• **Solicitar copia**: Si no encuentras un recibo, puedes solicitarlo al propietario o a RIAL\n\n¿Necesitas un recibo específico?`
        }
        if (lowerQuestion.includes('cambiar método de pago')) {
          return `**Para cambiar tu método de pago:**\n\n• **En la app/web**: Ve a "Configuración" → "Métodos de Pago" → "Agregar Nuevo Método"\n• **Selecciona** el método que quieres usar por defecto\n• **Verifica** que la información esté correcta\n• Los **próximos pagos** se harán con el nuevo método\n• Puedes tener **múltiples métodos** guardados y elegir cuál usar en cada pago\n\n¿Necesitas ayuda para configurarlo?`
        }
        return 'Sobre pagos y facturación, puedo ayudarte con:\n\n• Formas de pago aceptadas\n• Depósitos de garantía\n• Historial de pagos\n• Recibos y facturas\n• Pagos atrasados\n\n¿Qué necesitas saber?'
      }

      case 'support': {
        // Soporte, reclamos y problemas
        if (lowerQuestion.includes('no responde') && lowerQuestion.includes('propietario')) {
          return `**Si el propietario no responde:**\n\n1. **Espera 48-72 horas** (algunos propietarios tardan en responder)\n2. **Envía un recordatorio** a través de la plataforma\n3. **Contacta a RIAL**: Ve a "Soporte" → "Reportar Problema"\n4. **RIAL puede**:\n   - Contactar al propietario directamente\n   - Ofrecerte propiedades alternativas\n   - Ayudarte a resolver la situación\n\n⏱️ **Tiempos normales de respuesta**: 24-48 horas hábiles.\n\n¿Hace cuánto tiempo enviaste tu mensaje?`
        }
        if (lowerQuestion.includes('no coincide') && lowerQuestion.includes('fotos')) {
          return `**Si la propiedad no coincide con las fotos:**\n\n⚠️ **Pasos a seguir:**\n\n1. **Documenta el problema**: Toma fotos de las diferencias\n2. **Contacta al propietario** primero para aclarar\n3. **Si no se resuelve**: Reporta a RIAL:\n   - Ve a "Soporte" → "Reportar Problema"\n   - Selecciona "Propiedad no coincide con anuncio"\n   - Adjunta tus fotos y explicación\n4. **RIAL investigará** y puede:\n   - Solicitar al propietario que actualice las fotos\n   - Ofrecerte alternativas\n   - En casos graves, remover el anuncio\n\n🔍 **Importante**: RIAL verifica las propiedades, pero si encuentras discrepancias, repórtalas.`
        }
        if (lowerQuestion.includes('problema con el pago') || lowerQuestion.includes('cargo duplicado')) {
          return `**Si tienes un problema con el pago (cargo duplicado, etc.):**\n\n🚨 **Acción inmediata:**\n\n1. **Revisa tu historial de pagos** en la app\n2. **Contacta a RIAL inmediatamente**:\n   - Soporte → "Problema con Pago"\n   - Proporciona detalles del cargo\n3. **RIAL investigará** y resolverá:\n   - Si hay cargo duplicado, se reembolsará\n   - Si hay error, se corregirá\n   - Te mantendrán informado del proceso\n4. **Tiempo de resolución**: Generalmente 3-5 días hábiles\n\n💳 **Mientras tanto**: Guarda comprobantes de todos los cargos.\n\n¿Puedes darme más detalles sobre el problema?`
        }
        if (lowerQuestion.includes('cancelar') && lowerQuestion.includes('reserva')) {
          return `**Para cancelar tu reserva:**\n\n• **Antes de ser aceptada**: Puedes cancelar sin penalización desde "Mis Solicitudes"\n• **Después de ser aceptada**: Depende de las políticas:\n   - Si cancelas dentro de X días: reembolso completo o parcial\n   - Si cancelas muy cerca de la fecha: pueden aplicar penalizaciones\n   - Revisa las políticas de cancelación en tu solicitud\n• **Proceso**: Ve a "Mis Alquileres" → Tu reserva → "Cancelar"\n• **Contacta al propietario** si quieres negociar la cancelación\n\n¿En qué etapa está tu reserva?`
        }
        if (lowerQuestion.includes('devuelven el dinero') && lowerQuestion.includes('cancelar')) {
          return `**Reembolso al cancelar:**\n\n• **Depende del momento** en que canceles:\n   - **Antes de ser aceptada**: Reembolso completo del depósito de reserva (si se pagó)\n   - **Después de aceptada, con tiempo**: Reembolso completo o parcial según políticas\n   - **Cancelación tardía**: Puede haber deducciones o penalizaciones\n• **Tiempo de reembolso**: 5-10 días hábiles después de procesar la cancelación\n• **Forma**: Se devuelve al método de pago original\n\n📋 **Revisa las políticas específicas** de tu reserva para detalles exactos.\n\n¿Quieres cancelar una reserva?`
        }
        if (lowerQuestion.includes('mantenimiento') || lowerQuestion.includes('problema') && lowerQuestion.includes('departamento')) {
          return `**Si hay un problema de mantenimiento:**\n\n🔧 **Pasos a seguir:**\n\n1. **Contacta al propietario** primero a través de la plataforma\n2. **Describe el problema** claramente (con fotos si es posible)\n3. **Espera respuesta** (generalmente 24-48 horas)\n4. **Si no responde o no resuelve**:\n   - Reporta a RIAL en "Soporte" → "Problema con Propiedad"\n   - RIAL puede contactar al propietario\n   - En casos urgentes (agua, gas, electricidad), contacta servicios de emergencia\n\n⚠️ **Urgencias**: Para problemas graves (fugas, gas, etc.), contacta servicios de emergencia primero.\n\n¿Qué tipo de problema tienes?`
        }
        if (lowerQuestion.includes('reportar') && (lowerQuestion.includes('propietario') || lowerQuestion.includes('comportamiento'))) {
          return `**Para reportar comportamiento inapropiado:**\n\n🚨 **RIAL toma esto muy en serio:**\n\n1. **Ve a "Soporte"** → "Reportar Usuario"\n2. **Selecciona el tipo de problema**:\n   - Acoso o comportamiento inapropiado\n   - Comunicación ofensiva\n   - Incumplimiento de acuerdos\n   - Otro\n3. **Proporciona detalles** y evidencia si la tienes\n4. **RIAL investigará** y tomará las medidas necesarias:\n   - Advertencia al usuario\n   - Suspensión temporal o permanente\n   - En casos graves, acción legal\n\n🔒 **Confidencialidad**: Tu reporte es confidencial y se maneja con seriedad.\n\n¿Quieres hacer un reporte?`
        }
        if (lowerQuestion.includes('reseña') || lowerQuestion.includes('resena') || lowerQuestion.includes('dejar reseña')) {
          return `**Para dejar una reseña:**\n\n⭐ **Después de tu estadía o interacción:**\n\n• **Ve a la propiedad** en "Mis Alquileres" → "Dejar Reseña"\n• **Califica** (1-5 estrellas) y escribe tu opinión\n• **Puedes reseñar**:\n   - La propiedad (ubicación, estado, amenities)\n   - El propietario (comunicación, respuesta, flexibilidad)\n• **Las reseñas son públicas** y ayudan a otros usuarios\n• **Sé honesto y constructivo** en tu reseña\n\n💡 **Tip**: Las reseñas detalladas son más útiles para la comunidad.\n\n¿Quieres dejar una reseña sobre alguna propiedad?`
        }
        return 'Sobre soporte y problemas, puedo ayudarte con:\n\n• Problemas con propietarios\n• Reclamos sobre propiedades\n• Problemas de pago\n• Cancelaciones\n• Mantenimiento\n• Reportar comportamientos inapropiados\n• Dejar reseñas\n\n¿Qué problema necesitas resolver?'
      }

      case 'account': {
        // Cuenta de usuario del inquilino
        if (lowerQuestion.includes('crear cuenta') || lowerQuestion.includes('registro')) {
          return `**Para crear una cuenta en RIAL:**\n\n1. **Haz clic en "Registrarse"** en la página principal\n2. **Completa el formulario**:\n   - Email\n   - Contraseña\n   - Nombre completo\n   - Teléfono\n3. **Verifica tu email** (te llegará un correo de confirmación)\n4. **Completa tu perfil**:\n   - Foto de perfil\n   - Información adicional\n   - Verificación de identidad (opcional pero recomendado)\n5. **¡Listo!** Ya puedes buscar y solicitar propiedades\n\n⏱️ **Tiempo**: Menos de 5 minutos.\n\n¿Necesitas ayuda con algún paso?`
        }
        if (lowerQuestion.includes('contraseña') || lowerQuestion.includes('contrasena') || lowerQuestion.includes('olvidé') || lowerQuestion.includes('olvide')) {
          return `**Para recuperar tu contraseña:**\n\n1. **Haz clic en "¿Olvidaste tu contraseña?"** en la pantalla de inicio de sesión\n2. **Ingresa tu email** registrado\n3. **Revisa tu correo** - recibirás un link para restablecer\n4. **Haz clic en el link** y crea una nueva contraseña\n5. **Inicia sesión** con tu nueva contraseña\n\n⏱️ **Si no recibes el email**:\n• Revisa tu carpeta de spam\n• Verifica que el email sea el correcto\n• Espera unos minutos (puede tardar)\n• Contacta a soporte si persiste el problema\n\n¿Tienes problemas para recuperar tu contraseña?`
        }
        if (lowerQuestion.includes('cambiar') && (lowerQuestion.includes('mail') || lowerQuestion.includes('email') || lowerQuestion.includes('teléfono') || lowerQuestion.includes('telefono'))) {
          return `**Para cambiar tu información de contacto:**\n\n• **En la app/web**: Ve a "Configuración" → "Mi Perfil" → "Editar"\n• **Puedes cambiar**:\n   - Email (requiere verificación del nuevo email)\n   - Teléfono\n   - Nombre (si hay cambios legales)\n• **Guarda los cambios**\n• **Verifica** el nuevo email si lo cambiaste\n\n🔔 **Importante**: Asegúrate de que tu información esté actualizada para recibir notificaciones importantes.\n\n¿Necesitas ayuda para actualizar tu información?`
        }
        if (lowerQuestion.includes('cerrar sesión') && lowerQuestion.includes('todos')) {
          return `**Para cerrar sesión en todos tus dispositivos:**\n\n• **En la app/web**: Ve a "Configuración" → "Seguridad" → "Cerrar Sesión en Todos los Dispositivos"\n• Esto **cerrará tu sesión** en:\n   - Tu computadora\n   - Tu celular\n   - Tablets\n   - Cualquier otro dispositivo donde hayas iniciado sesión\n• **Tendrás que iniciar sesión nuevamente** en cada dispositivo\n\n🔒 **Seguridad**: Útil si perdiste un dispositivo o sospechas acceso no autorizado.\n\n¿Quieres hacerlo ahora?`
        }
        if (lowerQuestion.includes('eliminar cuenta')) {
          return `**Para eliminar tu cuenta:**\n\n⚠️ **Importante**: Esto es permanente y no se puede deshacer.\n\n1. **Ve a "Configuración"** → "Privacidad" → "Eliminar Cuenta"\n2. **Confirma** que quieres eliminar tu cuenta\n3. **Si tienes alquileres activos**:\n   - Debes completar o cancelar tus contratos primero\n   - No puedes eliminar la cuenta con alquileres activos\n4. **Se eliminará**:\n   - Tu perfil\n   - Historial (excepto lo requerido por ley)\n   - Reseñas (se mantienen anónimas)\n\n💡 **Alternativa**: Puedes desactivar tu cuenta temporalmente en lugar de eliminarla.\n\n¿Estás seguro de que quieres eliminar tu cuenta?`
        }
        if (lowerQuestion.includes('foto de perfil') || lowerQuestion.includes('cambiar foto')) {
          return `**Para cambiar tu foto de perfil:**\n\n1. **Ve a "Configuración"** → "Mi Perfil"\n2. **Haz clic en tu foto actual**\n3. **Selecciona "Cambiar Foto"**\n4. **Elige una foto** desde tu dispositivo\n5. **Ajusta y guarda**\n\n📸 **Recomendaciones**:\n• Usa una foto clara y profesional\n• Asegúrate de que sea una foto tuya (los propietarios la verán)\n• Tamaño recomendado: al menos 200x200 píxeles\n\n¿Necesitas ayuda para actualizar tu foto?`
        }
        if (lowerQuestion.includes('qué datos ven') || lowerQuestion.includes('que datos ven') || lowerQuestion.includes('propietarios ven')) {
          return `**Qué datos ven los propietarios de tu perfil:**\n\n👁️ **Información visible:**\n• Nombre completo\n• Foto de perfil\n• Calificación promedio (si tienes reseñas)\n• Verificación de identidad (si la completaste)\n• Reseñas que otros propietarios te hayan dejado\n\n🔒 **Información privada (NO visible):**\n• Email\n• Teléfono (hasta que inicies contacto)\n• Dirección\n• Información financiera\n• Documentos personales\n\n💡 **Tip**: Un perfil completo y verificado aumenta tus chances de ser aceptado.\n\n¿Quieres completar tu perfil?`
        }
        // Casos específicos para propietarios en cuenta
        if (lowerQuestion.includes('cuenta propietario') || lowerQuestion.includes('registro propietario') || 
            (lowerQuestion.includes('propietario') && (lowerQuestion.includes('cuenta') || lowerQuestion.includes('registro')))) {
          return `**Para crear una cuenta como propietario:**\n\n1. **Haz clic en "Registrarse"** y selecciona "Soy Propietario"\n2. **Completa el formulario**:\n   - Email\n   - Contraseña\n   - Nombre completo o nombre de empresa\n   - Teléfono\n3. **Verifica tu email**\n4. **Completa verificación de propietario**:\n   - Documentos de identidad\n   - Documentos que demuestren propiedad (títulos, escrituras)\n   - Información bancaria para recibir pagos\n5. **Una vez verificado**, puedes publicar propiedades\n\n⏱️ **Tiempo de verificación**: 1-3 días hábiles\n\n💡 **Ventaja**: Las cuentas verificadas generan más confianza en los inquilinos.\n\n¿Necesitas ayuda con el registro?`
        }
        if (lowerQuestion.includes('diferencia') && (lowerQuestion.includes('inquilino') && lowerQuestion.includes('propietario'))) {
          return `**Diferencia entre cuenta de inquilino y propietario:**\n\n👤 **Cuenta de Inquilino:**\n• Para buscar y alquilar propiedades\n• Puedes enviar solicitudes\n• Ver y contactar propietarios\n• Gestionar tus alquileres activos\n• Dejar reseñas\n\n🏠 **Cuenta de Propietario:**\n• Para publicar y gestionar propiedades\n• Puedes recibir solicitudes\n• Aceptar o rechazar inquilinos\n• Gestionar contratos y pagos\n• Ver estadísticas de tus propiedades\n\n💡 **Puedes tener ambas**: Muchos usuarios tienen cuenta de inquilino y propietario.\n\n¿Quieres crear una cuenta como propietario?`
        }
        if (lowerQuestion.includes('verificar cuenta propietario') || lowerQuestion.includes('verificación propietario')) {
          return `**Para verificar tu cuenta de propietario:**\n\n📄 **Documentos necesarios:**\n\n• **Identidad**:\n   - DNI o pasaporte\n   - Foto de perfil clara\n\n• **Propiedad**:\n   - Título de propiedad\n   - Escritura\n   - Contrato de compra-venta\n   - O documento que demuestre que eres propietario\n\n• **Bancario** (para recibir pagos):\n   - Datos de cuenta bancaria\n   - Comprobante de cuenta\n\n⏱️ **Tiempo de verificación**: 1-3 días hábiles después de subir los documentos\n\n✅ **Ventajas de estar verificado**:\n• Sello de verificación en tus anuncios\n• Mayor confianza de los inquilinos\n• Más solicitudes\n• Acceso a todas las funciones\n\n¿Tienes todos los documentos listos?`
        }
        if (lowerQuestion.includes('cuenta empresa') || lowerQuestion.includes('inmobiliaria')) {
          return `**Sí, puedes usar una cuenta de empresa/inmobiliaria:**\n\n🏢 **Para empresas/inmobiliarias:**\n\n1. **Regístrate** como "Cuenta Empresarial" o "Inmobiliaria"\n2. **Documentos necesarios**:\n   - Documentos de la empresa\n   - Registro comercial\n   - Autorización para representar la empresa\n3. **Ventajas**:\n   - Gestionar múltiples propiedades\n   - Agregar miembros del equipo\n   - Estadísticas avanzadas\n   - Facturación empresarial\n\n👥 **Equipo**: Puedes agregar otros usuarios a tu cuenta para que gestionen propiedades.\n\n💡 **Contacta a RIAL**: Para cuentas empresariales, te recomendamos contactar directamente para configuración personalizada.\n\n¿Eres una empresa o inmobiliaria?`
        }
        if (lowerQuestion.includes('cuánto tarda verificación') || lowerQuestion.includes('cuanto tarda verificacion')) {
          return `**Tiempo de verificación de cuenta de propietario:**\n\n⏱️ **Generalmente 1-3 días hábiles** después de subir todos los documentos.\n\n📋 **Factores que afectan el tiempo:**\n• Completitud de los documentos\n• Claridad de las fotos/documentos\n• Volumen de solicitudes (puede tardar más en picos)\n• Verificación adicional si es necesario\n\n📧 **Notificación**: Recibirás un email cuando tu cuenta sea verificada.\n\n💡 **Tip**: Asegúrate de que los documentos sean claros y estén completos para acelerar el proceso.\n\n¿Ya subiste tus documentos?`
        }
        return 'Sobre tu cuenta, puedo ayudarte con:\n\n• Crear cuenta (inquilino o propietario)\n• Recuperar contraseña\n• Actualizar información\n• Verificación de propietario\n• Configuración de privacidad\n• Eliminar cuenta\n\n¿Qué necesitas hacer?'
      }

      case 'publish': {
        // Publicación de propiedades (propietarios)
        if (lowerQuestion.includes('publicar') || lowerQuestion.includes('publicación') || lowerQuestion.includes('publicacion')) {
          return `**Para publicar una propiedad en RIAL:**\n\n1. **Inicia sesión** como propietario\n2. **Haz clic en "Publicar Propiedad"**\n3. **Completa la información**:\n   - Ubicación y dirección\n   - Tipo de propiedad\n   - Precio de alquiler\n   - Número de habitaciones, baños, etc.\n   - Descripción detallada\n   - Amenities y características\n4. **Sube fotos** (mínimo 3, recomendado 10+)\n5. **Revisa y publica**\n\n⏱️ **Tiempo estimado**: 15-20 minutos\n\n💡 **Tip**: Propiedades con más fotos y descripciones detalladas reciben más solicitudes.\n\n¿Necesitas ayuda con algún paso?`
        }
        if (lowerQuestion.includes('qué información') || lowerQuestion.includes('que informacion') || lowerQuestion.includes('completar')) {
          return `**Información necesaria para el anuncio:**\n\n📋 **Obligatorio:**\n• Ubicación completa (dirección, ciudad, país)\n• Tipo de propiedad (departamento, casa, loft, etc.)\n• Precio de alquiler mensual\n• Número de habitaciones\n• Número de baños\n• Área en m²\n• Al menos 3 fotos\n\n📋 **Recomendado:**\n• Descripción detallada\n• Amenities (piscina, gimnasio, etc.)\n• Reglas de la propiedad\n• Disponibilidad desde fecha\n• Depósito de garantía requerido\n• Si acepta mascotas\n• Si está amueblado\n\n¿Tienes alguna pregunta sobre qué incluir?`
        }
        if (lowerQuestion.includes('fotos') || lowerQuestion.includes('cuántas fotos')) {
          return `**Sobre fotos para tu anuncio:**\n\n📸 **Requisitos:**\n• **Mínimo**: 3 fotos\n• **Recomendado**: 10-15 fotos\n• **Máximo**: 30 fotos\n\n📸 **Recomendaciones para buenas fotos:**\n• **Buena iluminación**: Usa luz natural cuando sea posible\n• **Múltiples ángulos**: Sala, cocina, habitaciones, baños, exteriores\n• **Limpieza**: Asegúrate de que la propiedad esté ordenada\n• **Calidad**: Fotos nítidas y bien enfocadas\n• **Primera foto**: Usa la mejor como foto principal\n\n💡 **Tip**: Incluye fotos de amenities del edificio si aplica (piscina, gimnasio, etc.).\n\n¿Necesitas más consejos para las fotos?`
        }
        if (lowerQuestion.includes('editar precio') || lowerQuestion.includes('cambiar precio')) {
          return `**Para editar el precio de tu propiedad:**\n\n1. **Ve a "Mis Propiedades"**\n2. **Selecciona la propiedad** que quieres editar\n3. **Haz clic en "Editar"**\n4. **Modifica el precio**\n5. **Guarda los cambios**\n\n⚠️ **Importante**:\n• Los cambios se aplican inmediatamente\n• Los inquilinos con solicitudes pendientes serán notificados\n• Puedes cambiar el precio en cualquier momento\n\n¿Quieres editar el precio de alguna propiedad?`
        }
        if (lowerQuestion.includes('pausar') || lowerQuestion.includes('no disponible') || lowerQuestion.includes('reactivar')) {
          return `**Para pausar o reactivar una publicación:**\n\n⏸️ **Pausar:**\n• Ve a "Mis Propiedades" → Tu propiedad → "Pausar"\n• La propiedad dejará de aparecer en búsquedas\n• Puedes reactivarla cuando quieras\n\n▶️ **Reactivar:**\n• Ve a "Propiedades Pausadas" → "Reactivar"\n• La propiedad volverá a aparecer en búsquedas\n\n💡 **Útil para**:\n• Reparaciones o mantenimiento\n• Propiedad temporalmente ocupada\n• Actualizar información antes de volver a publicar\n\n¿Quieres pausar alguna propiedad?`
        }
        if (lowerQuestion.includes('duplicar') || lowerQuestion.includes('copiar anuncio')) {
          return `**Para duplicar un anuncio anterior:**\n\n1. **Ve a "Mis Propiedades"**\n2. **Selecciona la propiedad** que quieres duplicar\n3. **Haz clic en "Duplicar"** o "Usar como plantilla"\n4. **Se creará un nuevo anuncio** con la misma información\n5. **Edita lo que necesites** (precio, descripción, fotos, etc.)\n6. **Publica el nuevo anuncio**\n\n💡 **Útil para**:\n• Publicar la misma propiedad en diferentes zonas\n• Crear variaciones del mismo anuncio\n• Ahorrar tiempo al publicar propiedades similares\n\n⚠️ **Importante**: Asegúrate de actualizar la información específica (dirección, precio, etc.) antes de publicar.\n\n¿Quieres duplicar algún anuncio?`
        }
        if (lowerQuestion.includes('editar descripción') || lowerQuestion.includes('cambiar descripción') || lowerQuestion.includes('modificar descripción')) {
          return `**Para editar la descripción de tu propiedad:**\n\n1. **Ve a "Mis Propiedades"**\n2. **Selecciona la propiedad**\n3. **Haz clic en "Editar"**\n4. **Modifica la descripción** en el campo correspondiente\n5. **Guarda los cambios**\n\n💡 **Consejos para una buena descripción:**\n• Sé específico sobre características únicas\n• Menciona amenities y servicios cercanos\n• Incluye información sobre transporte público\n• Menciona si acepta mascotas, estudiantes, etc.\n• Sé honesto sobre el estado de la propiedad\n\n📝 **Longitud recomendada**: 200-500 palabras.\n\n¿Necesitas ayuda para mejorar tu descripción?`
        }
        if (lowerQuestion.includes('marcar no disponible') || lowerQuestion.includes('temporalmente ocupada')) {
          return `**Para marcar una propiedad como no disponible temporalmente:**\n\n1. **Ve a "Mis Propiedades"**\n2. **Selecciona la propiedad**\n3. **Haz clic en "Pausar"** o "No disponible"\n4. **Opcionalmente, indica la fecha** de disponibilidad futura\n\n⏸️ **Efectos:**\n• La propiedad dejará de aparecer en búsquedas\n• Las solicitudes existentes se mantienen\n• Puedes reactivarla cuando quieras\n\n💡 **Alternativa**: Puedes actualizar la fecha de disponibilidad en lugar de pausar completamente.\n\n¿Quieres pausar alguna propiedad?`
        }
        return 'Sobre publicar propiedades, puedo ayudarte con:\n\n• Cómo crear un anuncio\n• Qué información incluir\n• Fotos y recomendaciones\n• Editar precios y descripciones\n• Duplicar anuncios\n• Pausar y reactivar publicaciones\n\n¿Qué necesitas saber?'
      }

      case 'owner_management': {
        // Gestión de solicitudes (propietarios)
        if (lowerQuestion.includes('solicitudes') || lowerQuestion.includes('candidatos') || lowerQuestion.includes('postuló')) {
          return `**Para ver solicitudes de tu propiedad:**\n\n1. **Ve a "Mis Propiedades"**\n2. **Selecciona la propiedad**\n3. **Haz clic en "Solicitudes"**\n4. **Verás todas las solicitudes** con:\n   - Perfil del inquilino\n   - Información de contacto\n   - Documentos adjuntos\n   - Mensaje personal (si lo enviaron)\n\n📋 **Puedes**:\n• Ver detalles completos de cada candidato\n• Aceptar o rechazar solicitudes\n• Pedir más información\n• Contactar directamente\n\n¿Tienes solicitudes pendientes?`
        }
        if (lowerQuestion.includes('aceptar') || lowerQuestion.includes('rechazar')) {
          return `**Para aceptar o rechazar una solicitud:**\n\n✅ **Aceptar:**\n• Ve a la solicitud → "Aceptar"\n• El inquilino será notificado\n• Pueden coordinar visita y contrato\n\n❌ **Rechazar:**\n• Ve a la solicitud → "Rechazar"\n• Opcionalmente, puedes agregar un motivo\n• El inquilino será notificado amablemente\n\n💡 **Recomendación**: Responde en 24-48 horas para mantener buena comunicación.\n\n¿Quieres aceptar o rechazar alguna solicitud?`
        }
        if (lowerQuestion.includes('requisitos mínimos') || lowerQuestion.includes('fijar requisitos')) {
          return `**Para fijar requisitos mínimos:**\n\n📋 **Al publicar o editar tu propiedad, puedes establecer:**\n\n• **Ingresos mínimos**: Ej. "Ingresos de al menos 3x el alquiler"\n• **Tiempo de contrato**: Ej. "Mínimo 12 meses"\n• **Garante requerido**: Sí/No\n• **Verificación de identidad**: Requerida/Opcional\n• **Historial crediticio**: Mínimo aceptable\n\n💡 **Ventajas**:\n• Filtra candidatos que no cumplen\n• Ahorra tiempo en revisión\n• Atrae inquilinos más adecuados\n\n¿Quieres configurar requisitos para alguna propiedad?`
        }
        if (lowerQuestion.includes('bloquear usuario')) {
          return `**Para bloquear a un usuario:**\n\n1. **Ve al perfil del usuario**\n2. **Haz clic en "Bloquear"**\n3. **Confirma la acción**\n\n🚫 **Efectos del bloqueo:**\n• El usuario no podrá ver tus propiedades\n• No podrá enviarte solicitudes\n• No podrá contactarte\n\n⚠️ **Importante**: Esta acción es permanente. Si cambias de opinión, contacta a soporte.\n\n¿Quieres bloquear a algún usuario?`
        }
        return 'Sobre gestión de solicitudes, puedo ayudarte con:\n\n• Ver solicitudes y candidatos\n• Aceptar o rechazar solicitudes\n• Establecer requisitos mínimos\n• Bloquear usuarios\n\n¿Qué necesitas hacer?'
      }

      case 'owner_pricing': {
        // Precios y comisiones (propietarios)
        if (lowerQuestion.includes('comisión') || lowerQuestion.includes('comision') || lowerQuestion.includes('rial cobra')) {
          return `**Sobre comisiones de RIAL:**\n\n💰 **Para propietarios:**\n• RIAL cobra una comisión del **X%** sobre cada alquiler (varía según el plan)\n• La comisión se descuenta del pago que recibes\n• **Sin costo de publicación**: Publicar propiedades es gratis\n• **Solo pagas cuando alquilas**: Si no alquilas, no pagas comisión\n\n📋 **Planes disponibles**:\n• Plan Básico: X% comisión\n• Plan Premium: X% comisión (con más beneficios)\n\n💡 **Transparencia**: Todos los costos se muestran claramente antes de publicar.\n\n¿Quieres conocer más sobre nuestros planes?`
        }
        if (lowerQuestion.includes('recibo el pago') || lowerQuestion.includes('cuándo recibo')) {
          return `**Cuándo y cómo recibes el pago:**\n\n💰 **Proceso de pago:**\n\n1. **El inquilino paga** a través de RIAL\n2. **RIAL procesa** el pago (1-2 días hábiles)\n3. **Se descuenta la comisión**\n4. **Recibes el pago** en tu cuenta bancaria\n\n⏱️ **Tiempo**: Generalmente 3-5 días hábiles después de que el inquilino paga\n\n🏦 **Métodos de pago disponibles**:\n• Transferencia bancaria\n• Depósito directo\n• Otros métodos según tu país\n\n💡 **Configuración**: Asegúrate de tener tus datos bancarios actualizados en "Configuración de Pagos".\n\n¿Tienes tus datos bancarios configurados?`
        }
        if (lowerQuestion.includes('depósito mayor') || lowerQuestion.includes('deposito mayor') || lowerQuestion.includes('garantía mayor')) {
          return `**Sobre depósitos de garantía mayores:**\n\n💰 **Sí, puedes pedir un depósito mayor:**\n\n• **Depósito estándar**: Generalmente 1-2 meses de alquiler\n• **Depósito mayor**: Puedes solicitar 3 meses o más si lo consideras necesario\n\n📋 **Cuándo es útil:**\n• Para inquilinos sin historial crediticio\n• Para propiedades de alto valor\n• Para mayor seguridad\n\n⚠️ **Consideraciones**:\n• Debe estar especificado en el anuncio\n• Debe ser razonable según el mercado\n• El depósito se devuelve al finalizar el contrato si no hay daños\n\n💡 **Tip**: Un depósito mayor puede disuadir a algunos inquilinos, pero atrae a otros más serios.\n\n¿Quieres configurar un depósito mayor?`
        }
        if (lowerQuestion.includes('cambiar precio después') || lowerQuestion.includes('modificar precio publicado')) {
          return `**Sí, puedes cambiar el precio después de publicado:**\n\n1. **Ve a "Mis Propiedades"**\n2. **Selecciona la propiedad**\n3. **Haz clic en "Editar"**\n4. **Modifica el precio**\n5. **Guarda los cambios**\n\n⚠️ **Consideraciones:**\n• Los cambios se aplican inmediatamente\n• Los inquilinos con solicitudes pendientes serán notificados\n• Un aumento de precio puede afectar las solicitudes existentes\n• Una disminución puede atraer más interés\n\n💡 **Recomendación**: Si aumentas el precio significativamente, considera pausar y reactivar el anuncio para que aparezca como "nuevo".\n\n¿Quieres cambiar el precio de alguna propiedad?`
        }
        return 'Sobre precios y pagos como propietario, puedo ayudarte con:\n\n• Comisiones de RIAL\n• Cuándo recibes los pagos\n• Configuración de datos bancarios\n• Depósitos de garantía\n• Cambiar precios\n• Historial de pagos\n\n¿Qué necesitas saber?'
      }

      case 'owner_contract': {
        // Contratos y reglas (propietarios)
        if (lowerQuestion.includes('contrato automático') || lowerQuestion.includes('modelo de contrato') || lowerQuestion.includes('rial genera contrato')) {
          return `**Sobre contratos en RIAL:**\n\n📄 **RIAL genera un modelo de contrato automáticamente:**\n\n• **Al aceptar una solicitud**, se genera un contrato base\n• **Incluye cláusulas estándar** legales\n• **Puedes personalizarlo** antes de enviarlo al inquilino\n• **Ambas partes** deben revisar y aceptar\n\n✅ **Ventajas:**\n• Ahorra tiempo\n• Incluye cláusulas legales estándar\n• Firma digital disponible\n• Almacenamiento seguro\n\n📝 **Personalización**: Puedes agregar cláusulas específicas según tus necesidades.\n\n¿Tienes alguna pregunta sobre contratos?`
        }
        if (lowerQuestion.includes('mi propio contrato') || lowerQuestion.includes('contrato personalizado')) {
          return `**Sí, puedes usar tu propio contrato:**\n\n1. **Al aceptar una solicitud**, en lugar del contrato automático\n2. **Sube tu contrato** en formato PDF o Word\n3. **El inquilino lo revisa** y puede aceptar o solicitar cambios\n4. **Ambas partes** deben estar de acuerdo\n\n⚠️ **Importante**:\n• Tu contrato debe cumplir con las leyes locales\n• RIAL no se hace responsable del contenido de contratos personalizados\n• Te recomendamos consultar con un abogado\n• Algunas cláusulas pueden no ser legales según tu jurisdicción\n\n💡 **Recomendación**: Combina el contrato de RIAL con cláusulas adicionales personalizadas.\n\n¿Quieres usar un contrato personalizado?`
        }
        if (lowerQuestion.includes('reglas específicas') || lowerQuestion.includes('reglas de la propiedad') || lowerQuestion.includes('no fumar') || lowerQuestion.includes('no fiestas')) {
          return `**Para agregar reglas específicas a tu propiedad:**\n\n📋 **Dónde agregarlas:**\n\n1. **En el anuncio**: Sección "Reglas de la Propiedad"\n2. **En el contrato**: Como cláusulas adicionales\n3. **Al contactar inquilinos**: Puedes mencionarlas directamente\n\n📝 **Reglas comunes:**\n• No fumar\n• No fiestas/eventos\n• No mascotas (o solo ciertos tipos)\n• Horarios de silencio\n• Uso de áreas comunes\n• Mantenimiento y limpieza\n• Visitas y huéspedes\n\n⚠️ **Importante**:\n• Las reglas deben ser razonables y legales\n• Deben estar claras desde el principio\n• Deben estar en el contrato para ser vinculantes\n\n💡 **Tip**: Sé específico pero razonable. Reglas muy restrictivas pueden reducir el interés.\n\n¿Quieres agregar reglas a alguna propiedad?`
        }
        if (lowerQuestion.includes('subir condiciones') || lowerQuestion.includes('condiciones particulares')) {
          return `**Para subir condiciones particulares:**\n\n1. **Al crear o editar tu anuncio**: Sección "Condiciones Especiales"\n2. **En el contrato**: Como anexo o cláusulas adicionales\n3. **Formato**: Puedes subir un documento PDF o escribirlas directamente\n\n📄 **Qué incluir:**\n• Reglas de la propiedad\n• Uso de espacios comunes\n• Políticas de mantenimiento\n• Restricciones específicas\n• Cualquier condición importante\n\n💡 **Recomendación**: Haz las condiciones claras y visibles desde el anuncio para evitar malentendidos.\n\n¿Necesitas ayuda para redactar condiciones?`
        }
        if (lowerQuestion.includes('firma digital') || lowerQuestion.includes('firma presencial') || lowerQuestion.includes('cómo se firma')) {
          return `**Sobre la firma del contrato:**\n\n📝 **RIAL ofrece ambas opciones:**\n\n✅ **Firma digital:**\n• Rápida y conveniente\n• Desde cualquier dispositivo\n• Legalmente válida\n• Almacenada de forma segura\n• Ambas partes pueden firmar online\n\n✅ **Firma presencial:**\n• Puedes coordinar una reunión\n• Firma física del contrato\n• Útil si prefieres el contacto personal\n• Debes escanear y subir el contrato firmado\n\n💡 **Recomendación**: La firma digital es más rápida y eficiente, pero la elección es tuya.\n\n¿Prefieres firma digital o presencial?`
        }
        return 'Sobre contratos y reglas, puedo ayudarte con:\n\n• Contratos automáticos de RIAL\n• Contratos personalizados\n• Agregar reglas específicas\n• Condiciones particulares\n• Firma digital vs presencial\n\n¿Qué necesitas saber?'
      }

      case 'owner_cancel': {
        // Cancelaciones y conflictos (propietarios)
        if (lowerQuestion.includes('cancelar alquiler') && lowerQuestion.includes('propietario')) {
          return `**Si necesitas cancelar un alquiler ya acordado:**\n\n⚠️ **Proceso:**\n\n1. **Contacta al inquilino** primero para explicar la situación\n2. **Notifica a RIAL** a través de soporte\n3. **Revisa las políticas** de cancelación en tu contrato\n4. **Negocia una solución** si es posible\n\n💰 **Penalizaciones posibles:**\n• Puede haber penalizaciones según el contrato\n• Puedes perder el depósito de reserva si lo recibiste\n• Puede afectar tu calificación como propietario\n• El inquilino puede tener derecho a compensación\n\n💡 **Alternativas**:\n• Buscar un reemplazo antes de cancelar\n• Negociar una salida amigable\n• Ofrecer compensación al inquilino\n\n🚨 **Importante**: La cancelación sin causa justificada puede tener consecuencias legales.\n\n¿Cuál es tu situación específica?`
        }
        if (lowerQuestion.includes('penalizaciones') && lowerQuestion.includes('cancelar')) {
          return `**Penalizaciones por cancelar como propietario:**\n\n💰 **Depende de cuándo canceles:**\n\n• **Antes de firmar contrato**: Generalmente sin penalización, pero el inquilino puede recibir reembolso del depósito de reserva\n• **Después de firmar pero antes de ingreso**: Puede haber penalización según el contrato\n• **Después del ingreso**: Penalizaciones más severas, posible compensación al inquilino\n\n📋 **Factores que afectan:**\n• Tiempo de aviso dado\n• Razón de la cancelación\n• Términos del contrato\n• Leyes locales\n\n⚠️ **Consecuencias adicionales:**\n• Puede afectar tu calificación\n• Puede afectar tu capacidad de publicar en el futuro\n• Posibles acciones legales del inquilino\n\n💡 **Recomendación**: Siempre intenta encontrar una solución alternativa antes de cancelar.\n\n¿Estás considerando cancelar un alquiler?`
        }
        if (lowerQuestion.includes('inquilino rompe reglas') || lowerQuestion.includes('incumplimiento')) {
          return `**Si el inquilino rompe las reglas:**\n\n📋 **Pasos a seguir:**\n\n1. **Documenta el problema**: Fotos, mensajes, testigos si es necesario\n2. **Contacta al inquilino** de forma profesional y clara\n3. **Explica qué regla se está rompiendo** y por qué es un problema\n4. **Da una oportunidad** para corregir (si es razonable)\n5. **Si persiste**: Contacta a RIAL para mediación\n6. **En casos graves**: Considera acción legal según tu contrato\n\n⚠️ **Casos graves que requieren acción inmediata:**\n• Daños a la propiedad\n• Actividades ilegales\n• Molestias graves a vecinos\n• Incumplimiento de pago\n\n💡 **RIAL puede ayudar**: Ofrecemos mediación para resolver conflictos.\n\n¿Qué tipo de incumplimiento estás experimentando?`
        }
        if (lowerQuestion.includes('reportar problema') && lowerQuestion.includes('inquilino')) {
          return `**Para reportar un problema con un inquilino:**\n\n1. **Ve a "Mis Alquileres"** → Tu propiedad\n2. **Haz clic en "Reportar Problema"**\n3. **Selecciona el tipo de problema**:\n   - Incumplimiento de reglas\n   - Problemas de pago\n   - Daños a la propiedad\n   - Comportamiento inapropiado\n   - Otro\n4. **Proporciona detalles** y evidencia si la tienes\n5. **RIAL revisará** y te ayudará a resolver\n\n🔒 **Confidencialidad**: Tu reporte es confidencial.\n\n⏱️ **Tiempo de respuesta**: Generalmente 24-48 horas.\n\n¿Quieres hacer un reporte?`
        }
        if (lowerQuestion.includes('daños en la propiedad') || lowerQuestion.includes('rial ayuda con daños')) {
          return `**Sobre daños en la propiedad:**\n\n🛠️ **RIAL puede ayudar, pero:**\n\n✅ **Lo que SÍ hacemos:**\n• Facilitamos comunicación entre partes\n• Ofrecemos mediación en disputas\n• Proporcionamos documentación del contrato\n• Ayudamos a evaluar si los daños están cubiertos por el depósito\n\n❌ **Lo que NO hacemos:**\n• No pagamos por daños directamente\n• No somos responsables de los daños\n• No forzamos pagos (debe ser por acuerdo o vía legal)\n\n💰 **Proceso típico:**\n1. Documenta los daños (fotos, descripción)\n2. Contacta al inquilino\n3. Si hay desacuerdo, usa el depósito de garantía\n4. Si el depósito no cubre todo, puede requerir acción legal\n\n💡 **Recomendación**: Toma fotos antes y después del alquiler para comparar.\n\n¿Tienes un problema con daños?`
        }
        if (lowerQuestion.includes('reseña al inquilino') || lowerQuestion.includes('dejar reseña inquilino')) {
          return `**Sí, puedes dejar una reseña al inquilino:**\n\n⭐ **Después de que termine el alquiler:**\n\n1. **Ve a "Mis Alquileres"** → Propiedad finalizada\n2. **Haz clic en "Dejar Reseña"**\n3. **Califica** (1-5 estrellas) y escribe tu opinión\n4. **Puedes reseñar**:\n   - Cumplimiento de pagos\n   - Cuidado de la propiedad\n   - Comunicación y respeto\n   - Cumplimiento de reglas\n\n💡 **Importante**:\n• Sé honesto y constructivo\n• Las reseñas son públicas\n• Ayudan a otros propietarios\n• El inquilino también puede reseñarte a ti\n\n📝 **Tip**: Reseñas detalladas son más útiles para la comunidad.\n\n¿Quieres dejar una reseña?`
        }
        return 'Sobre cancelaciones y conflictos, puedo ayudarte con:\n\n• Cancelar un alquiler\n• Penalizaciones por cancelar\n• Inquilinos que rompen reglas\n• Reportar problemas\n• Daños en la propiedad\n• Dejar reseñas a inquilinos\n\n¿Qué problema necesitas resolver?'
      }

      case 'owner_account': {
        // Cuenta de propietario/inmobiliaria
        if (lowerQuestion.includes('cambiar nombre empresa') || lowerQuestion.includes('nombre que aparece')) {
          return `**Para cambiar el nombre de tu empresa que aparece en los anuncios:**\n\n1. **Ve a "Configuración"** → "Mi Perfil de Propietario"\n2. **Haz clic en "Editar Información de Empresa"**\n3. **Modifica el nombre**\n4. **Guarda los cambios**\n\n⚠️ **Importante**:\n• El cambio se aplicará a todos tus anuncios\n• Puede requerir verificación si cambias el nombre legal\n• Los inquilinos verán el nuevo nombre\n\n💡 **Tip**: Si es un cambio legal importante, contacta a soporte para actualizar la verificación.\n\n¿Quieres cambiar el nombre de tu empresa?`
        }
        if (lowerQuestion.includes('agregar usuarios') || lowerQuestion.includes('equipo de trabajo') || lowerQuestion.includes('miembros del equipo')) {
          return `**Para agregar otros usuarios a tu cuenta (equipo de trabajo):**\n\n👥 **Proceso:**\n\n1. **Ve a "Configuración"** → "Equipo" o "Miembros"\n2. **Haz clic en "Agregar Miembro"**\n3. **Ingresa el email** del usuario\n4. **Asigna permisos**:\n   - Ver propiedades\n   - Editar propiedades\n   - Gestionar solicitudes\n   - Ver reportes\n   - Administrador completo\n5. **El usuario recibirá una invitación** por email\n6. **Una vez aceptada**, tendrá acceso según los permisos\n\n💡 **Útil para**:\n• Inmobiliarias con múltiples agentes\n• Propietarios que contratan gestores\n• Empresas con equipos\n\n¿Quieres agregar miembros a tu equipo?`
        }
        if (lowerQuestion.includes('actualizar datos bancarios') || lowerQuestion.includes('datos bancarios para recibir pagos')) {
          return `**Para actualizar tus datos bancarios:**\n\n🏦 **Proceso:**\n\n1. **Ve a "Configuración"** → "Pagos" → "Datos Bancarios"\n2. **Haz clic en "Editar"**\n3. **Actualiza la información**:\n   - Número de cuenta\n   - Tipo de cuenta\n   - Banco\n   - Información de transferencia\n4. **Verifica la información** (puede requerir confirmación)\n5. **Guarda los cambios**\n\n⚠️ **Importante**:\n• Los cambios pueden tardar 1-2 días en procesarse\n• Los pagos pendientes seguirán yendo a la cuenta anterior hasta que se actualice\n• Verifica que la información sea correcta para evitar problemas\n\n💡 **Tip**: Mantén tus datos bancarios actualizados para recibir pagos sin demoras.\n\n¿Necesitas actualizar tus datos bancarios?`
        }
        if (lowerQuestion.includes('cerrar cuenta propietario') || lowerQuestion.includes('eliminar cuenta propietario')) {
          return `**Para cerrar tu cuenta de propietario:**\n\n⚠️ **Importante**: Esto es permanente y tiene consecuencias.\n\n📋 **Antes de cerrar:**\n\n1. **Completa o cancela** todos los alquileres activos\n2. **Pausa o elimina** todas tus publicaciones\n3. **Resuelve** cualquier pago pendiente\n4. **Exporta** cualquier información que necesites\n\n🗑️ **Proceso de cierre:**\n\n1. **Ve a "Configuración"** → "Privacidad" → "Eliminar Cuenta"\n2. **Selecciona "Cuenta de Propietario"**\n3. **Confirma** que quieres cerrar\n4. **Completa el proceso**\n\n🚫 **Consecuencias:**\n• Se eliminarán todas tus publicaciones\n• No podrás recibir nuevos pagos\n• Tu perfil dejará de ser visible\n• Las reseñas se mantendrán anónimas\n\n💡 **Alternativa**: Puedes pausar todas tus publicaciones en lugar de cerrar la cuenta.\n\n¿Estás seguro de que quieres cerrar tu cuenta?`
        }
        if (lowerQuestion.includes('misma cuenta varias propiedades') || lowerQuestion.includes('varias propiedades misma cuenta')) {
          return `**Sí, puedes usar la misma cuenta para varias propiedades:**\n\n✅ **Ventajas:**\n\n• **Gestión centralizada**: Todas tus propiedades en un solo lugar\n• **Estadísticas consolidadas**: Ve el rendimiento de todas juntas\n• **Facilidad**: No necesitas múltiples cuentas\n• **Eficiencia**: Gestiona todo desde un dashboard\n\n📋 **Cómo funciona:**\n\n• Publica tantas propiedades como quieras desde tu cuenta\n• Cada propiedad tiene su propio anuncio y gestión\n• Puedes ver todas en "Mis Propiedades"\n• Puedes gestionar solicitudes de todas en un lugar\n\n💡 **Tip**: Organiza tus propiedades con etiquetas o carpetas si tienes muchas.\n\n¿Tienes múltiples propiedades para publicar?`
        }
        return 'Sobre tu cuenta de propietario, puedo ayudarte con:\n\n• Cambiar nombre de empresa\n• Agregar miembros del equipo\n• Actualizar datos bancarios\n• Cerrar cuenta de propietario\n• Gestionar múltiples propiedades\n\n¿Qué necesitas hacer?'
      }

      case 'platform_info': {
        // Qué es RIAL y cómo funciona
        if (lowerQuestion.includes('qué es rial') || lowerQuestion.includes('que es rial')) {
          return `**RIAL es una plataforma digital** que conecta propietarios e inquilinos para alquileres de largo plazo.\n\n🏠 **Qué hacemos:**\n• Facilitamos la búsqueda y publicación de propiedades\n• Proporcionamos herramientas para gestionar alquileres\n• Ofrecemos contratos digitales\n• Procesamos pagos de forma segura\n• Verificamos identidades para mayor seguridad\n\n💡 **RIAL NO es una inmobiliaria tradicional**: Somos una plataforma tecnológica que facilita el proceso de alquiler.\n\n¿Quieres saber más sobre cómo funciona?`
        }
        if (lowerQuestion.includes('inmobiliaria') || lowerQuestion.includes('plataforma')) {
          return `**RIAL es una plataforma tecnológica**, no una inmobiliaria tradicional:\n\n✅ **Lo que SÍ hacemos:**\n• Conectamos propietarios e inquilinos\n• Facilitamos el proceso de alquiler\n• Proporcionamos herramientas digitales\n• Procesamos pagos\n• Ofrecemos soporte\n\n❌ **Lo que NO hacemos:**\n• No gestionamos propiedades directamente\n• No somos responsables de los contratos (facilitamos el proceso)\n• No inspeccionamos todas las propiedades físicamente\n\n🔒 **Responsabilidad**: Los contratos son entre propietario e inquilino. RIAL facilita el proceso.\n\n¿Tienes más preguntas?`
        }
        if (lowerQuestion.includes('airbnb') || lowerQuestion.includes('booking')) {
          return `**RIAL vs Airbnb/Booking:**\n\n🏠 **RIAL**:\n• **Enfoque**: Alquileres de largo plazo (6+ meses)\n• **Contratos**: Formales, con depósitos y garantías\n• **Proceso**: Más similar a alquiler tradicional pero digitalizado\n• **Público**: Personas buscando hogar permanente o semi-permanente\n\n🏨 **Airbnb/Booking**:\n• **Enfoque**: Alojamiento temporal (días/semanas)\n• **Contratos**: Más informales, sin depósitos grandes\n• **Proceso**: Reserva rápida, check-in/out\n• **Público**: Viajeros y turistas\n\n💡 **Resumen**: RIAL es para vivir, Airbnb/Booking es para visitar.\n\n¿Buscas alquiler de largo plazo?`
        }
        if (lowerQuestion.includes('países') || lowerQuestion.includes('paises') || lowerQuestion.includes('ciudades disponibles')) {
          return `**RIAL está enfocado en alquileres de largo plazo en el área de Miami, Florida (EE. UU.).**\n\n🏙️ **Zonas principales:**\n• Brickell\n• South Beach / Miami Beach\n• Coral Gables\n• Wynwood\n• Downtown Miami\n\n💡 Puedes buscar por barrio, dirección o frases naturales (ej. "apartamento 2 habitaciones con pool en Brickell").\n\n¿En qué zona de Miami estás buscando?`
        }
        return 'Sobre RIAL, puedo ayudarte con:\n\n• Qué es RIAL\n• Cómo funciona\n• Dónde está disponible\n• Diferencias con otras plataformas\n\n¿Qué te gustaría saber?'
      }

      case 'security': {
        // Seguridad y verificación
        if (lowerQuestion.includes('propiedades reales') || lowerQuestion.includes('verificar propiedades')) {
          return `**Cómo sabemos que las propiedades son reales:**\n\n✅ **Proceso de verificación:**\n\n• **Verificación de identidad del propietario**: Documentos oficiales\n• **Verificación de propiedad**: Títulos, escrituras o documentos que demuestren propiedad\n• **Fotos verificadas**: Revisamos que las fotos sean reales\n• **Sistema de reseñas**: Los inquilinos pueden reportar propiedades falsas\n• **Monitoreo activo**: Revisamos reportes y actividad sospechosa\n\n🔒 **Sello de verificación**: Las propiedades verificadas tienen un sello especial.\n\n⚠️ **Si encuentras algo sospechoso**: Repórtalo inmediatamente.\n\n¿Viste alguna propiedad que te parezca sospechosa?`
        }
        if (lowerQuestion.includes('verifican identidad')) {
          return `**Sí, RIAL verifica identidades:**\n\n👤 **Para inquilinos:**\n• Verificación opcional pero recomendada\n• Subes foto de tu DNI/pasaporte\n• Verificación automática o manual\n• Mejora tu perfil y chances de ser aceptado\n\n👤 **Para propietarios:**\n• Verificación obligatoria para publicar\n• Documentos de identidad\n• Verificación de propiedad\n• Mayor confianza para inquilinos\n\n🔒 **Seguridad**: Todos los documentos se manejan con encriptación y solo se usan para verificación.\n\n¿Quieres verificar tu identidad?`
        }
        if (lowerQuestion.includes('seguro pagar') || lowerQuestion.includes('pago seguro')) {
          return `**Sí, es seguro pagar a través de RIAL:**\n\n🔒 **Medidas de seguridad:**\n\n• **Encriptación SSL**: Todos los pagos son encriptados\n• **Procesadores seguros**: Trabajamos con procesadores de pago certificados\n• **No almacenamos datos de tarjeta**: Los datos sensibles no se guardan en nuestros servidores\n• **Protección contra fraude**: Sistemas de detección automática\n• **Reembolsos protegidos**: Políticas claras de reembolso\n\n✅ **Garantías**:\n• Si hay un problema, RIAL te ayuda a resolverlo\n• Pagos protegidos contra fraudes\n• Transparencia total en las transacciones\n\n💡 **Tip**: Siempre revisa que estés en el sitio oficial de RIAL antes de pagar.\n\n¿Tienes alguna preocupación sobre seguridad?`
        }
        if (lowerQuestion.includes('estafa') || lowerQuestion.includes('evitar estafas')) {
          return `**Cómo evitar estafas en RIAL:**\n\n⚠️ **Señales de alerta:**\n\n• Propietario que pide pago fuera de la plataforma\n• Precios demasiado bajos para ser verdad\n• Propietario que no quiere mostrar la propiedad\n• Presión para pagar rápido sin ver la propiedad\n• Solicitud de información bancaria por WhatsApp/email no oficial\n\n✅ **Buenas prácticas:**\n\n• **Siempre paga a través de RIAL**: Nunca transfieras fuera de la plataforma\n• **Visita la propiedad**: O al menos haz videollamada\n• **Revisa el perfil**: Propietarios verificados son más confiables\n• **Lee reseñas**: Revisa qué dicen otros inquilinos\n• **Reporta sospechas**: Si algo te parece raro, repórtalo\n\n🚨 **Si sospechas estafa**: Contacta a RIAL inmediatamente.\n\n¿Viste algo sospechoso?`
        }
        return 'Sobre seguridad y verificación, puedo ayudarte con:\n\n• Cómo verificamos propiedades\n• Verificación de identidad\n• Seguridad de pagos\n• Cómo evitar estafas\n\n¿Qué te preocupa?'
      }

      case 'policies': {
        // Políticas, términos y privacidad
        if (lowerQuestion.includes('términos') || lowerQuestion.includes('terminos') || lowerQuestion.includes('condiciones')) {
          return `**Términos y Condiciones de Alquiler – RIAL APP (Inquilino/Locatario)**\n\nÚltima actualización: 13 de febrero de 2026.\n\nEl contrato de alquiler en RIAL son estos Términos. Al aceptar, confirmar una reserva o registrar una tarjeta, el Locatario acepta: estos Términos, las condiciones de la Publicación y las políticas del proceso (en conjunto, el "Contrato de Alquiler").\n\n**Resumen:**\n• **Relación:** Alquiler entre Locatario y Locador; RIAL es la plataforma de gestión.\n• **Pago:** Solo tarjeta de crédito; débito automático (alquiler, seña, garantía, daños, mora).\n• **Seña 50%** al confirmar; saldo acreditado antes del Acceso Digital.\n• **Alquiler 3 meses:** 3 meses por adelantado + 1 mes de Garantía.\n• **Mora 15 días:** el Locador puede resolver y restringir Acceso Digital.\n• **Acceso Digital** (código/QR): personal; no compartir; uso indebido = incumplimiento grave.\n• **Devolución** en las mismas condiciones; Garantía y/o tarjeta para daños/faltantes.\n• **Ley aplicable:** Leyes del Estado de Florida y jurisdicción de Miami-Dade County, EE. UU.\n• **Seña:** 50% al reservar; **48 h** para el saldo o se pierde la seña.\n\n📄 **Texto completo:** Se muestra al "Revisar Contrato" en el proceso de alquiler (paso 4) y en Configuración/Footer.\n\n¿Querés que te aclare alguna parte?`
        }
        if (lowerQuestion.includes('datos personales') || lowerQuestion.includes('privacidad')) {
          return `**Sobre tus datos personales:**\n\n🔒 **Qué hacemos con tus datos:**\n\n• **Uso principal**: Facilitar alquileres y comunicación entre usuarios\n• **Seguridad**: Encriptamos y protegemos tu información\n• **Compartir**: Solo con usuarios relevantes (propietarios/inquilinos) cuando es necesario\n• **NO vendemos** tus datos a terceros\n• **NO usamos** tus datos para publicidad de terceros sin tu consentimiento\n\n📋 **Tus derechos:**\n• Acceder a tus datos\n• Corregir información incorrecta\n• Solicitar eliminación (según políticas)\n• Exportar tus datos\n\n📄 **Política completa**: Disponible en "Política de Privacidad" en el footer.\n\n¿Tienes preguntas sobre privacidad?`
        }
        if (lowerQuestion.includes('discriminación') || lowerQuestion.includes('discriminacion')) {
          return `**Política de no discriminación de RIAL:**\n\n🚫 **RIAL prohíbe estrictamente la discriminación** basada en:\n\n• Raza o etnia\n• Religión\n• Nacionalidad\n• Orientación sexual\n• Identidad de género\n• Estado civil\n• Discapacidad\n• Edad (excepto requisitos legales)\n• Otras características protegidas\n\n✅ **Qué SÍ pueden considerar los propietarios:**\n• Historial crediticio\n• Ingresos comprobables\n• Referencias\n• Capacidad de pago\n\n🚨 **Si experimentas discriminación**: Repórtala inmediatamente. RIAL investigará y tomará medidas.\n\n¿Has experimentado algún caso de discriminación?`
        }
        return 'Sobre políticas, puedo ayudarte con:\n\n• Términos y condiciones\n• Política de privacidad\n• Política de no discriminación\n• Políticas de cancelación\n\n¿Qué quieres conocer?'
      }

      case 'advanced_recommend': {
        // Recomendaciones personalizadas avanzadas
        if (lowerQuestion.includes('presupuesto de') && lowerQuestion.includes('recomend')) {
          const budgetMatch = lowerQuestion.match(/(\d+)/)
          if (budgetMatch) {
            const budget = parseInt(budgetMatch[1])
            contextRef.current.userPreferences.budget = { min: 0, max: budget }
            let filtered = allProperties.filter(p => (p.price || 0) <= budget)
            filtered = filtered.sort((a, b) => {
              const scoreA = (a.averageRating || 0) * 20 - ((a.price || 0) / budget) * 50
              const scoreB = (b.averageRating || 0) * 20 - ((b.price || 0) / budget) * 50
              return scoreB - scoreA
            }).slice(0, 5)
            
            if (filtered.length > 0) {
              contextRef.current.mentionedProperties = filtered.map(p => p.id)
              return `Con un presupuesto de **$${budget.toLocaleString()}/mes**, te recomiendo:\n\n${filtered.map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location}\n   💰 $${(p.price || 0).toLocaleString()}/mes\n   ⭐ ${(p.averageRating || 0).toFixed(1)}/5`).join('\n\n')}\n\n💡 **Consejo**: Con ese presupuesto, te recomiendo buscar en zonas ${budget < 1500 ? 'más económicas' : budget < 2500 ? 'intermedias' : 'premium'}.\n\n¿Te interesa alguna?`
            }
          }
          return `Con ese presupuesto, puedo ayudarte a encontrar las mejores opciones. ¿En qué ciudad estás buscando?`
        }
        if (lowerQuestion.includes('trabajo desde casa') || lowerQuestion.includes('home office')) {
          let filtered = allProperties.filter(p => {
            const amenities = [...(p.amenities || []), ...(p.buildingAmenities || [])]
            return amenities.some((a: string) => 
              a.toLowerCase().includes('office') || 
              a.toLowerCase().includes('trabajo') ||
              a.toLowerCase().includes('wifi') ||
              a.toLowerCase().includes('internet')
            ) || (p.bedrooms || 0) >= 2
          })
          filtered = filtered.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0)).slice(0, 5)
          
          if (filtered.length > 0) {
            contextRef.current.mentionedProperties = filtered.map(p => p.id)
            return `Para **trabajar desde casa**, te recomiendo propiedades con:\n\n• Espacio para oficina (2+ habitaciones ideal)\n• Buena conexión a internet\n• Ambiente tranquilo\n\n**Opciones recomendadas:**\n\n${filtered.map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location}\n   🏠 ${p.bedrooms || 0} hab. - Ideal para home office\n   💰 $${(p.price || 0).toLocaleString()}/mes`).join('\n\n')}\n\n¿Te interesa alguna?`
          }
          return 'Para trabajar desde casa, busca propiedades con 2+ habitaciones donde puedas dedicar una a tu oficina. ¿En qué zona estás buscando?'
        }
        if (lowerQuestion.includes('tranquilo') && lowerQuestion.includes('seguro')) {
          return `Para zonas **tranquilas y seguras**, te recomiendo:\n\n🏘️ **Barrios recomendados** (varía por ciudad):\n• Zonas residenciales\n• Barrios cerrados o con seguridad\n• Áreas alejadas del centro pero bien conectadas\n\n🔍 **Características a buscar:**\n• Propiedades con medidas de seguridad (portería, cámaras)\n• Zonas residenciales, no comerciales\n• Buenas reseñas sobre seguridad\n• Lejos de bares/zonas de fiesta\n\n💡 **Tip**: Revisa las reseñas de otras propiedades en la misma zona para conocer la seguridad del área.\n\n¿En qué ciudad estás buscando?`
        }
        if (lowerQuestion.includes('transporte público') || lowerQuestion.includes('transporte publico')) {
          return `Para estar cerca de **transporte público**, busca propiedades que mencionen:\n\n🚇 **Cerca de:**\n• Estaciones de metro/subte\n• Paradas de bus principales\n• Estaciones de tren\n• Terminales de transporte\n\n📍 **En el mapa**: Las propiedades muestran su ubicación. Busca las que estén cerca de líneas de transporte.\n\n💡 **Tip**: Filtra por ubicación y revisa en el mapa qué tan cerca están de transporte público.\n\n¿En qué ciudad y zona estás buscando?`
        }
        if (lowerQuestion.includes('pareja joven')) {
          let filtered = allProperties.filter(p => (p.bedrooms || 0) >= 1 && (p.bedrooms || 0) <= 3)
          filtered = filtered.sort((a, b) => {
            const scoreA = ((a.bedrooms || 0) >= 2 ? 10 : 5) + (a.averageRating || 0) * 5
            const scoreB = ((b.bedrooms || 0) >= 2 ? 10 : 5) + (b.averageRating || 0) * 5
            return scoreB - scoreA
          }).slice(0, 5)
          
          if (filtered.length > 0) {
            contextRef.current.mentionedProperties = filtered.map(p => p.id)
            return `Para una **pareja joven**, te recomiendo propiedades con:\n\n• 1-2 habitaciones (ideal para empezar)\n• Buena ubicación (cerca de trabajo/universidad)\n• Amenities modernas\n• Precio accesible\n\n**Opciones recomendadas:**\n\n${filtered.map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location}\n   🏠 ${p.bedrooms || 0} hab. - Perfecto para pareja\n   💰 $${(p.price || 0).toLocaleString()}/mes\n   ⭐ ${(p.averageRating || 0).toFixed(1)}/5`).join('\n\n')}\n\n¿Te interesa alguna?`
          }
        }
        return 'Puedo hacer recomendaciones personalizadas basadas en:\n\n• Tu presupuesto\n• Necesidades específicas (home office, mascotas, etc.)\n• Preferencias de zona\n• Tipo de propiedad\n\n¿Qué necesitas específicamente?'
      }

      case 'explain_concept': {
        // Explicación de conceptos inmobiliarios
        if (lowerQuestion.includes('depósito de garantía') || lowerQuestion.includes('deposito de garantia')) {
          return `**¿Qué es un depósito de garantía?**\n\n💰 **Definición**: Es un monto que pagas al inicio del alquiler (generalmente 1-2 meses de alquiler) que el propietario guarda como "seguro".\n\n📋 **Para qué se usa:**\n• Cubrir daños a la propiedad (más allá del desgaste normal)\n• Pagar meses pendientes si te vas sin pagar\n• Limpieza profunda si es necesaria\n\n✅ **Se devuelve**: Al finalizar el contrato si la propiedad está en buen estado\n\n💡 **Importante**: Solo se pueden hacer deducciones por daños reales y justificados.\n\n¿Tienes más preguntas sobre depósitos?`
        }
        if (lowerQuestion.includes('amoblado parcial')) {
          return `**¿Qué significa "amoblado parcial"?**\n\n🛋️ **Significa que la propiedad incluye algunos muebles pero no todos:**\n\n✅ **Generalmente incluye:**\n• Muebles básicos (cama, mesa, sillas)\n• Electrodomésticos (heladera, cocina)\n• Cortinas, iluminación\n\n❌ **Generalmente NO incluye:**\n• Decoración personal\n• Todos los muebles (puede faltar sofá, escritorio, etc.)\n• Ropa de cama\n• Utensilios de cocina\n\n💡 **Tip**: Pregunta al propietario exactamente qué incluye antes de alquilar.\n\n¿Buscas algo amoblado?`
        }
        if (lowerQuestion.includes('expensas')) {
          return `**¿Qué son las expensas?**\n\n🏢 **Definición**: Son los gastos comunes del edificio que se reparten entre todos los propietarios/inquilinos.\n\n📋 **Qué incluyen:**\n• Mantenimiento del edificio\n• Limpieza de áreas comunes\n• Portería/seguridad\n• Ascensores\n• Calefacción central (si aplica)\n• Agua de áreas comunes\n• Seguro del edificio\n\n💰 **Cómo se paga**: Generalmente se paga mensualmente, aparte del alquiler.\n\n💡 **Importante**: Las expensas pueden variar mes a mes. Pregunta al propietario sobre el promedio.\n\n¿Tienes más preguntas?`
        }
        if (lowerQuestion.includes('contrato a plazo fijo')) {
          return `**¿Qué es un contrato a plazo fijo?**\n\n📅 **Definición**: Es un contrato con una duración específica y determinada (ej. 12 meses, 24 meses).\n\n📋 **Características:**\n• **Duración fija**: No se puede terminar antes sin penalización\n• **Renovación**: Al terminar, se puede renovar o terminar\n• **Estabilidad**: Ambas partes saben cuánto durará\n\n🔄 **Diferencia con otros contratos**:\n• Contrato temporal: Duración más corta y flexible\n• Contrato indefinido: Sin fecha de finalización específica\n\n💡 **Ventaja**: Proporciona estabilidad tanto para inquilino como propietario.\n\n¿Buscas un contrato de plazo fijo?`
        }
        if (lowerQuestion.includes('garante') || lowerQuestion.includes('fiador')) {
          return `**¿Qué es un garante/fiador?**\n\n👤 **Definición**: Es una persona que se compromete a pagar el alquiler si el inquilino no puede hacerlo.\n\n📋 **Requisitos típicos:**\n• Ingresos comprobables (generalmente 3x el valor del alquiler)\n• Buena calificación crediticia\n• Documentación en regla\n\n✅ **Cuándo se necesita:**\n• Si tus ingresos no son suficientes\n• Si eres estudiante sin ingresos fijos\n• Si el propietario lo requiere\n\n💡 **Importante**: El garante es responsable legalmente si no pagas.\n\n¿Necesitas un garante?`
        }
        if (lowerQuestion.includes('alquiler indexado')) {
          return `**¿Qué es alquiler indexado?**\n\n📈 **Definición**: Es un alquiler que se ajusta según un índice (generalmente inflación o índice de precios).\n\n📋 **Cómo funciona:**\n• El precio base se ajusta periódicamente (generalmente anualmente)\n• Se usa un índice oficial (IPC, índice de precios, etc.)\n• El aumento se calcula según la variación del índice\n\n💰 **Ejemplo**: Si el índice sube 5% en un año, el alquiler sube 5%.\n\n💡 **Ventaja**: Protege al propietario de la inflación, pero puede ser predecible para el inquilino.\n\n¿Tienes más preguntas sobre tipos de contratos?`
        }
        return 'Puedo explicarte conceptos como:\n\n• Depósito de garantía\n• Amoblado parcial\n• Expensas\n• Contratos a plazo fijo\n• Garantes/fiadores\n• Alquiler indexado\n\n¿Qué concepto quieres que explique?'
      }

      case 'calculate': {
        // Ayuda con cálculos
        if (lowerQuestion.includes('si gano') && lowerQuestion.includes('alquiler máximo')) {
          const incomeMatch = lowerQuestion.match(/(\d+)/)
          if (incomeMatch) {
            const income = parseInt(incomeMatch[1])
            const maxRent = Math.floor(income / 3)
            const recommended = Math.floor(income / 3.5)
            return `Si ganas **$${income.toLocaleString()}/mes**, te recomiendo:\n\n💰 **Alquiler máximo recomendado**: $${recommended.toLocaleString()}/mes\n💰 **Alquiler máximo absoluto**: $${maxRent.toLocaleString()}/mes\n\n📋 **Regla general**: Tu alquiler no debería superar el **30-35% de tus ingresos** para mantener un buen equilibrio financiero.\n\n💡 **Consejo**: Deja espacio para gastos como servicios, comida, transporte, ahorros, etc.\n\n¿Quieres que busque propiedades en ese rango de precio?`
          }
        }
        if (lowerQuestion.includes('depósito') && lowerQuestion.includes('entrada')) {
          const rentMatch = lowerQuestion.match(/(\d+)/)
          if (rentMatch) {
            const rent = parseInt(rentMatch[1])
            const deposit = rent * 2
            const total = rent + deposit
            return `Si el alquiler es de **$${rent.toLocaleString()}/mes** y el depósito es de **2 meses**:\n\n💰 **Desglose de pago inicial:**\n• Depósito de garantía (2 meses): $${deposit.toLocaleString()}\n• Primer mes de alquiler: $${rent.toLocaleString()}\n• **Total a pagar de entrada**: $${total.toLocaleString()}\n\n💡 **Nota**: Algunos propietarios pueden pedir 1 mes de depósito, otros 2-3. Siempre pregunta antes.\n\n¿Tienes alguna otra pregunta sobre pagos?`
          }
        }
        if (lowerQuestion.includes('aumenta') && (lowerQuestion.includes('cuánto') || lowerQuestion.includes('cuanto'))) {
          const rentMatch = lowerQuestion.match(/(\d+)/)
          const percentMatch = lowerQuestion.match(/(\d+)%/i)
          if (rentMatch && percentMatch) {
            const rent = parseInt(rentMatch[1])
            const percent = parseInt(percentMatch[1])
            const increase = rent * (percent / 100)
            const newRent = rent + increase
            return `Si el alquiler actual es de **$${rent.toLocaleString()}/mes** y aumenta **${percent}%**:\n\n📈 **Cálculo:**\n• Aumento: $${Math.round(increase).toLocaleString()}\n• **Nuevo alquiler**: $${Math.round(newRent).toLocaleString()}/mes\n\n💡 **Nota**: Los aumentos generalmente se aplican anualmente. Revisa tu contrato para ver la frecuencia exacta.\n\n¿Tienes más preguntas sobre aumentos?`
          }
        }
        return 'Puedo ayudarte con cálculos como:\n\n• Alquiler máximo según tus ingresos\n• Cuánto pagar de entrada (depósito + primer mes)\n• Cálculo de aumentos de alquiler\n\n¿Qué quieres calcular?'
      }

      case 'chatbot_info': {
        // Sobre el chatbot
        if (lowerQuestion.includes('qué podés hacer') || lowerQuestion.includes('que podes hacer') || lowerQuestion.includes('podés hacer')) {
          return `**Lo que puedo hacer como asistente de RIAL:**\n\n✅ **Puedo ayudarte con:**\n\n• **Búsqueda de propiedades**: Buscar por ubicación, precio, características\n• **Información detallada**: Responder preguntas sobre propiedades específicas\n• **Recomendaciones**: Sugerir propiedades según tus necesidades\n• **Comparaciones**: Comparar diferentes propiedades\n• **Proceso de alquiler**: Explicar cómo funciona RIAL\n• **Requisitos y documentación**: Qué necesitas para alquilar\n• **Pagos y contratos**: Información sobre depósitos, pagos, etc.\n• **Soporte**: Ayudarte con problemas y preguntas\n• **Explicaciones**: Aclarar conceptos inmobiliarios\n• **Cálculos**: Ayudar con cálculos de alquiler\n\n❌ **Lo que NO puedo hacer:**\n• Hacer reservas por ti (debes hacerlo tú en la plataforma)\n• Hablar directamente con propietarios (puedo guiarte sobre cómo hacerlo)\n• Modificar contratos\n• Procesar pagos directamente\n• Ver datos sensibles de tu cuenta\n\n¿En qué más puedo ayudarte?`
        }
        if (lowerQuestion.includes('reservas por mí') || lowerQuestion.includes('reservar por')) {
          return `**No, no puedo hacer reservas por ti**, pero puedo:\n\n✅ **Ayudarte con:**\n• Explicarte el proceso paso a paso\n• Responder dudas sobre requisitos\n• Recomendarte propiedades\n• Ayudarte a preparar tu solicitud\n\n📱 **Para reservar**: Debes hacerlo tú mismo en la plataforma RIAL:\n1. Selecciona la propiedad\n2. Haz clic en "Solicitar alquiler"\n3. Completa el formulario\n4. Envía tu solicitud\n\n💡 **Ventaja**: Tú tienes control total sobre tu solicitud y puedes personalizarla.\n\n¿Necesitas ayuda para preparar tu solicitud?`
        }
        if (lowerQuestion.includes('hablar con el propietario')) {
          return `**No puedo hablar directamente con propietarios por ti**, pero puedo:\n\n✅ **Ayudarte a:**\n• Preparar mensajes para contactar propietarios\n• Sugerir qué preguntar\n• Explicar cómo usar el sistema de mensajería de RIAL\n• Ayudarte con problemas de comunicación\n\n📱 **Para contactar propietarios**:\n• Usa el sistema de mensajería de RIAL\n• O el contacto que aparece en el anuncio\n\n💡 **Tip**: Sé claro, profesional y específico en tus mensajes.\n\n¿Quieres ayuda para redactar un mensaje?`
        }
        if (lowerQuestion.includes('de dónde sacás') || lowerQuestion.includes('de donde sacas') || lowerQuestion.includes('información')) {
          return `**De dónde obtengo mi información:**\n\n📚 **Fuentes:**\n\n• **Base de datos de RIAL**: Información de todas las propiedades publicadas\n• **Políticas y términos**: Documentos oficiales de RIAL\n• **Conocimiento general**: Información sobre procesos de alquiler\n• **Contexto de conversación**: Lo que me has dicho en esta conversación\n\n🔒 **NO tengo acceso a:**\n• Datos personales sensibles de usuarios\n• Información financiera privada\n• Mensajes privados entre usuarios\n• Información no pública\n\n💡 **Transparencia**: Solo uso información disponible públicamente o que me compartes.\n\n¿Tienes más preguntas sobre cómo funciono?`
        }
        if (lowerQuestion.includes('ver mis datos') || lowerQuestion.includes('datos personales')) {
          return `**No puedo ver tus datos personales sensibles:**\n\n🔒 **Lo que NO veo:**\n• Contraseñas\n• Información financiera completa\n• Documentos personales\n• Mensajes privados\n• Datos de pago completos\n\n👁️ **Lo que SÍ puedo ver (si me lo compartes):**\n• Información que me das en la conversación\n• Preferencias que mencionas (presupuesto, ubicación, etc.)\n• Preguntas que haces\n\n💡 **Privacidad**: Tu información personal está protegida. Solo uso lo que me compartes para ayudarte mejor.\n\n¿Tienes preocupaciones sobre privacidad?`
        }
        if (lowerQuestion.includes('modificar contrato')) {
          return `**No puedo modificar contratos**, pero puedo:\n\n✅ **Ayudarte con:**\n• Explicar términos del contrato\n• Aclarar dudas sobre cláusulas\n• Sugerir qué revisar antes de firmar\n• Explicar procesos de modificación\n\n📝 **Para modificar contratos**:\n• Debes contactar directamente al propietario\n• O usar el sistema de RIAL para solicitar cambios\n• Los cambios deben ser acordados por ambas partes\n\n💡 **Importante**: Siempre revisa cuidadosamente cualquier contrato antes de firmar.\n\n¿Tienes dudas sobre algún contrato?`
        }
        return 'Sobre mí, puedo contarte:\n\n• Qué puedo hacer\n• Qué no puedo hacer\n• De dónde obtengo información\n• Cómo funciono\n\n¿Qué te gustaría saber?'
      }

      case 'technical': {
        // Errores técnicos
        if (lowerQuestion.includes('no me deja iniciar sesión') || lowerQuestion.includes('error iniciar sesion')) {
          return `**Si no puedes iniciar sesión:**\n\n🔧 **Soluciones:**\n\n1. **Verifica tus credenciales**:\n   - Email correcto\n   - Contraseña correcta (mayúsculas/minúsculas importan)\n\n2. **Recupera tu contraseña**:\n   - Haz clic en "¿Olvidaste tu contraseña?"\n   - Sigue el proceso de recuperación\n\n3. **Limpia caché y cookies**:\n   - En el navegador, limpia caché\n   - O prueba en modo incógnito\n\n4. **Verifica tu conexión a internet**\n\n5. **Contacta a soporte**:\n   - Si nada funciona, contacta a RIAL\n   - Proporciona detalles del error\n\n¿Ya intentaste recuperar tu contraseña?`
        }
        if (lowerQuestion.includes('no me llega el mail') || lowerQuestion.includes('email verificación')) {
          return `**Si no recibes el email de verificación:**\n\n📧 **Soluciones:**\n\n1. **Revisa tu carpeta de spam/correo no deseado**\n2. **Espera 5-10 minutos** (puede tardar)\n3. **Verifica el email** que ingresaste\n4. **Revisa filtros de email** que puedan bloquearlo\n5. **Solicita reenvío**:\n   - Ve a "Reenviar email de verificación"\n   - O contacta a soporte\n\n💡 **Tip**: Agrega RIAL a tus contactos para evitar que vaya a spam.\n\n¿Revisaste tu carpeta de spam?`
        }
        if (lowerQuestion.includes('cargando') || lowerQuestion.includes('no aparecen propiedades')) {
          return `**Si la página se queda cargando o no aparecen propiedades:**\n\n🔧 **Soluciones:**\n\n1. **Refresca la página** (F5 o Ctrl+R)\n2. **Limpia caché del navegador**\n3. **Verifica tu conexión a internet**\n4. **Prueba otro navegador** (Chrome, Firefox, Safari)\n5. **Desactiva extensiones** que puedan interferir\n6. **Revisa si hay mantenimiento**: RIAL puede estar en mantenimiento\n\n💡 **Si persiste**: Contacta a soporte con detalles del problema.\n\n¿Ya intentaste refrescar la página?`
        }
        if (lowerQuestion.includes('subir fotos') || lowerQuestion.includes('no puedo subir')) {
          return `**Si no puedes subir fotos:**\n\n📸 **Soluciones:**\n\n1. **Verifica el formato**:\n   - Formatos aceptados: JPG, PNG, WebP\n   - Tamaño máximo: generalmente 10MB por foto\n\n2. **Reduce el tamaño** si es muy grande\n3. **Verifica tu conexión** a internet\n4. **Prueba otra foto** para descartar que sea problema de esa imagen específica\n5. **Refresca la página** y vuelve a intentar\n\n💡 **Tip**: Si las fotos son muy grandes, comprímelas antes de subirlas.\n\n¿Qué error específico te aparece?`
        }
        if (lowerQuestion.includes('no se guarda') || lowerQuestion.includes('no guarda información')) {
          return `**Si la información no se guarda:**\n\n💾 **Soluciones:**\n\n1. **Verifica que estés guardando correctamente**:\n   - Haz clic en "Guardar" o "Actualizar"\n   - Espera a que aparezca confirmación\n\n2. **Revisa campos obligatorios**:\n   - Algunos campos pueden ser requeridos\n   - Completa todos los campos marcados con *\n\n3. **Guarda en secciones**:\n   - Si es un formulario largo, guarda por partes\n\n4. **Refresca y vuelve a intentar**\n\n5. **Contacta a soporte** si persiste\n\n¿Qué información específica no se está guardando?`
        }
        if (lowerQuestion.includes('pago rechazado') && lowerQuestion.includes('descontó')) {
          return `**Si el pago fue rechazado pero se descontó:**\n\n🚨 **Acción inmediata:**\n\n1. **NO te preocupes**: Esto suele ser un cargo temporal\n2. **Revisa tu historial de pagos** en RIAL\n3. **Contacta a RIAL inmediatamente**:\n   - Soporte → "Problema con Pago"\n   - Proporciona detalles\n4. **RIAL investigará** y resolverá:\n   - Si fue error, se corregirá\n   - Si el cargo fue temporal, se liberará\n   - Te reembolsarán si corresponde\n\n⏱️ **Tiempo**: Generalmente se resuelve en 3-5 días hábiles.\n\n💳 **Mientras tanto**: Guarda comprobantes de todo.\n\n¿Ya contactaste a soporte?`
        }
        if (lowerQuestion.includes('idioma') || lowerQuestion.includes('español')) {
          return `**Para cambiar el idioma a español:**\n\n🌐 **En la web:**\n• Busca el selector de idioma (generalmente en la esquina superior derecha)\n• Selecciona "Español"\n\n📱 **En la app:**\n• Ve a Configuración → Idioma → Español\n\n💡 **Nota**: Si el idioma cambió solo, puede ser por configuración del navegador. Revísalo en la configuración de RIAL.\n\n¿Necesitas ayuda para encontrarlo?`
        }
        if (lowerQuestion.includes('versión móvil') || lowerQuestion.includes('version movil') || lowerQuestion.includes('app móvil')) {
          return `**RIAL está disponible en:**\n\n💻 **Web**:\n• Navegador en computadora\n• Navegador móvil (responsive)\n\n📱 **App móvil**:\n• iOS (App Store)\n• Android (Google Play)\n\n✅ **Funcionalidades**: Ambas versiones tienen las mismas funciones principales.\n\n💡 **Ventaja de la app**: Notificaciones push, acceso más rápido, mejor experiencia móvil.\n\n¿Quieres descargar la app?`
        }
        return 'Sobre problemas técnicos, puedo ayudarte con:\n\n• Problemas de inicio de sesión\n• Emails que no llegan\n• Páginas que no cargan\n• Problemas al subir fotos\n• Errores de guardado\n• Problemas de pago\n• Configuración de idioma\n\n¿Qué problema técnico tienes?'
      }
      
      default: {
        // Respuestas contextuales generales
        if (lowerQuestion.includes('hola') || lowerQuestion.includes('hi') || lowerQuestion.includes('buenos')) {
          const contextInfo = []
          if (contextRef.current.mentionedProperties.length > 0) {
            contextInfo.push(`has estado viendo ${contextRef.current.mentionedProperties.length} propiedades`)
          }
          if (contextRef.current.entities.locations.size > 0) {
            contextInfo.push(`interés en ${Array.from(contextRef.current.entities.locations).join(', ')}`)
          }
          
          return `¡Hola! 👋 ${contextInfo.length > 0 ? `Veo que ${contextInfo.join(' y ')}. ` : ''}¿En qué más puedo ayudarte hoy?`
        }
        
        // Referencias a conversación anterior
        if (lowerQuestion.includes('esa') || lowerQuestion.includes('esta') || lowerQuestion.includes('la que')) {
          if (contextRef.current.mentionedProperties.length > 0) {
            const lastProp = allProperties.find(p => p.id === contextRef.current.mentionedProperties[0])
            if (lastProp) {
              return `Te refieres a **"${lastProp.title || 'Sin título'}"** en ${lastProp.location || 'ubicación no especificada'} por **$${(lastProp.price || 0).toLocaleString()}/mes**. ${lastProp.averageRating ? `Tiene una calificación de ${lastProp.averageRating.toFixed(1)}/5. ` : ''}¿Qué te gustaría saber sobre esta propiedad?`
            }
          }
          return 'No estoy seguro a qué propiedad te refieres. ¿Podrías ser más específico o mencionar el nombre de la propiedad?'
        }
        
        // Intentar detectar intenciones más sutiles
        if (lowerQuestion.includes('necesito') || lowerQuestion.includes('busco') || lowerQuestion.includes('quiero')) {
          // Intentar hacer una búsqueda básica con lo que tenemos
          let filtered = [...allProperties]
          
          if (context.entities.locations.length > 0) {
            filtered = filtered.filter(p => context.entities.locations.some(loc => p.location.toLowerCase().includes(loc.toLowerCase())))
          }
          
          if (context.entities.prices.length > 0) {
            const maxPrice = Math.max(...context.entities.prices)
            filtered = filtered.filter(p => (p.price || 0) <= maxPrice)
          }
          
          if (context.entities.requirements.bedrooms) {
            filtered = filtered.filter(p => (p.bedrooms || 0) >= context.entities.requirements.bedrooms!)
          }
          
          if (context.entities.requirements.bathrooms) {
            filtered = filtered.filter(p => (p.bathrooms || 0) >= context.entities.requirements.bathrooms!)
          }
          
          if (filtered.length > 0 && filtered.length < allProperties.length) {
            contextRef.current.mentionedProperties = filtered.slice(0, 5).map(p => p.id)
            return `Encontré **${filtered.length} propiedades** que podrían interesarte:\n\n${filtered.slice(0, 5).map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location || 'Ubicación no especificada'}\n   💰 $${(p.price || 0).toLocaleString()}/mes${p.averageRating ? `\n   ⭐ ${p.averageRating.toFixed(1)}/5` : ''}`).join('\n\n')}${filtered.length > 5 ? `\n\n...y ${filtered.length - 5} más.` : ''}\n\n¿Te interesa alguna en particular? Puedo darte más detalles.`
          }
        }
        
        // Preguntas sobre disponibilidad
        if (lowerQuestion.includes('disponible') || lowerQuestion.includes('disponibilidad')) {
          const available = allProperties.filter(p => p.availableNow)
          return `Tenemos **${available.length} propiedades disponibles ahora** de un total de ${totalProperties}. ${available.length > 0 ? '¿Quieres que te muestre algunas opciones?' : 'Puedo ayudarte a buscar propiedades que estarán disponibles próximamente.'}`
        }
        
        // Preguntas sobre tipos de propiedad
        if (lowerQuestion.includes('tipo') && (lowerQuestion.includes('propiedad') || lowerQuestion.includes('departamento') || lowerQuestion.includes('casa'))) {
          const types = [...new Set(allProperties.map(p => p.type).filter(Boolean))]
          return `Tenemos los siguientes **tipos de propiedades** disponibles:\n\n${types.slice(0, 10).map(t => `• ${t}`).join('\n')}${types.length > 10 ? `\n\n...y ${types.length - 10} tipos más.` : ''}\n\n¿Qué tipo de propiedad te interesa?`
        }
        
        // Preguntas sobre ayuda general
        if (lowerQuestion.includes('ayuda') || lowerQuestion.includes('ayudar') || lowerQuestion.includes('qué puedo') || lowerQuestion.includes('que puedo')) {
          return `¡Por supuesto! Puedo ayudarte con:\n\n🔍 **Búsqueda:**\n• Buscar propiedades por ubicación, precio, características\n• Filtrar por habitaciones, baños, amenities\n• Encontrar propiedades cerca de puntos de interés\n\n📋 **Información:**\n• Detalles de propiedades específicas\n• Proceso de alquiler paso a paso\n• Requisitos y documentación necesaria\n• Información sobre contratos y pagos\n\n💡 **Recomendaciones:**\n• Propiedades según tu presupuesto\n• Comparaciones entre propiedades\n• Explicación de conceptos inmobiliarios\n\n🆘 **Soporte:**\n• Resolver problemas técnicos\n• Ayuda con tu cuenta\n• Reportar problemas\n\n¿Con qué necesitas ayuda específicamente?`
        }
        
        // Respuesta inteligente con contexto mejorada
        const contextHints = []
        if (contextRef.current.userPreferences.budget) {
          contextHints.push(`presupuesto de hasta $${contextRef.current.userPreferences.budget.max.toLocaleString()}`)
        }
        if (contextRef.current.entities.locations.size > 0) {
          contextHints.push(`ubicaciones: ${Array.from(contextRef.current.entities.locations).join(', ')}`)
        }
        if (contextRef.current.userPreferences.minBedrooms) {
          contextHints.push(`${contextRef.current.userPreferences.minBedrooms}+ habitaciones`)
        }
        if (contextRef.current.userPreferences.minBathrooms) {
          contextHints.push(`${contextRef.current.userPreferences.minBathrooms}+ baños`)
        }
        
        // Si hay contexto, intentar hacer una búsqueda
        if (contextHints.length > 0) {
          let filtered = [...allProperties]
          if (contextRef.current.userPreferences.budget) {
            filtered = filtered.filter(p => (p.price || 0) <= contextRef.current.userPreferences.budget!.max)
          }
          if (contextRef.current.entities.locations.size > 0) {
            const locs = Array.from(contextRef.current.entities.locations)
            filtered = filtered.filter(p => locs.some(loc => p.location.toLowerCase().includes(loc.toLowerCase())))
          }
          if (contextRef.current.userPreferences.minBedrooms) {
            filtered = filtered.filter(p => (p.bedrooms || 0) >= contextRef.current.userPreferences.minBedrooms!)
          }
          if (contextRef.current.userPreferences.minBathrooms) {
            filtered = filtered.filter(p => (p.bathrooms || 0) >= contextRef.current.userPreferences.minBathrooms!)
          }
          
          if (filtered.length > 0 && filtered.length < allProperties.length) {
            contextRef.current.mentionedProperties = filtered.slice(0, 5).map(p => p.id)
            return `Basándome en ${contextHints.join(' y ')}, encontré **${filtered.length} propiedades** que podrían interesarte:\n\n${filtered.slice(0, 5).map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location || 'Ubicación no especificada'}\n   💰 $${(p.price || 0).toLocaleString()}/mes${p.averageRating ? `\n   ⭐ ${p.averageRating.toFixed(1)}/5` : ''}`).join('\n\n')}${filtered.length > 5 ? `\n\n...y ${filtered.length - 5} más.` : ''}\n\n¿Te interesa alguna?`
          }
        }
        
        return `Entiendo tu pregunta. ${contextHints.length > 0 ? `Veo que mencionaste ${contextHints.join(' y ')}. ` : ''}Basándome en nuestro catálogo de **${totalProperties} propiedades**, puedo ayudarte con:\n\n🔍 **Búsquedas:**\n• Por ubicación, precio, características\n• Con filtros específicos (habitaciones, baños, amenities)\n\n📋 **Información:**\n• Detalles de propiedades\n• Proceso de alquiler\n• Requisitos y documentación\n\n💡 **Recomendaciones:**\n• Según tu presupuesto y necesidades\n• Comparaciones entre opciones\n\n¿Podrías ser más específico? Por ejemplo:\n• "Busco un departamento de 2 habitaciones en South Beach por menos de $2000"\n• "¿Qué propiedades tienen piscina y aceptan mascotas?"\n• "¿Cuál es el proceso para alquilar?"`
      }
    }

    if (lowerQuestion.includes('cuántas') || lowerQuestion.includes('cuantos') || lowerQuestion.includes('total')) {
      return `Actualmente tenemos **${totalProperties} propiedades** disponibles en nuestra plataforma. Puedo ayudarte a encontrar la que mejor se adapte a tus necesidades.`
    }

    if (lowerQuestion.includes('precio') || lowerQuestion.includes('cuesta') || lowerQuestion.includes('barato') || lowerQuestion.includes('caro')) {
      if (lowerQuestion.includes('promedio') || lowerQuestion.includes('promedio')) {
        return `El precio promedio de nuestras propiedades es de **$${Math.round(avgPrice).toLocaleString()}/mes**. El rango de precios va desde **$${priceRange.min.toLocaleString()}/mes** hasta **$${priceRange.max.toLocaleString()}/mes**.`
      }
      if (lowerQuestion.includes('más barato') || lowerQuestion.includes('más económico')) {
        const cheapest = allProperties.sort((a, b) => (a.price || 0) - (b.price || 0))[0]
        return `La propiedad más económica es **"${cheapest.title || 'Sin título'}"** en ${cheapest.location || 'ubicación no especificada'} por **$${(cheapest.price || 0).toLocaleString()}/mes**.`
      }
      if (lowerQuestion.includes('más caro') || lowerQuestion.includes('más costoso')) {
        const expensive = allProperties.sort((a, b) => (b.price || 0) - (a.price || 0))[0]
        return `La propiedad más costosa es **"${expensive.title || 'Sin título'}"** en ${expensive.location || 'ubicación no especificada'} por **$${(expensive.price || 0).toLocaleString()}/mes**.`
      }
      return `Nuestras propiedades tienen precios que van desde **$${priceRange.min.toLocaleString()}/mes** hasta **$${priceRange.max.toLocaleString()}/mes**, con un promedio de **$${Math.round(avgPrice).toLocaleString()}/mes**. ¿Buscas algo en un rango de precio específico?`
    }

    if (lowerQuestion.includes('ubicación') || lowerQuestion.includes('dónde') || lowerQuestion.includes('donde') || lowerQuestion.includes('zona')) {
      const locationMatch = locations.find(loc => 
        lowerQuestion.includes(loc.toLowerCase().split(',')[0].toLowerCase()) ||
        lowerQuestion.includes(loc.toLowerCase().split(' ')[0].toLowerCase())
      )
      
      if (locationMatch) {
        const propsInLocation = allProperties.filter(p => p.location === locationMatch)
        return `En **${locationMatch}** tenemos **${propsInLocation.length} propiedades** disponibles:\n\n${propsInLocation.slice(0, 5).map((p, i) => `${i + 1}. ${p.title || 'Sin título'} - $${(p.price || 0).toLocaleString()}/mes`).join('\n')}${propsInLocation.length > 5 ? `\n\n...y ${propsInLocation.length - 5} más.` : ''}`
      }
      
      return `Tenemos propiedades en las siguientes ubicaciones:\n\n${locations.slice(0, 10).map(loc => `• ${loc}`).join('\n')}${locations.length > 10 ? `\n\n...y ${locations.length - 10} ubicaciones más.` : ''}\n\n¿Te interesa alguna ubicación en particular?`
    }

    if (lowerQuestion.includes('comparar') || lowerQuestion.includes('diferencia') || lowerQuestion.includes('mejor')) {
      if (lowerQuestion.includes('mejor') || lowerQuestion.includes('recomendar')) {
        // Encontrar propiedades con mejor relación precio/calidad
        const ratedProps = allProperties
          .filter(p => (p.averageRating || 0) > 0)
          .sort((a, b) => {
            const scoreA = (a.averageRating || 0) * 10 - (a.price || 0) / 100
            const scoreB = (b.averageRating || 0) * 10 - (b.price || 0) / 100
            return scoreB - scoreA
          })
          .slice(0, 3)
        
        if (ratedProps.length > 0) {
          return `Basándome en calificaciones y precios, te recomiendo estas propiedades:\n\n${ratedProps.map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location || 'Ubicación no especificada'}\n   💰 $${(p.price || 0).toLocaleString()}/mes\n   ⭐ ${(p.averageRating || 0).toFixed(1)}/5`).join('\n\n')}`
        }
      }
      return 'Para comparar propiedades, puedes usar la herramienta de comparación o preguntarme sobre características específicas. Por ejemplo: "¿Qué diferencia hay entre las propiedades en South Beach y las del Centro?"'
    }

    if (lowerQuestion.includes('buscar') || lowerQuestion.includes('encontrar') || lowerQuestion.includes('propiedad')) {
      // Extraer criterios de búsqueda
      const priceMatch = question.match(/\$?(\d+)/)
      const locationMatch = locations.find(loc => 
        lowerQuestion.includes(loc.toLowerCase().split(',')[0].toLowerCase())
      )
      
      let filtered = [...allProperties]

      let maxPrice: number | undefined;
      if (priceMatch) {
        const priceValue = priceMatch![1];
        if (priceValue && typeof priceValue === 'string') {
          const parsed = parseInt(priceValue, 10);
          if (!isNaN(parsed)) {
            maxPrice = parsed;
          }
        }
      }
      if (typeof maxPrice === 'number') {
        filtered = filtered.filter(p => (p.price || 0) <= maxPrice!);
      }

      if (locationMatch) {
        filtered = filtered.filter(p => p.location === locationMatch)
      }
      
      if (lowerQuestion.includes('barato') || lowerQuestion.includes('económico')) {
        filtered = filtered.sort((a, b) => (a.price || 0) - (b.price || 0)).slice(0, 5)
      }
      
      if (filtered.length === 0) {
        return 'No encontré propiedades que coincidan con tus criterios. ¿Podrías ser más específico? Por ejemplo: "Busco propiedades en South Beach por menos de $1500"'
      }
      
      return `Encontré **${filtered.length} propiedades** que coinciden:\n\n${filtered.slice(0, 5).map((p, i) => `${i + 1}. **${p.title || 'Sin título'}**\n   📍 ${p.location || 'Ubicación no especificada'}\n   💰 $${(p.price || 0).toLocaleString()}/mes`).join('\n\n')}${filtered.length > 5 ? `\n\n...y ${filtered.length - 5} más.` : ''}`
    }

    if (lowerQuestion.includes('características') || lowerQuestion.includes('amenities') || lowerQuestion.includes('incluye')) {
      return 'Nuestras propiedades incluyen diversas características como:\n\n• WiFi\n• Aire acondicionado\n• Calefacción\n• Estacionamiento\n• Balcón\n• Ascensor\n• Gimnasio\n• Piscina\n• Mascotas permitidas\n• Amueblado\n\n¿Buscas alguna característica específica?'
    }

    // Respuesta genérica inteligente
    return `Entiendo que preguntas sobre "${question}". Basándome en nuestro catálogo de ${totalProperties} propiedades, puedo ayudarte con:\n\n• Información sobre precios (promedio: $${Math.round(avgPrice).toLocaleString()}/mes)\n• Propiedades por ubicación\n• Comparaciones y recomendaciones\n• Búsquedas personalizadas\n\n¿Podrías ser más específico sobre lo que buscas? Por ejemplo: "¿Cuántas propiedades hay en South Beach?" o "¿Cuál es la propiedad más barata?"`
  }

  function localizeAssistantText(text: string): string {
    if (!i18n.language.startsWith('en')) return text

    let output = text
    const replacements: Array<[RegExp, string]> = [
      [/Por favor, asegúrate de tener Ollama instalado y ejecutándose\./g, 'Please make sure Ollama is installed and running.'],
      [/Una vez instalado, ejecuta:/g, 'Once installed, run:'],
      [/No encontré propiedades que coincidan con tus criterios/g, 'I could not find properties matching your criteria'],
      [/Encontré \*\*(\d+) propiedades\*\*/g, 'I found **$1 properties**'],
      [/Sin título/g, 'Untitled'],
      [/Ubicación no especificada/g, 'Location not specified'],
      [/ubicación no especificada/g, 'location not specified'],
      [/¿Te interesa alguna en particular\? Puedo darte más detalles\./g, 'Are you interested in any of them? I can share more details.'],
      [/¿Quieres más detalles sobre alguna de estas\?/g, 'Do you want more details about any of these?'],
      [/¿Podrías contarme más sobre lo que buscas\?/g, 'Could you tell me more about what you are looking for?'],
      [/Basándome en/g, 'Based on'],
      [/tu presupuesto de hasta/g, 'your budget up to'],
      [/y tu interés en/g, 'and your interest in'],
      [/La propiedad más económica es/g, 'The most affordable property is'],
      [/disponible ahora/g, 'available now'],
      [/disponible próximamente/g, 'available soon'],
      [/Puedes contactar al propietario para coordinar la fecha de ingreso\./g, 'You can contact the owner to coordinate the move-in date.'],
      [/amueblada/g, 'furnished'],
      [/sin amueblar/g, 'unfurnished'],
      [/acepta mascotas/g, 'allows pets'],
      [/no acepta mascotas/g, 'does not allow pets'],
      [/cocheras/g, 'parking spaces'],
      [/cochera/g, 'parking space'],
      [/estacionamiento/g, 'parking'],
      [/seguridad/g, 'security'],
      [/personas/g, 'people'],
      [/persona/g, 'person'],
      [/habitaciones/g, 'bedrooms'],
      [/habitación/g, 'bedroom'],
      [/camas/g, 'beds'],
      [/cama/g, 'bed'],
      [/¿Te interesa alguna ubicación en particular\?/g, 'Are you interested in any specific location?'],
      [/Tenemos propiedades en las siguientes ubicaciones:/g, 'We have properties in the following locations:'],
      [/No tengo suficientes propiedades que coincidan con tus preferencias para hacer una recomendación\./g, 'I do not have enough properties matching your preferences to make a recommendation.'],
      [/Para comparar, necesito que menciones al menos 2 propiedades\./g, 'To compare, I need you to mention at least 2 properties.'],
      [/Comparando \*\*(\d+) propiedades\*\*/g, 'Comparing **$1 properties**'],
      [/Análisis:/g, 'Analysis:'],
      [/Precio promedio:/g, 'Average price:'],
      [/Rango:/g, 'Range:'],
      [/Diferencia:/g, 'Difference:'],
      [/Nuestras propiedades tienen precios que van desde/g, 'Our properties range in price from'],
      [/¿Tienes un presupuesto en mente\?/g, 'Do you have a budget in mind?'],
      [/No hay reserva previa sin aprobación/g, 'There is no pre-booking without approval'],
      [/Tiempo de respuesta/g, 'Response time'],
      [/Si es rechazada/g, 'If rejected'],
      [/depósito/g, 'deposit'],
      [/solicitud/g, 'application'],
      [/propietario/g, 'owner'],
      [/propiedades/g, 'properties'],
      [/propiedad/g, 'property'],
      [/alquiler/g, 'rental'],
      [/¿Qué te gustaría saber específicamente\?/g, 'What would you like to know specifically?'],
      [/Lo siento, hubo un error al procesar tu pregunta\. Por favor, intenta reformularla o pregunta algo diferente\./g, 'Sorry, there was an error processing your question. Please try rephrasing it or ask something different.'],
      [/\*\*Puntuación total:\*\*/g, '**Total score:**'],
      [/\*\*Desglose:\*\*/g, '**Breakdown:**'],
      [/Presupuesto \/ precio/g, 'Budget / price'],
      [/Calificación/g, 'Rating'],
      [/Disponibilidad/g, 'Availability'],
      [/Características pedidas/g, 'Requested features'],
      [/Habitaciones \/ baños/g, 'Bedrooms / bathrooms'],
      [/Historial en el chat/g, 'Chat history'],
      [/• Ubicación:/g, '• Location:'],
      [/ordenadas por puntuación/g, 'sorted by score'],
      [/Cada fila incluye un \*\*desglose\*\* \(suma máxima 110\): priorizo precio dentro de tu rango, calificación, disponibilidad, ubicación alineada con lo que comentaste, coincidencia con amenities pedidas, habitaciones\/baños, y un pequeño boost si \*\*ya viste\*\* esa propiedad en el chat\./g,
        'Each listing includes a **breakdown** (max total 110): I prioritize price within your range, rating, availability, location aligned with what you mentioned, match with requested amenities, bedrooms/bathrooms, and a small boost if you **already viewed** that property in the chat.'],
      [/ℹ️ \*\*Nota:\*\* amplié un poco los criterios \(precio o habitaciones\) porque con el filtro estricto había pocas opciones\./g,
        'ℹ️ **Note:** I relaxed the criteria slightly (price or bedrooms) because the strict filter returned few options.'],
      [/ℹ️ \*\*Nota:\*\* no había coincidencias con tus filtros guardados; te muestro las mejores opciones generales del catálogo\./g,
        'ℹ️ **Note:** nothing matched your saved filters; I am showing the best general options from the catalog.'],
      [/sin exigir todas las características pedidas/g, 'not requiring all requested features'],
      [/presupuesto hasta \+12% y mínimo de habitaciones\/baños algo más flexible/g,
        'budget up to +12% and a slightly relaxed minimum for bedrooms/bathrooms'],
      [/sin filtrar por ubicación/g, 'not filtering by location'],
      [/mostrando el catálogo completo ordenado por puntuación/g, 'showing the full catalog sorted by score'],
      [/\*\*Puntuación \(mismo criterio que recomendaciones\):\*\*/g, '**Score (same criteria as recommendations):**'],
      [/📊 \*\*Orden:\*\* resultados ordenados por la misma puntuación que uso en recomendaciones \(presupuesto, calificación, disponibilidad, ubicación, amenities, habitaciones\/baños e historial del chat\)\./g,
        '📊 **Order:** results are sorted using the same score as recommendations (budget, rating, availability, location, amenities, bedrooms/bathrooms, and chat history).'],
    ]

    for (const [pattern, replacement] of replacements) {
      output = output.replace(pattern, replacement)
    }

    return output
  }

  async function handleSend() {
    if (!input.trim() || isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Simular delay de respuesta
    await new Promise(resolve => setTimeout(resolve, 500))

    try {
      // Usar el nuevo motor de IA mejorado
      const response = await processQuestion(userMessage.content)
      const localizedResponse = localizeAssistantText(response)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: localizedResponse,
        timestamp: new Date(),
        context: {
          mentionedProperties: contextRef.current.mentionedProperties.slice(-5), // Últimas 5 mencionadas
          mentionedLocations: Array.from(contextRef.current.entities.locations),
          priceRange: contextRef.current.userPreferences.budget,
          preferences: contextRef.current.userPreferences
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Generar sugerencias inteligentes después de la respuesta
      const allProperties = properties.map(item => item.property || item)
      const smartSuggestions = generateSmartSuggestions(
        contextRef.current,
        allProperties,
        userMessage.content
      )
      const followUpSuggestions = generateFollowUpSuggestions(
        contextRef.current.lastIntent || 'general',
        contextRef.current
      )
      
      // Combinar y actualizar sugerencias
      const combinedSuggestions = [
        ...followUpSuggestions,
        ...smartSuggestions.map(s => s.text)
      ].map((suggestion) => localizeAssistantText(suggestion)).slice(0, 4)
      
      setSuggestedQuestions(combinedSuggestions)
    } catch (error) {
      console.error('Error processing question:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: localizeAssistantText('Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta reformularla o pregunta algo diferente.'),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Inicializar sugerencias inteligentes
  useEffect(() => {
    const allProperties = properties.map(item => item.property || item)
    const initialSuggestions = generateSmartSuggestions(contextRef.current, allProperties)
    setSuggestedQuestions(initialSuggestions.map(s => s.text))
  }, [properties])

  if (!isOpen) return null

  return (
    <motion.div
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-rial-cream-dark/50 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera editorial RIAL (navy + acento celeste) */}
        <div className="flex items-center justify-between border-b border-rial-gold/25 bg-gradient-to-br from-rial-navy via-rial-navy to-rial-navy-light px-6 py-5 shadow-[0_4px_24px_-6px_rgba(11,22,35,0.55)]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-rial-gold/40 backdrop-blur-sm">
              <Bot className="h-7 w-7 text-rial-gold" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-rial-cream">{t('aiAssistant.title')}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-rial-cream/90">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {t('aiAssistant.readyToHelp')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-rial-cream hover:bg-white/10 hover:text-white"
            icon={<X className="h-5 w-5" />}
          >
            {t('common.close')}
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-rial-cream/50 to-white p-6 dark:from-slate-900 dark:to-slate-950">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                className={classNames(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                {message.role === 'assistant' && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rial-navy shadow-md ring-1 ring-rial-gold/40">
                    <Bot className="h-[1.15rem] w-[1.15rem] text-rial-gold" strokeWidth={2.25} aria-hidden />
                  </div>
                )}
                <div
                  className={classNames(
                    'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                    message.role === 'user'
                      ? 'rounded-br-md bg-rial-navy text-rial-cream shadow-md'
                      : 'border border-rial-cream-dark/40 bg-white text-rial-ink dark:border-slate-600 dark:bg-slate-800 dark:text-rial-cream'
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {(() => {
                      const allProperties = properties.map((item: any) => item.property || item)
                      const normalize = (s: string) => (s || '').replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim()
                      // Ordenar por longitud de título (más largo primero) para evitar coincidencias parciales
                      const propsByTitle = [...allProperties]
                        .filter((p: any) => (p.title || '').trim().length > 2)
                        .sort((a: any, b: any) => (b.title || '').length - (a.title || '').length)
                      const makeSegmentClickable = (text: string, keyPrefix: string, isBold: boolean): React.ReactNode[] => {
                        if (!onPropertyClick) return [isBold ? <strong key={keyPrefix}>{text}</strong> : <React.Fragment key={keyPrefix}>{text}</React.Fragment>]
                        if (!text) return []
                        for (const prop of propsByTitle) {
                          const title = (prop.title || 'Sin título').trim()
                          if (!title) continue
                          const idx = text.indexOf(title)
                          if (idx === -1) continue
                          const before = text.slice(0, idx)
                          const after = text.slice(idx + title.length)
                          return [
                            ...makeSegmentClickable(before, `${keyPrefix}-b`, isBold),
                            <button
                              key={`${keyPrefix}-btn`}
                              type="button"
                              onClick={() => onPropertyClick(Number(prop.id))}
                              className="cursor-pointer text-left font-semibold text-rial-navy hover:text-rial-gold hover:underline dark:text-rial-gold dark:hover:text-rial-cream"
                            >
                              {title}
                            </button>,
                            ...makeSegmentClickable(after, `${keyPrefix}-a`, isBold)
                          ]
                        }
                        return [isBold ? <strong key={keyPrefix}>{text}</strong> : <React.Fragment key={keyPrefix}>{text}</React.Fragment>]
                      }
                      const displayContent =
                        message.role === 'assistant' ? localizeAssistantText(message.content) : message.content
                      const parts = displayContent.split('**')
                      const result: React.ReactNode[] = []
                      parts.forEach((part, i) => {
                        const nodes = makeSegmentClickable(part, `${message.id}-${i}`, i % 2 === 1)
                        result.push(...nodes)
                      })
                      return result
                    })()}
                  </div>
                  <div className={classNames(
                    'text-xs mt-2',
                    message.role === 'user' ? 'text-rial-cream/90' : 'text-gray-500 dark:text-gray-400'
                  )}>
                    {message.timestamp.toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  
                  {/* Feedback para respuestas del asistente */}
                  {message.role === 'assistant' && currentKnowledgeId && message.id === messages[messages.length - 1]?.id && (
                    <AIFeedback
                      knowledgeId={currentKnowledgeId}
                      question={messages[messages.length - 2]?.content || ''}
                      answer={message.content}
                      onFeedback={async (helpful, improvedAnswer) => {
                        if (generativeAI.current && currentKnowledgeId) {
                          await generativeAI.current.learnFromFeedback(
                            currentKnowledgeId,
                            helpful,
                            improvedAnswer
                          )
                        }
                        setCurrentKnowledgeId(null)
                      }}
                      onClose={() => setCurrentKnowledgeId(null)}
                    />
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rial-cream-dark/50 bg-rial-cream-dark/40 dark:border-slate-600 dark:bg-slate-800">
                    <span className="text-xs font-semibold text-rial-navy dark:text-rial-cream">{t('aiAssistant.you')}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              className="flex gap-3 justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rial-navy shadow-md ring-1 ring-rial-gold/40">
                <Bot className="h-[1.15rem] w-[1.15rem] text-rial-gold" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="rounded-2xl border border-rial-cream-dark/40 bg-white px-5 py-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-rial-gold" style={{ animationDelay: '0ms' }} />
                  <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-rial-gold/70" style={{ animationDelay: '150ms' }} />
                  <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-rial-muted" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preguntas sugeridas - más visibles e intuitivas */}
        {suggestedQuestions.length > 0 && (
          <div className="border-t border-rial-cream-dark/40 bg-rial-cream/40 px-6 pb-2 pt-4 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-rial-navy dark:text-rial-cream">
              <Sparkles className="h-4 w-4 shrink-0 text-rial-gold" aria-hidden />
              {messages.length === 1 ? t('aiAssistant.tryAsking') : t('aiAssistant.alsoAsk')}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <motion.button
                  key={i}
                  onClick={() => {
                    setInput(q)
                    setTimeout(() => handleSend(), 100)
                  }}
                  className="rounded-xl border border-rial-cream-dark/60 bg-white px-4 py-2.5 text-sm font-medium text-rial-navy transition-all hover:border-rial-gold/60 hover:bg-rial-gold-soft/50 hover:shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-rial-cream dark:hover:border-rial-gold/40 dark:hover:bg-slate-800/90"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Input más acogedor */}
        <div className="border-t border-rial-cream-dark/40 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                value={input}
                onChange={setInput}
                onKeyPress={handleKeyPress}
                placeholder={t('aiAssistant.inputPlaceholder')}
                icon={<Sparkles className="h-4 w-4 text-rial-navy dark:text-rial-gold" aria-hidden />}
                disabled={isTyping}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="rounded-xl px-5 font-medium shadow-sm"
              icon={isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            >
              {isTyping ? t('aiAssistant.sending') : t('chat.send')}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

