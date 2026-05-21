import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireVerification } from '../middleware/requireVerification';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createReservation,
  expireStaleReservations,
  getReservationForUser,
  payBalance,
  payDeposit,
  BALANCE_DEADLINE_HOURS,
  DEPOSIT_PERCENT,
} from '../services/reservationService';

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({
    depositPercent: DEPOSIT_PERCENT,
    balanceDeadlineHours: BALANCE_DEADLINE_HOURS,
  });
});

router.get(
  '/mine',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    await expireStaleReservations();
    const prisma = (await import('../lib/prisma')).default;
    const list = await (prisma as any).rentalReservation.findMany({
      where: { userId: req.user.id },
      include: {
        property: { select: { id: true, title: true, location: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  })
);

router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    const reservation = await getReservationForUser(id, req.user.id);
    const now = Date.now();
    const balanceDueAt = reservation.balanceDueAt
      ? new Date(reservation.balanceDueAt).getTime()
      : null;
    const msRemaining =
      reservation.status === 'deposit_paid' && balanceDueAt
        ? Math.max(0, balanceDueAt - now)
        : 0;

    res.json({
      ...reservation,
      balanceDeadlineHours: BALANCE_DEADLINE_HOURS,
      msRemaining,
      hoursRemaining: msRemaining > 0 ? Math.ceil(msRemaining / (60 * 60 * 1000)) : 0,
    });
  })
);

router.post(
  '/',
  authenticateToken,
  requireVerification,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { propertyId, durationMonths, startDate, leaseRequestId, securityDeposit } = req.body;

    if (!propertyId || !durationMonths) {
      return res.status(400).json({ error: 'propertyId y durationMonths son requeridos' });
    }

    try {
      const reservation = await createReservation({
        userId: req.user.id,
        propertyId: Number(propertyId),
        durationMonths: Number(durationMonths),
        startDate: startDate ?? null,
        leaseRequestId: leaseRequestId ? Number(leaseRequestId) : null,
        securityDeposit:
          securityDeposit != null && securityDeposit !== ''
            ? Number(securityDeposit)
            : undefined,
      });
      res.status(201).json(reservation);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Error al crear reserva' });
    }
  })
);

router.post(
  '/:id/pay-deposit',
  authenticateToken,
  requireVerification,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    const paymentMethod = req.body?.paymentMethod || 'stripe';
    try {
      const result = await payDeposit(id, req.user.id, paymentMethod);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  })
);

router.post(
  '/:id/pay-balance',
  authenticateToken,
  requireVerification,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    const paymentMethod = req.body?.paymentMethod || 'stripe';
    try {
      const result = await payBalance(id, req.user.id, paymentMethod);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  })
);

export default router;
