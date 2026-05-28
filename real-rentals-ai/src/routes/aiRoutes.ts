import express from 'express'
import prisma from '../lib/prisma'
import { authenticateToken, optionalAuthenticateToken, AuthRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = express.Router()

// Configuración de IA (desde variables de entorno)
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'openai',
  apiKey: process.env.AI_API_KEY,
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  ollamaBaseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
}

/**
 * Resumen IA para leads de broker (solo cuando Ollama está configurado)
 */
router.post('/broker/lead-summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' })

    const { leadId } = req.body as { leadId: number }
    const id = Number(leadId)
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'leadId inválido' })
    }

    const lead = await (prisma as any).lead.findUnique({
      where: { id },
      include: {
        activities: true,
        showings: true,
        property: { select: { id: true, title: true, location: true, price: true } },
        renter: { select: { id: true, name: true, email: true } },
      },
    })

    if (!lead) {
      return res.status(404).json({ error: 'Lead no encontrado' })
    }

    const isBrokerOwner = lead.brokerId === req.user.id
    const isAdmin = req.user.role === 'admin'
    if (!isBrokerOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para ver el resumen de este lead' })
    }

    if (AI_CONFIG.provider !== 'ollama') {
      return res.status(503).json({
        error: 'El resumen avanzado de leads requiere que AI_PROVIDER=ollama y que Ollama esté corriendo localmente',
        fallback: true,
      })
    }

    const systemPrompt = `
Eres un asistente especializado en leasing inmobiliario que ayuda a brokers a priorizar leads.
Tu objetivo es:
- Resumir en 3-5 bullets quién es el prospecto, qué busca y en qué etapa está.
- Resaltar señales de intención (showings, mensajes, velocidad de respuesta).
- Sugerir próximos pasos concretos para el broker (máx. 3).
- Mantener el tono profesional, conciso y accionable.
Responde siempre en español neutro. No inventes datos que no estén en el contexto.
`

    const compactLead = {
      id: lead.id,
      stage: lead.stage,
      urgency: lead.urgency,
      intentScore: lead.intentScore,
      probability: lead.probability,
      nextStep: lead.nextStep,
      nextStepDueAt: lead.nextStepDueAt,
      renter: lead.renter,
      property: lead.property,
      showings: lead.showings,
      activities: lead.activities?.slice(0, 50),
    }

    const userPrompt = `
Genera un resumen ejecutivo de este lead de leasing inmobiliario y una recomendación de próximos pasos.

Datos del lead (JSON):
${JSON.stringify(compactLead, null, 2)}
`

    const response = await fetch(`${AI_CONFIG.ollamaBaseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_CONFIG.model || 'llama3.2:3b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 400,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${errorText || 'Unknown error'}`)
    }

    const data = await response.json()
    const answer = data.message?.content || ''

    if (!answer) {
      return res.status(503).json({
        error: 'Ollama no devolvió respuesta para el resumen de lead',
        fallback: true,
      })
    }

    res.json({ leadId: id, summary: answer })
  } catch (error: any) {
    logger.error('Error generando resumen de lead para broker', 'AI', error as Error)
    res.status(500).json({ error: 'Error al generar resumen de lead', message: error.message, fallback: true })
  }
})

/**
 * Resumen IA del pipeline del broker (visión día/semana con prioridades y acciones)
 */
