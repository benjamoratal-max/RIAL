/**
 * Sistema de Auto-Modificación de Código con Validación Estricta
 * 
 * Este sistema permite que la IA modifique su propio comportamiento de forma segura:
 * - Auto-optimización de prompts
 * - Generación de nuevas reglas
 * - Ajuste de umbrales y parámetros
 * - Todo con validación, rollback, testing y límites de seguridad
 */

interface ConfigChange {
  type: 'prompt' | 'rule' | 'threshold' | 'parameter'
  key: string
  value: any
  previousValue?: any
  reason: string
  source: 'auto' | 'manual' | 'feedback'
  metadata?: any
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  safetyScore: number // 0-1
  testResults?: any
}

interface SecurityLimits {
  maxPromptLength: number
  maxRuleCount: number
  minConfidenceThreshold: number
  maxConfidenceThreshold: number
  allowedConfigTypes: string[]
  blockedPatterns: RegExp[]
  maxChangesPerDay: number
  requireHumanApproval: boolean
}

interface TestSuite {
  name: string
  tests: Array<{
    name: string
    input: any
    expectedOutput?: any
    validator: (output: any) => boolean
  }>
}

export class SelfModificationSystem {
  private apiEndpoint: string
  private securityLimits: SecurityLimits
  private changeHistory: ConfigChange[] = []
  private dailyChangeCount: number = 0
  private lastResetDate: string = new Date().toDateString()

