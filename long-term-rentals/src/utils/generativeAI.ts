/**
 * Servicio de IA Generativa con Base de Conocimiento y Aprendizaje
 * Integra modelos de lenguaje generativo (OpenAI, Anthropic, etc.) con sistema de aprendizaje
 * Usa el prompt central Rial AI Broker para personalidad, reglas y playbook.
 */

import { getRialBrokerSystemPrompt, type RialBrokerContext } from './rialBrokerPrompt'

/** Modelo de Ollama por defecto: más pequeño y rápido (llama3.2:3b ~2GB). Para aún más ligero usar llama3.2:1b */
export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b'

interface GenerativeAIConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'local'
  apiKey?: string
  model?: string
  baseURL?: string
  ollamaBaseURL?: string
}

interface KnowledgeBaseEntry {
  id: string
  question: string
  answer: string
  context: string
  category: string
  usageCount: number
  helpful: number
  notHelpful: number
  createdAt: Date
  updatedAt: Date
  metadata?: any
}

interface ConversationContext {
  properties?: any[]
  conversationHistory?: Array<{
    question: string
    answer?: string
    intent?: string
    timestamp: Date | string
  }>
  userPreferences?: any
  currentStep?: number
  userRole?: 'tenant' | 'owner'
  /** Para broker en proceso de alquiler */
  totalSteps?: number
  stepName?: string
  formData?: { monthlyRent?: number; deposit?: number; duration?: string; startDate?: string; [key: string]: any }
  property?: { title?: string; price?: number; location?: string; [key: string]: any }
  brokerFlow?: boolean
}

export class GenerativeAIService {
  private client: any = null
  private knowledgeBase: Map<string, KnowledgeBaseEntry> = new Map()
  private config: GenerativeAIConfig
  private apiEndpoint: string

  constructor(config: GenerativeAIConfig) {
    this.config = config
    this.apiEndpoint = config.baseURL || '/api/ai'
    this.initializeClient()
    this.loadKnowledgeBase()
  }

  /**
   * Inicializar cliente de IA según proveedor
   */
  private initializeClient(): void {
    if (this.config.provider === 'ollama') {
      this.client = {
        type: 'ollama',
        baseURL: this.config.ollamaBaseURL || 'http://localhost:11434',
        model: this.config.model || DEFAULT_OLLAMA_MODEL
      }
    } else if (this.config.provider === 'openai' && this.config.apiKey) {
      // Usar fetch directamente para evitar dependencias pesadas
      // En producción, instalar: npm install openai
      this.client = {
        type: 'openai',
        apiKey: this.config.apiKey,
        model: this.config.model || 'gpt-4o-mini'
      }
    } else if (this.config.provider === 'anthropic' && this.config.apiKey) {
      this.client = {
        type: 'anthropic',
        apiKey: this.config.apiKey,
        model: this.config.model || 'claude-3-sonnet-3-20240229'
      }
    } else {
      this.client = { type: 'local' }
    }
  }

  /**
   * Generar respuesta usando IA generativa con contexto
   */
  async generateResponse(
    question: string,
    context: ConversationContext
  ): Promise<{ answer: string; knowledgeId?: string; confidence: number }> {
    try {
      // 1. Buscar en base de conocimiento primero
      const similarEntry = await this.findSimilarQuestion(question, context)
      if (similarEntry && similarEntry.helpful > similarEntry.notHelpful && similarEntry.usageCount > 2) {
        // Usar respuesta existente mejorada
        similarEntry.usageCount++
        this.persistKnowledgeBase()
        return {
          answer: this.enhanceExistingAnswer(similarEntry, context),
          knowledgeId: similarEntry.id,
          confidence: 0.9
        }
      }

      // 2. Construir prompt con contexto
      const systemPrompt = this.buildSystemPrompt(context)
      const userPrompt = this.buildUserPrompt(question, context)

      // 3. Llamar a la IA generativa con contexto completo
      const response = await this.callGenerativeAI(systemPrompt, userPrompt, context)

      // 4. Guardar en base de conocimiento para aprendizaje
      const knowledgeId = await this.saveToKnowledgeBase(question, response, context)

      return {
        answer: response,
        knowledgeId,
        confidence: 0.8
      }
    } catch (error) {
      console.error('Error en IA generativa:', error)
      // Fallback inteligente
      return {
        answer: this.generateFallbackResponse(question, context),
        confidence: 0.5
      }
    }
  }

