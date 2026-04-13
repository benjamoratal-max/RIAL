/**
 * Motor de IA avanzado para el asistente virtual
 * Procesamiento de lenguaje natural mejorado con comprensión de contexto
 */

export interface ConversationMemory {
  userPreferences: {
    budget?: { min: number; max: number }
    preferredLocations?: string[]
    requiredFeatures?: string[]
    propertyType?: string
    minBedrooms?: number
    minBathrooms?: number
    minContractMonths?: number
    lifestyle?: string[] // trabajo remoto, familia, estudiante, etc.
  }
  mentionedProperties: number[]
  conversationHistory: Array<{
    question: string
    intent: string
    entities: any
    timestamp: Date
  }>
  lastIntent?: string
  entities: {
    properties: Map<number, any>
    locations: Set<string>
    prices: number[]
    features: Set<string>
  }
  userProfile?: {
    role?: 'tenant' | 'owner'
    experience?: 'new' | 'experienced'
  }
}

export interface ExtractedEntities {
  properties: number[]
  locations: string[]
  prices: number[]
  features: string[]
  requirements: {
    bedrooms?: number
    bathrooms?: number
    minPrice?: number
    maxPrice?: number
    contractMonths?: number
  }
  temporal?: {
    availableFrom?: string
    availableTo?: string
  }
  lifestyle?: string[]
}

export interface IntentAnalysis {
  intent: string
  confidence: number
  entities: ExtractedEntities
  context: {
    references: {
      previousProperties?: number[]
      previousLocations?: string[]
      previousBudget?: { min: number; max: number }
      previousFeatures?: string[]
    }
    conversationFlow?: string
    userNeeds?: string[]
  }
}

/**
 * Motor de extracción de entidades mejorado
 */
