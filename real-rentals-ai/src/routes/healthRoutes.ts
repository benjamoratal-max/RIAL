/**
 * Rutas de health check y métricas del sistema
 */

import express from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

/**
 * Health check básico
 */
router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const health = {
    status: 'ok',
    timestamp: now.toISOString(),
    date: today,
    today,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };

  res.json(health);
}));

/**
 * Health check completo (incluye verificación de BD)
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'unknown';
  let dbLatency = 0;

  try {
    // Verificar conexión a base de datos
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbStatus = 'connected';
  } catch (error: any) {
    dbStatus = 'error';
    logger.error('Error verificando base de datos', 'Health', error);
  }

  const health = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: {
        status: dbStatus,
        latency: dbLatency,
      },
    },
    system: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      nodeVersion: process.version,
      platform: process.platform,
    },
    responseTime: Date.now() - startTime,
  };

  const statusCode = dbStatus === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
}));

/**
 * Métricas básicas del sistema
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  // Solo permitir en desarrollo o con autenticación en producción
  if (process.env.NODE_ENV === 'production' && !req.headers.authorization) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      unit: 'MB',
    },
    cpu: {
      usage: process.cpuUsage(),
    },
    nodeVersion: process.version,
    platform: process.platform,
  };

  res.json(metrics);
}));

export default router;
