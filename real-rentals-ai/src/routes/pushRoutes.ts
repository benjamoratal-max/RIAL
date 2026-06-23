/**
 * Rutas de Web Push: el frontend obtiene la clave pública VAPID y registra/desregistra
 * la suscripción del dispositivo (PWA) para recibir notificaciones del sistema.
 */
import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { getVapidPublicKey, isPushEnabled } from '../services/pushService';

const router = express.Router();

/** Clave pública VAPID + si el push está habilitado (público, sin auth). */
router.get('/vapid-public-key', (_req, res) => {
  res.json({ enabled: isPushEnabled(), publicKey: getVapidPublicKey() });
});

/** Registra (o actualiza) la suscripción push del dispositivo del usuario. */
router.post(
  '/subscribe',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Suscripción push inválida' });
    }

    const userAgent = req.headers['user-agent']?.toString().slice(0, 255) ?? null;

    // upsert por endpoint: si el dispositivo ya estaba suscrito, se reasigna al
    // usuario actual y se refrescan las claves.
    const sub = await (prisma as any).pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
      update: {
        userId: req.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
    });

    res.status(201).json({ ok: true, id: sub.id });
  })
);

/** Elimina la suscripción del dispositivo (al desactivar notificaciones o cerrar sesión). */
router.post(
  '/unsubscribe',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint requerido' });

    await (prisma as any).pushSubscription
      .deleteMany({ where: { endpoint, userId: req.user.id } })
      .catch(() => {});

    res.json({ ok: true });
  })
);

export default router;
