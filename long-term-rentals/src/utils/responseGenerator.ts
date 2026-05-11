/**
 * Generador de respuestas inteligentes y naturales
 * Crea respuestas contextuales basadas en intención, entidades y memoria
 */

import type { IntentAnalysis, ConversationMemory, ExtractedEntities } from './aiEngine'

export interface ResponseContext {
  allProperties: any[]
  memory: ConversationMemory
  intent: IntentAnalysis
}

/**
 * Generar respuesta principal basada en intención
 */
export function generateIntentResponse(context: ResponseContext): string {
  const { intent, allProperties, memory } = context
  const { entities, context: intentContext } = intent
  
  switch (intent.intent) {
    case 'greeting':
      return generateGreeting(memory)
    
    case 'search':
      return generateSearchResponse(entities, allProperties, memory, intentContext)
    
    case 'compare':
      return generateCompareResponse(entities, allProperties, memory)
    
    case 'recommend':
      return generateRecommendResponse(entities, allProperties, memory, intentContext)
    
    case 'price':
      return generatePriceResponse(entities, allProperties, memory)
    
    case 'location':
      return generateLocationResponse(entities, allProperties, memory)
    
    case 'property_details':
      return generatePropertyDetailsResponse(entities, allProperties, memory)
    
    case 'rental_process':
      return generateRentalProcessResponse(memory)
    
    case 'requirements':
      return generateRequirementsResponse(entities, memory)
    
    case 'contract':
      return generateContractResponse(memory)
    
    case 'payment':
      return generatePaymentResponse(memory)
    
    case 'support':
      return generateSupportResponse()
    
    case 'account':
      return generateAccountResponse(intent.entities)
    
    case 'publish':
      return generatePublishResponse()
    
    case 'owner_management':
      return generateOwnerManagementResponse()
    
    case 'platform_info':
      return generatePlatformInfoResponse()
    
    case 'security':
      return generateSecurityResponse()
    
    case 'help':
      return generateHelpResponse(memory)
    
    case 'calculate':
      return generateCalculateResponse(entities, allProperties, memory)
    
    case 'goodbye':
      return generateGoodbyeResponse(memory)
    
    default:
      return generateFallbackResponse(intent, memory)
  }
}

/**
 * Generar saludo personalizado
 */
function generateGreeting(memory: ConversationMemory): string {
  const isReturning = memory.conversationHistory.length > 0
  
  if (isReturning) {
    const lastIntent = memory.conversationHistory[memory.conversationHistory.length - 1]?.intent
    if (lastIntent === 'search') {
      return `¡Hola de nuevo! 👋 Veo que estabas buscando propiedades. ¿Encontraste algo que te interese o quieres que te ayude a refinar tu búsqueda?`
    }
    if (lastIntent === 'property_details') {
      return `¡Hola! 👋 ¿Tienes más preguntas sobre las propiedades que vimos? Estoy aquí para ayudarte.`
    }
    return `¡Hola de nuevo! 👋 ¿En qué más puedo ayudarte hoy?`
  }
  
  return `¡Hola! 👋 Soy tu asistente virtual de RIAL App con inteligencia avanzada. 

Puedo ayudarte con:
• 🔍 **Búsqueda inteligente** de propiedades según tus necesidades
• 💰 **Análisis de precios** y comparaciones
• 📍 **Recomendaciones personalizadas** basadas en tu perfil
• 📋 **Información sobre el proceso** de alquiler
• ❓ **Cualquier pregunta** sobre propiedades, contratos, pagos, etc.

Puedo entender contexto y recordar nuestra conversación. ¿En qué puedo ayudarte?`
}

/**
 * Generar respuesta de búsqueda inteligente
 */
function generateSearchResponse(
  entities: ExtractedEntities,
  allProperties: any[],
  memory: ConversationMemory,
  context: IntentAnalysis['context']
): string {
  const locationTargets = collectRecommendationLocationTargets(entities, memory, context)
  const filterLocations =
    locationTargets.length > 0
      ? locationTargets
      : entities.locations.length > 0
        ? entities.locations
        : context.references.previousLocations || []

  const maxPrice =
    entities.requirements.maxPrice ??
    (entities.prices.length > 0 ? Math.max(...entities.prices) : undefined) ??
    context.references.previousBudget?.max ??
    memory.userPreferences.budget?.max

  const minPrice = entities.requirements.minPrice

  const minBedrooms =
    Math.max(memory.userPreferences.minBedrooms ?? 0, entities.requirements.bedrooms ?? 0) || undefined
  const minBathrooms =
    Math.max(memory.userPreferences.minBathrooms ?? 0, entities.requirements.bathrooms ?? 0) || undefined

  function applySearchFilters(
    includeFeatures: boolean,
    priceMultiplier: number,
    bedroomSlack: number,
    bathroomSlack: number,
    useLocationFilter: boolean
  ): any[] {
    let list = [...allProperties]

    if (useLocationFilter && filterLocations.length > 0) {
      list = list.filter((p) => locationMatchesAny(p.location, filterLocations))
    }

    const cap = maxPrice != null ? maxPrice * priceMultiplier : undefined
    if (cap != null && cap > 0) {
      list = list.filter((p) => (p.price || 0) <= cap)
    }
    if (minPrice) {
      list = list.filter((p) => (p.price || 0) >= minPrice)
    }

    if (includeFeatures && entities.features.length > 0) {
      list = list.filter((p) => {
        const allAmenities = propertyAmenitiesLower(p)
        return entities.features.every((feature) => {
          const featureLower = feature.toLowerCase()
          return allAmenities.some(
            (amenity: string) => amenity.includes(featureLower) || featureLower.includes(amenity)
          )
        })
      })
    }

    const effMinBed =
      minBedrooms != null ? Math.max(1, minBedrooms - bedroomSlack) : undefined
    const effMinBath =
      minBathrooms != null ? Math.max(1, minBathrooms - bathroomSlack) : undefined

    if (effMinBed) {
      list = list.filter((p) => (p.bedrooms || 0) >= effMinBed)
    }
    if (effMinBath) {
      list = list.filter((p) => (p.bathrooms || 0) >= effMinBath)
    }
    return list
  }

  const noteParts: string[] = []
  let filtered = applySearchFilters(true, 1, 0, 0, true)

  if (filtered.length === 0 && entities.features.length > 0) {
    filtered = applySearchFilters(false, 1, 0, 0, true)
    if (filtered.length > 0) {
      noteParts.push('sin exigir todas las características pedidas')
    }
  }

  if (filtered.length === 0) {
    filtered = applySearchFilters(false, 1.12, 1, 1, true)
    if (filtered.length > 0) {
      noteParts.push('presupuesto hasta +12% y mínimo de habitaciones/baños algo más flexible')
      if (entities.features.length > 0) {
        noteParts.push('sin exigir todas las características pedidas')
      }
    }
  }

  if (filtered.length === 0) {
    filtered = applySearchFilters(false, 1.12, 1, 1, false)
    if (filtered.length > 0) {
      noteParts.push('sin filtrar por ubicación')
    }
  }

  if (filtered.length === 0) {
    filtered = [...allProperties]
    if (allProperties.length > 0) {
      noteParts.push('mostrando el catálogo completo ordenado por puntuación')
    }
  }

  const relaxedNote =
    noteParts.length > 0 ? `\n\nℹ️ **Nota:** ${noteParts.join('; ')}.` : ''

  const featureTargets = collectRecommendationFeatureTargets(entities, memory)

  const scored = filtered
    .map((p) => {
      const { total, breakdown } = scorePropertyForRecommendation(
        p,
        memory,
        entities,
        locationTargets.length > 0 ? locationTargets : filterLocations,
        featureTargets,
        minBedrooms,
        minBathrooms,
        maxPrice
      )
      return { ...p, searchScore: total, scoreBreakdown: breakdown }
    })
    .sort((a, b) => b.searchScore - a.searchScore)

  if (scored.length === 0) {
    const suggestions: string[] = []
    if (maxPrice) suggestions.push(`aumentar tu presupuesto`)
    if (filterLocations.length > 0) suggestions.push(`explorar otras ubicaciones`)
    if (entities.features.length > 0) suggestions.push(`ser más flexible con las características`)

    return `No encontré propiedades que coincidan exactamente con tus criterios${filterLocations.length > 0 ? ` en ${filterLocations.join(', ')}` : ''}${maxPrice ? ` por menos de $${maxPrice.toLocaleString()}/mes` : ''}.

💡 **Sugerencias:**
${suggestions.length > 0 ? suggestions.map((s) => `• Considera ${s}`).join('\n') : '• Prueba con criterios más amplios'}
• Puedo ayudarte a encontrar alternativas similares

¿Quieres que ajuste los filtros o busque opciones similares?`
  }

  memory.mentionedProperties = scored.slice(0, 5).map((p) => p.id)

  const filtersSummary: string[] = []
  if (filterLocations.length > 0) filtersSummary.push(`📍 ${filterLocations.join(', ')}`)
  if (maxPrice) filtersSummary.push(`💰 Hasta $${maxPrice.toLocaleString()}/mes`)
  if (minBedrooms) filtersSummary.push(`🛏️ ${minBedrooms}+ habitaciones`)
  if (entities.features.length > 0) filtersSummary.push(`✨ ${entities.features.join(', ')}`)

  const propertiesList = scored.slice(0, 5).map((p, i) => {
    const featLine: string[] = []
    if (p.bedrooms) featLine.push(`${p.bedrooms} hab`)
    if (p.bathrooms) featLine.push(`${p.bathrooms} baños`)
    if (p.area) featLine.push(`${p.area}m²`)
    const breakdownLines = p.scoreBreakdown.map(
      (b: ScoreBreakdown) => `     • ${b.label}: ${b.points}/${b.max}`
    )
    return `${i + 1}. **${p.title || 'Sin título'}**
   📍 ${p.location || 'Ubicación no especificada'}
   💰 $${(p.price || 0).toLocaleString()}/mes${featLine.length > 0 ? ` | ${featLine.join(' | ')}` : ''}${p.averageRating ? ` | ⭐ ${p.averageRating.toFixed(1)}/5` : ''}${p.isAvailable === false ? ' | ❌ Ocupada' : ' | ✅ Disponible'}
   🎯 **Puntuación (mismo criterio que recomendaciones):** ${p.searchScore}/110
   📊 **Desglose:**
${breakdownLines.join('\n')}`
  }).join('\n\n')

  return `Encontré **${scored.length} propiedades**${filtersSummary.length > 0 ? ` que cumplen con:\n${filtersSummary.map((f) => `   ${f}`).join('\n')}\n\n` : ':\n\n'}${propertiesList}${scored.length > 5 ? `\n\n...y **${scored.length - 5} más** disponibles.` : ''}${relaxedNote}

📊 **Orden:** resultados ordenados por la misma puntuación que uso en recomendaciones (presupuesto, calificación, disponibilidad, ubicación, amenities, habitaciones/baños e historial del chat).

💡 **Próximos pasos:**
• Puedo darte más detalles sobre cualquiera de estas propiedades
• Puedo comparar propiedades para ayudarte a decidir
• Puedo ajustar los filtros si quieres ver otras opciones

¿Te interesa alguna en particular?`
}

