/**
 * Rutas para gestión de configuración versionada y auto-modificación
 */

import express from 'express'
import prisma from '../lib/prisma'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = express.Router()

/**
 * Crear nueva versión de configuración
 */
router.post('/version', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const {
    configType,
    configKey,
    configValue,
    previousValue,
    changeReason,
    validationStatus,
    testResults,
    safetyScore,
    changeSource,
    metadata
  } = req.body

  if (!configType || !configKey || configValue === undefined) {
    return res.status(400).json({ error: 'configType, configKey y configValue son requeridos' })
  }

  // Obtener versión actual para incrementar
  const currentVersion = await prisma.aIConfigVersion.findFirst({
    where: {
      configType,
      configKey,
      isActive: true
    },
    orderBy: {
      version: 'desc'
    }
  })

  const newVersion = (currentVersion?.version || 0) + 1

  const version = await prisma.aIConfigVersion.create({
    data: {
      version: newVersion,
      configType,
      configKey,
      configValue: JSON.stringify(configValue),
      previousValue: previousValue ? JSON.stringify(previousValue) : null,
      changeReason: changeReason || null,
      validationStatus: validationStatus || 'pending',
      testResults: testResults ? JSON.stringify(testResults) : null,
      safetyScore: safetyScore || null,
      changeSource: changeSource || 'auto',
      metadata: metadata ? JSON.stringify(metadata) : null,
      isActive: false // No activar hasta que se aplique
    }
  })

  res.json({
    success: true,
    versionId: version.id,
    version: version.version
  })
}))

/**
 * Aplicar versión de configuración
 */
router.post('/apply', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { versionId, configType, configKey, configValue } = req.body

  if (!versionId) {
    return res.status(400).json({ error: 'versionId es requerido' })
  }

  // Obtener versión
  const version = await prisma.aIConfigVersion.findUnique({
    where: { id: versionId }
  })

  if (!version) {
    return res.status(404).json({ error: 'Versión no encontrada' })
  }

  if (version.validationStatus !== 'validated') {
    return res.status(400).json({ error: 'Versión no validada' })
  }

  // Desactivar versiones anteriores
  await prisma.aIConfigVersion.updateMany({
    where: {
      configType: version.configType,
      configKey: version.configKey,
      isActive: true
    },
    data: {
      isActive: false
    }
  })

  // Activar nueva versión
  const updated = await prisma.aIConfigVersion.update({
    where: { id: versionId },
    data: {
      isActive: true,
      appliedAt: new Date()
    }
  })

  res.json({
    success: true,
    versionId: updated.id,
    configType: updated.configType,
    configKey: updated.configKey,
    appliedAt: updated.appliedAt
  })
}))

/**
 * Rollback a versión anterior
 */
router.post('/rollback', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { versionId } = req.body

  if (!versionId) {
    return res.status(400).json({ error: 'versionId es requerido' })
  }

  const version = await prisma.aIConfigVersion.findUnique({
    where: { id: versionId }
  })

  if (!version) {
    return res.status(404).json({ error: 'Versión no encontrada' })
  }

  // Buscar versión anterior activa
  const previousVersion = await prisma.aIConfigVersion.findFirst({
    where: {
      configType: version.configType,
      configKey: version.configKey,
      version: { lt: version.version },
      isActive: false
    },
    orderBy: {
      version: 'desc'
    }
  })

  // Desactivar versión actual
  await prisma.aIConfigVersion.update({
    where: { id: versionId },
    data: {
      isActive: false,
      rolledBackAt: new Date()
    }
  })

  // Reactivar versión anterior si existe
  if (previousVersion) {
    await prisma.aIConfigVersion.update({
      where: { id: previousVersion.id },
      data: {
        isActive: true
      }
    })

    res.json({
      success: true,
      rolledBackTo: previousVersion.id,
      previousVersion: previousVersion.version
    })
  } else {
    res.json({
      success: true,
      message: 'Versión desactivada (no hay versión anterior)'
    })
  }
}))

/**
 * Obtener configuración activa
 */
router.get('/active/:configType/:configKey', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { configType, configKey } = req.params

  const version = await prisma.aIConfigVersion.findFirst({
    where: {
      configType,
      configKey,
      isActive: true
    },
    orderBy: {
      version: 'desc'
    }
  })

  if (!version) {
    return res.status(404).json({ error: 'Configuración activa no encontrada' })
  }

  res.json({
    id: version.id,
    version: version.version,
    configType: version.configType,
    configKey: version.configKey,
    configValue: JSON.parse(version.configValue),
    previousValue: version.previousValue ? JSON.parse(version.previousValue) : null,
    changeReason: version.changeReason,
    safetyScore: version.safetyScore,
    appliedAt: version.appliedAt,
    createdAt: version.createdAt
  })
}))