  /**
   * Buscar pregunta similar en base de conocimiento
   */
  private async findSimilarQuestion(
    question: string,
    context: ConversationContext
  ): Promise<KnowledgeBaseEntry | null> {
    const questionLower = question.toLowerCase()
    let bestMatch: { entry: KnowledgeBaseEntry; score: number } | null = null

    for (const entry of this.knowledgeBase.values()) {
      // Calcular similitud
      const similarity = this.calculateSimilarity(questionLower, entry.question.toLowerCase())
      
      // Bonus si la categoría coincide con el contexto
      const contextBonus = this.getContextBonus(entry, context)
      
      const totalScore = similarity * 0.7 + contextBonus * 0.3

      if (totalScore > 0.75 && (!bestMatch || totalScore > bestMatch.score)) {
        bestMatch = { entry, score: totalScore }
      }
    }

    return bestMatch?.entry || null
  }

  /**
   * Calcular similitud entre dos preguntas
   */
  private calculateSimilarity(q1: string, q2: string): number {
    // Tokenización simple
    const words1 = new Set(q1.split(/\s+/).filter(w => w.length > 2))
    const words2 = new Set(q2.split(/\s+/).filter(w => w.length > 2))

    // Intersección
    const intersection = new Set([...words1].filter(w => words2.has(w)))
    
    // Unión
    const union = new Set([...words1, ...words2])

    // Jaccard similarity
    if (union.size === 0) return 0
    return intersection.size / union.size
  }

  /**
   * Bonus de contexto
   */
  private getContextBonus(entry: KnowledgeBaseEntry, context: ConversationContext): number {
    let bonus = 0.5 // Base

    try {
      const entryContext = JSON.parse(entry.context || '{}')
      
      // Bonus si las preferencias coinciden
      if (entryContext.userPreferences && context.userPreferences) {
        if (entryContext.userPreferences.budget?.max === context.userPreferences.budget?.max) {
          bonus += 0.2
        }
      }

      // Bonus si el paso coincide
      if (entryContext.currentStep === context.currentStep) {
        bonus += 0.2
      }

      // Bonus si el rol coincide
      if (entryContext.userRole === context.userRole) {
        bonus += 0.1
      }
    } catch (e) {
      // Ignorar errores de parsing
    }

    return Math.min(bonus, 1.0)
  }

  /**
   * Construir prompt del sistema: Rial AI Broker (personalidad, reglas, playbook) + contexto actual.
   */
  private buildSystemPrompt(context: ConversationContext): string {
    const rialContext: RialBrokerContext = {
      properties: context.properties,
      userPreferences: context.userPreferences,
      currentStep: context.currentStep,
      totalSteps: context.totalSteps,
      stepName: context.stepName,
      formData: context.formData,
      property: context.property,
      brokerFlow: context.brokerFlow
    }
    let systemPrompt = getRialBrokerSystemPrompt(rialContext)
    // Opcional: añadir mejores respuestas de la base de conocimiento para reforzar estilo
    const topAnswers = Array.from(this.knowledgeBase.values())
      .filter(e => e.helpful > e.notHelpful)
      .sort((a, b) => (b.helpful - b.notHelpful) - (a.helpful - a.notHelpful))
      .slice(0, 3)
      .map(e => `Q: ${e.question}\nA: ${e.answer}`)
      .join('\n\n')
    if (topAnswers) {
      systemPrompt += `\n\nEJEMPLOS DE RESPUESTAS ÚTILES (estilo a seguir):\n${topAnswers}`
    }
    return systemPrompt
  }