/**
 * Generar respuesta de comparación
 */
function generateCompareResponse(
  entities: ExtractedEntities,
  allProperties: any[],
  memory: ConversationMemory
): string {
  const propsToCompare = entities.properties.length > 0
    ? allProperties.filter(p => entities.properties.includes(p.id))
    : memory.mentionedProperties.length > 0
      ? allProperties.filter(p => memory.mentionedProperties.includes(p.id))
      : []
  
  if (propsToCompare.length < 2) {
    return `Para comparar propiedades, necesito que menciones al menos 2. Puedes:
• Decirme "compara las propiedades en [ubicación]"
• Mencionar IDs específicos: "compara propiedad #123 y #456"
• O simplemente decir "compara las que mencionaste"

¿Qué propiedades te gustaría comparar?`
  }
  
  const comparison = propsToCompare.slice(0, 4).map(p => ({
    id: p.id,
    title: p.title || 'Sin título',
    price: p.price || 0,
    location: p.location || 'No especificada',
    bedrooms: p.bedrooms || 0,
    bathrooms: p.bathrooms || 0,
    area: p.area || 0,
    rating: p.averageRating || 0,
    available: p.isAvailable !== false
  }))
  
  const avgPrice = comparison.reduce((sum, p) => sum + p.price, 0) / comparison.length
  const priceRange = {
    min: Math.min(...comparison.map(p => p.price)),
    max: Math.max(...comparison.map(p => p.price))
  }
  const priceDiff = priceRange.max - priceRange.min
  
  const avgRating = comparison.reduce((sum, p) => sum + p.rating, 0) / comparison.length
  
  // Análisis detallado
  const analysis: string[] = []
  
  if (priceDiff > 0) {
    const cheapest = comparison.find(p => p.price === priceRange.min)
    const mostExpensive = comparison.find(p => p.price === priceRange.max)
    analysis.push(`💰 **Precio:** La diferencia es de $${priceDiff.toLocaleString()}/mes`)
    analysis.push(`   • Más económica: ${cheapest?.title} ($${priceRange.min.toLocaleString()}/mes)`)
    analysis.push(`   • Más costosa: ${mostExpensive?.title} ($${priceRange.max.toLocaleString()}/mes)`)
  } else {
    analysis.push(`💰 **Precio:** Todas tienen el mismo precio ($${priceRange.min.toLocaleString()}/mes)`)
  }
  
  if (avgRating > 0) {
    const bestRated = comparison.sort((a, b) => b.rating - a.rating)[0]
    analysis.push(`\n⭐ **Calificación:** Promedio ${avgRating.toFixed(1)}/5`)
    analysis.push(`   • Mejor calificada: ${bestRated.title} (${bestRated.rating.toFixed(1)}/5)`)
  }
  
  const availableCount = comparison.filter(p => p.available).length
  if (availableCount < comparison.length) {
    analysis.push(`\n✅ **Disponibilidad:** ${availableCount} de ${comparison.length} están disponibles`)
  }
  
  const comparisonTable = comparison.map((p, i) => 
    `${i + 1}. **${p.title}**
   💰 $${p.price.toLocaleString()}/mes | 🛏️ ${p.bedrooms}hab/${p.bathrooms}baños | ${p.area}m² | ⭐ ${p.rating.toFixed(1)}/5 | ${p.available ? '✅' : '❌'}`
  ).join('\n\n')
  
  return `Comparando **${comparison.length} propiedades**:\n\n${comparisonTable}\n\n**📊 Análisis:**\n${analysis.join('\n')}\n\n💡 **Recomendación:** ${generateComparisonRecommendation(comparison)}\n\n¿Quieres que profundice en alguna comparación específica o que analice otros aspectos?`
}

/**
 * Generar recomendación de comparación
 */
function generateComparisonRecommendation(comparison: any[]): string {
  // Encontrar mejor relación precio-calidad
  const scored = comparison.map(p => {
    const priceScore = 100 - (p.price / Math.max(...comparison.map(c => c.price)) * 100)
    const ratingScore = p.rating * 20
    const valueScore = (priceScore + ratingScore) / 2
    return { ...p, valueScore }
  })
  
  const bestValue = scored.sort((a, b) => b.valueScore - a.valueScore)[0]
  
  if (bestValue.available) {
    return `Te recomiendo **${bestValue.title}** por su excelente relación precio-calidad. Tiene buena calificación (${bestValue.rating.toFixed(1)}/5) y está disponible.`
  } else {
    const available = scored.filter(p => p.available)
    if (available.length > 0) {
      const bestAvailable = available.sort((a, b) => b.valueScore - a.valueScore)[0]
      return `Te recomiendo **${bestAvailable.title}** - es la mejor opción disponible actualmente.`
    }
    return `Lamentablemente ninguna está disponible ahora, pero **${bestValue.title}** es la mejor opción cuando esté disponible.`
  }
}

function collectRecommendationLocationTargets(
  entities: ExtractedEntities,
  memory: ConversationMemory,
  context: IntentAnalysis['context']
): string[] {
  const set = new Set<string>()
  entities.locations.forEach((l) => set.add(l))
  memory.userPreferences.preferredLocations?.forEach((l) => set.add(l))
  memory.entities.locations.forEach((l) => set.add(l))
  context.references.previousLocations?.forEach((l) => set.add(l))
  return [...set].filter(Boolean)
}

function collectRecommendationFeatureTargets(entities: ExtractedEntities, memory: ConversationMemory): string[] {
  const set = new Set<string>()
  entities.features.forEach((f) => set.add(f))
  memory.userPreferences.requiredFeatures?.forEach((f) => set.add(f))
  memory.entities.features.forEach((f) => set.add(f))
  return [...set].map((f) => f.toLowerCase())
}

function propertyAmenitiesLower(p: any): string[] {
  return [
    ...(p.amenities || []),
    ...(p.buildingAmenities || []),
    ...(p.safety || []),
    ...(p.highlights || []),
  ].map((a: string) => String(a).toLowerCase())
}

