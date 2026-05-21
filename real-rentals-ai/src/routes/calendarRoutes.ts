import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import config from '../config/env';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  exchangeCodeForTokens,
  getAuthUrl,
  isGoogleCalendarConfigured,
} from '../services/calendarService';
import { schedulePropertyVisit } from '../services/visitSchedulingService';

const router = express.Router();

const BROKER_ROLES = new Set(['broker', 'broker_admin', 'admin']);

function requireBroker(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  if (!BROKER_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Solo brokers pueden conectar Google Calendar' });
  }
  next();
}

function signOAuthState(userId: number): string {
  return jwt.sign({ purpose: 'google_calendar', userId }, config.jwtSecret, { expiresIn: '15m' });
}

function verifyOAuthState(state: string): number | null {
  try {
    const payload = jwt.verify(state, config.jwtSecret) as {
      purpose?: string;
      userId?: number;
    };
    if (payload.purpose !== 'google_calendar' || !payload.userId) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

function frontendRedirect(path: string): string {
  const base =
    config.frontendUrl ||
    config.publicFrontendUrl ||
    'http://localhost:5173';
  return `${base.replace(/\/$/, '')}${path}`;
}

router.get(
  '/status',
  auth,
  requireBroker,
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await prisma.brokerProfile.findUnique({
      where: { userId: req.user!.id },
      select: {
        googleCalendarConnectedAt: true,
        googleCalendarRefreshToken: true,
      },
    });
    res.json({
      configured: isGoogleCalendarConfigured(),
      connected: Boolean(profile?.googleCalendarRefreshToken),
      connectedAt: profile?.googleCalendarConnectedAt?.toISOString() ?? null,
    });
  })
);

router.get(
  '/auth/url',
  auth,
  requireBroker,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isGoogleCalendarConfigured()) {
      return res.status(503).json({
        error: 'Google Calendar no está configurado en el servidor',
        code: 'GOOGLE_CALENDAR_NOT_CONFIGURED',
      });
    }
    const state = signOAuthState(req.user!.id);
    res.json({ url: getAuthUrl(state) });
  })
);

router.get(
  '/auth/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) {
      return res.redirect(frontendRedirect('/?calendar=error&reason=denied'));
    }
    if (!code || !state || typeof state !== 'string') {
      return res.redirect(frontendRedirect('/?calendar=error&reason=missing_params'));
    }

    const userId = verifyOAuthState(state);
    if (!userId) {
      return res.redirect(frontendRedirect('/?calendar=error&reason=invalid_state'));
    }

    if (!isGoogleCalendarConfigured()) {
      return res.redirect(frontendRedirect('/?calendar=error&reason=not_configured'));
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      if (!tokens.refresh_token) {
        return res.redirect(
          frontendRedirect('/?calendar=error&reason=no_refresh_token')
        );
      }

      const brokerUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const fullName = brokerUser?.name?.trim() || 'Broker';

      const existing = await prisma.brokerProfile.findUnique({ where: { userId } });
      if (existing) {
        await prisma.brokerProfile.update({
          where: { userId },
          data: {
            googleCalendarRefreshToken: tokens.refresh_token,
            googleCalendarConnectedAt: new Date(),
          },
        });
      } else {
        await prisma.brokerProfile.create({
          data: {
            userId,
            fullName,
            googleCalendarRefreshToken: tokens.refresh_token,
            googleCalendarConnectedAt: new Date(),
          },
        });
      }

      return res.redirect(frontendRedirect('/?calendar=connected'));
    } catch {
      return res.redirect(frontendRedirect('/?calendar=error&reason=exchange_failed'));
    }
  })
);

router.post(
  '/schedule-visit',
  auth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      propertyId,
      date,
      time,
      visitType,
      message,
    } = req.body as {
      propertyId?: number;
      date?: string;
      time?: string;
      visitType?: 'in_person' | 'video_call';
      message?: string;
    };

    if (!propertyId || !date || !time) {
      return res.status(400).json({ success: false, message: 'propertyId, date y time son requeridos' });
    }

    try {
      const result = await schedulePropertyVisit(propertyId, req.user!.id, {
        date,
        time,
        visitType,
        message,
      });
      res.status(201).json({
        success: true,
        ...result,
        link: result.googleEventLink,
      });
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : 500;
      const message =
        err instanceof Error ? err.message : 'Error agendando la visita';
      if (statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({ success: false, message });
      }
      return res.status(500).json({ success: false, message: 'Error agendando la visita' });
    }
  })
);

export default router;
