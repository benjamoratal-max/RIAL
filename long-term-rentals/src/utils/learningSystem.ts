/**
 * Sistema de Aprendizaje y Análisis de Calidad
 * Analiza respuestas, extrae patrones y mejora continuamente
 */

interface Conversation {
  question: string
  answer: string
  intent: string
  timestamp: Date
  userFeedback?: 'helpful' | 'not_helpful'
  metadata?: any
}

interface QualityMetrics {
  length: boolean
  hasActionableInfo: boolean
  hasContext: boolean
  userSatisfaction: number
  completeness: number
}

export class LearningSystem {
  /**
   * Analizar calidad de una respuesta
   */
  static analyzeResponseQuality(
    question: string,
    answer: string,
    userFeedback?: 'helpful' | 'not_helpful'
  ): {
    quality: number
    metrics: QualityMetrics
    improvements: string[]
  } {
    const metrics: QualityMetrics = {
      length: answer.length >= 50 && answer.length <= 2000,
      hasActionableInfo: this.hasActionableInfo(answer),
      hasContext: this.hasContext(answer, question),
      userSatisfaction: userFeedback === 'helpful' ? 1 : userFeedback === 'not_helpful' ? 0 : 0.5,
      completeness: this.calculateCompleteness(answer, question)
    }

    const quality = (
      (metrics.length ? 1 : 0) * 0.15 +
      (metrics.hasActionableInfo ? 1 : 0) * 0.25 +
      (metrics.hasContext ? 1 : 0) * 0.20 +
      metrics.userSatisfaction * 0.25 +
      metrics.completeness * 0.15
    )

    return {
      quality,
      metrics,
      improvements: this.suggestImprovements(metrics, answer, question)
    }
  }

  /**
   * Verificar si tiene información accionable
   */
  private static hasActionableInfo(answer: string): boolean {
    const actionablePatterns = [
      /puedes/i,
      /debes/i,
      /necesitas/i,
      /haz/i,
      /ve a/i,
      /contacta/i,
      /revisa/i,
      /usa/i,
      /sigue/i,
      /completa/i,
      /sube/i,
      /descarga/i,
      /haz clic/i,
      /selecciona/i
    ]

    return actionablePatterns.some(pattern => pattern.test(answer))
  }

  /**
   * Verificar si tiene contexto relevante
   */
  private static hasContext(answer: string, question: string): boolean {
    const questionWords = new Set(
      question.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
    )

    const answerWords = answer.toLowerCase().split(/\s+/)
    const overlap = answerWords.filter(w => questionWords.has(w))

    return overlap.length >= Math.min(2, questionWords.size * 0.3)
  }

  /**
   * Calcular completitud de la respuesta
   */
  private static calculateCompleteness(answer: string, question: string): number {
    let score = 0.5 // Base

    // Bonus por estructura
    if (answer.includes('**') || answer.includes('•') || answer.includes('-')) {
      score += 0.2 // Tiene formato estructurado
    }

    // Bonus por ejemplos
    if (answer.includes('ejemplo') || answer.includes('por ejemplo') || /\$\d+/.test(answer)) {
      score += 0.15 // Tiene ejemplos concretos
    }

    // Bonus por preguntas de seguimiento
    if (answer.includes('?') || answer.includes('¿')) {
      score += 0.15 // Es proactivo
    }

    return Math.min(score, 1.0)
  }

  /**
   * Sugerir mejoras
   */
  private static suggestImprovements(
    metrics: QualityMetrics,
    answer: string,
    question: string
  ): string[] {
    const improvements: string[] = []

    if (!metrics.length) {
      if (answer.length < 50) {
        improvements.push('Respuesta muy corta - agregar más detalles')
      } else if (answer.length > 2000) {
        improvements.push('Respuesta muy larga - resumir información clave')
      }
    }

    if (!metrics.hasActionableInfo) {
      improvements.push('Agregar información accionable (pasos, acciones concretas)')
    }

    if (!metrics.hasContext) {
      improvements.push('Mejorar relevancia contextual con la pregunta')
    }

    if (metrics.completeness < 0.7) {
      improvements.push('Agregar ejemplos, estructura o preguntas de seguimiento')
    }

    if (metrics.userSatisfaction < 0.5) {
      improvements.push('Revisar si la respuesta realmente responde la pregunta del usuario')
    }

    return improvements
  }