/**
 * Obtener historial de versiones
 */
router.get('/history/:configType/:configKey', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { configType, configKey } = req.params
  const limit = parseInt(req.query.limit as string) || 20

  const versions = await prisma.aIConfigVersion.findMany({
    where: {
      configType,
      configKey
    },
    orderBy: {
      version: 'desc'
    },
    take: limit
  })

  res.json(
    versions.map((v) => ({
      id: v.id,
      version: v.version,
      configValue: JSON.parse(v.configValue),
      previousValue: v.previousValue ? JSON.parse(v.previousValue) : null,
      changeReason: v.changeReason,
      validationStatus: v.validationStatus,
      safetyScore: v.safetyScore,
      isActive: v.isActive,
      appliedAt: v.appliedAt,
      rolledBackAt: v.rolledBackAt,
      createdAt: v.createdAt
    }))
  )
}))

/**
 * Crear o actualizar regla automática
 */
router.post('/rule', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const {
    ruleName,
    pattern,
    response,
    confidence,
    isAutoGenerated,
    generatedFrom,
    metadata
  } = req.body

  if (!ruleName || !pattern || !response) {
    return res.status(400).json({ error: 'ruleName, pattern y response son requeridos' })
  }

  // Verificar si ya existe una regla con el mismo nombre
  const existing = await prisma.aIRule.findFirst({
    where: { ruleName }
  })

  let rule
  if (existing) {
    // Actualizar regla existente
    rule = await prisma.aIRule.update({
      where: { id: existing.id },
      data: {
        pattern,
        response,
        confidence: confidence ?? existing.confidence,
        isAutoGenerated: isAutoGenerated ?? existing.isAutoGenerated,
        generatedFrom: generatedFrom ?? existing.generatedFrom,
        metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
        updatedAt: new Date()
      }
    })
  } else {
    // Crear nueva regla
    rule = await prisma.aIRule.create({
      data: {
        ruleName,
        pattern,
        response,
        confidence: confidence ?? 0.5,
        isAutoGenerated: isAutoGenerated ?? false,
        generatedFrom: generatedFrom ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    })
  }

  res.json({
    success: true,
    rule: {
      id: rule.id,
      ruleName: rule.ruleName,
      pattern: rule.pattern,
      response: rule.response,
      confidence: rule.confidence,
      isActive: rule.isActive,
      isAutoGenerated: rule.isAutoGenerated
    }
  })
}))

/**
 * Obtener reglas activas
 */
router.get('/rules', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const isActive = req.query.isActive !== 'false'
  const isAutoGenerated = req.query.isAutoGenerated === 'true'

  const where: any = {}
  if (isActive !== undefined) {
    where.isActive = isActive
  }
  if (isAutoGenerated) {
    where.isAutoGenerated = true
  }

  const rules = await prisma.aIRule.findMany({
    where,
    orderBy: {
      successRate: 'desc'
    }
  })

  res.json(
    rules.map((r) => ({
      id: r.id,
      ruleName: r.ruleName,
      pattern: r.pattern,
      response: r.response,
      confidence: r.confidence,
      usageCount: r.usageCount,
      successRate: r.successRate,
      isActive: r.isActive,
      isAutoGenerated: r.isAutoGenerated,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  )
}))

/**
 * Actualizar estadísticas de regla (uso y éxito)
 */
router.patch('/rule/:id/stats', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  const { success } = req.body

  const rule = await prisma.aIRule.findUnique({
    where: { id }
  })

  if (!rule) {
    return res.status(404).json({ error: 'Regla no encontrada' })
  }

  // Calcular nueva tasa de éxito
  const newUsageCount = rule.usageCount + 1
  const currentSuccessCount = rule.successRate * rule.usageCount
  const newSuccessCount = success ? currentSuccessCount + 1 : currentSuccessCount
  const newSuccessRate = newSuccessCount / newUsageCount

  const updated = await prisma.aIRule.update({
    where: { id },
    data: {
      usageCount: newUsageCount,
      successRate: newSuccessRate,
      updatedAt: new Date()
    }
  })

  res.json({
    success: true,
    rule: {
      id: updated.id,
      usageCount: updated.usageCount,
      successRate: updated.successRate
    }
  })
}))

export default router