router.get('/broker/pipeline-summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' })

    if (req.user.role !== 'broker' && req.user.role !== 'broker_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo brokers o admins pueden acceder a este resumen' })
    }

    if (AI_CONFIG.provider !== 'ollama') {
      return res.status(503).json({
        error: 'El resumen avanzado del pipeline requiere que AI_PROVIDER=ollama y que Ollama esté corriendo localmente',
        fallback: true,
      })
    }

    const brokerId = req.user.role === 'admin' ? undefined : req.user.id
    const where: any = {}
    if (brokerId) where.brokerId = brokerId

    const leads = await (prisma as any).lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        showings: true,
        property: { select: { id: true, title: true, location: true, price: true } },
        renter: { select: { id: true, name: true, email: true } },
      },
    })

    const compactPipeline = leads.map((l: any) => ({
      id: l.id,
      stage: l.stage,
      urgency: l.urgency,
      intentScore: l.intentScore,
      probability: l.probability,
      nextStep: l.nextStep,
      nextStepDueAt: l.nextStepDueAt,
      createdAt: l.createdAt,
      lastInteractionAt: l.lastInteractionAt,
      renter: l.renter,
      property: l.property,
      showings: l.showings,
    }))

    const systemPrompt = `
Eres un asistente senior de revenue operations para un equipo de brokers de leasing inmobiliario.
Tu trabajo es ayudar a priorizar la cola de leads y a enfocarse en lo que mueve la aguja.

Instrucciones:
- Analiza el pipeline del broker (leads, etapas, showings, scoring).
- Identifica:
  - Cuáles son los 5-10 leads que requieren acción inmediata (por urgencia, probabilidad y próximos pasos vencidos).
  - Cuellos de botella en el funnel (etapas donde se acumulan leads sin movimiento).
  - Oportunidades de mejora de proceso (por ejemplo: muchos leads en 'documents_received' sin pasar a 'application_ready').
- Entrega tu respuesta en tres secciones claras:
  1) Resumen del día (1-3 frases).
  2) Top prioridades (lista numerada con máximo 10 bullets, cada uno con ID de lead y acción sugerida).
  3) Insights de funnel y recomendaciones de proceso (3-5 bullets).

Tono:
- Profesional, concreto y accionable.
- Siempre en español neutro.
- No inventes datos que no estén en el JSON.
`

    const userPrompt = `
Analiza el siguiente pipeline de leads y genera un resumen ejecutivo y plan de acción.

Pipeline (JSON):
${JSON.stringify(compactPipeline, null, 2)}
`

    const response = await fetch(`${AI_CONFIG.ollamaBaseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_CONFIG.model || 'llama3.2:3b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: 0.35,
          num_predict: 600,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${errorText || 'Unknown error'}`)
    }

    const data = await response.json()
    const summary = data.message?.content || ''

    if (!summary) {
      return res.status(503).json({
        error: 'Ollama no devolvió respuesta para el resumen de pipeline',
        fallback: true,
      })
    }

    res.json({ summary })
  } catch (error: any) {
    logger.error('Error generando resumen de pipeline de broker', 'AI', error as Error)
    res.status(500).json({ error: 'Error al generar resumen de pipeline', message: error.message, fallback: true })
  }
})

/**
 * Generar respuesta usando IA generativa
 */