  constructor(apiEndpoint: string = '/api/ai') {
    this.apiEndpoint = apiEndpoint
    this.securityLimits = {
      maxPromptLength: 2000,
      maxRuleCount: 100,
      minConfidenceThreshold: 0.3,
      maxConfidenceThreshold: 0.95,
      allowedConfigTypes: ['prompt', 'rule', 'threshold', 'parameter'],
      blockedPatterns: [
        /eval\(/i,
        /Function\(/i,
        /exec\(/i,
        /dangerous/i,
        /delete\s+all/i,
        /drop\s+table/i,
      ],
      maxChangesPerDay: 50,
      requireHumanApproval: false, // Cambiar a true en producción crítica
    }
  }

  /**
   * Proponer y aplicar un cambio de configuración
   */
  async proposeChange(change: ConfigChange): Promise<{
    success: boolean
    versionId?: string
    validation?: ValidationResult
    error?: string
  }> {
    // 1. Resetear contador diario si es nuevo día
    this.resetDailyCounter()

    // 2. Validar límites de seguridad
    const limitCheck = this.checkSecurityLimits(change)
    if (!limitCheck.valid) {
      return {
        success: false,
        validation: {
          valid: false,
          errors: limitCheck.errors,
          warnings: [],
          safetyScore: 0,
        },
        error: limitCheck.errors.join('; '),
      }
    }

    // 3. Validación estricta del cambio
    const validation = await this.validateChange(change)
    if (!validation.valid) {
      return {
        success: false,
        validation,
        error: validation.errors.join('; '),
      }
    }

    // 4. Ejecutar tests automáticos
    const testResults = await this.runTests(change)
    if (!testResults.passed) {
      return {
        success: false,
        validation: {
          valid: false,
          errors: [`Tests fallaron: ${testResults.failures.join(', ')}`],
          warnings: [],
          safetyScore: validation.safetyScore * 0.5, // Reducir score si tests fallan
          testResults,
        },
        error: `Tests fallaron: ${testResults.failures.join(', ')}`,
      }
    }

    // 5. Crear versión con rollback
    const versionId = await this.createVersion(change, validation, testResults)

    // 6. Aplicar cambio
    const applied = await this.applyChange(change, versionId)
    if (!applied.success) {
      // Rollback automático si falla la aplicación
      await this.rollback(versionId)
      return {
        success: false,
        error: `Error aplicando cambio: ${applied.error}`,
      }
    }

    // 7. Registrar en historial
    this.changeHistory.push(change)
    this.dailyChangeCount++

    return {
      success: true,
      versionId,
      validation: {
        ...validation,
        testResults,
      },
    }
  }

  /**
   * Validación estricta de cambios
   */
  private async validateChange(change: ConfigChange): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    let safetyScore = 1.0

    // 1. Validar tipo de configuración
    if (!this.securityLimits.allowedConfigTypes.includes(change.type)) {
      errors.push(`Tipo de configuración no permitido: ${change.type}`)
      safetyScore -= 0.5
    }

    // 2. Validar que el valor no contenga patrones peligrosos
    const valueStr = JSON.stringify(change.value)
    for (const pattern of this.securityLimits.blockedPatterns) {
      if (pattern.test(valueStr)) {
        errors.push(`Patrón peligroso detectado: ${pattern}`)
        safetyScore = 0
      }
    }

    // 3. Validaciones específicas por tipo
    switch (change.type) {
      case 'prompt':
        if (typeof change.value !== 'string') {
          errors.push('Prompt debe ser un string')
          safetyScore -= 0.3
        } else if (change.value.length > this.securityLimits.maxPromptLength) {
          errors.push(`Prompt demasiado largo (max: ${this.securityLimits.maxPromptLength})`)
          safetyScore -= 0.2
        } else if (change.value.length < 10) {
          warnings.push('Prompt muy corto, puede no ser efectivo')
          safetyScore -= 0.1
        }
        break

      case 'rule':
        if (!change.value.pattern || !change.value.response) {
          errors.push('Regla debe tener pattern y response')
          safetyScore -= 0.4
        }
        if (change.value.confidence !== undefined) {
          if (
            change.value.confidence < this.securityLimits.minConfidenceThreshold ||
            change.value.confidence > this.securityLimits.maxConfidenceThreshold
          ) {
            errors.push(
              `Confidence fuera de rango permitido (${this.securityLimits.minConfidenceThreshold}-${this.securityLimits.maxConfidenceThreshold})`
            )
            safetyScore -= 0.3
          }
        }
        break

      case 'threshold':
        if (typeof change.value !== 'number') {
          errors.push('Threshold debe ser un número')
          safetyScore -= 0.3
        } else if (
          change.value < this.securityLimits.minConfidenceThreshold ||
          change.value > this.securityLimits.maxConfidenceThreshold
        ) {
          errors.push(
            `Threshold fuera de rango permitido (${this.securityLimits.minConfidenceThreshold}-${this.securityLimits.maxConfidenceThreshold})`
          )
          safetyScore -= 0.3
        }
        break

      case 'parameter':
        // Validación genérica para parámetros
        if (change.value === null || change.value === undefined) {
          errors.push('Parámetro no puede ser null o undefined')
          safetyScore -= 0.3
        }
        break
    }

    // 4. Validar razón del cambio
    if (!change.reason || change.reason.length < 10) {
      warnings.push('Razón del cambio muy corta o ausente')
      safetyScore -= 0.1
    }

    // 5. Asegurar que safetyScore esté en rango [0, 1]
    safetyScore = Math.max(0, Math.min(1, safetyScore))

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      safetyScore,
    }
  }

  /**
   * Verificar límites de seguridad
   */
  private checkSecurityLimits(change: ConfigChange): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Límite de cambios por día
    if (this.dailyChangeCount >= this.securityLimits.maxChangesPerDay) {
      errors.push(
        `Límite diario de cambios alcanzado (${this.securityLimits.maxChangesPerDay})`
      )
    }

    // Si requiere aprobación humana y es cambio automático
    if (
      this.securityLimits.requireHumanApproval &&
      change.source === 'auto'
    ) {
      errors.push('Este cambio requiere aprobación humana')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Ejecutar tests automáticos antes de aplicar cambio
   */
  private async runTests(change: ConfigChange): Promise<{
    passed: boolean
    failures: string[]
    results: any
  }> {
    const failures: string[] = []
    const results: any = {}

    // Test 1: Validar que el cambio no rompe funcionalidad básica
    try {
      const basicTest = await this.testBasicFunctionality(change)
      results.basicFunctionality = basicTest
      if (!basicTest.passed) {
        failures.push('Test de funcionalidad básica falló')
      }
    } catch (error: any) {
      failures.push(`Error en test básico: ${error.message}`)
    }

    // Test 2: Validar que respuestas siguen siendo coherentes
    try {
      const coherenceTest = await this.testResponseCoherence(change)
      results.coherence = coherenceTest
      if (!coherenceTest.passed) {
        failures.push('Test de coherencia falló')
      }
    } catch (error: any) {
      failures.push(`Error en test de coherencia: ${error.message}`)
    }

    // Test 3: Validar rendimiento (no debe degradarse significativamente)
    try {
      const performanceTest = await this.testPerformance(change)
      results.performance = performanceTest
      if (!performanceTest.passed) {
        failures.push('Test de rendimiento falló')
      }
    } catch (error: any) {
      failures.push(`Error en test de rendimiento: ${error.message}`)
    }

    return {
      passed: failures.length === 0,
      failures,
      results,
    }
  }

  /**
   * Test de funcionalidad básica
   */
  private async testBasicFunctionality(change: ConfigChange): Promise<{
    passed: boolean
    details: string
  }> {
    // Simular uso básico del cambio
    try {
      // Test simple: verificar que el valor puede ser parseado/usado
      if (change.type === 'prompt') {
        if (typeof change.value !== 'string' || change.value.length === 0) {
          return {
            passed: false,
            details: 'Prompt inválido',
          }
        }
      }

      // Test de que no hay errores de sintaxis obvios
      if (change.type === 'rule' && change.value.pattern) {
        try {
          new RegExp(change.value.pattern)
        } catch (e) {
          return {
            passed: false,
            details: `Patrón regex inválido: ${e}`,
          }
        }
      }

      return {
        passed: true,
        details: 'Funcionalidad básica OK',
      }
    } catch (error: any) {
      return {
        passed: false,
        details: `Error: ${error.message}`,
      }
    }
  }

  /**
   * Test de coherencia de respuestas
   */
  private async testResponseCoherence(change: ConfigChange): Promise<{
    passed: boolean
    details: string
  }> {
    // Verificar que el cambio no genera respuestas vacías o inválidas
    try {
      if (change.type === 'prompt' || change.type === 'rule') {
        // Test simple: verificar que hay contenido
        const testValue =
          change.type === 'prompt' ? change.value : change.value.response
        if (!testValue || testValue.trim().length === 0) {
          return {
            passed: false,
            details: 'Respuesta vacía generada',
          }
        }

        // Verificar que no es solo caracteres especiales
        const meaningfulContent = testValue.replace(/[^\w\s]/g, '').trim()
        if (meaningfulContent.length < 5) {
          return {
            passed: false,
            details: 'Respuesta sin contenido significativo',
          }
        }
      }

      return {
        passed: true,
        details: 'Coherencia OK',
      }
    } catch (error: any) {
      return {
        passed: false,
        details: `Error: ${error.message}`,
      }
    }
  }

  /**
   * Test de rendimiento
   */
  private async testPerformance(change: ConfigChange): Promise<{
    passed: boolean
    details: string
    metrics: any
  }> {
    const startTime = performance.now()

    try {
      // Simular procesamiento del cambio
      if (change.type === 'rule' && change.value.pattern) {
        // Test de que el regex no es demasiado complejo (puede causar ReDoS)
        const testString = 'a'.repeat(100)
        const regex = new RegExp(change.value.pattern)
        const matchStart = performance.now()
        regex.test(testString)
        const matchTime = performance.now() - matchStart

        if (matchTime > 100) {
          // Más de 100ms es sospechoso
          return {
            passed: false,
            details: 'Regex demasiado complejo (riesgo de ReDoS)',
            metrics: { matchTime },
          }
        }
      }

      const totalTime = performance.now() - startTime
      return {
        passed: true,
        details: 'Rendimiento OK',
        metrics: { totalTime },
      }
    } catch (error: any) {
      return {
        passed: false,
        details: `Error: ${error.message}`,
        metrics: {},
      }
    }
  }

  /**
   * Crear versión con capacidad de rollback
   */
  private async createVersion(
    change: ConfigChange,
    validation: ValidationResult,
    testResults: any
  ): Promise<string> {
    try {
      const response = await fetch(`${this.apiEndpoint}/config/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configType: change.type,
          configKey: change.key,
          configValue: change.value,
          previousValue: change.previousValue,
          changeReason: change.reason,
          validationStatus: validation.valid ? 'validated' : 'rejected',
          testResults: testResults,
          safetyScore: validation.safetyScore,
          changeSource: change.source,
          metadata: change.metadata,
        }),
      })

      if (!response.ok) {
        throw new Error(`Error creando versión: ${response.statusText}`)
      }

      const data = await response.json()
      return data.versionId
    } catch (error: any) {
      console.error('Error creando versión:', error)
      // Generar ID local si falla el backend
      return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  /**
   * Aplicar cambio
   */
  private async applyChange(
    change: ConfigChange,
    versionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiEndpoint}/config/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          configType: change.type,
          configKey: change.key,
          configValue: change.value,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.error || response.statusText,
        }
      }

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Rollback a versión anterior
   */
  async rollback(versionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiEndpoint}/config/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.error || response.statusText,
        }
      }

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Auto-optimizar prompt basándose en feedback
   */
  async optimizePrompt(
    currentPrompt: string,
    feedback: {
      helpful: boolean
      question: string
      answer: string
      improvedAnswer?: string
    }
  ): Promise<{ success: boolean; optimizedPrompt?: string; error?: string }> {
    if (!feedback.helpful && !feedback.improvedAnswer) {
      return {
        success: false,
        error: 'Se necesita feedback útil o respuesta mejorada para optimizar',
      }
    }

    // Generar prompt optimizado
    const optimizedPrompt = feedback.improvedAnswer
      ? this.generateOptimizedPromptFromFeedback(currentPrompt, feedback)
      : this.generateOptimizedPromptFromPattern(currentPrompt, feedback)

    const change: ConfigChange = {
      type: 'prompt',
      key: 'system_prompt',
      value: optimizedPrompt,
      previousValue: currentPrompt,
      reason: `Optimización basada en feedback: ${feedback.helpful ? 'útil' : 'no útil'}`,
      source: 'feedback',
      metadata: {
        originalQuestion: feedback.question,
        originalAnswer: feedback.answer,
        improvedAnswer: feedback.improvedAnswer,
      },
    }

    const result = await this.proposeChange(change)
    if (result.success) {
      return {
        success: true,
        optimizedPrompt,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Generar nueva regla basándose en patrones exitosos
   */
  async generateRuleFromPattern(pattern: {
    questionPattern: string
    bestAnswer: string
    successRate: number
    usageCount: number
  }): Promise<{ success: boolean; ruleId?: string; error?: string }> {
    if (pattern.successRate < 0.7) {
      return {
        success: false,
        error: 'Patrón no tiene suficiente tasa de éxito (min: 0.7)',
      }
    }

    const change: ConfigChange = {
      type: 'rule',
      key: `auto_rule_${Date.now()}`,
      value: {
        pattern: pattern.questionPattern,
        response: pattern.bestAnswer,
        confidence: Math.min(0.9, pattern.successRate),
        usageCount: pattern.usageCount,
        isAutoGenerated: true,
      },
      reason: `Regla generada automáticamente de patrón exitoso (${(pattern.successRate * 100).toFixed(1)}% éxito)`,
      source: 'auto',
      metadata: {
        originalPattern: pattern,
      },
    }

    const result = await this.proposeChange(change)
    if (result.success) {
      return {
        success: true,
        ruleId: change.key,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Ajustar umbral automáticamente
   */
  async adjustThreshold(
    thresholdName: string,
    currentValue: number,
    adjustment: number,
    reason: string
  ): Promise<{ success: boolean; newValue?: number; error?: string }> {
    const newValue = currentValue + adjustment

    // Validar que está en rango permitido
    if (
      newValue < this.securityLimits.minConfidenceThreshold ||
      newValue > this.securityLimits.maxConfidenceThreshold
    ) {
      return {
        success: false,
        error: `Nuevo valor (${newValue}) fuera de rango permitido`,
      }
    }

    const change: ConfigChange = {
      type: 'threshold',
      key: thresholdName,
      value: newValue,
      previousValue: currentValue,
      reason,
      source: 'auto',
      metadata: {
        adjustment,
        previousValue: currentValue,
      },
    }

    const result = await this.proposeChange(change)
    if (result.success) {
      return {
        success: true,
        newValue,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private generateOptimizedPromptFromFeedback(
    currentPrompt: string,
    feedback: any
  ): string {
    // Mejorar prompt incorporando la respuesta mejorada
    if (feedback.improvedAnswer) {
      return `${currentPrompt}

Nota importante: Cuando recibas preguntas similares a "${feedback.question}", 
proporciona respuestas más detalladas y específicas como: "${feedback.improvedAnswer.substring(0, 200)}..."`
    }
    return currentPrompt
  }

  private generateOptimizedPromptFromPattern(
    currentPrompt: string,
    feedback: any
  ): string {
    // Ajustar prompt basándose en el patrón de feedback negativo
    return `${currentPrompt}

Nota: Evita respuestas genéricas. Sé específico y proporciona información detallada y útil.`
  }

  private resetDailyCounter(): void {
    const today = new Date().toDateString()
    if (today !== this.lastResetDate) {
      this.dailyChangeCount = 0
      this.lastResetDate = today
    }
  }

  /**
   * Obtener historial de cambios
   */
  getChangeHistory(): ConfigChange[] {
    return [...this.changeHistory]
  }

  /**
   * Obtener estadísticas
   */
  getStats(): {
    totalChanges: number
    dailyChanges: number
    changesByType: Record<string, number>
  } {
    const changesByType: Record<string, number> = {}
    this.changeHistory.forEach((change) => {
      changesByType[change.type] = (changesByType[change.type] || 0) + 1
    })

    return {
      totalChanges: this.changeHistory.length,
      dailyChanges: this.dailyChangeCount,
      changesByType,
    }
  }
}
