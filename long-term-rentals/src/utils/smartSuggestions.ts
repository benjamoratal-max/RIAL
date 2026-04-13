/**
 * Sistema de sugerencias proactivas e inteligentes
 * Genera sugerencias contextuales basadas en la conversación y preferencias del usuario
 */

import type { ConversationMemory } from './aiEngine'

export interface Suggestion {
  text: string
  intent: string
  priority: number
  contextual: boolean
}

/**
 * Generar sugerencias inteligentes basadas en el contexto
 */
export function generateSmartSuggestions(
  memory: ConversationMemory,
  allProperties: any[],
  lastMessage?: string
): Suggestion[] {
  const suggestions: Suggestion[] = []
  
  // Si es el inicio de la conversación
  if (memory.conversationHistory.length === 0) {
    suggestions.push(
      { text: 'Buscar departamentos en Palermo', intent: 'search', priority: 1, contextual: false },
      { text: '¿Cuál es el precio promedio?', intent: 'price', priority: 1, contextual: false },
      { text: 'Recomiéndame propiedades', intent: 'recommend', priority: 1, contextual: false },
      { text: '¿Cómo funciona el proceso de alquiler?', intent: 'rental_process', priority: 1, contextual: false }
    )
    return suggestions
  }
  
  const lastIntent = memory.conversationHistory[memory.conversationHistory.length - 1]?.intent
  
  // Sugerencias basadas en el último intent
  if (lastIntent === 'search') {
    if (memory.mentionedProperties.length > 0) {
      suggestions.push(
        { text: 'Dame más detalles de la primera propiedad', intent: 'property_details', priority: 2, contextual: true },
        { text: 'Compara las propiedades que mencionaste', intent: 'compare', priority: 2, contextual: true }
      )
    }
    if (memory.userPreferences.budget) {
      suggestions.push(
        { text: `Buscar por menos de $${memory.userPreferences.budget.max.toLocaleString()}`, intent: 'search', priority: 1, contextual: true }
      )
    }
  }
  
  if (lastIntent === 'property_details') {
    suggestions.push(
      { text: '¿Cómo alquilo esta propiedad?', intent: 'rental_process', priority: 2, contextual: true },
      { text: 'Comparar con otras propiedades similares', intent: 'compare', priority: 1, contextual: true }
    )
  }
  
  if (lastIntent === 'price') {
    suggestions.push(
      { text: 'Buscar propiedades en mi presupuesto', intent: 'search', priority: 2, contextual: true },
      { text: '¿Qué incluye el precio?', intent: 'property_details', priority: 1, contextual: true }
    )
  }
  
  if (lastIntent === 'location') {
    if (memory.entities.locations.size > 0) {
      const location = Array.from(memory.entities.locations)[0]
      suggestions.push(
        { text: `Buscar propiedades en ${location}`, intent: 'search', priority: 2, contextual: true },
        { text: `¿Cuál es el precio promedio en ${location}?`, intent: 'price', priority: 1, contextual: true }
      )
    }
  }
  
  // Sugerencias basadas en preferencias detectadas
  if (memory.userPreferences.minBedrooms && !memory.userPreferences.minBathrooms) {
    suggestions.push(
      { text: `Buscar con ${memory.userPreferences.minBedrooms} habitaciones y 2 baños`, intent: 'search', priority: 1, contextual: true }
    )
  }
  
  if (memory.userPreferences.budget && memory.entities.locations.size === 0) {
    suggestions.push(
      { text: 'Buscar en diferentes ubicaciones', intent: 'location', priority: 1, contextual: true }
    )
  }
  
  // Sugerencias proactivas si no hay mucha actividad
  if (memory.conversationHistory.length > 3 && lastIntent === 'general') {
    suggestions.push(
      { text: '¿Necesitas ayuda con algo específico?', intent: 'help', priority: 0.5, contextual: true }
    )
  }
  
  // Ordenar por prioridad y retornar top 4
  return suggestions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4)
}

/**
 * Generar sugerencias de seguimiento después de una respuesta
 */
export function generateFollowUpSuggestions(
  intent: string,
  memory: ConversationMemory,
  responseContext?: any
): string[] {
  const suggestions: string[] = []
  
  switch (intent) {
    case 'search':
      if (responseContext?.propertiesFound && responseContext.propertiesFound > 0) {
        suggestions.push('Dame más detalles de la primera')
        suggestions.push('Compara las mejores opciones')
        suggestions.push('¿Cuál me recomiendas?')
      } else {
        suggestions.push('Ajustar los filtros de búsqueda')
        suggestions.push('Ver todas las ubicaciones disponibles')
      }
      break
      
    case 'compare':
      suggestions.push('¿Cuál tiene mejor relación precio-calidad?')
      suggestions.push('Dame más detalles de la más económica')
      break
      
    case 'recommend':
      suggestions.push('¿Por qué me recomiendas estas?')
      suggestions.push('Dame más detalles de la primera recomendación')
      break
      
    case 'property_details':
      suggestions.push('¿Cómo alquilo esta propiedad?')
      suggestions.push('Comparar con otras similares')
      suggestions.push('¿Qué documentos necesito?')
      break
      
    case 'price':
      suggestions.push('Buscar en mi presupuesto')
      suggestions.push('¿Qué incluye el precio?')
      break
      
    default:
      if (memory.mentionedProperties.length > 0) {
        suggestions.push('Dame más detalles de las propiedades')
      }
      if (memory.userPreferences.budget) {
        suggestions.push(`Buscar por menos de $${memory.userPreferences.budget.max.toLocaleString()}`)
      }
  }
  
  return suggestions.slice(0, 3)
}