function locationMatchesAny(propertyLocation: string | null | undefined, targets: string[]): boolean {
  if (!propertyLocation || targets.length === 0) return false
  const pl = propertyLocation.toLowerCase()
  return targets.some((t) => {
    const tl = t.toLowerCase()
    return pl.includes(tl) || tl.includes(pl)
  })
}

type ScoreBreakdown = { label: string; points: number; max: number }

function scorePropertyForRecommendation(
  p: any,
  memory: ConversationMemory,
  entities: ExtractedEntities,
  locationTargets: string[],
  featureTargets: string[],
  minBedrooms: number | undefined,
  minBathrooms: number | undefined,
  budgetMax: number | undefined
): { total: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = []
  const mentioned = new Set(memory.mentionedProperties.map(Number))
  const pid = Number(p.id)

  // 1) Ajuste al presupuesto (0–25)
  let budgetPts = 0
  const maxBudget = budgetMax
  const price = p.price || 0
  if (maxBudget && maxBudget > 0) {
    if (price <= 0) {
      budgetPts = 8
    } else if (price <= maxBudget) {
      const ratio = price / maxBudget
      budgetPts = Math.round(25 * (1 - Math.min(ratio, 1) * 0.85))
      if (price <= maxBudget * 0.85) budgetPts = Math.min(25, budgetPts + 3)
    } else {
      budgetPts = 0
    }
  } else {
    budgetPts = 12
  }
  breakdown.push({ label: 'Presupuesto / precio', points: budgetPts, max: 25 })

  // 2) Calificación (0–20)
  const rating = Math.min(Math.max(p.averageRating || 0, 0), 5)
  const ratingPts = Math.round((rating / 5) * 20)
  breakdown.push({ label: 'Calificación', points: ratingPts, max: 20 })

  // 3) Disponibilidad (0–15)
  const availPts = p.isAvailable !== false ? 15 : 0
  breakdown.push({ label: 'Disponibilidad', points: availPts, max: 15 })

  // 4) Ubicación alineada con tu búsqueda (0–20)
  let locPts = 0
  if (locationTargets.length > 0) {
    if (locationMatchesAny(p.location, locationTargets)) locPts = 20
    else locPts = 4
  } else {
    locPts = 10
  }
  breakdown.push({ label: 'Ubicación', points: locPts, max: 20 })

  // 5) Amenities / features pedidas (0–15)
  let featPts = 0
  if (featureTargets.length > 0) {
    const am = propertyAmenitiesLower(p)
    const hits = featureTargets.filter((f) => am.some((a) => a.includes(f) || f.includes(a)))
    featPts = Math.round((hits.length / featureTargets.length) * 15)
  } else {
    featPts = 8
  }
  breakdown.push({ label: 'Características pedidas', points: featPts, max: 15 })

  // 6) Habitaciones / baños mínimos (0–10)
  let roomPts = 10
  if (minBedrooms != null && (p.bedrooms || 0) < minBedrooms) roomPts -= 6
  if (minBathrooms != null && (p.bathrooms || 0) < minBathrooms) roomPts -= 4
  roomPts = Math.max(0, roomPts)
  breakdown.push({ label: 'Habitaciones / baños', points: roomPts, max: 10 })

  // 7) Memoria del chat: propiedades que ya miraste (0–5)
  let memPts = 0
  if (mentioned.has(pid)) memPts += 4
  const recentIntents = memory.conversationHistory.slice(-4).map((h) => h.intent)
  if (recentIntents.includes('search') || recentIntents.includes('property_details')) memPts += 1
  memPts = Math.min(5, memPts)
  breakdown.push({ label: 'Historial en el chat', points: memPts, max: 5 })

  const total = breakdown.reduce((s, b) => s + b.points, 0)
  return { total, breakdown }
}

function filterRecommendCandidates(
  allProperties: any[],
  preferences: ConversationMemory['userPreferences'],
  entities: ExtractedEntities,
  strict: boolean
): any[] {
  let list = [...allProperties]
  const budgetMax = preferences.budget?.max ?? entities.requirements.maxPrice
  const minBed = Math.max(preferences.minBedrooms ?? 0, entities.requirements.bedrooms ?? 0) || undefined
  const minBath = Math.max(preferences.minBathrooms ?? 0, entities.requirements.bathrooms ?? 0) || undefined

  if (budgetMax) {
    list = list.filter((p) => (p.price || 0) <= budgetMax * (strict ? 1 : 1.12))
  }
  if (minBed) {
    list = list.filter((p) => (p.bedrooms || 0) >= (strict ? minBed : Math.max(1, minBed - 1)))
  }
  if (minBath) {
    list = list.filter((p) => (p.bathrooms || 0) >= (strict ? minBath : Math.max(1, minBath - 1)))
  }
  if (strict && preferences.preferredLocations && preferences.preferredLocations.length > 0) {
    list = list.filter((p) =>
      preferences.preferredLocations!.some((loc) => p.location?.toLowerCase().includes(loc.toLowerCase()))
    )
  }
  return list
}

/**
 * Generar respuesta de recomendación personalizada
 */
