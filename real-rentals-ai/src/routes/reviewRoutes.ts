import express from 'express';
import prisma from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import NotificationService from '../utils/notificationService';

const router = express.Router();

// Listar reviews de una propiedad + promedio
router.get('/property/:propertyId', async (req, res) => {
  const propertyId = Number(req.params.propertyId);
  try {
    const reviews = await prisma.review.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
    const agg = await prisma.review.aggregate({
      where: { propertyId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    res.json({
      reviews,
      averageRating: agg._avg.rating ?? 0,
      reviewsCount: agg._count._all,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener reviews' });
  }
});

// Crear review (solo usuarios autenticados con alquiler aprobado)
router.post('/', auth, async (req: AuthRequest, res) => {
  const { propertyId, rating, comment } = req.body;
  const userId = req.user!.id;

  if (!propertyId || !rating) {
    return res.status(400).json({ error: 'propertyId y rating son obligatorios' });
  }
  const r = Number(rating);
  if (isNaN(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'rating debe ser un entero entre 1 y 5' });
  }

  try {
    const hasApprovedLease = await prisma.leaseRequest.findFirst({
      where: { userId, propertyId: Number(propertyId), status: 'approved' },
    });
    if (!hasApprovedLease) {
      return res.status(403).json({ error: 'Solo inquilinos con alquiler aprobado pueden reseñar' });
    }

    const review = await prisma.review.create({
      data: {
        userId,
        propertyId: Number(propertyId),
        rating: r,
        comment: comment || '',
      },
    });
    
    // Notificar al propietario sobre la nueva reseña
    await NotificationService.notifyNewReview(review.id);
    
    res.status(201).json(review);
  } catch {
    res.status(400).json({ error: 'Error al crear review' });
  }
});

export default router;