  /**
   * Índice JSON de todo el inventario de la sesión (para preguntas sobre cualquier propiedad / agregados).
   * Si el catálogo es enorme, acorta descripciones hasta caber en ~110k caracteres.
   */
  private buildCatalogCompactJson(properties: any[]): { json: string; wasTrimmed: boolean } {
    if (!properties.length) return { json: '[]', wasTrimmed: false }

    let descMax = 420
    let wasTrimmed = false

    for (let attempt = 0; attempt < 6; attempt++) {
      const rows = properties.map((p: any) => ({
        id: p.id,
        title: p.title,
        location: p.location,
        price: p.price,
        rooms: p.rooms ?? p.bedrooms,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        type: p.propertyType,
        verified: p.verified,
        lat: p.latitude,
        lng: p.longitude,
        d:
          descMax <= 0
            ? undefined
            : typeof p.description === 'string'
              ? p.description.slice(0, descMax)
              : undefined,
      }))
      const json = JSON.stringify(rows)
      if (json.length <= 110000 || descMax <= 0) {
        if (descMax < 420) wasTrimmed = true
        return { json, wasTrimmed }
      }
      descMax = Math.max(0, Math.floor(descMax / 2))
    }

    const minimal = properties.map((p: any) => ({
      id: p.id,
      title: p.title,
      location: p.location,
      price: p.price,
      rooms: p.rooms ?? p.bedrooms,
      bathrooms: p.bathrooms,
    }))
    return { json: JSON.stringify(minimal), wasTrimmed: true }
  }

  /**
   * Prioriza propiedades que encajan con la pregunta; siempre devuelve un subconjunto ampliado para el bloque DETALLE_RELEVANTE.
   */
  private pickRelevantProperties(question: string, properties: any[]): any[] {
    const q = (question || '').toLowerCase()
    const tokens = q.split(/\s+/).filter((t) => t.length >= 3)

    const pinned: any[] = []
    const idPatterns = [
      /\b(?:propiedad|prop|listing|id|#)\s*[:#]?\s*(\d{1,8})\b/i,
      /\bid\s*[=:]?\s*(\d{1,8})\b/i,
    ]
    for (const re of idPatterns) {
      const m = q.match(re)
      if (m) {
        const pid = Number(m[1])
        if (Number.isFinite(pid)) {
          const found = properties.find((p) => Number(p?.id) === pid)
          if (found) pinned.push(found)
        }
        break
      }
    }

    const scored = properties.map((p) => {
      const haystack = [p?.title, p?.description, p?.location, p?.propertyType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      let score = 0
      for (const token of tokens) {
        if (haystack.includes(token)) score += 1
      }

      const roomMatch = q.match(/(\d+)\s*(ambientes?|amb|rooms?)/)
      const bathMatch = q.match(/(\d+)\s*(banos?|baños?|bathrooms?|baths?)/)
      const maxPriceMatch = q.match(/(?:hasta|max(?:imo)?|menos de)\s*\$?\s*(\d{3,7})/)
      const minPriceMatch = q.match(/(?:desde|min(?:imo)?|mas de)\s*\$?\s*(\d{3,7})/)

      if (roomMatch && Number(roomMatch[1]) === Number(p?.rooms ?? p?.bedrooms)) score += 2
      if (bathMatch && Number(bathMatch[1]) === Number(p?.bathrooms)) score += 2

      if (maxPriceMatch && Number(p?.price || 0) <= Number(maxPriceMatch[1])) score += 1
      if (minPriceMatch && Number(p?.price || 0) >= Number(minPriceMatch[1])) score += 1

      return { p, score }
    })

    const topScored = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 55)
      .map((x) => x.p)

    const merged = [...pinned, ...topScored]
    const deduped = Array.from(new Map(merged.map((p) => [p.id, p])).values())

    if (pinned.length > 0) return deduped.slice(0, 60)
    if (deduped.length > 0 && scored.some((s) => s.score > 0)) return deduped.slice(0, 60)
    return properties.slice(0, 60)
  }

  private buildUserPrompt(question: string, context: ConversationContext): string {
    const allProperties = context.properties || []
    const relevantProperties = this.pickRelevantProperties(question, allProperties)

    const propertiesData = relevantProperties.map((p) => ({
      id: p.id,
      title: p.title,
      description:
        typeof p.description === 'string' ? p.description.slice(0, 1200) : p.description,
      location: p.location,
      price: p.price,
      bedrooms: p.bedrooms,
      rooms: p.rooms,
      bathrooms: p.bathrooms,
      area: p.area,
      propertyType: p.propertyType,
      verified: p.verified,
      latitude: p.latitude,
      longitude: p.longitude,
      available: p.isAvailable !== false,
    }))

    const prices = allProperties
      .map((p) => Number(p?.price || 0))
      .filter((n) => Number.isFinite(n) && n > 0)

    const globalStats = {
      totalProperties: allProperties.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    }

    const prefs = context.userPreferences || {}
    const preferencesSummaryParts: string[] = []

    if (prefs.budget?.max) {
      preferencesSummaryParts.push(`presupuesto hasta $${prefs.budget.max}`)
    }
    if (prefs.preferredLocations && prefs.preferredLocations.length > 0) {
      preferencesSummaryParts.push(`ubicaciones preferidas: ${prefs.preferredLocations.join(', ')}`)
    }
    if (typeof prefs.minBedrooms === 'number') {
      preferencesSummaryParts.push(`${prefs.minBedrooms}+ habitaciones`)
    }
    if (typeof prefs.minBathrooms === 'number') {
      preferencesSummaryParts.push(`${prefs.minBathrooms}+ baños`)
    }
    if (prefs.requiredFeatures && prefs.requiredFeatures.length > 0) {
      preferencesSummaryParts.push(`características requeridas: ${prefs.requiredFeatures.join(', ')}`)
    }

    let prompt = `Pregunta actual del usuario: "${question}"`

    if (preferencesSummaryParts.length > 0) {
      prompt += `\n\nResumen de preferencias conocidas del usuario:\n- ${preferencesSummaryParts.join('\n- ')}`
    }

    if (allProperties.length > 0) {
      prompt += `\n\nEstadísticas del catálogo real disponible:\n${JSON.stringify(globalStats, null, 2)}`
    }

    if (allProperties.length > 0) {
      const { json, wasTrimmed } = this.buildCatalogCompactJson(allProperties)
      prompt += `\n\nCATÁLOGO_COMPACTO (todas las propiedades de esta sesión; base factual para cualquier pregunta):\n${json}`
      if (wasTrimmed) {
        prompt +=
          '\n\n(Nota interna: las descripciones del índice fueron acortadas por tamaño; usá DETALLE_RELEVANTE para texto más largo cuando figure.)'
      }
    }

    if (propertiesData.length > 0) {
      prompt += `\n\nDETALLE_RELEVANTE (propiedades priorizadas para esta consulta; combiná con CATÁLOGO_COMPACTO):\n${JSON.stringify(propertiesData, null, 2)}`
    }

    return prompt
  }

  /**
   * Construir historial de conversación en formato de mensajes
   */
  private buildConversationHistory(context: ConversationContext): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = []

    if (context.conversationHistory && context.conversationHistory.length > 0) {
      // Últimos 6 intercambios para contexto sin alargar demasiado la respuesta
      const recentHistory = context.conversationHistory.slice(-6)

      recentHistory.forEach((entry: any) => {
        if (entry.question) {
          messages.push({ role: 'user', content: entry.question })
        }
        if (entry.answer) {
          messages.push({ role: 'assistant', content: entry.answer })
        }
      })
    }

    return messages
  }