export function extractEntitiesAdvanced(
  text: string,
  allProperties: any[],
  memory: ConversationMemory
): ExtractedEntities {
  const lowerText = text.toLowerCase()
  const entities: ExtractedEntities = {
    properties: [],
    locations: [],
    prices: [],
    features: [],
    requirements: {},
    lifestyle: []
  }

  // Extraer números con mejor contexto
  const numberPattern = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+)/g
  const numberMatches = [...text.matchAll(numberPattern)]
  
  numberMatches.forEach(match => {
    const raw = match[0]
    const normalized = raw.replace(/[^\d.,]/g, '')
    const numeric = parseFloat(normalized.replace(/\./g, '').replace(',', '.'))
    if (isNaN(numeric)) return

    const index = match.index ?? 0
    const contextWindow = 20
    const before = lowerText.slice(Math.max(0, index - contextWindow), index)
    const after = lowerText.slice(index + raw.length, index + raw.length + contextWindow)
    const context = `${before} ${after}`

    // Detectar tipo de número según contexto
    if (/\b(habitaci[oó]n|hab|cuarto|dormitorio|bedroom|room)\b/i.test(context)) {
      entities.requirements.bedrooms = Math.max(
        entities.requirements.bedrooms ?? 0,
        Math.round(numeric)
      )
    } else if (/\b(ba[ñn]o|bathroom|toilet)\b/i.test(context)) {
      entities.requirements.bathrooms = Math.max(
        entities.requirements.bathrooms ?? 0,
        Math.round(numeric)
      )
    } else if (/\b(precio|precio|cost|budget|alquiler|rent|dep[oó]sito|deposito|garant[íi]a|garantia|usd|eur|ars|peso|d[oó]lar|dolar)\b/i.test(context)) {
      if (/\b(m[íi]n|min|m[áa]ximo|maximo|hasta|m[áa]s de|menos de)\b/i.test(before)) {
        if (/\b(m[áa]ximo|maximo|hasta|m[áa]s de)\b/i.test(before)) {
          entities.requirements.maxPrice = numeric
        } else {
          entities.requirements.minPrice = numeric
        }
      } else {
        entities.prices.push(numeric)
      }
    } else if (/\b(mes|month|a[ñn]o|year)\b/i.test(context)) {
      entities.requirements.contractMonths = Math.round(numeric)
    }
  })

  // Extraer ubicaciones con matching mejorado
  const allLocations = [...new Set(allProperties.map(p => p.location).filter(Boolean))]
  allLocations.forEach((loc: string) => {
    const locLower = loc.toLowerCase()
    const locWords = locLower.split(/[,\s]+/).filter((w: string) => w.length > 2)
    
    // Matching más flexible
    if (locWords.some((word: string) => lowerText.includes(word)) || 
        lowerText.includes(locLower) ||
        locWords.some((word: string) => {
          const regex = new RegExp(`\\b${word}\\w*`, 'i')
          return regex.test(lowerText)
        })) {
      entities.locations.push(loc)
    }
  })

  // Extraer características con sinónimos expandidos
  const featureSynonyms: { [key: string]: RegExp[] } = {
    'piscina': [/piscina/i, /pileta/i, /pool/i, /swimming/i, /nataci[oó]n/i],
    'gimnasio': [/gimnasio/i, /gym/i, /fitness/i, /ejercicio/i, /pesas/i],
    'mascotas': [/mascota/i, /pet/i, /perro/i, /gato/i, /acepta.*mascota/i, /pet.*friendly/i],
    'amueblado': [/amueblado/i, /furnished/i, /mueble/i, /con.*mueble/i],
    'estacionamiento': [/estacionamiento/i, /parking/i, /cochera/i, /garage/i, /garaje/i],
    'balcón': [/balc[oó]n/i, /balcon/i, /balcony/i, /terraza/i, /terrace/i],
    'ascensor': [/ascensor/i, /elevator/i, /elevador/i],
    'wifi': [/wifi/i, /wi-fi/i, /internet/i, /conexi[oó]n/i, /banda.*ancha/i],
    'aire acondicionado': [/aire.*acondicionado/i, /\bac\b/i, /climatizaci[oó]n/i, /aire/i],
    'calefacción': [/calefacci[oó]n/i, /heating/i, /calor/i, /caldera/i],
    'seguridad': [/seguridad/i, /security/i, /porter[íi]a/i, /vigilancia/i, /24.*hora/i, /guardia/i],
    'lavadero': [/lavadero/i, /lavander[íi]a/i, /laundry/i, /lavadora/i],
    'cocina': [/cocina/i, /kitchen/i, /cocina.*completa/i],
    'universidad': [/universidad/i, /university/i, /cerca.*universidad/i],
    'hospital': [/hospital/i, /cerca.*hospital/i, /cl[íi]nica/i],
    'centro': [/centro/i, /downtown/i, /centro.*ciudad/i],
    'transporte': [/transporte.*p[úu]blico/i, /metro/i, /subte/i, /bus/i, /estaci[oó]n/i]
  }

  Object.keys(featureSynonyms).forEach(feature => {
    if (featureSynonyms[feature].some(regex => regex.test(lowerText))) {
      entities.features.push(feature)
    }
  })

  // Detectar estilo de vida
  const lifestylePatterns = {
    'trabajo remoto': [/trabajo.*remoto/i, /home.*office/i, /teletrabajo/i, /remoto/i],
    'familia': [/familia/i, /ni[ñn]o/i, /hijo/i, /escolar/i],
    'estudiante': [/estudiante/i, /universidad/i, /universitario/i],
    'pareja': [/pareja/i, /novio/i, /novia/i, /esposo/i, /esposa/i],
    'soltero': [/soltero/i, /solo/i, /individual/i]
  }

  Object.keys(lifestylePatterns).forEach(lifestyle => {
    if (lifestylePatterns[lifestyle as keyof typeof lifestylePatterns].some(regex => regex.test(lowerText))) {
      entities.lifestyle?.push(lifestyle)
    }
  })

  // Detectar referencias a propiedades mencionadas
  const referenceWords = ['esa', 'esta', 'la que', 'la anterior', 'la mencionada', 'esa propiedad', 'esa casa']
  if (referenceWords.some(word => lowerText.includes(word)) && memory.mentionedProperties.length > 0) {
    entities.properties = [...memory.mentionedProperties]
  }

  // Detectar IDs de propiedades explícitos
  const idMatches = [...lowerText.matchAll(/\b(propiedad|property|id|#)\s*(\d+)/gi)]
  idMatches.forEach(match => {
    const id = parseInt(match[2])
    if (!isNaN(id)) {
      entities.properties.push(id)
    }
  })

  return entities
}

/**
 * Análisis de intención mejorado con scoring
 */
export function analyzeIntent(
  question: string,
  allProperties: any[],
  memory: ConversationMemory
): IntentAnalysis {
  const lowerQuestion = question.toLowerCase()
  const entities = extractEntitiesAdvanced(question, allProperties, memory)
  
  // Sistema de scoring de intenciones
  const intentScores: { [key: string]: number } = {}
  
  // Patrones de intención con pesos
  const intentPatterns: { [key: string]: { patterns: RegExp[], weight: number }[] } = {
    'search': [
      { patterns: [/buscar/i, /encontrar/i, /quiero/i, /mostr[ae]me/i, /ten[ée]s/i, /tienes/i, /hay.*algo/i, /opciones/i], weight: 1.0 },
      { patterns: [/propiedad/i, /departamento/i, /casa/i], weight: 0.5 }
    ],
    'compare': [
      { patterns: [/comparar/i, /diferencia/i, /\bvs\b/i, /versus/i, /cu[áa]l.*mejor/i, /mejor.*opci[oó]n/i], weight: 1.0 }
    ],
    'recommend': [
      { patterns: [/recomendar/i, /recomendaci[oó]n/i, /sugerir/i, /sugerencia/i, /mejor.*para/i], weight: 1.0 }
    ],
    'price': [
      { patterns: [/cu[áa]nto/i, /precio/i, /cuesta/i, /costo/i, /valor/i, /dep[oó]sito/i, /garant[íi]a/i], weight: 1.0 },
      { patterns: [/\$\d+/i, /usd/i, /eur/i, /peso/i], weight: 0.8 }
    ],
    'location': [
      { patterns: [/d[oó]nde/i, /ubicaci[oó]n/i, /zona/i, /barrio/i, /cerca.*de/i], weight: 1.0 }
    ],
    'property_details': [
      { patterns: [/caracter[íi]stica/i, /tiene/i, /incluye/i, /amenities/i, /disponible.*desde/i], weight: 1.0 },
      { patterns: [/amoblado/i, /mascota/i, /estacionamiento/i, /parking/i, /expensas/i], weight: 0.8 }
    ],
    'rental_process': [
      { patterns: [/c[oó]mo.*alquilar/i, /reservar/i, /paso.*paso/i, /proceso/i, /visita/i, /videollamada/i], weight: 1.0 }
    ],
    'requirements': [
      { patterns: [/documento/i, /requisito/i, /garante/i, /fiador/i, /estudiante/i, /extranjero/i], weight: 1.0 }
    ],
    'contract': [
      { patterns: [/contrato/i, /plazo/i, /renovar/i, /aumento/i, /irse.*antes/i, /terminar/i], weight: 1.0 }
    ],
    'payment': [
      { patterns: [/pago/i, /pagar/i, /factura/i, /recibo/i, /m[ée]todo.*pago/i], weight: 1.0 }
    ],
    'support': [
      { patterns: [/problema/i, /reclamo/i, /cancelar/i, /reportar/i, /no.*responde/i], weight: 1.0 }
    ],
    'account': [
      { patterns: [/cuenta/i, /registro/i, /sesi[oó]n/i, /contrase[ñn]a/i, /perfil/i], weight: 1.0 }
    ],
    'publish': [
      { patterns: [/publicar/i, /publicaci[oó]n/i, /anuncio/i, /fotos/i, /editar.*precio/i], weight: 1.0 }
    ],
    'owner_management': [
      { patterns: [/solicitud/i, /candidato/i, /postul[oó]/i, /aceptar/i, /rechazar/i], weight: 1.0 }
    ],
    'platform_info': [
      { patterns: [/qu[ée].*rial/i, /rial.*es/i, /inmobiliaria/i, /pa[íi]s/i, /ciudad.*disponible/i], weight: 1.0 }
    ],
    'security': [
      { patterns: [/verificar/i, /verificaci[oó]n/i, /identidad/i, /estafa/i, /seguro/i], weight: 1.0 }
    ],
    'greeting': [
      { patterns: [/hola/i, /hi/i, /buenos.*d[ií]as/i, /buenas.*tardes/i, /buenas.*noches/i], weight: 1.0 }
    ],
    'goodbye': [
      { patterns: [/adios/i, /adi[oó]s/i, /chau/i, /hasta.*luego/i, /nos.*vemos/i], weight: 1.0 }
    ],
    'help': [
      { patterns: [/ayuda/i, /help/i, /qu[ée].*pod[ée]s/i, /puedes.*hacer/i], weight: 1.0 }
    ],
    'calculate': [
      { patterns: [/si.*gano/i, /cu[áa]nto.*tengo.*pagar/i, /aumenta.*cu[áa]nto/i], weight: 1.0 }
    ]
  }

  // Calcular scores
  Object.keys(intentPatterns).forEach(intent => {
    let score = 0
    intentPatterns[intent].forEach(({ patterns, weight }) => {
      patterns.forEach(pattern => {
        if (pattern.test(lowerQuestion)) {
          score += weight
        }
      })
    })
    intentScores[intent] = score
  })

  // Determinar intención principal
  const sortedIntents = Object.entries(intentScores)
    .sort((a, b) => b[1] - a[1])
  
  const primaryIntent = sortedIntents[0]?.[0] || 'general'
  const confidence = sortedIntents[0]?.[1] || 0

  // Detectar referencias a conversación anterior
  const references = {
    previousProperties: memory.mentionedProperties,
    previousLocations: Array.from(memory.entities.locations),
    previousBudget: memory.userPreferences.budget,
    previousFeatures: Array.from(memory.entities.features)
  }

  // Detectar flujo de conversación
  const conversationFlow = detectConversationFlow(memory, primaryIntent)
  const userNeeds = inferUserNeeds(memory, entities, primaryIntent)

  return {
    intent: primaryIntent,
    confidence: Math.min(confidence / 2, 1.0), // Normalizar a 0-1
    entities,
    context: {
      references,
      conversationFlow,
      userNeeds
    }
  }
}

/**
 * Detectar flujo de conversación
 */
function detectConversationFlow(memory: ConversationMemory, currentIntent: string): string {
  if (memory.conversationHistory.length === 0) return 'initial'
  
  const lastIntent = memory.conversationHistory[memory.conversationHistory.length - 1]?.intent
  
  // Flujos comunes
  if (lastIntent === 'search' && currentIntent === 'property_details') return 'exploring'
  if (lastIntent === 'property_details' && currentIntent === 'compare') return 'comparing'
  if (lastIntent === 'compare' && currentIntent === 'recommend') return 'seeking_advice'
  if (lastIntent === 'recommend' && currentIntent === 'rental_process') return 'ready_to_rent'
  if (lastIntent === 'price' && currentIntent === 'search') return 'refining_search'
  
  return 'continuing'
}

/**
 * Inferir necesidades del usuario
 */
function inferUserNeeds(
  memory: ConversationMemory,
  entities: ExtractedEntities,
  intent: string
): string[] {
  const needs: string[] = []
  
  if (entities.lifestyle && entities.lifestyle.length > 0) {
    needs.push(`Estilo de vida: ${entities.lifestyle.join(', ')}`)
  }
  
  if (memory.userPreferences.budget) {
    needs.push(`Presupuesto: hasta $${memory.userPreferences.budget.max.toLocaleString()}`)
  }
  
  if (entities.requirements.bedrooms) {
    needs.push(`Necesita: ${entities.requirements.bedrooms}+ habitaciones`)
  }
  
  if (intent === 'search' && entities.locations.length === 0 && memory.entities.locations.size === 0) {
    needs.push('Necesita ayuda para elegir ubicación')
  }
  
  if (intent === 'rental_process' && memory.conversationHistory.length < 3) {
    needs.push('Necesita información sobre el proceso de alquiler')
  }
  
  return needs
}

/**
 * Generar respuesta natural basada en intención y contexto
 */
export function generateResponse(
  intent: string,
  entities: ExtractedEntities,
  context: IntentAnalysis['context'],
  allProperties: any[],
  memory: ConversationMemory
): string {
  // Esta función será expandida con lógica de generación de respuestas
  // Por ahora retorna un placeholder
  return ''
}