function generateRecommendResponse(
  entities: ExtractedEntities,
  allProperties: any[],
  memory: ConversationMemory,
  context: IntentAnalysis['context']
): string {
  const preferences = memory.userPreferences
  const locationTargets = collectRecommendationLocationTargets(entities, memory, context)
  const featureTargets = collectRecommendationFeatureTargets(entities, memory)
  const minBedrooms = Math.max(preferences.minBedrooms ?? 0, entities.requirements.bedrooms ?? 0) || undefined
  const minBathrooms = Math.max(preferences.minBathrooms ?? 0, entities.requirements.bathrooms ?? 0) || undefined
  const budgetMax = preferences.budget?.max ?? entities.requirements.maxPrice

  let candidates = filterRecommendCandidates(allProperties, preferences, entities, true)
  let relaxedNote = ''
  if (candidates.length < 3) {
    const relaxed = filterRecommendCandidates(allProperties, preferences, entities, false)
    if (relaxed.length > candidates.length) {
      candidates = relaxed
      relaxedNote =
        '\n\nℹ️ **Nota:** amplié un poco los criterios (precio o habitaciones) porque con el filtro estricto había pocas opciones.'
    }
  }
  if (candidates.length === 0) {
    candidates = [...allProperties]
    relaxedNote =
      '\n\nℹ️ **Nota:** no había coincidencias con tus filtros guardados; te muestro las mejores opciones generales del catálogo.'
  }

  const scored = candidates
    .map((p) => {
      const { total, breakdown } = scorePropertyForRecommendation(
        p,
        memory,
        entities,
        locationTargets,
        featureTargets,
        minBedrooms,
        minBathrooms,
        budgetMax
      )
      return { ...p, score: total, scoreBreakdown: breakdown }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (scored.length === 0) {
    return `No tengo suficientes propiedades que coincidan con tus preferencias para hacer una recomendación personalizada.

💡 **Para ayudarte mejor, cuéntame:**
• ¿Cuál es tu presupuesto máximo?
• ¿Qué ubicaciones te interesan?
• ¿Cuántas habitaciones necesitas?
• ¿Hay características específicas que buscas?

Con esa información puedo darte recomendaciones más precisas.`
  }

  memory.mentionedProperties = scored.map((p) => p.id)

  const recommendations = scored.map((p, i) => {
    const lines = p.scoreBreakdown.map(
      (b: ScoreBreakdown) => `     • ${b.label}: ${b.points}/${b.max}`
    )
    return `${i + 1}. **${p.title || 'Sin título'}**
   📍 ${p.location || 'Ubicación no especificada'}
   💰 $${(p.price || 0).toLocaleString()}/mes
   ⭐ ${(p.averageRating || 0).toFixed(1)}/5
   🎯 **Puntuación total:** ${p.score}/110
   📊 **Desglose:**
${lines.join('\n')}`
  }).join('\n\n')

  const contextInfo: string[] = []
  if (preferences.budget || budgetMax) {
    contextInfo.push(
      `presupuesto de hasta $${(preferences.budget?.max ?? budgetMax ?? 0).toLocaleString()}`
    )
  }
  if (locationTargets.length > 0) {
    contextInfo.push(`interés en ${locationTargets.slice(0, 4).join(', ')}`)
  }
  if (featureTargets.length > 0) {
    contextInfo.push(`características: ${featureTargets.slice(0, 5).join(', ')}`)
  }

  return `Basándome en${contextInfo.length > 0 ? ` tu ${contextInfo.join(' y tu ')}` : ' las propiedades disponibles'}, te recomiendo estas **${scored.length} opciones** (ordenadas por puntuación):${relaxedNote}

${recommendations}

💡 **¿Por qué estas?**
Cada fila incluye un **desglose** (suma máxima 110): priorizo precio dentro de tu rango, calificación, disponibilidad, ubicación alineada con lo que comentaste, coincidencia con amenities pedidas, habitaciones/baños, y un pequeño boost si **ya viste** esa propiedad en el chat.

¿Quieres más detalles sobre alguna de estas recomendaciones?`
}

// Continuaré con las demás funciones de generación de respuestas...
// Por ahora, voy a crear funciones placeholder para las demás intenciones

function generatePriceResponse(entities: ExtractedEntities, allProperties: any[], memory: ConversationMemory): string {
  // Implementación detallada de análisis de precios
  const allPrices = allProperties.map(p => p.price || 0).filter(p => p > 0)
  if (allPrices.length === 0) {
    return 'No tengo información de precios disponible en este momento.'
  }
  
  const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length
  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  
  if (entities.locations.length > 0) {
    const propsInLocation = allProperties.filter(p => 
      entities.locations.some(loc => p.location?.toLowerCase().includes(loc.toLowerCase()))
    )
    if (propsInLocation.length > 0) {
      const locPrices = propsInLocation.map(p => p.price || 0).filter(p => p > 0)
      const locAvg = locPrices.reduce((a, b) => a + b, 0) / locPrices.length
      const locMin = Math.min(...locPrices)
      const locMax = Math.max(...locPrices)
      
      return `En **${entities.locations[0]}**:\n\n💰 **Análisis de precios:**\n• Promedio: **$${Math.round(locAvg).toLocaleString()}/mes**\n• Rango: **$${locMin.toLocaleString()} - $${locMax.toLocaleString()}/mes**\n• Total de propiedades: **${propsInLocation.length}**\n\n💡 **Comparación:** El precio promedio en esta zona es ${locAvg > avgPrice ? 'mayor' : 'menor'} que el promedio general ($${Math.round(avgPrice).toLocaleString()}/mes).\n\n¿Te interesa alguna propiedad específica de esta zona?`
    }
  }
  
  const budgetMax = memory.userPreferences.budget?.max
  return `💰 **Análisis de precios general:**\n\n• Precio promedio: **$${Math.round(avgPrice).toLocaleString()}/mes**\n• Rango: **$${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}/mes**\n• Total de propiedades: **${allProperties.length}**\n\n${budgetMax ? `Veo que mencionaste un presupuesto de hasta $${budgetMax.toLocaleString()}. Tengo **${allProperties.filter(p => (p.price || 0) <= budgetMax).length} propiedades** en ese rango.` : '¿Tienes un presupuesto en mente? Puedo ayudarte a encontrar opciones que se ajusten.'}`
}

function generateLocationResponse(entities: ExtractedEntities, allProperties: any[], memory: ConversationMemory): string {
  const locations = [...new Set(allProperties.map(p => p.location).filter(Boolean))]
  
  if (entities.locations.length > 0) {
    const locationMatch = entities.locations[0]
    const propsInLocation = allProperties.filter(p => 
      p.location?.toLowerCase().includes(locationMatch.toLowerCase()) ||
      locationMatch.toLowerCase().includes(p.location?.toLowerCase() || '')
    )
    
    if (propsInLocation.length > 0) {
      memory.entities.locations.add(locationMatch)
      memory.mentionedProperties = propsInLocation.slice(0, 5).map(p => p.id)
      
      const avgPrice = propsInLocation.reduce((sum, p) => sum + (p.price || 0), 0) / propsInLocation.length
      
      return `En **${locationMatch}** tenemos **${propsInLocation.length} propiedades** disponibles:\n\n${propsInLocation.slice(0, 5).map((p, i) => 
        `${i + 1}. **${p.title || 'Sin título'}**\n   💰 $${(p.price || 0).toLocaleString()}/mes${p.averageRating ? ` | ⭐ ${p.averageRating.toFixed(1)}/5` : ''}${p.isAvailable === false ? ' | ❌ Ocupada' : ' | ✅ Disponible'}`
      ).join('\n\n')}${propsInLocation.length > 5 ? `\n\n...y **${propsInLocation.length - 5} más**.` : ''}\n\n💰 **Precio promedio en esta zona:** $${Math.round(avgPrice).toLocaleString()}/mes\n\n¿Te interesa alguna en particular? Puedo darte más detalles.`
    }
  }
  
  return `Tenemos propiedades en las siguientes ubicaciones:\n\n${locations.slice(0, 15).map(loc => `📍 ${loc}`).join('\n')}${locations.length > 15 ? `\n\n...y **${locations.length - 15} ubicaciones más**.` : ''}\n\n${memory.entities.locations.size > 0 ? `Veo que has mostrado interés en **${Array.from(memory.entities.locations).join(', ')}**. ` : ''}¿Te interesa alguna ubicación en particular? Puedo mostrarte las propiedades disponibles allí.`
}

function generatePropertyDetailsResponse(entities: ExtractedEntities, allProperties: any[], memory: ConversationMemory): string {
  const prop = entities.properties.length > 0
    ? allProperties.find(p => p.id === entities.properties[0])
    : memory.mentionedProperties.length > 0
      ? allProperties.find(p => p.id === memory.mentionedProperties[0])
      : null
  
  if (!prop) {
    return 'No tengo información sobre esa propiedad específica. ¿Puedes mencionar el nombre, ubicación o ID de la propiedad que te interesa?'
  }
  
  // Generar respuesta detallada sobre la propiedad
  const details: string[] = []
  details.push(`**${prop.title || 'Sin título'}**`)
  details.push(`📍 ${prop.location || 'Ubicación no especificada'}`)
  details.push(`💰 $${(prop.price || 0).toLocaleString()}/mes`)
  
  if (prop.bedrooms) details.push(`🛏️ ${prop.bedrooms} habitaciones`)
  if (prop.bathrooms) details.push(`🚿 ${prop.bathrooms} baños`)
  if (prop.area) details.push(`📐 ${prop.area}m²`)
  if (prop.averageRating) details.push(`⭐ ${prop.averageRating.toFixed(1)}/5 (${prop.reviewsCount || 0} reseñas)`)
  details.push(prop.isAvailable === false ? '❌ Ocupada' : '✅ Disponible')
  
  if (prop.description) {
    details.push(`\n📝 **Descripción:**\n${prop.description}`)
  }
  
  const amenities = [
    ...(prop.amenities || []),
    ...(prop.buildingAmenities || []),
    ...(prop.safety || [])
  ]
  
  if (amenities.length > 0) {
    details.push(`\n✨ **Características:**\n${amenities.slice(0, 10).map(a => `• ${a}`).join('\n')}${amenities.length > 10 ? `\n...y ${amenities.length - 10} más` : ''}`)
  }
  
  memory.mentionedProperties = [prop.id]
  
  return details.join('\n') + `\n\n¿Quieres saber más sobre algún aspecto específico de esta propiedad?`
}

// Funciones placeholder para las demás intenciones (se implementarán completamente)
function generateRentalProcessResponse(memory: ConversationMemory): string {
  return `**📋 Proceso de alquiler completo en RIAL:**\n\n**Pasos del proceso:**\n\n1. **🔍 Busca y selecciona** una propiedad que te guste\n   • Explora el catálogo con filtros inteligentes\n   • Revisa fotos, ubicación y características\n   • Lee reseñas de otros inquilinos\n\n2. **👤 Completa tu perfil** (opcional pero recomendado)\n   • Información personal básica\n   • Verificación de identidad (aumenta confianza)\n   • Referencias personales o laborales\n\n3. **📝 Solicita el alquiler**\n   • Haz clic en "Solicitar Alquiler"\n   • El propietario revisará tu perfil y solicitud\n   • Puedes agregar un mensaje personal\n\n4. **✅ Aprobación del propietario**\n   • Revisión de tu perfil y documentos\n   • Comunicación directa si hay preguntas\n   • Notificación cuando seas aprobado\n\n5. **📄 Revisa el contrato**\n   • Todos los términos estarán claros y visibles\n   • Puedes hacer preguntas antes de firmar\n   • El contrato es generado automáticamente\n\n6. **✍️ Firma digitalmente**\n   • El proceso es 100% online\n   • Firma con un clic (legalmente vinculante)\n   • Recibirás una copia por email\n\n7. **💰 Paga el depósito y primer mes**\n   • Métodos de pago seguros\n   • El depósito se mantiene en custodia\n\n8. **🔑 Coordina la entrega**\n   • Contacta al propietario para coordinar\n   • Inspección inicial (opcional)\n   • Recibe las llaves\n\n⏱️ **Tiempo estimado total:** 2-5 días hábiles\n\n💡 **Ventajas del proceso digital:**\n• Más rápido que procesos tradicionales\n• Todo desde tu casa\n• Documentos seguros y encriptados\n• Soporte en cada paso\n\n¿Tienes alguna pregunta específica sobre algún paso del proceso?`
}

function generateRequirementsResponse(entities: ExtractedEntities, memory: ConversationMemory): string {
  const isStudent = entities.lifestyle?.includes('estudiante') || 
                    memory.conversationHistory.some(h => h.question.toLowerCase().includes('estudiante'))
  const isFreelancer = memory.conversationHistory.some(h => 
    h.question.toLowerCase().includes('freelancer') || 
    h.question.toLowerCase().includes('independiente')
  )
  const isForeigner = memory.conversationHistory.some(h => 
    h.question.toLowerCase().includes('extranjero') || 
    h.question.toLowerCase().includes('extranjera')
  )
  
  let response = `**📄 Documentos y requisitos para alquilar:**\n\n`
  
  response += `**Documentos obligatorios:**\n`
  response += `1. **Documento de identidad**\n   • DNI, pasaporte o licencia de conducir\n   • Debe estar vigente y legible\n   • Fotos claras de ambos lados\n\n`
  response += `2. **Comprobante de ingresos** (últimos 3 meses)\n   • Recibos de sueldo (empleados)\n   • Extractos bancarios (independientes)\n   • Declaración jurada (freelancers)\n   • Contratos de trabajo\n\n`
  response += `3. **Estado de cuenta bancario** (últimos 2 meses)\n   • Para verificar solvencia\n   • Debe mostrar movimientos regulares\n   • Puede ser de cualquier banco\n\n`
  
  response += `**💼 Requisitos generales:**\n`
  response += `• **Ingresos:** Generalmente 3x el alquiler mensual\n`
  response += `• **Historial crediticio:** Positivo (opcional pero recomendado)\n`
  response += `• **Referencias:** Personales o laborales (opcional)\n`
  response += `• **Edad:** Mayor de 18 años (verificado con documento)\n\n`
  
  if (isStudent) {
    response += `**🎓 Para estudiantes:**\n`
    response += `• Comprobante de beca o apoyo familiar\n`
    response += `• Carta de la universidad\n`
    response += `• Puede requerirse garante o fiador\n`
    response += `• Algunos propietarios ofrecen descuentos para estudiantes\n\n`
  }
  
  if (isFreelancer) {
    response += `**💻 Para freelancers/independientes:**\n`
    response += `• Declaración jurada de ingresos\n`
    response += `• Extractos bancarios de los últimos 6 meses\n`
    response += `• Facturas o contratos de trabajo\n`
    response += `• Puede requerirse depósito mayor o garante\n\n`
  }
  
  if (isForeigner) {
    response += `**🌍 Para extranjeros:**\n`
    response += `• Pasaporte vigente\n`
    response += `• Visa o permiso de residencia\n`
    response += `• Comprobante de ingresos (puede ser del país de origen)\n`
    response += `• Puede requerirse garante local o depósito mayor\n\n`
  }
  
  response += `**💡 Notas importantes:**\n`
  response += `• Los requisitos pueden **variar según el propietario**\n`
  response += `• Algunos son más flexibles que otros\n`
  response += `• Un perfil completo y verificado aumenta tus chances\n`
  response += `• Puedes contactar al propietario para aclarar requisitos específicos\n\n`
  
  if (!isStudent && !isFreelancer && !isForeigner) {
    response += `¿Eres estudiante, freelancer o extranjero? Puedo darte información más específica para tu caso.`
  } else {
    response += `¿Tienes alguna pregunta específica sobre los documentos o requisitos?`
  }
  
  return response
}

function generateContractResponse(memory: ConversationMemory): string {
  return `**📋 Información completa sobre contratos:**\n\n**Tipos de contrato en RIAL:**\n• **Contrato estándar de RIAL** (recomendado)\n   - Términos probados y legales\n   - Protección para ambas partes\n   - Fácil de entender\n• **Contrato personalizado del propietario** (si lo permite)\n   - Términos específicos del propietario\n   - Debe cumplir con leyes locales\n   - Revisa cuidadosamente\n\n**⏱️ Duración del contrato:**\n• **Mínimo:** Generalmente 6-12 meses (varía por región)\n• **Máximo:** Sin límite, según acuerdo\n• **Renovación:**\n   - Automática (si no hay aviso de rescisión)\n   - Manual (requiere nueva firma)\n   - Términos pueden cambiar en renovación\n• **Rescisión:**\n   - Con aviso previo (generalmente 30 días)\n   - Sin penalización si cumples el aviso\n   - Puede haber penalización si rompes el contrato antes\n\n**💰 Términos financieros comunes:**\n• **Depósito:** 1-2 meses de alquiler (reembolsable al finalizar)\n• **Primer mes:** Pagado por adelantado\n• **Aumentos:**\n   - Según índice de inflación (común)\n   - Porcentaje fijo anual\n   - Negociable en renovación\n• **Servicios:**\n   - Generalmente por cuenta del inquilino\n   - Algunos incluyen servicios básicos\n   - Verifica en el contrato específico\n\n**📝 Cláusulas importantes:**\n• **Mantenimiento:** Responsabilidades claramente definidas\n• **Modificaciones:** Prohibidas sin autorización\n• **Subarrendar:** Generalmente prohibido sin permiso\n• **Mascotas:** Según política del propietario\n• **Visitas:** Derecho a privacidad y tranquilidad\n\n**⚖️ Derechos y obligaciones:**\n• **Tus derechos:**\n   - Propiedad en buen estado\n   - Privacidad\n   - Rescisión con aviso\n   - Devolución del depósito\n• **Tus obligaciones:**\n   - Pago puntual\n   - Mantenimiento básico\n   - Comunicar problemas\n   - Respetar términos\n\n**💡 Consejos:**\n• Lee el contrato **completamente** antes de firmar\n• Si algo no está claro, **pregunta**\n• Guarda una copia del contrato firmado\n• Revisa las cláusulas de rescisión\n\n¿Tienes alguna pregunta específica sobre contratos, cláusulas o términos?`
}

function generatePaymentResponse(memory: ConversationMemory): string {
  const budget = memory.userPreferences.budget
  
  return `**💳 Información completa sobre pagos:**\n\n**Métodos de pago aceptados:**\n• 💳 **Tarjeta de crédito/débito** (Visa, Mastercard, Amex)\n   - Pago inmediato\n   - Seguro y encriptado\n   - Puedes guardar tarjeta para pagos automáticos\n• 🏦 **Transferencia bancaria**\n   - Directa y segura\n   - Sin comisiones adicionales\n   - Puede tardar 1-2 días hábiles\n• 📱 **PayPal** (en algunos casos)\n   - Rápido y seguro\n   - Disponible según región\n• 💰 **Efectivo** (solo casos especiales)\n   - Coordinado directamente con propietario\n   - No recomendado por seguridad\n\n**📅 Frecuencia de pagos:**\n• **Mensual:** Por adelantado (más común)\n• **Trimestral:** Algunos propietarios lo aceptan\n• **Anual:** Raro, pero posible con descuento\n\n**💰 Desglose de costos:**\n• **Alquiler base:** El precio principal de la propiedad\n• **Expensas:** Si aplica (comunes en departamentos)\n• **Servicios:**\n   - Generalmente por cuenta del inquilino\n   - Luz, gas, agua, internet\n   - Algunos incluyen servicios básicos\n• **Impuestos:** Según la región y tipo de contrato\n\n**📊 Qué incluye el precio mostrado:**\nEl precio que ves generalmente es el **alquiler base**. Verifica en el detalle:\n• Si incluye expensas\n• Si incluye servicios\n• Si hay costos adicionales\n\n${budget ? `**💡 Tu presupuesto:**\nVeo que mencionaste un presupuesto de hasta $${budget.max.toLocaleString()}/mes. Recuerda considerar:\n• Expensas adicionales (si aplica)\n• Servicios (luz, gas, agua, internet)\n• Depósito inicial\n• Gastos de mudanza\n\n**Total inicial aproximado:** $${Math.round(budget.max * 2.5).toLocaleString()} (depósito + primer mes + gastos)\n\n` : ''}**🔄 Pagos automáticos:**\n• Puedes configurar pagos automáticos mensuales\n• Recibirás recordatorios antes de cada pago\n• Evitas olvidos y retrasos\n\n**⚠️ Si no puedes pagar a tiempo:**\n• Contacta al propietario **inmediatamente**\n• Comunica la situación con anticipación\n• Algunos propietarios son flexibles con acuerdos\n• Evita retrasos sin comunicación\n\n**📄 Recibos y comprobantes:**\n• Recibirás recibos digitales automáticamente\n• Disponibles en tu cuenta de RIAL\n• Puedes descargarlos en PDF\n• Historial completo de pagos\n\n**❓ Preguntas frecuentes:**\n• **¿Puedo pagar con tarjeta extranjera?** Sí, se aceptan tarjetas internacionales\n• **¿Hay comisiones?** No, RIAL no cobra comisiones adicionales\n• **¿Qué pasa si el pago falla?** Se te notificará y podrás reintentar\n• **¿Puedo cambiar el método de pago?** Sí, en cualquier momento desde tu cuenta\n\n¿Tienes alguna pregunta específica sobre pagos, métodos o costos?`
}

function generateSupportResponse(): string {
  return `**🆘 Soporte y resolución de problemas:**\n\n**Canales de soporte:**\n• 💬 **Chat en la app:** Respuesta más rápida\n• 📧 **Email:** soporte@rial.com (respuesta en 24 horas)\n• 📱 **Teléfono:** (disponible en algunas regiones)\n• 🆘 **Botón "Reportar problema":** En cada propiedad\n\n**🔧 Problemas comunes y soluciones:**\n\n**1. Problemas con la propiedad:**\n• **Mantenimiento:** Contacta al propietario directamente primero\n• **Urgencias:** Contacta servicios de emergencia si es grave\n• **Reporta en RIAL:** Usa el botón "Reportar problema"\n• **Fotos/evidencia:** Toma fotos del problema\n\n**2. Problemas con pagos:**\n• **Pago fallido:** Revisa tu método de pago, saldo, o contacta a tu banco\n• **No recibí recibo:** Revisa spam, o descárgalo desde tu cuenta\n• **Error en el monto:** Contacta a soporte inmediatamente\n• **Historial:** Revisa tu historial completo en "Mis Pagos"\n\n**3. Problemas con contratos:**\n• **No puedo acceder:** Revisa "Mis Alquileres" en tu cuenta\n• **Términos no claros:** Puedo ayudarte a entender cualquier término\n• **Necesito modificar:** Contacta al propietario para negociar\n• **Descargar PDF:** Disponible en "Mis Alquileres" → "Ver Contrato"\n\n**4. Problemas técnicos de la app:**\n• **No carga:** Prueba refrescar o cerrar y abrir la app\n• **Error al subir fotos:** Verifica el formato y tamaño\n• **No recibo notificaciones:** Revisa configuración de notificaciones\n• **Problema de login:** Usa "Recuperar contraseña" o contacta soporte\n\n**5. Problemas con el propietario:**\n• **No responde:** Espera 24-48 horas, luego contacta a RIAL\n• **Comportamiento inapropiado:** Reporta inmediatamente a soporte\n• **Disputas:** RIAL puede mediar en conflictos\n• **Cancelación injusta:** Contacta a soporte para revisión\n\n**⚖️ Resolución de disputas:**\n• **Mediación:** RIAL ofrece mediación imparcial\n• **Documentación:** Guarda evidencia de todo\n• **Comunicación:** Mantén comunicación profesional\n• **Tiempo:** El proceso puede tardar algunos días\n\n**🛡️ Protecciones:**\n• Tu depósito está protegido\n• Contratos legales y ejecutables\n• Sistema de reseñas y calificaciones\n• Soporte durante todo el proceso\n\n**💡 Consejos:**\n• **Comunica pronto:** No esperes a que el problema empeore\n• **Documenta todo:** Fotos, emails, mensajes\n• **Sé profesional:** La comunicación respetuosa ayuda\n• **Usa los canales oficiales:** Para tener registro de todo\n\n¿Cuál es el problema específico que estás experimentando? Puedo ayudarte a resolverlo o guiarte sobre los próximos pasos.`
}

function generateAccountResponse(entities: ExtractedEntities): string {
  const wantsToChange = entities.features.some(f => 
    f.toLowerCase().includes('cambiar') || 
    f.toLowerCase().includes('modificar') ||
    f.toLowerCase().includes('actualizar')
  )
  const wantsSecurity = entities.features.some(f => 
    f.toLowerCase().includes('seguridad') ||
    f.toLowerCase().includes('contraseña') ||
    f.toLowerCase().includes('verificar')
  )
  
  let response = `**👤 Gestión completa de cuenta:**\n\n`
  
  if (wantsToChange) {
    response += `**✏️ Modificar información:**\n\n`
    response += `**Puedes actualizar:**
• **Perfil:** Nombre, foto, biografía
• **Contacto:** Email, teléfono
• **Contraseña:** Desde "Configuración" → "Seguridad"
• **Preferencias:** Notificaciones, privacidad, tema\n\n`
    response += `**Para cambiar:**
1. Ve a "Mi Perfil" o "Configuración"
2. Haz clic en "Editar"
3. Modifica la información
4. Guarda los cambios\n\n`
    response += `**⚠️ Importante:**
• Cambiar email requiere verificación del nuevo email
• Cambiar teléfono puede requerir verificación
• Algunos cambios pueden afectar verificaciones existentes\n\n`
  }
  
  if (wantsSecurity) {
    response += `**🔒 Seguridad de cuenta:**\n\n`
    response += `**Protecciones disponibles:**
• **Verificación de dos factores (2FA):** Por email
• **Contraseñas seguras:** Requeridas (mínimo 8 caracteres)
• **Datos encriptados:** Toda tu información está protegida
• **Sesiones activas:** Puedes ver y cerrar sesiones desde otros dispositivos\n\n`
    response += `**Para mejorar tu seguridad:**
1. Activa 2FA en "Configuración" → "Seguridad"
2. Usa una contraseña única y fuerte
3. No compartas tus credenciales
4. Cierra sesión en dispositivos públicos\n\n`
  }
  
  if (!wantsToChange && !wantsSecurity) {
    response += `**👤 Información del perfil:**
• Actualizar nombre, foto, biografía
• Completar información adicional
• Agregar referencias\n\n`
    response += `**📧 Contacto:**
• Cambiar email (requiere verificación)
• Actualizar teléfono
• Gestionar preferencias de comunicación\n\n`
    response += `**🔒 Seguridad:**
• Cambiar contraseña
• Activar verificación de dos factores
• Ver sesiones activas
• Gestionar dispositivos conectados\n\n`
    response += `**🔔 Notificaciones:**
• Email, push, SMS
• Frecuencia de notificaciones
• Tipos de notificaciones\n\n`
    response += `**👁️ Privacidad:**
• Visibilidad del perfil
• Qué información ven los propietarios
• Compartir datos con terceros\n\n`
  }
  
  response += `**✅ Verificación de identidad:**
• Sube tu documento de identidad
• Verificación automática
• Aumenta confianza y chances de aprobación
• Opcional pero altamente recomendado\n\n`
  
  response += `**🗑️ Eliminar cuenta:**
• Disponible en "Configuración" → "Eliminar cuenta"
• Requiere confirmación
• Los datos se eliminan según políticas de privacidad
• Puede haber período de retención según leyes locales\n\n`
  
  response += `¿Qué aspecto específico de tu cuenta quieres gestionar o modificar?`
  
  return response
}

function generatePublishResponse(): string {
  return `**📝 Guía completa para publicar una propiedad:**\n\n**Pasos detallados:**\n\n**1. Accede a "Publicar Propiedad"**\n   • Desde el menú principal\n   • O desde tu perfil si eres propietario\n\n**2. Información básica**\n   • Título atractivo y descriptivo\n   • Descripción detallada\n   • Tipo de propiedad (casa, departamento, etc.)\n   • Ubicación exacta\n   • Precio mensual\n\n**3. Características y detalles**\n   • Habitaciones, baños, área\n   • Amenities y características\n   • Disponibilidad (fecha de inicio)\n   • Duración mínima del contrato\n   • Reglas (mascotas, fumadores, etc.)\n\n**4. Fotos de calidad**\n   • Mínimo 5 fotos recomendadas\n   • Fotos claras y bien iluminadas\n   • Diferentes ángulos y habitaciones\n   • Foto principal atractiva\n   • Fotos del exterior y ubicación\n\n**5. Configuración**\n   • Disponibilidad inmediata o futura\n   • Requisitos mínimos para inquilinos\n   • Métodos de contacto\n   • Preferencias de inquilinos\n\n**6. Revisión y publicación**\n   • Revisa toda la información\n   • Verifica que todo esté correcto\n   • Publica y espera solicitudes\n\n**💰 Comisiones y costos:**\n• **RIAL cobra una comisión** al propietario (por transacción exitosa)\n• **No hay costos** para inquilinos\n• **Sin costo de publicación** - solo pagas cuando se concreta el alquiler\n• **Comisión competitiva** - consulta tarifas actuales\n\n**💡 Consejos para propietarios:**\n• **Fotos profesionales** aumentan las vistas\n• **Descripción completa** genera más confianza\n• **Precio competitivo** atrae más inquilinos\n• **Respuesta rápida** a solicitudes aumenta aprobaciones\n• **Perfil verificado** genera más confianza\n\n**📊 Después de publicar:**\n• Recibirás notificaciones de nuevas solicitudes\n• Puedes revisar perfiles de candidatos\n• Aceptar o rechazar solicitudes\n• Comunicarte directamente con inquilinos\n• Gestionar múltiples propiedades\n\n**❓ Preguntas frecuentes:**\n• **¿Puedo editar después de publicar?** Sí, en cualquier momento\n• **¿Puedo pausar la publicación?** Sí, sin perder la información\n• **¿Cuánto tarda en aparecer?** Inmediatamente después de publicar\n• **¿Puedo publicar múltiples propiedades?** Sí, sin límite\n\n¿Eres propietario y quieres publicar? ¿Tienes alguna pregunta sobre el proceso de publicación?`
}

function generateOwnerManagementResponse(): string {
  return `**📊 Gestión completa para propietarios:**\n\n**📋 Gestión de solicitudes:**\n• Ver todas las solicitudes de alquiler\n• Revisar perfiles completos de candidatos\n• Aceptar o rechazar candidatos\n• Comunicarte directamente con inquilinos\n• Ver historial de comunicación\n\n**🏠 Gestión de propiedades:**\n• Gestionar múltiples propiedades desde un solo lugar\n• Editar información, precios y disponibilidad\n• Pausar o reactivar publicaciones\n• Subir nuevas fotos\n• Actualizar características\n\n**📈 Estadísticas y reportes:**\n• Vistas de tus propiedades\n• Solicitudes recibidas\n• Tasa de conversión\n• Ingresos y pagos\n• Calificaciones y reseñas\n\n**⚙️ Configuración:**\n• Requisitos mínimos para inquilinos\n• Preferencias de candidatos\n• Métodos de contacto preferidos\n• Notificaciones y alertas\n• Configuración de pagos\n\n**💡 Mejores prácticas:**\n• **Responde rápido:** Los inquilinos valoran la rapidez\n• **Revisa perfiles completos:** No solo el mensaje inicial\n• **Comunícate claramente:** Establece expectativas desde el inicio\n• **Sé profesional:** La buena comunicación genera confianza\n• **Mantén actualizado:** Precios, disponibilidad y fotos\n\n**📊 Dashboard de propietario:**\n• Vista general de todas tus propiedades\n• Solicitudes pendientes\n• Alquileres activos\n• Próximos pagos\n• Calendario de disponibilidad\n\n**💰 Gestión financiera:**\n• Ver historial de pagos\n• Configurar métodos de pago\n• Recibir pagos automáticamente\n• Reportes fiscales (si aplica)\n\n**🔔 Notificaciones inteligentes:**\n• Nuevas solicitudes\n• Mensajes de inquilinos\n• Pagos recibidos\n• Recordatorios importantes\n\n**❓ Preguntas frecuentes:**\n• **¿Puedo bloquear usuarios?** Sí, desde el perfil del usuario\n• **¿Cómo manejo múltiples propiedades?** Todas desde un solo dashboard\n• **¿Puedo establecer requisitos automáticos?** Sí, en configuración\n• **¿Qué hago si un inquilino no paga?** Contacta a soporte de RIAL\n\n¿Necesitas ayuda con alguna gestión específica? Puedo ayudarte con solicitudes, propiedades, pagos o cualquier otro aspecto.`
}

function generatePlatformInfoResponse(): string {
  return `**🏠 Sobre RIAL App - Plataforma de Alquileres:**\n\n**¿Qué es RIAL?**\nRIAL es una **plataforma digital innovadora** para alquileres a largo plazo que conecta propietarios e inquilinos de forma **segura, eficiente y transparente**.\n\n**✨ Características principales:**\n\n**🔍 Para Inquilinos:**
• Búsqueda inteligente con filtros avanzados
• Propiedades verificadas y documentadas
• Perfiles de propietarios con calificaciones
• Proceso de alquiler 100% digital
• Contratos legales y protegidos
• Sistema de pagos integrado y seguro
• Soporte durante todo el proceso\n\n**🏠 Para Propietarios:**
• Publicación fácil y rápida
• Gestión centralizada de propiedades
• Acceso a candidatos verificados
• Contratos automáticos
• Pagos seguros y puntuales
• Dashboard con estadísticas
• Herramientas de gestión completas\n\n**🛡️ Seguridad y confianza:**
• Propiedades verificadas
• Usuarios verificados (opcional)
• Contratos legales y ejecutables
• Depósitos en custodia segura
• Sistema de reseñas y calificaciones
• Resolución de disputas imparcial\n\n**🌍 Disponibilidad:**
• Disponible en múltiples países
• Soporte multi-idioma
• Monedas locales
• Cumplimiento con leyes locales\n\n**💡 Ventajas sobre métodos tradicionales:**
• **Más rápido:** Proceso digital en días vs semanas
• **Más seguro:** Verificaciones y protecciones
• **Más transparente:** Toda la información visible
• **Más conveniente:** Todo desde tu casa
• **Más económico:** Sin intermediarios costosos\n\n**📱 Plataforma:**
• **Web:** Accesible desde cualquier navegador
• **Móvil:** App disponible (iOS y Android)
• **Sincronización:** Todo se sincroniza en tiempo real\n\n**🆚 Diferencias con otras plataformas:**
• **vs Airbnb:** Enfocado en alquileres a largo plazo, no turismo
• **vs Inmobiliarias tradicionales:** Más rápido, digital, sin comisiones altas
• **vs Clasificados:** Propiedades verificadas, proceso seguro\n\n**📊 Estadísticas:**
• Miles de propiedades disponibles
• Miles de usuarios activos
• Alto índice de satisfacción
• Proceso promedio: 2-5 días\n\n**🎯 Nuestra misión:**
Hacer que encontrar y alquilar una propiedad sea **simple, seguro y accesible** para todos.\n\n¿Quieres saber más sobre algún aspecto específico de RIAL? ¿O buscas propiedades en tu país/región?`
}

function generateSecurityResponse(): string {
  return `**🛡️ Seguridad y verificación en RIAL:**\n\n**✅ Verificación de propiedades:**\n• Todas las propiedades pasan por un **proceso de verificación**\n• **Documentos de propiedad** verificados (títulos, escrituras)\n• **Fotos reales** y actualizadas (no stock photos)\n• **Información verificada** (ubicación, características, precio)\n• **Propietarios verificados** con documentación\n• **Sistema anti-fraude** para detectar propiedades falsas\n\n**👤 Verificación de usuarios:**\n• **Verificación de identidad** opcional pero altamente recomendada\n• **Documentos verificados** (DNI, pasaporte, licencia)\n• **Perfiles verificados** generan más confianza\n• **Sistema de reseñas** y calificaciones mutuas\n• **Historial de transacciones** visible\n• **Badges de verificación** en perfiles verificados\n\n**🔒 Protección de datos:**\n• **Datos encriptados** (SSL/TLS)\n• **Cumplimiento** con leyes de protección de datos (GDPR, etc.)\n• **Información privada** no se comparte sin autorización\n• **Contraseñas seguras** requeridas y encriptadas\n• **Sesiones seguras** con tokens JWT\n\n**💰 Protección financiera:**\n• **Depósitos en custodia segura** durante todo el contrato\n• **Pagos encriptados** y procesados de forma segura\n• **No almacenamos** información de tarjetas completas\n• **Protección contra fraudes** financieros\n• **Devolución garantizada** del depósito según términos\n\n**⚖️ Resolución de disputas:**\n• **Sistema de mediación** imparcial\n• **Documentación** de todo el proceso\n• **Soporte legal** de RIAL cuando es necesario\n• **Proceso transparente** y justo\n• **Protección para ambas partes**\n\n**🛡️ Protecciones adicionales:**\n• **Contratos legales** y ejecutables\n• **Sistema de reportes** para comportamiento inapropiado\n• **Bloqueo de usuarios** problemáticos\n• **Verificación continua** de propiedades activas\n• **Monitoreo** de actividad sospechosa\n\n**✅ Cómo identificar propiedades seguras:**\n• Busca el **badge de verificación** en la propiedad\n• Revisa las **reseñas** de otros inquilinos\n• Verifica que el **propietario esté verificado**\n• Lee el **perfil completo** del propietario\n• Revisa el **historial** de la propiedad\n\n**⚠️ Señales de alerta:**\n• Precios **sospechosamente bajos**\n• Propietario **no verificado** y sin reseñas\n• Solicitud de **pago fuera de la plataforma**\n• **Presión** para decidir rápidamente\n• **Fotos** que parecen stock o genéricas\n\n**💡 Consejos de seguridad:**\n• **Nunca pagues fuera** de la plataforma RIAL\n• **Verifica la identidad** del propietario\n• **Lee el contrato** completamente antes de firmar\n• **Documenta todo** (fotos, mensajes, pagos)\n• **Reporta** cualquier comportamiento sospechoso\n• **Usa los canales oficiales** de RIAL para comunicación\n\n**🆘 Si encuentras algo sospechoso:**
• **Reporta inmediatamente** usando el botón "Reportar"
• **Contacta a soporte** de RIAL
• **No compartas** información personal fuera de la plataforma
• **No hagas pagos** fuera de RIAL\n\n¿Tienes alguna preocupación de seguridad específica? ¿O quieres saber más sobre cómo verificar una propiedad o usuario?`
}

function generateHelpResponse(memory: ConversationMemory): string {
  const capabilities = [
    '🔍 Buscar propiedades según tus criterios',
    '💰 Analizar precios y comparar opciones',
    '📍 Recomendaciones personalizadas',
    '📋 Información sobre el proceso de alquiler',
    '📄 Explicar contratos y términos',
    '💳 Ayuda con pagos y depósitos',
    '❓ Responder cualquier pregunta sobre propiedades',
    '💬 Entender contexto y recordar nuestra conversación'
  ]
  
  return `**¿Qué puedo hacer por ti?**\n\n${capabilities.join('\n')}\n\n💡 **Puedo entender:**\n• Preguntas en lenguaje natural\n• Referencias a conversaciones anteriores\n• Contexto y preferencias\n• Preguntas complejas con múltiples criterios\n\n**Ejemplos de preguntas:**\n• "Busca departamentos en Palermo por menos de $500"\n• "¿Cuál es la diferencia entre estas dos propiedades?"\n• "Recomiéndame algo para trabajar desde casa"\n• "¿Qué documentos necesito para alquilar?"\n\n¿En qué puedo ayudarte específicamente?`
}

function generateCalculateResponse(entities: ExtractedEntities, allProperties: any[], memory: ConversationMemory): string {
  // Extraer números que podrían ser ingresos o precios
  const numbers = [...entities.prices, entities.requirements.maxPrice, entities.requirements.minPrice]
    .filter((n): n is number => typeof n === 'number' && n > 0)
  
  if (numbers.length >= 1) {
    const income = numbers[0] // Asumir que el primer número es el ingreso
    const rentPrice = numbers[1] || memory.userPreferences.budget?.max || 0
    
    if (rentPrice > 0) {
      const ratio = income / rentPrice
      const isAffordable = ratio >= 3
      const recommendedMax = Math.round(income / 3)
      
      let response = `**💰 Análisis de asequibilidad:**\n\n`
      response += `**Tus datos:**
• Ingreso mensual: $${income.toLocaleString()}
• Alquiler considerado: $${rentPrice.toLocaleString()}/mes
• Ratio ingreso/alquiler: ${ratio.toFixed(1)}x\n\n`
      
      if (isAffordable) {
        response += `✅ **Es asequible:** Tu ingreso es ${ratio.toFixed(1)} veces el alquiler, lo cual es **adecuado**.\n\n`
        response += `**💡 Recomendación:** Este alquiler está dentro de un rango saludable para tus ingresos.\n\n`
      } else {
        response += `⚠️ **Considera cuidadosamente:** Tu ingreso es ${ratio.toFixed(1)} veces el alquiler.\n\n`
        response += `**💡 Recomendación:** Según la regla general, tu ingreso debería ser al menos **3 veces** el alquiler mensual.\n\n`
        response += `**Opciones:**
• Busca propiedades por menos de $${recommendedMax.toLocaleString()}/mes
• Considera buscar un garante o fiador
• Evalúa si puedes ajustar otros gastos\n\n`
      }
      
      // Calcular otros gastos estimados
      const estimatedExpenses = Math.round(rentPrice * 0.3) // 30% para servicios, expensas, etc.
      const totalMonthly = rentPrice + estimatedExpenses
      const remainingAfterRent = income - totalMonthly
      
      response += `**📊 Desglose mensual estimado:**
• Alquiler: $${rentPrice.toLocaleString()}
• Expensas/servicios (estimado): $${estimatedExpenses.toLocaleString()}
• **Total vivienda:** $${totalMonthly.toLocaleString()}/mes
• **Te quedaría:** $${remainingAfterRent.toLocaleString()}/mes para otros gastos\n\n`
      
      if (remainingAfterRent < income * 0.3) {
        response += `⚠️ **Advertencia:** Te quedaría menos del 30% de tu ingreso para otros gastos, lo cual puede ser ajustado.\n\n`
      }
      
      response += `**💡 Regla general de asequibilidad:**
• **30% del ingreso** para vivienda (ideal)
• **Máximo 40%** del ingreso para vivienda
• **Mínimo 3x** el alquiler en ingresos\n\n`
      
      response += `¿Quieres que busque propiedades dentro de tu rango recomendado (hasta $${recommendedMax.toLocaleString()}/mes)?`
      
      return response
    }
  }
  
  return `**💰 Calculadora de asequibilidad de alquiler:**\n\nPara ayudarte a calcular si un alquiler es asequible, necesito:\n\n**Datos necesarios:**
• 💵 Tu ingreso mensual (después de impuestos)
• 🏠 El precio del alquiler que estás considerando
• 📊 Otros gastos estimados (expensas, servicios)\n\n**💡 Reglas generales:**
• **Regla 30%:** No más del 30% de tu ingreso en vivienda
• **Regla 3x:** Tu ingreso debe ser al menos 3 veces el alquiler
• **Gastos adicionales:** Considera expensas, servicios, internet (aprox. 20-30% adicional)\n\n**Ejemplo:**
Si ganas $${(memory.userPreferences.budget?.max ? memory.userPreferences.budget.max * 3 : 3000).toLocaleString()}/mes:
• Alquiler máximo recomendado: $${(memory.userPreferences.budget?.max ? memory.userPreferences.budget.max : 1000).toLocaleString()}/mes
• Con expensas/servicios: ~$${Math.round((memory.userPreferences.budget?.max || 1000) * 1.3).toLocaleString()}/mes total\n\n¿Puedes darme tu ingreso mensual y el precio del alquiler que estás considerando? Puedo hacer un análisis detallado.`
}

function generateGoodbyeResponse(memory: ConversationMemory): string {
  const hasActiveSearch = memory.mentionedProperties.length > 0 || memory.entities.locations.size > 0
  
  let response = `¡Fue un placer ayudarte! 👋\n\n`
  
  if (hasActiveSearch) {
    response += `**💡 Recordatorio:**\n`
    if (memory.mentionedProperties.length > 0) {
      response += `• Tienes ${memory.mentionedProperties.length} propiedades guardadas en nuestra conversación\n`
    }
    if (memory.entities.locations.size > 0) {
      response += `• Has mostrado interés en: ${Array.from(memory.entities.locations).join(', ')}\n`
    }
    if (memory.userPreferences.budget) {
      response += `• Tu presupuesto: hasta $${memory.userPreferences.budget.max.toLocaleString()}/mes\n`
    }
    response += `\nPuedes volver cuando quieras y continuar desde donde lo dejamos.\n\n`
  }
  
  response += `**Estoy aquí cuando me necesites para:**
• Continuar tu búsqueda
• Responder más preguntas
• Ayudarte con el proceso de alquiler
• Cualquier otra consulta\n\n`
  
  response += `¡Que tengas un excelente día! 😊\n\n**P.D.:** Si encuentras una propiedad que te guste, no dudes en preguntarme cualquier cosa sobre ella.`
  
  return response
}

function generateFallbackResponse(intent: IntentAnalysis, memory: ConversationMemory): string {
  // Respuesta inteligente cuando no se detecta una intención clara
  if (memory.conversationHistory.length > 0) {
    const lastIntent = memory.conversationHistory[memory.conversationHistory.length - 1]?.intent
    if (lastIntent === 'search' || lastIntent === 'property_details') {
      return `No estoy seguro de entender exactamente qué necesitas. ¿Te refieres a algo sobre las propiedades que estábamos viendo? Puedes ser más específico y te ayudo mejor.`
    }
  }
  
  return `No estoy seguro de entender tu pregunta. ¿Podrías reformularla? Puedo ayudarte con:\n\n• Búsqueda de propiedades\n• Información sobre precios y ubicaciones\n• Proceso de alquiler\n• Contratos y documentos\n• Cualquier otra pregunta sobre RIAL\n\n¿En qué puedo ayudarte?`
}
