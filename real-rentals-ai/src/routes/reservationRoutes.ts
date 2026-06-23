import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireVerification } from '../middleware/requireVerification';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createReservation,
  expireStaleReservations,
  getReservationForUser,
  initiateReservationPayment,
  confirmCheckoutSession,
  BALANCE_DEADLINE_HOURS,
  DEPOSIT_PERCENT,
} from '../services/reservationService';
import { isStripeEnabled } from '../services/stripeService';

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({
    depositPercent: DEPOSIT_PERCENT,
    balanceDeadlineHours: BALANCE_DEADLINE_HOURS,
    // true → el frontend debe esperar { checkoutUrl } y redirigir a Stripe.
    // false → cobro simulado (sin tarjeta real).
    stripeEnabled: isStripeEnabled(),
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
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            bedrooms: true,
            bathrooms: true,
            area: true,
            propertyType: true,
            images: { select: { url: true }, take: 1 },
          },
        },
        // Contrato PDF (si la solicitud asociada fue aprobada y generó contrato).
        leaseRequest: { include: { leaseContract: { select: { pdfUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aplanar datos útiles para el frontend (primera imagen y URL de contrato).
    const shaped = list.map((r: any) => ({
      ...r,
      property: r.property
        ? { ...r.property, image: r.property.images?.[0]?.url ?? null }
        : null,
      contractUrl: r.leaseRequest?.leaseContract?.pdfUrl ?? null,
    }));
    res.json(shaped);
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
    try {
      const result = await initiateReservationPayment(id, req.user.id, 'deposit');
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
    try {
      const result = await initiateReservationPayment(id, req.user.id, 'balance');
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  })
);

/** Confirma el cobro al volver de Stripe Checkout (session_id en la URL de éxito). */
router.post(
  '/:id/confirm-checkout',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    const sessionId = req.body?.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId es requerido' });
    }
    try {
      const reservation = await confirmCheckoutSession(id, req.user.id, sessionId);
      res.json(reservation);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  })
);

export default router;