  /**
   * Llamar a la IA generativa
   */
  private async callGenerativeAI(systemPrompt: string, userPrompt: string, context?: ConversationContext): Promise<string> {
    // Si es Ollama, puede funcionar sin API key a través del backend
    const canUseBackend = this.config.provider !== 'local' && 
      (this.config.provider === 'ollama' || this.config.apiKey)
    
    if (canUseBackend && this.apiEndpoint) {
      try {
        // Construir historial de conversación
        const conversationHistory = context ? this.buildConversationHistory(context) : []
        
        const response = await fetch(`${this.apiEndpoint}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            systemPrompt,
            userPrompt,
            provider: this.config.provider,
            model: this.config.model,
            conversationHistory
          })
        })

        if (response.ok) {
          const data = await response.json()
          return data.answer || data.response || ''
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || 'Error en la respuesta del servidor')
        }
      } catch (error: any) {
        console.warn('Error llamando a API de IA:', error.message)
        
        // Si es Ollama y falla, intentar directamente
        if (this.config.provider === 'ollama') {
          return this.callOllamaDirectly(systemPrompt, userPrompt, context)
        }
        
        // Para otros proveedores, usar fallback local
        return this.generateLocalResponse(systemPrompt, userPrompt)
        
        throw error
      }
    }

    // Si es Ollama y no hay backend, intentar directamente
    if (this.config.provider === 'ollama') {
      return this.callOllamaDirectly(systemPrompt, userPrompt, context)
    }

    // Fallback local inteligente
    return this.generateLocalResponse(systemPrompt, userPrompt)
  }

  /**
   * Llamar a Ollama directamente (sin backend).
   * En el navegador usamos /ollama (proxy de Vite) para evitar CORS.
   */
  private async callOllamaDirectly(systemPrompt: string, userPrompt: string, context?: ConversationContext): Promise<string> {
    let ollamaURL = this.config.ollamaBaseURL || 'http://localhost:11434'
    // En el navegador, si la URL es localhost, usar el proxy de Vite para evitar CORS
    if (typeof window !== 'undefined' && (ollamaURL.startsWith('http://localhost') || ollamaURL.startsWith('http://127.0.0.1'))) {
      ollamaURL = '/ollama'
    }
    const model = this.config.model || DEFAULT_OLLAMA_MODEL
    
    const messages: Array<{ role: string; content: string }> = []
    
    // Agregar prompt del sistema
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    
    // Agregar historial de conversación
    if (context) {
      const history = this.buildConversationHistory(context)
      messages.push(...history)
    }
    
    // Agregar mensaje actual
    messages.push({ role: 'user', content: userPrompt })
    
    try {
      const response = await fetch(`${ollamaURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: false,
          options: {
            temperature: 0.4,
            num_predict: 600
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama error: ${errorText}`)
      }

      const data = await response.json()
      return data.message?.content || ''
    } catch (error: any) {
      console.error('Error llamando a Ollama directamente:', error)
      throw new Error(`Ollama no está disponible. Asegúrate de que Ollama esté ejecutándose en ${ollamaURL}. Instala Ollama desde https://ollama.ai`)
    }
  }

  /**
   * Generar respuesta local (fallback)
   */
  private generateLocalResponse(systemPrompt: string, userPrompt: string): string {
    const question = userPrompt.match(/Pregunta actual del usuario: "([^"]+)"/)?.[1] || ''
    const lowerQuestion = question.toLowerCase()

    // Respuestas inteligentes basadas en palabras clave
    if (lowerQuestion.includes('hola') || lowerQuestion.includes('hi')) {
      return `¡Hola! 👋 Estoy aquí para ayudarte con todo lo relacionado con RIAL App. Puedo ayudarte a buscar propiedades, explicar el proceso de alquiler, responder preguntas sobre contratos y mucho más. ¿En qué puedo ayudarte específicamente?`
    }

    if (lowerQuestion.includes('gracias') || lowerQuestion.includes('thanks')) {
      return `¡De nada! 😊 Me alegra haber podido ayudarte. Si tienes más preguntas, no dudes en preguntar. Estoy aquí para ayudarte en todo momento.`
    }

    if (lowerQuestion.includes('no entiendo') || lowerQuestion.includes('confuso')) {
      return `Entiendo que puede ser confuso. Déjame explicarte de otra manera. ¿Podrías decirme específicamente qué parte no entiendes? Así puedo ayudarte mejor con una explicación más clara y detallada.`
    }

    // Respuesta genérica útil, sin mencionar fallos técnicos
    return `Puedo ayudarte con búsqueda de propiedades (ubicación, precio, habitaciones), proceso de alquiler paso a paso, documentos necesarios y dudas sobre contratos. Decime qué necesitás (por ejemplo: zona, presupuesto o tipo de propiedad). 😊`
  }

  /**
   * Guardar en base de conocimiento para aprendizaje
   */
  private async saveToKnowledgeBase(
    question: string,
    answer: string,
    context: ConversationContext
  ): Promise<string> {
    const entry: KnowledgeBaseEntry = {
      id: `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question,
      answer,
      context: JSON.stringify(context),
      category: this.categorizeQuestion(question),
      usageCount: 1,
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        propertiesCount: context.properties?.length || 0,
        hasPreferences: !!context.userPreferences,
        step: context.currentStep
      }
    }

    this.knowledgeBase.set(entry.id, entry)
    this.persistKnowledgeBase()

    // También guardar en backend si está disponible
    try {
      await fetch(`${this.apiEndpoint}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer,
          category: entry.category,
          metadata: entry.metadata
        })
      })
    } catch (error) {
      // Ignorar errores de backend, solo usar localStorage
      console.warn('No se pudo guardar en backend:', error)
    }

