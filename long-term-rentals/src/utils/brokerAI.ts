/**
 * Motor de IA avanzado para el Broker Virtual en el proceso de alquiler
 * Entiende contexto del proceso, paso actual y genera respuestas inteligentes
 */

export interface BrokerContext {
  currentStep: number
  totalSteps: number
  stepName: string
  formData: {
    monthlyRent?: number
    deposit?: number
    duration?: string
    startDate?: string
    [key: string]: any
  }
  property?: {
    title?: string
    price?: number
    location?: string
    [key: string]: any
  }
  user?: {
    name?: string
    role?: string
    [key: string]: any
  }
  conversationHistory: Array<{
    question: string
    intent: string
    timestamp: Date
  }>
  userNeeds: string[]
}

export interface BrokerIntent {
  intent: string
  confidence: number
  context: {
    stepRelated: boolean
    needsClarification: boolean
    suggestedActions?: string[]
  }
}

/**
 * Analizar intención en el contexto del proceso de alquiler
 */
export function analyzeBrokerIntent(question: string, context: BrokerContext): BrokerIntent {
  const lowerQuestion = question.toLowerCase()
  const intentScores: { [key: string]: number } = {}
  
  // Intenciones específicas del proceso de alquiler
  const intentPatterns: { [key: string]: { patterns: RegExp[], weight: number, stepRelevant?: number[] }[] } = {
    'greeting': [
      { patterns: [/hola/i, /hi/i, /buenos.*d[ií]as/i, /buenas.*tardes/i], weight: 1.0 }
    ],
    'documents': [
      { patterns: [/documento/i, /papel/i, /necesito/i, /requisito/i, /archivo/i], weight: 1.0, stepRelevant: [3] },
      { patterns: [/dni/i, /pasaporte/i, /licencia/i, /identidad/i], weight: 0.8, stepRelevant: [3] },
      { patterns: [/selfie/i, /cedula en mano/i, /cédula en mano/i], weight: 0.9, stepRelevant: [3] },
      { patterns: [/ingreso/i, /sueldo/i, /bancario/i, /extracto/i], weight: 0.8, stepRelevant: [3] }
    ],
    'contract': [
      { patterns: [/contrato/i, /t[ée]rmino/i, /cl[áa]usula/i, /condici[oó]n/i], weight: 1.0, stepRelevant: [4] },
      { patterns: [/firmar/i, /firma/i, /legal/i], weight: 0.8, stepRelevant: [4, 5] }
    ],
    'pricing': [
      { patterns: [/precio/i, /cuesta/i, /dep[oó]sito/i, /deposito/i, /garant[íi]a/i, /garantia/i], weight: 1.0 },
      { patterns: [/cu[áa]nto/i, /\$\d+/i, /total/i, /pagar/i], weight: 0.8 }
    ],
    'timeline': [
      { patterns: [/cu[áa]nto.*tiempo/i, /demora/i, /dura/i, /r[áa]pido/i], weight: 1.0 },
      { patterns: [/cuando/i, /fecha/i, /inicio/i], weight: 0.8, stepRelevant: [2] }
    ],
    'security': [
      { patterns: [/seguro/i, /garant[íi]a/i, /garantia/i, /protecci[oó]n/i, /proteccion/i], weight: 1.0 },
      { patterns: [/confianza/i, /seguro.*es/i, /riesgo/i], weight: 0.8 }
    ],
    'step_help': [
      { patterns: [/paso/i, /qu[ée].*hacer/i, /siguiente/i, /continuar/i], weight: 1.0 },
      { patterns: [/ayuda/i, /help/i, /no.*entiendo/i], weight: 0.9 }
    ],
    'modification': [
      { patterns: [/cambiar/i, /modificar/i, /editar/i, /corregir/i], weight: 1.0 },
      { patterns: [/volver/i, /atr[áa]s/i, /anterior/i], weight: 0.8 }
    ],
    'cancellation': [
      { patterns: [/cancelar/i, /cancelaci[oó]n/i, /arrepentirse/i], weight: 1.0 },
      { patterns: [/no.*quiero/i, /desistir/i], weight: 0.8 }
    ],
    'payment_methods': [
      { patterns: [/pago/i, /pagar/i, /m[ée]todo/i, /tarjeta/i, /transferencia/i], weight: 1.0 },
      { patterns: [/c[oó]mo.*pagar/i, /formas.*pago/i], weight: 0.9 }
    ],
    'property_questions': [
      { patterns: [/propiedad/i, /departamento/i, /casa/i, /caracter[íi]stica/i], weight: 1.0 },
      { patterns: [/visita/i, /ver/i, /foto/i], weight: 0.8 }
    ],
    'legal': [
      { patterns: [/legal/i, /ley/i, /derecho/i, /obligaci[oó]n/i], weight: 1.0 },
      { patterns: [/puedo/i, /debo/i, /tengo.*derecho/i], weight: 0.8 }
    ],
    'emergency': [
      { patterns: [/urgente/i, /emergencia/i, /problema.*grave/i], weight: 1.0 },
      { patterns: [/no.*funciona/i, /error.*cr[ií]tico/i], weight: 0.9 }
    ]
  }
  
  // Calcular scores
  Object.keys(intentPatterns).forEach(intent => {
    let score = 0
    intentPatterns[intent].forEach(({ patterns, weight, stepRelevant }) => {
      patterns.forEach(pattern => {
        if (pattern.test(lowerQuestion)) {
          // Bonus si es relevante para el paso actual
          if (stepRelevant && stepRelevant.includes(context.currentStep)) {
            score += weight * 1.2
          } else {
            score += weight
          }
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
  
  // Detectar si es relevante para el paso actual
  const stepRelated = intentPatterns[primaryIntent]?.some(
    pattern => pattern.stepRelevant?.includes(context.currentStep)
  ) || false
  
  // Detectar si necesita clarificación
  const needsClarification = confidence < 0.5 || 
    (primaryIntent === 'general' && context.conversationHistory.length > 0)
  
  // Sugerir acciones basadas en el paso actual
  const suggestedActions = getSuggestedActions(context.currentStep, primaryIntent)
  
  return {
    intent: primaryIntent,
    confidence: Math.min(confidence / 2, 1.0),
    context: {
      stepRelated,
      needsClarification,
      suggestedActions
    }
  }
}

/**
 * Obtener acciones sugeridas según el paso
 */
function getSuggestedActions(step: number, intent: string): string[] {
  const actions: { [key: number]: string[] } = {
    1: ['Completa tu información personal', 'Verifica que los datos sean correctos'],
    2: ['Define la fecha de inicio', 'Selecciona la duración del contrato'],
    3: ['Prepara los documentos necesarios', 'Asegúrate de que estén claros y legibles'],
    4: ['Lee el contrato cuidadosamente', 'Revisa todos los términos'],
    5: ['Confirma que entiendes los términos', 'Firma digitalmente cuando estés listo']
  }
  
  return actions[step] || []
}

/**
 * Generar respuesta inteligente del broker
 */
export function generateBrokerResponse(
  question: string,
  context: BrokerContext
): string {
  const intent = analyzeBrokerIntent(question, context)
  const lowerQuestion = question.toLowerCase()
  
  // Actualizar historial
  context.conversationHistory.push({
    question,
    intent: intent.intent,
    timestamp: new Date()
  })
  
  switch (intent.intent) {
    case 'greeting':
      return generateBrokerGreeting(context)
    
    case 'documents':
      return generateDocumentsResponse(context, lowerQuestion)
    
    case 'contract':
      return generateContractResponse(context, lowerQuestion)
    
    case 'pricing':
      return generatePricingResponse(context)
    
    case 'timeline':
      return generateTimelineResponse(context, lowerQuestion)
    
    case 'security':
      return generateSecurityResponse(context)
    
    case 'step_help':
      return generateStepHelpResponse(context)
    
    case 'modification':
      return generateModificationResponse(context)
    
    case 'cancellation':
      return generateCancellationResponse(context)
    
    case 'payment_methods':
      return generatePaymentMethodsResponse(context)
    
    case 'property_questions':
      return generatePropertyQuestionsResponse(context, lowerQuestion)
    
    case 'legal':
      return generateLegalResponse(context, lowerQuestion)
    
    case 'emergency':
      return generateEmergencyResponse(context)
    
    default:
      return generateContextualFallback(context, lowerQuestion)
  }
}

function generateBrokerGreeting(context: BrokerContext): string {
  const isReturning = context.conversationHistory.length > 1
  
  if (isReturning) {
    return `¡Hola de nuevo! 👋 Veo que estás en el paso ${context.currentStep} de ${context.totalSteps}: **${context.stepName}**.

¿En qué puedo ayudarte específicamente con este paso?`
  }
  
  return `¡Hola! 👋 Soy tu broker virtual y estoy aquí para ayudarte durante todo el proceso de alquiler de **${context.property?.title || 'esta propiedad'}**.

Actualmente estás en el **paso ${context.currentStep} de ${context.totalSteps}**: **${context.stepName}**.

**Puedo ayudarte con:**
• 📄 Documentos necesarios
• 📋 Explicación del contrato
• 💰 Desglose de costos
• ⏱️ Tiempos del proceso
• 🛡️ Garantías y protecciones
• ❓ Cualquier duda sobre el proceso

¿En qué puedo ayudarte?`
}

function generateDocumentsResponse(context: BrokerContext, question: string): string {
  const stepSpecific = context.currentStep === 3
  
  let response = `**Documentos requeridos para el alquiler:**\n\n`
  
  if (stepSpecific) {
    response += `Estás en el paso de documentación. Necesitas:\n\n`
  }
  
  response += `1. **Documento de identidad** (DNI, pasaporte o licencia de conducir)
   • Debe estar vigente y legible
   • Fotos claras o escaneo de buena calidad
   • Ambos lados si aplica
   
2. **Selfie con cédula en mano**
   • Foto de tu rostro sosteniendo tu documento de identidad
   • Para verificación de identidad
   • Debe verse claramente tu cara y el documento
   
3. **Comprobante de ingresos** (últimos 3 meses)
   • Recibos de sueldo (si eres empleado)
   • Extractos bancarios (si eres independiente)
   • Declaración jurada (si eres freelancer)
   • Contratos de trabajo o facturas
   
4. **Estado de cuenta bancario** (últimos 2 meses)
   • Para verificar solvencia económica
   • Debe mostrar movimientos regulares
   • Puede ser de cualquier banco
   
**💡 Consejos importantes:**
• Asegúrate de que los documentos estén en formato **PDF o imagen clara**
• Verifica que la información sea **legible** y completa
• Si algún documento está en otro idioma, considera traducirlo
• Los documentos se revisan en 24-48 horas
   
**❓ Casos especiales:**
• **Estudiante:** Puedes usar comprobante de beca o apoyo familiar
• **Freelancer:** Declaración jurada + extractos bancarios
• **Extranjero:** Pasaporte + visa o permiso de residencia
• **Sin ingresos fijos:** Garante o fiador puede ser necesario`
  
  if (question.includes('específico') || question.includes('especifico') || question.includes('cuál') || question.includes('cual')) {
    response += `\n\n¿Qué documento específico te genera dudas? Puedo darte más detalles.`
  }
  
  return response
}

function generateContractResponse(context: BrokerContext, question: string): string {
  const monthlyRent = context.formData.monthlyRent || context.property?.price || 0
  const deposit = context.formData.deposit || Math.round(monthlyRent * 1.5)
  const duration = context.formData.duration || '12'
  const startDate = context.formData.startDate || 'A definir'
  
  let response = `**Contrato de alquiler - Términos principales:**\n\n`
  
  response += `**📋 Información del contrato:**
• **Duración:** ${duration} meses
• **Renta mensual:** $${monthlyRent.toLocaleString()}/mes
• **Depósito:** $${deposit.toLocaleString()} (reembolsable al finalizar)
• **Fecha de inicio:** ${startDate}
• **Total del contrato:** $${(monthlyRent * parseInt(duration)).toLocaleString()}\n\n`
  
  response += `**✅ Derechos del inquilino:**
• Recibir la propiedad en buen estado
• Privacidad y tranquilidad en el hogar
• Mantenimiento de servicios básicos por parte del propietario
• Rescisión con aviso previo (generalmente 30 días)
• Devolución del depósito al finalizar (si no hay daños)\n\n`
  
  response += `**📝 Obligaciones del inquilino:**
• Pagar la renta puntualmente cada mes (por adelantado)
• Mantener la propiedad en buen estado
• No realizar modificaciones sin autorización
• No subarrendar sin permiso del propietario
• Comunicar problemas o daños oportunamente\n\n`
  
  response += `**🏠 Obligaciones del propietario:**
• Entregar la propiedad en condiciones habitables
• Realizar mantenimientos necesarios
• Respetar la privacidad del inquilino
• Devolver el depósito según lo acordado\n\n`
  
  response += `**⚖️ Cláusulas importantes:**
• **Rescisión anticipada:** Con aviso de 30 días, sin penalización (según términos)
• **Aumentos:** Según índice acordado o términos del contrato
• **Renovación:** Automática o manual según lo acordado
• **Daños:** Responsabilidad del inquilino por daños causados
• **Mantenimiento:** Responsabilidades claramente definidas\n\n`
  
  if (question.includes('cláusula') || question.includes('clausula') || question.includes('término') || question.includes('termino')) {
    response += `¿Hay alguna cláusula específica que te gustaría que explique con más detalle? Puedo ayudarte a entender cualquier término del contrato.`
  } else if (question.includes('firmar') || question.includes('firma')) {
    response += `**Sobre la firma:**
• El contrato se firma **digitalmente** en RIAL
• Es **legalmente vinculante** una vez firmado
• Recibirás una copia en PDF por email
• Puedes descargarlo desde tu cuenta en cualquier momento
• La firma digital tiene la misma validez legal que una firma física\n\n`
    response += `¿Estás listo para firmar o tienes alguna pregunta antes?`
  } else {
    response += `¿Tienes alguna pregunta específica sobre el contrato? Puedo explicarte cualquier término o cláusula.`
  }
  
  return response
}

function generatePricingResponse(context: BrokerContext): string {
  const monthlyRent = context.formData.monthlyRent || context.property?.price || 0
  const deposit = context.formData.deposit || Math.round(monthlyRent * 1.5)
  const duration = context.formData.duration || '12'
  
  const totalContract = monthlyRent * parseInt(duration)
  const totalUpfront = deposit + monthlyRent // Primer mes + depósito
  
  return `**💰 Desglose completo de costos:**\n\n**Costos iniciales (al firmar):**
• 💵 **Depósito:** $${deposit.toLocaleString()} (se devuelve al finalizar si no hay daños)
• 💰 **Primer mes de alquiler:** $${monthlyRent.toLocaleString()}
• 📊 **Total inicial:** $${totalUpfront.toLocaleString()}\n\n**Costos mensuales:**
• 🏠 **Alquiler:** $${monthlyRent.toLocaleString()}/mes (pagado por adelantado)
• 📅 **Frecuencia:** Mensual\n\n**Costos totales del contrato:**
• 📋 **Alquiler total (${duration} meses):** $${totalContract.toLocaleString()}
• 💵 **Depósito:** $${deposit.toLocaleString()} (reembolsable)
• 📊 **Total comprometido:** $${(totalContract + deposit).toLocaleString()}\n\n**💡 Información importante:**
• El depósito se **retiene como garantía** durante todo el contrato
• Se **devuelve íntegramente** al finalizar si la propiedad está en buen estado
• La renta se paga **mensualmente por adelantado**
• **No hay comisiones** adicionales de RIAL App
• Los servicios (luz, gas, agua, internet) generalmente corren por cuenta del inquilino (verifica en el contrato)\n\n**❓ ¿Tienes preguntas sobre:**
• Métodos de pago aceptados
• Qué hacer si no puedes pagar a tiempo
• Cómo se maneja el depósito
• Aumentos de precio durante el contrato\n\n¿Qué te gustaría saber?`
}

function generateTimelineResponse(context: BrokerContext, question: string): string {
  const stepTimes: { [key: number]: string } = {
    1: '5-10 minutos',
    2: '5 minutos',
    3: '10-15 minutos (más tiempo de revisión: 24-48 horas)',
    4: '10-15 minutos',
    5: '2-5 minutos'
  }
  
  const currentStepTime = stepTimes[context.currentStep] || '5-10 minutos'
  const remainingSteps = context.totalSteps - context.currentStep
  
  let response = `**⏱️ Tiempo estimado del proceso:**\n\n`
  
  if (question.includes('paso actual') || question.includes('este paso')) {
    response += `**Paso actual (${context.stepName}):** ${currentStepTime}\n\n`
  }
  
  response += `**Tiempos por paso:**
1. **Información personal:** 5-10 minutos
2. **Detalles del alquiler:** 5 minutos
3. **Documentación:** 10-15 minutos (revisión: 24-48 horas)
4. **Revisión de contrato:** 10-15 minutos
5. **Firma digital:** 2-5 minutos\n\n`
  
  response += `**📅 Tiempo total estimado:**\n`
  response += `• **Completar formularios:** ~30-45 minutos\n`
  response += `• **Revisión de documentos:** 24-48 horas (hábiles)\n`
  response += `• **Aprobación:** 1-3 días hábiles\n`
  response += `• **Firma y entrega:** Inmediata después de aprobación\n\n`
  response += `**⏰ Total:** 2-5 días hábiles desde que completas todos los pasos\n\n`
  
  if (remainingSteps > 0) {
    response += `**Tu progreso:**\n`
    response += `• ✅ Completados: ${context.currentStep - 1} pasos\n`
    response += `• ⏳ Pendientes: ${remainingSteps} pasos\n`
    response += `• 📍 Actual: Paso ${context.currentStep} - ${context.stepName}\n\n`
  }
  
  response += `**💡 Ventajas del proceso digital:**
• Más rápido que procesos tradicionales (que pueden tardar semanas)
• Todo se hace online, sin necesidad de visitas presenciales
• Documentos revisados automáticamente cuando es posible
• Notificaciones en tiempo real del progreso\n\n`
  
  if (question.includes('r[áa]pido') || question.includes('acelerar') || question.includes('urgente')) {
    response += `**Para acelerar el proceso:**
• Completa todos los pasos lo antes posible
• Sube documentos claros y legibles
• Responde rápidamente si hay solicitudes de información adicional
• Mantén tu perfil actualizado\n\n`
  }
  
  response += `¿Hay algo específico sobre los tiempos que te preocupe?`
  
  return response
}

function generateSecurityResponse(context: BrokerContext): string {
  return `**🛡️ Garantías y protecciones en RIAL:**\n\n**✅ Lo que RIAL garantiza:**
• Propiedades **verificadas y documentadas**
• Contratos **legales y protegidos**
• Sistema de **resolución de disputas** imparcial
• **Soporte** durante todo el proceso y después
• **Transparencia** en todos los términos\n\n**💰 Tu depósito está protegido:**
• Se mantiene en **custodia segura** durante todo el contrato
• Se devuelve **íntegramente** al finalizar (si no hay daños)
• Proceso **transparente** de inspección al finalizar
• **Documentación** de cualquier deducción (si aplica)
• **Disputas** se resuelven de forma justa\n\n**🔒 Seguridad de datos:**
• Información personal **encriptada**
• Documentos almacenados de forma **segura**
• Cumplimiento con **leyes de protección de datos**
• Solo se comparte información necesaria con el propietario\n\n**🛡️ Seguro de alquiler (opcional):**
• Puedes contratar un seguro para proteger tus pertenencias
• No es obligatorio pero es **altamente recomendable**
• Cubre daños a tus pertenencias
• Algunos propietarios lo requieren\n\n**⚖️ Resolución de problemas:**
• Sistema de **mediación** para disputas
• Soporte de RIAL en caso de problemas
• Proceso claro de **reporte de problemas**
• Protección para ambas partes\n\n¿Quieres más información sobre alguna garantía específica o tienes alguna preocupación de seguridad?`
}

function generateStepHelpResponse(context: BrokerContext): string {
  const stepGuides: { [key: number]: string } = {
    1: `**Paso 1: Información Personal**\n\nEn este paso necesitas:\n• Nombre completo\n• Email y teléfono\n• Dirección actual\n• Información de contacto de emergencia\n\n💡 **Consejos:**\n• Asegúrate de que todos los datos sean correctos\n• El email debe ser uno que revises frecuentemente\n• La información será verificada\n\n¿Hay algún campo específico que te genera dudas?`,
    
    2: `**Paso 2: Detalles del Alquiler**\n\nAquí defines:\n• Fecha de inicio deseada\n• Duración del contrato (meses)\n• Cualquier preferencia especial\n\n💡 **Consejos:**\n• La fecha de inicio debe ser realista\n• Considera tu situación actual\n• Puedes negociar con el propietario si es necesario\n\n¿Necesitas ayuda para decidir la fecha o duración?`,
    
    3: `**Paso 3: Documentación**\n\nNecesitas subir:\n• Documento de identidad\n• Selfie con cédula en mano (foto tuya sosteniendo tu documento)\n• Comprobante de ingresos\n• Estado de cuenta bancario\n\n💡 **Consejos:**\n• Asegúrate de que las fotos sean claras\n• Los documentos deben estar vigentes\n• En la selfie deben verse tu rostro y el documento\n• Si eres estudiante o freelancer, tengo información específica\n\n¿Tienes dudas sobre algún documento específico?`,
    
    4: `**Paso 4: Revisión de Contrato**\n\nDebes:\n• Leer cuidadosamente todos los términos\n• Verificar que los datos sean correctos\n• Asegurarte de entender todas las cláusulas\n\n💡 **Consejos:**\n• Tómate tu tiempo para leer\n• Puedo explicarte cualquier término\n• Si algo no está claro, pregunta antes de firmar\n\n¿Hay alguna cláusula que quieras que explique?`,
    
    5: `**Paso 5: Firma Digital**\n\nEn este paso:\n• Revisas una última vez el contrato\n• Firmas digitalmente\n• El contrato se vuelve legalmente vinculante\n\n💡 **Consejos:**\n• Asegúrate de estar completamente de acuerdo\n• Una vez firmado, es un compromiso legal\n• Recibirás una copia por email\n\n¿Estás listo para firmar o tienes alguna última pregunta?`
  }
  
  const guide = stepGuides[context.currentStep]
  if (guide) {
    return guide
  }
  
  return `Estás en el paso ${context.currentStep} de ${context.totalSteps}: **${context.stepName}**.

**Próximos pasos:**
${Array.from({ length: context.totalSteps - context.currentStep + 1 }, (_, i) => {
    const stepNum = context.currentStep + i
    return `${stepNum}. Paso ${stepNum}`
  }).join('\n')}

¿Tienes alguna pregunta específica sobre este paso o los siguientes?`
}

function generateModificationResponse(context: BrokerContext): string {
  return `**✏️ Modificar información:**\n\n**Puedes modificar:**
• Información personal (paso 1)
• Detalles del alquiler (paso 2)
• Documentos (paso 3) - puedes reemplazarlos\n\n**Para modificar:**
• Haz clic en el paso que quieres cambiar
• Edita la información necesaria
• Guarda los cambios\n\n**⚠️ Importante:**
• Si ya enviaste documentos, el propietario puede ver los cambios
• Si ya firmaste el contrato, algunos cambios pueden requerir una nueva firma
• Los cambios en precio o duración pueden requerir aprobación del propietario\n\n¿Qué información específica quieres modificar?`
}

function generateCancellationResponse(context: BrokerContext): string {
  const canCancel = context.currentStep < 5
  
  if (canCancel) {
    return `**❌ Cancelar el proceso:**\n\n**Puedes cancelar en cualquier momento** antes de firmar el contrato.\n\n**Si cancelas:**
• No hay penalización
• Puedes volver a intentar más tarde
• Tu información se guarda (puedes retomarlo)
• El propietario será notificado\n\n**⚠️ Después de firmar:**
• El contrato es legalmente vinculante
• La cancelación puede tener consecuencias según los términos
• Consulta la sección de rescisión en el contrato\n\n¿Estás seguro de que quieres cancelar? Puedo ayudarte con cualquier duda antes de que tomes una decisión.`
  }
  
  return `**⚠️ Cancelación después de la firma:**\n\nUna vez que has firmado el contrato, es **legalmente vinculante**. Sin embargo:\n\n**Opciones:**
• **Rescisión anticipada:** Según los términos del contrato (generalmente con aviso de 30 días)
• **Negociación:** Puedes hablar con el propietario sobre una solución
• **Mediación:** RIAL puede ayudar a mediar si hay problemas\n\n**Consecuencias posibles:**
• Pérdida del depósito (según términos)
• Penalizaciones según el contrato
• Impacto en tu historial en RIAL\n\n💡 **Recomendación:** Si tienes dudas, es mejor resolverlas antes de firmar. ¿Hay algo específico que te preocupa? Puedo ayudarte a entender mejor los términos.`
}

function generatePaymentMethodsResponse(context: BrokerContext): string {
  return `**💳 Métodos de pago aceptados:**\n\n**Para el depósito y primer mes:**
• 💳 **Tarjeta de crédito/débito** (Visa, Mastercard, Amex)
• 🏦 **Transferencia bancaria** (directa y segura)
• 📱 **PayPal** (en algunos casos)
• 💰 **Efectivo** (solo en casos especiales, coordinado con propietario)\n\n**Para pagos mensuales:**
• 💳 **Tarjeta guardada** (pago automático opcional)
• 🏦 **Transferencia bancaria** mensual
• 📅 **Recordatorios** automáticos antes de cada pago\n\n**💡 Información importante:**
• Los pagos son **seguros y encriptados**
• Recibirás **recibos digitales** automáticamente
• Puedes ver tu **historial de pagos** en cualquier momento
• Los pagos se procesan de forma **inmediata**\n\n**❓ Preguntas frecuentes:**
• **¿Puedo pagar con tarjeta extranjera?** Sí, se aceptan tarjetas internacionales
• **¿Hay comisiones?** No, RIAL no cobra comisiones adicionales
• **¿Qué pasa si no puedo pagar a tiempo?** Contacta al propietario y a RIAL lo antes posible\n\n¿Tienes alguna pregunta específica sobre los métodos de pago?`
}

function generatePropertyQuestionsResponse(context: BrokerContext, question: string): string {
  const prop = context.property
  
  if (!prop) {
    return 'No tengo información detallada sobre la propiedad en este momento. ¿Hay algo específico que te gustaría saber?'
  }
  
  let response = `**Sobre la propiedad "${prop.title || 'esta propiedad'}":**\n\n`
  
  if (question.includes('visita') || question.includes('ver') || question.includes('foto')) {
    response += `**Para ver la propiedad:**
• Puedes ver todas las fotos en el detalle de la propiedad
• Puedes solicitar una **visita presencial** contactando al propietario
• Algunos propietarios ofrecen **videollamadas virtuales**
• Puedes usar el mapa interactivo para ver la ubicación exacta\n\n`
  }
  
  if (question.includes('característica') || question.includes('caracteristica') || question.includes('tiene') || question.includes('incluye')) {
    response += `**Características:**\n`
    response += `• Precio: $${(prop.price || 0).toLocaleString()}/mes\n`
    response += `• Ubicación: ${prop.location || 'No especificada'}\n`
    response += `• Puedes ver todas las características en el detalle completo de la propiedad\n\n`
  }
  
  response += `**💡 Durante el proceso de alquiler:**
• Puedes hacer preguntas al propietario directamente
• Puedes solicitar información adicional
• Puedes pedir ver más fotos o detalles específicos\n\n`
  
  response += `¿Qué aspecto específico de la propiedad te gustaría conocer mejor?`
  
  return response
}

function generateLegalResponse(context: BrokerContext, question: string): string {
  return `**⚖️ Aspectos legales del alquiler:**\n\n**📋 Contrato legal:**
• El contrato de RIAL es **legalmente vinculante**
• Cumple con las leyes locales de alquileres
• Protege los derechos de ambas partes
• Es ejecutable en caso de disputas\n\n**✅ Tus derechos legales:**
• Derecho a un hogar en **buen estado**
• Derecho a **privacidad**
• Derecho a **rescisión** con aviso previo
• Derecho a **devolución del depósito** (si no hay daños)
• Protección contra **desalojos injustificados**\n\n**📝 Tus obligaciones legales:**
• Pagar la renta **puntualmente**
• Mantener la propiedad en **buen estado**
• No realizar **modificaciones** sin autorización
• Comunicar **problemas** oportunamente\n\n**🛡️ Protecciones legales:**
• **Mediación** para resolver disputas
• **Documentación** de todo el proceso
• **Soporte legal** de RIAL si es necesario\n\n**❓ Preguntas legales comunes:**
• **¿Puedo subarrendar?** Solo con autorización del propietario
• **¿Puedo tener mascotas?** Depende del contrato y políticas del propietario
• **¿Qué pasa si rompo algo?** Responsabilidad según el contrato y tipo de daño
• **¿Puedo terminar antes?** Sí, con aviso previo según términos del contrato\n\n¿Tienes alguna pregunta legal específica? Puedo ayudarte a entender mejor tus derechos y obligaciones.`
}

function generateEmergencyResponse(context: BrokerContext): string {
  return `**🚨 Situación urgente:**\n\n**Si es una emergencia real:**
• Contacta al propietario **inmediatamente**
• Si es un problema grave con la propiedad, llama a servicios de emergencia si es necesario
• Reporta el problema en RIAL lo antes posible\n\n**Soporte de RIAL:**
• Email: soporte@rial.com (respuesta en 24 horas)
• Chat de soporte en la app (respuesta más rápida)
• Teléfono de emergencias (si está disponible en tu región)\n\n**Problemas comunes urgentes:**
• **Fugas de agua:** Contacta al propietario y servicios de emergencia si es grave
• **Problemas eléctricos:** Apaga la electricidad y contacta al propietario
• **Problemas de seguridad:** Contacta autoridades si es necesario\n\n**⚠️ Durante el proceso de alquiler:**
• Si hay un problema técnico con el proceso, puedo ayudarte
• Si no puedes completar un paso, podemos encontrar una solución
• Si hay un error en el sistema, reporta y te ayudaremos\n\n¿Cuál es la situación urgente específica? Puedo ayudarte a resolverla.`
}

function generateContextualFallback(context: BrokerContext, question: string): string {
  // Respuesta inteligente basada en el contexto del paso actual
  const stepContexts: { [key: number]: string } = {
    1: 'Estás completando tu información personal. ¿Hay algún campo que te genera dudas?',
    2: 'Estás definiendo los detalles del alquiler. ¿Necesitas ayuda con la fecha de inicio o duración?',
    3: 'Estás en el paso de documentación. ¿Tienes preguntas sobre los documentos necesarios?',
    4: 'Estás revisando el contrato. ¿Hay alguna cláusula que quieras que explique?',
    5: 'Estás a punto de firmar. ¿Tienes alguna última pregunta antes de firmar?'
  }
  
  const stepContext = stepContexts[context.currentStep]
  
  if (stepContext) {
    return `${stepContext}\n\n**También puedo ayudarte con:**
• Documentos necesarios
• Explicación del contrato
• Desglose de costos
• Tiempos del proceso
• Garantías y protecciones\n\n¿En qué puedo ayudarte específicamente?`
  }
  
  return `No estoy seguro de entender exactamente qué necesitas. Estás en el paso ${context.currentStep}: **${context.stepName}**.

**Puedo ayudarte con:**
• Información sobre este paso específico
• Documentos y requisitos
• Explicación del contrato
• Costos y pagos
• Cualquier duda sobre el proceso

¿Podrías reformular tu pregunta o ser más específico?`
}