router.post('/generate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { systemPrompt, userPrompt, provider, model, conversationHistory } = req.body

    // Usar el proveedor especificado o el configurado
    const aiProvider = provider || AI_CONFIG.provider
    const aiModel = model || AI_CONFIG.model

    let answer = ''

    if (aiProvider === 'ollama') {
      // Ollama no requiere API key, funciona localmente
      // Construir mensajes con historial de conversación
      const messages: Array<{ role: string; content: string }> = []
      
      // Agregar prompt del sistema
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      
      // Agregar historial de conversación si existe
      if (conversationHistory && Array.isArray(conversationHistory)) {
        conversationHistory.forEach((msg: any) => {
          if (msg.role && msg.content) {
            messages.push({ role: msg.role, content: msg.content })
          }
        })
      }
      
      // Agregar el mensaje actual del usuario
      messages.push({ role: 'user', content: userPrompt })

      // Llamar a Ollama API local
      const response = await fetch(`${AI_CONFIG.ollamaBaseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: aiModel || 'llama3.2:3b',
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
        throw new Error(`Ollama API error: ${errorText || 'Unknown error'}`)
      }

      const data = await response.json()
      answer = data.message?.content || ''
      
      // Si Ollama no está disponible, retornar error pero no fallback
      if (!answer) {
        return res.status(503).json({ 
          error: 'Ollama no está disponible. Asegúrate de que Ollama esté ejecutándose en ' + AI_CONFIG.ollamaBaseURL,
          fallback: true 
        })
      }
    } else if (aiProvider === 'openai') {
      if (!AI_CONFIG.apiKey) {
        return res.status(503).json({ 
          error: 'OpenAI API key no configurada',
          fallback: true 
        })
      }

      // Construir mensajes con historial
      const messages: Array<{ role: string; content: string }> = []
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      
      if (conversationHistory && Array.isArray(conversationHistory)) {
        conversationHistory.forEach((msg: any) => {
          if (msg.role && msg.content) {
            messages.push({ role: msg.role, content: msg.content })
          }
        })
      }
      
      messages.push({ role: 'user', content: userPrompt })

      // Llamar a OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: messages,
          temperature: 0.4,
          max_tokens: 1200
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      answer = data.choices[0]?.message?.content || ''
    } else if (aiProvider === 'anthropic') {
      if (!AI_CONFIG.apiKey) {
        return res.status(503).json({ 
          error: 'Anthropic API key no configurada',
          fallback: true 
        })
      }

      // Construir mensajes con historial para Anthropic
      const messages: Array<{ role: string; content: string }> = []
      
      if (conversationHistory && Array.isArray(conversationHistory)) {
        conversationHistory.forEach((msg: any) => {
          if (msg.role && msg.content && msg.role !== 'system') {
            messages.push({ role: msg.role, content: msg.content })
          }
        })
      }
      
      messages.push({ role: 'user', content: userPrompt })

      // Llamar a Anthropic API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': AI_CONFIG.apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: aiModel,
          max_tokens: 1200,
          system: systemPrompt || '',
          messages: messages
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      answer = data.content[0]?.text || ''
    } else {
      return res.status(400).json({ error: 'Proveedor de IA no soportado. Soporta: ollama, openai, anthropic' })
    }

    res.json({ answer, response: answer })
  } catch (error: any) {
    logger.error('Error generando respuesta de IA', 'AI', error as Error)
    res.status(500).json({ 
      error: 'Error al generar respuesta',
      message: error.message,
      fallback: true
    })
  }
})

/**
 * Guardar interacción para aprendizaje
 */
router.post('/interaction', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { question, answer, category, intent, metadata, knowledgeId } = req.body

    if (!question || !answer) {
      return res.status(400).json({ error: 'Pregunta y respuesta son requeridas' })
    }

    const interaction = await prisma.aIInteraction.create({
      data: {
        userId: req.user?.id,
        question,
        answer,
        category: category || 'general',
        intent: intent || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        knowledgeId: knowledgeId || null
      }
    })

    res.json({ 
      success: true, 
      id: interaction.id,
      knowledgeId: interaction.knowledgeId || interaction.id
    })
  } catch (error: any) {
    logger.error('Error guardando interacción', 'AI', error as Error)
    res.status(500).json({ error: 'Error guardando interacción', message: error.message })
  }
})

/**
 * Obtener base de conocimiento mejorada
 */
router.get('/knowledge-base', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { category, limit = 100 } = req.query

    const where: any = {
      helpful: true,
      OR: [
        { userId: req.user?.id },
        { userId: null } // Conocimiento global
      ]
    }

    if (category) {
      where.category = category
    }

    const interactions = await prisma.aIInteraction.findMany({
      where,
      orderBy: [
        { helpful: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit as string)
    })

    // Formatear para el frontend
    const knowledgeBase = interactions.map((interaction: any) => ({
      id: interaction.knowledgeId || interaction.id,
      question: interaction.question,
      answer: interaction.answer,
      category: interaction.category,
      context: interaction.metadata || '{}',
      usageCount: 1, // Se puede calcular desde otras métricas
      helpful: 1,
      notHelpful: 0,
      createdAt: interaction.createdAt,
      updatedAt: interaction.updatedAt,
      metadata: interaction.metadata ? JSON.parse(interaction.metadata) : {}
    }))

    res.json(knowledgeBase)
  } catch (error: any) {
    logger.error('Error obteniendo base de conocimiento', 'AI', error as Error)
    res.status(500).json({ error: 'Error obteniendo base de conocimiento', message: error.message })
  }
})

/**
 * Catálogo de propiedades para IA (paginado, datos reales)
 * Permite al frontend cargar el contexto completo para IA generativa y no generativa.
 */
router.get('/property-catalog', optionalAuthenticateToken, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 200)))
    const skip = (page - 1) * pageSize

    const where: any = {}
    const verifiedRaw = req.query.verified
    // Sin sesión: solo catálogo verificado (misma visibilidad que el buscador público).
    if (!req.user || verifiedRaw === 'true') {
      where.verified = true
    }

    const [total, rows] = await Promise.all([
      prisma.property.count({ where }),
      (prisma.property as any).findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          price: true,
          bedrooms: true,
          rooms: true,
          bathrooms: true,
          area: true,
          propertyType: true,
          verified: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          images: { select: { url: true } },
        },
      }),
    ])

    const items = rows.map((p: any) => ({
      ...p,
      images: Array.isArray(p.images) ? p.images.map((img: any) => img.url) : [],
      isAvailable: true,
    }))

    res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (error: any) {
    logger.error('Error obteniendo property catalog para IA', 'AI', error as Error)
    res.status(500).json({ error: 'Error obteniendo property catalog', message: error.message })
  }
})

/**
 * Feedback para mejorar respuestas
 */
router.post('/feedback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { knowledgeId, interactionId, helpful, improvedAnswer } = req.body

    if (knowledgeId) {
      // Actualizar todas las interacciones con este knowledgeId
      await prisma.aIInteraction.updateMany({
        where: {
          knowledgeId: knowledgeId,
          userId: req.user?.id
        },
        data: {
          helpful: helpful === true,
          improvedAnswer: improvedAnswer || null,
          updatedAt: new Date()
        }
      })
    } else if (interactionId) {
      // Actualizar interacción específica
      await prisma.aIInteraction.update({
        where: { id: interactionId },
        data: {
          helpful: helpful === true,
          improvedAnswer: improvedAnswer || null,
          updatedAt: new Date()
        }
      })
    } else {
      return res.status(400).json({ error: 'knowledgeId o interactionId requerido' })
    }

    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error guardando feedback', 'AI', error as Error)
    res.status(500).json({ error: 'Error guardando feedback', message: error.message })
  }
})

/**
 * Obtener estadísticas de aprendizaje
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    const total = await prisma.aIInteraction.count({
      where: { userId: userId || undefined }
    })

    const helpful = await prisma.aIInteraction.count({
      where: {
        userId: userId || undefined,
        helpful: true
      }
    })

    const notHelpful = await prisma.aIInteraction.count({
      where: {
        userId: userId || undefined,
        helpful: false
      }
    })

    // Categorías más comunes
    const categories = await prisma.aIInteraction.groupBy({
      by: ['category'],
      where: { userId: userId || undefined },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
      take: 5
    })

    // Intenciones más comunes
    const intents = await prisma.aIInteraction.groupBy({
      by: ['intent'],
      where: {
        userId: userId || undefined,
        intent: { not: null }
      },
      _count: { intent: true },
      orderBy: { _count: { intent: 'desc' } },
      take: 5
    })

    res.json({
      total,
      helpful,
      notHelpful,
      helpfulRate: total > 0 ? helpful / total : 0,
      categories: categories.map((c: any) => ({
        category: c.category,
        count: c._count.category
      })),
      intents: intents.map((i: any) => ({
        intent: i.intent,
        count: i._count.intent
      }))
    })
  } catch (error: any) {
    logger.error('Error obteniendo estadísticas', 'AI', error as Error)
    res.status(500).json({ error: 'Error obteniendo estadísticas', message: error.message })
  }
})

export default router