    return entry.id
  }

  /**
   * Mejorar respuesta existente con contexto actual
   */
  private enhanceExistingAnswer(
    entry: KnowledgeBaseEntry,
    context: ConversationContext
  ): string {
    let enhanced = entry.answer

    // Agregar contexto específico si hay propiedades
    if (context.properties && context.properties.length > 0) {
      const relevantProps = context.properties.slice(0, 2)
      if (relevantProps.length > 0) {
        enhanced += `\n\n💡 **Basándome en las propiedades disponibles actualmente**, puedo ayudarte con información específica sobre ellas. ¿Te interesa alguna en particular?`
      }
    }

    // Agregar sugerencia proactiva
    if (!enhanced.includes('¿') && !enhanced.includes('?')) {
      enhanced += `\n\n¿Hay algo más en lo que pueda ayudarte?`
    }

    return enhanced
  }

  /**
   * Categorizar pregunta
   */
  private categorizeQuestion(question: string): string {
    const lower = question.toLowerCase()
    
    if (lower.includes('precio') || lower.includes('cuesta') || lower.includes('costo')) return 'pricing'
    if (lower.includes('documento') || lower.includes('requisito') || lower.includes('papel')) return 'requirements'
    if (lower.includes('contrato') || lower.includes('término') || lower.includes('cláusula')) return 'contract'
    if (lower.includes('proceso') || lower.includes('cómo') || lower.includes('paso')) return 'process'
    if (lower.includes('buscar') || lower.includes('encontrar') || lower.includes('propiedad')) return 'search'
    if (lower.includes('pago') || lower.includes('pagar') || lower.includes('depósito')) return 'payment'
    if (lower.includes('ubicación') || lower.includes('dónde') || lower.includes('zona')) return 'location'
    
    return 'general'
  }

  /**
   * Aprender de feedback del usuario
   */
  async learnFromFeedback(
    knowledgeId: string,
    helpful: boolean,
    improvedAnswer?: string
  ): Promise<void> {
    const entry = this.knowledgeBase.get(knowledgeId)
    if (entry) {
      if (helpful) {
        entry.helpful++
      } else {
        entry.notHelpful++
        if (improvedAnswer) {
          entry.answer = improvedAnswer
          entry.updatedAt = new Date()
        }
      }
      this.persistKnowledgeBase()

      // Enviar feedback al backend
      try {
        await fetch(`${this.apiEndpoint}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            knowledgeId,
            helpful,
            improvedAnswer
          })
        })
      } catch (error) {
        console.warn('No se pudo enviar feedback al backend:', error)
      }

      // Si el feedback es negativo y hay respuesta mejorada, intentar auto-optimizar
      if (!helpful && improvedAnswer && entry.question) {
        try {
          const { SelfModificationSystem } = await import('./selfModification')
          const selfMod = new SelfModificationSystem(this.apiEndpoint)
          
          // Intentar optimizar el prompt del sistema si es posible
          const currentPrompt = this.getSystemPrompt()
          if (currentPrompt) {
            await selfMod.optimizePrompt(currentPrompt, {
              helpful: false,
              question: entry.question,
              answer: entry.answer,
              improvedAnswer
            })
          }
        } catch (error) {
          console.warn('No se pudo auto-optimizar prompt:', error)
        }
      }
    }
  }

  /**
   * Obtener prompt del sistema actual (para auto-modificación)
   */
  private getSystemPrompt(): string | null {
    // Intentar obtener desde localStorage o usar default
    try {
      const stored = localStorage.getItem('rial_system_prompt')
      if (stored) {
        return stored
      }
    } catch (error) {
      console.warn('Error obteniendo prompt del sistema:', error)
    }
    return null
  }

  /**
   * Generar respuesta de fallback inteligente (saludos y respuestas naturales, sin mencionar fallos técnicos)
   */
  private generateFallbackResponse(question: string, context: ConversationContext): string {
    const lowerQuestion = question.toLowerCase().trim()

    // Saludos: respuesta natural y amigable
    if (/^(hola|hi|hey|buenos?\s*d[ií]as|buenas?\s*tardes|buenas?\s*noches|qu[eé]\s*tal|como\s*estas?|qu[eé]\s*hay)\s*[!.]?$/i.test(lowerQuestion) || lowerQuestion === 'hola' || lowerQuestion === 'hi') {
      return `¡Hola! 👋 Soy el asistente de RIAL App. Puedo ayudarte a buscar propiedades, comparar opciones, ver precios y resolver dudas sobre alquileres. ¿En qué necesitas ayuda?`
    }

    // Despedidas
    if (/^(chau|adios|adi[oó]s|hasta\s*luego|nos\s*vemos|gracias\s*(por\s*todo)?)\s*[!.]?$/i.test(lowerQuestion)) {
      return `¡Hasta luego! 😊 Si más adelante tenés dudas sobre alquileres o propiedades, acá estoy.`
    }

    // Agradecimiento
    if (lowerQuestion.includes('gracias') || lowerQuestion.includes('thanks')) {
      return `De nada. Si necesitás algo más sobre propiedades o alquileres, preguntame.`
    }

    // Ayuda genérica
    if (/^(ayuda|help|qu[eé]\s*pod[eé]s\s*hacer|puedes\s*hacer)\s*[?]?$/i.test(lowerQuestion)) {
      return `Puedo ayudarte a buscar propiedades, comparar opciones, explicar el proceso de alquiler, documentos necesarios y dudas sobre contratos. Decime qué necesitás (por ejemplo: "buscar apartamento en Brickell" o "qué documentos pido").`
    }

    // Para el resto: respuesta útil sin hablar de "IA generativa" ni pedir reformular
    const parts: string[] = ['Puedo ayudarte con:']
    if (context.properties && context.properties.length > 0) {
      parts.push('• Buscar propiedades según tus criterios')
    }
    if (context.userPreferences) {
      parts.push('• Recomendaciones según tus preferencias')
    }
    parts.push('• Proceso de alquiler paso a paso')
    parts.push('• Documentos y requisitos')
    parts.push('• Contratos y plazos')
    parts.push('')
    parts.push('Escribí por ejemplo: "Buscar departamentos en [zona]", "¿Qué documentos necesito?" o "Explícame el proceso".')
    return parts.join('\n')
  }

  /**
   * Persistir base de conocimiento en localStorage
   */
  private persistKnowledgeBase(): void {
    try {
      const data = Array.from(this.knowledgeBase.values())
      localStorage.setItem('rial_knowledge_base', JSON.stringify(data))
    } catch (error) {
      console.warn('Error guardando en localStorage:', error)
    }
  }

  /**
   * Cargar base de conocimiento desde localStorage
   */
  async loadKnowledgeBase(): Promise<void> {
    try {
      const stored = localStorage.getItem('rial_knowledge_base')
      if (stored) {
        const data = JSON.parse(stored) as KnowledgeBaseEntry[]
        data.forEach(entry => {
          // Convertir fechas de string a Date
          entry.createdAt = new Date(entry.createdAt)
          entry.updatedAt = new Date(entry.updatedAt)
          this.knowledgeBase.set(entry.id, entry)
        })
      }

      // También cargar desde backend
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const response = await fetch(`${this.apiEndpoint}/knowledge-base`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (response.ok) {
          const backendData = await response.json()
          backendData.forEach((entry: any) => {
            if (!this.knowledgeBase.has(entry.id)) {
              this.knowledgeBase.set(entry.id, {
                ...entry,
                createdAt: new Date(entry.createdAt),
                updatedAt: new Date(entry.updatedAt)
              })
            }
          })
          this.persistKnowledgeBase()
        }
      } catch (error) {
        // Ignorar si el backend no está disponible
      }
    } catch (error) {
      console.warn('Error cargando base de conocimiento:', error)
    }
  }

  /**
   * Obtener estadísticas de la base de conocimiento
   */
  getKnowledgeBaseStats(): {
    total: number
    helpful: number
    categories: { [key: string]: number }
  } {
    const entries = Array.from(this.knowledgeBase.values())
    const categories: { [key: string]: number } = {}

    entries.forEach(entry => {
      categories[entry.category] = (categories[entry.category] || 0) + 1
    })

    return {
      total: entries.length,
      helpful: entries.filter(e => e.helpful > e.notHelpful).length,
      categories
    }
  }
}