  /**
   * Extraer patrones de conversaciones exitosas
   */
  static extractPatterns(conversations: Conversation[]): {
    commonQuestions: Array<{ question: string; count: number }>
    successfulResponses: Array<{ answer: string; helpful: number }>
    userPreferences: any
    commonIntents: Array<{ intent: string; count: number }>
  } {
    // Preguntas comunes
    const questionCounts = new Map<string, number>()
    conversations.forEach(conv => {
      const normalized = conv.question.toLowerCase().trim()
      questionCounts.set(normalized, (questionCounts.get(normalized) || 0) + 1)
    })

    const commonQuestions = Array.from(questionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }))

    // Respuestas exitosas
    const successfulResponses = conversations
      .filter(conv => conv.userFeedback === 'helpful')
      .map(conv => ({
        answer: conv.answer,
        helpful: 1
      }))
      .reduce((acc, curr) => {
        const existing = acc.find(a => a.answer === curr.answer)
        if (existing) {
          existing.helpful++
        } else {
          acc.push(curr)
        }
        return acc
      }, [] as Array<{ answer: string; helpful: number }>)
      .sort((a, b) => b.helpful - a.helpful)
      .slice(0, 10)

    // Intenciones comunes
    const intentCounts = new Map<string, number>()
    conversations.forEach(conv => {
      intentCounts.set(conv.intent, (intentCounts.get(conv.intent) || 0) + 1)
    })

    const commonIntents = Array.from(intentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([intent, count]) => ({ intent, count }))

    // Preferencias del usuario (extraer de metadata)
    const userPreferences: any = {}
    conversations.forEach(conv => {
      if (conv.metadata?.preferences) {
        Object.assign(userPreferences, conv.metadata.preferences)
      }
    })

    return {
      commonQuestions,
      successfulResponses,
      userPreferences,
      commonIntents
    }
  }

  /**
   * Identificar preguntas sin respuesta satisfactoria
   */
  static identifyUnansweredQuestions(conversations: Conversation[]): Array<{
    question: string
    attempts: number
    lastAttempt: Date
    suggestedAnswer?: string
  }> {
    const unanswered = conversations
      .filter(conv => conv.userFeedback === 'not_helpful' || !conv.userFeedback)
      .reduce((acc, conv) => {
        const existing = acc.find(a => a.question === conv.question)
        if (existing) {
          existing.attempts++
          if (conv.timestamp > existing.lastAttempt) {
            existing.lastAttempt = conv.timestamp
          }
        } else {
          acc.push({
            question: conv.question,
            attempts: 1,
            lastAttempt: conv.timestamp
          })
        }
        return acc
      }, [] as Array<{ question: string; attempts: number; lastAttempt: Date }>)

    return unanswered
      .filter(u => u.attempts >= 2)
      .sort((a, b) => b.attempts - a.attempts)
  }

  /**
   * Generar sugerencias de mejora basadas en patrones
   */
  static generateImprovementSuggestions(
    patterns: ReturnType<typeof this.extractPatterns>,
    unanswered: ReturnType<typeof this.identifyUnansweredQuestions>
  ): string[] {
    const suggestions: string[] = []

    // Si hay muchas preguntas sin respuesta
    if (unanswered.length > 5) {
      suggestions.push(`Hay ${unanswered.length} preguntas que necesitan mejor respuesta. Considera mejorar las respuestas para estas.`)
    }

    // Si hay intenciones comunes sin buena cobertura
    const topIntents = patterns.commonIntents.slice(0, 3)
    topIntents.forEach(({ intent, count }) => {
      if (count > 10) {
        suggestions.push(`La intención "${intent}" es muy común (${count} veces). Asegúrate de tener respuestas excelentes para esto.`)
      }
    })

    // Si hay preguntas muy repetidas
    const topQuestions = patterns.commonQuestions.slice(0, 3)
    topQuestions.forEach(({ question, count }) => {
      if (count > 5) {
        suggestions.push(`La pregunta "${question}" se repite ${count} veces. Considera crear una respuesta estándar mejorada.`)
      }
    })

    return suggestions
  }

  /**
   * Calcular métricas de aprendizaje
   */
  static calculateLearningMetrics(conversations: Conversation[]): {
    totalConversations: number
    helpfulRate: number
    averageQuality: number
    improvementTrend: 'improving' | 'stable' | 'declining'
    topCategories: Array<{ category: string; count: number; helpfulRate: number }>
  } {
    const total = conversations.length
    const helpful = conversations.filter(c => c.userFeedback === 'helpful').length
    const helpfulRate = total > 0 ? helpful / total : 0

    // Calcular calidad promedio
    const qualities = conversations.map(c => {
      const analysis = this.analyzeResponseQuality(c.question, c.answer, c.userFeedback)
      return analysis.quality
    })
    const averageQuality = qualities.length > 0
      ? qualities.reduce((a, b) => a + b, 0) / qualities.length
      : 0

    // Tendencias (comparar primera mitad vs segunda mitad)
    const firstHalf = conversations.slice(0, Math.floor(total / 2))
    const secondHalf = conversations.slice(Math.floor(total / 2))

    const firstHalfQuality = firstHalf.length > 0
      ? firstHalf.map(c => {
          const a = this.analyzeResponseQuality(c.question, c.answer, c.userFeedback)
          return a.quality
        }).reduce((a, b) => a + b, 0) / firstHalf.length
      : 0

    const secondHalfQuality = secondHalf.length > 0
      ? secondHalf.map(c => {
          const a = this.analyzeResponseQuality(c.question, c.answer, c.userFeedback)
          return a.quality
        }).reduce((a, b) => a + b, 0) / secondHalf.length
      : 0

    let improvementTrend: 'improving' | 'stable' | 'declining' = 'stable'
    if (secondHalfQuality > firstHalfQuality + 0.1) {
      improvementTrend = 'improving'
    } else if (secondHalfQuality < firstHalfQuality - 0.1) {
      improvementTrend = 'declining'
    }

    // Categorías (extraer de metadata o intent)
    const categoryStats = new Map<string, { count: number; helpful: number }>()
    conversations.forEach(c => {
      const category = c.metadata?.category || c.intent || 'general'
      const stats = categoryStats.get(category) || { count: 0, helpful: 0 }
      stats.count++
      if (c.userFeedback === 'helpful') stats.helpful++
      categoryStats.set(category, stats)
    })

    const topCategories = Array.from(categoryStats.entries())
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        helpfulRate: stats.count > 0 ? stats.helpful / stats.count : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalConversations: total,
      helpfulRate,
      averageQuality,
      improvementTrend,
      topCategories
    }
  }

  /**
   * Generar reglas automáticas basándose en patrones exitosos
   */
  static async generateAutoRules(
    patterns: ReturnType<typeof this.extractPatterns>,
    apiEndpoint: string = '/api/ai'
  ): Promise<Array<{ success: boolean; ruleId?: string; error?: string }>> {
    const results: Array<{ success: boolean; ruleId?: string; error?: string }> = []

    try {
      const { SelfModificationSystem } = await import('./selfModification')
      const selfMod = new SelfModificationSystem(apiEndpoint)

      // Generar reglas de preguntas comunes con respuestas exitosas
      for (const question of patterns.commonQuestions.slice(0, 5)) {
        const successfulAnswer = patterns.successfulResponses.find(
          r => r.helpful >= 3
        )

        if (successfulAnswer) {
          // Crear patrón de pregunta (simplificado)
          const questionPattern = this.createQuestionPattern(question.question)

          const result = await selfMod.generateRuleFromPattern({
            questionPattern,
            bestAnswer: successfulAnswer.answer,
            successRate: successfulAnswer.helpful / (successfulAnswer.helpful + 1),
            usageCount: question.count
          })

          results.push(result)
        }
      }
    } catch (error: any) {
      console.error('Error generando reglas automáticas:', error)
      results.push({
        success: false,
        error: error.message
      })
    }

    return results
  }

  /**
   * Crear patrón de pregunta desde texto
   */
  private static createQuestionPattern(question: string): string {
    // Simplificar pregunta a patrón regex básico
    const words = question.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5) // Tomar primeras 5 palabras significativas

    if (words.length === 0) {
      return question.toLowerCase()
    }

    // Crear patrón que coincida con palabras clave
    return words.join('.*')
  }

  /**
   * Analizar y sugerir ajustes de umbrales
   */
  static async analyzeAndAdjustThresholds(
    metrics: ReturnType<typeof this.calculateLearningMetrics>,
    apiEndpoint: string = '/api/ai'
  ): Promise<Array<{ success: boolean; threshold?: string; newValue?: number; error?: string }>> {
    const results: Array<{ success: boolean; threshold?: string; newValue?: number; error?: string }> = []

    try {
      const { SelfModificationSystem } = await import('./selfModification')
      const selfMod = new SelfModificationSystem(apiEndpoint)

      // Si la tasa de respuestas útiles es baja, bajar umbral de confianza
      if (metrics.helpfulRate < 0.6) {
        const result = await selfMod.adjustThreshold(
          'confidence_threshold',
          0.8, // Valor actual (puede obtenerse de configuración)
          -0.1, // Reducir en 0.1
          `Tasa de respuestas útiles baja (${(metrics.helpfulRate * 100).toFixed(1)}%), reduciendo umbral de confianza para usar más IA generativa`
        )
        results.push({
          success: result.success,
          threshold: 'confidence_threshold',
          newValue: result.newValue,
          error: result.error
        })
      }

      // Si la calidad promedio es alta, aumentar umbral para ser más selectivo
      if (metrics.averageQuality > 0.8 && metrics.helpfulRate > 0.8) {
        const result = await selfMod.adjustThreshold(
          'confidence_threshold',
          0.7, // Valor actual
          0.05, // Aumentar en 0.05
          `Calidad y satisfacción altas, aumentando umbral para mantener estándares`
        )
        results.push({
          success: result.success,
          threshold: 'confidence_threshold',
          newValue: result.newValue,
          error: result.error
        })
      }
    } catch (error: any) {
      console.error('Error ajustando umbrales:', error)
      results.push({
        success: false,
        error: error.message
      })
    }

    return results
  }
}
