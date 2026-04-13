import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireVerification } from '../middleware/requireVerification';
import NotificationService from '../utils/notificationService';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Obtener pagos del usuario
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// Crear nuevo pago (requiere verificación)
router.post('/', authenticateToken, requireVerification, asyncHandler(async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { propertyId, amount, paymentMethod, description } = req.body;
    const userId = req.user.id;

    if (!propertyId || !amount || !paymentMethod) {
      return res.status(400).json({ error: 'Propiedad, monto y método de pago son requeridos' });
    }

    // Verificar que la propiedad existe
    const property = await prisma.property.findUnique({
      where: { id: parseInt(propertyId) },
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Generar ID de transacción único
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payment = await prisma.payment.create({
      data: {
        userId,
        propertyId: parseInt(propertyId),
        amount: parseFloat(amount),
        paymentMethod,
        transactionId,
        description: description || `Pago por ${property.title}`,
        status: 'pending',
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
          },
        },
      },
    });

    // Simular procesamiento de pago (en producción usarías Stripe, PayPal, etc.)
    setTimeout(async () => {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'completed' },
      });

      // Notificar sobre el pago completado
      await NotificationService.notifyPaymentCompleted(payment.id);
    }, 2000);

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear pago' });
  }
}));

// Obtener detalles de un pago específico
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { id } = req.params;
    const payment = await prisma.payment.findFirst({
      where: { 
        id: parseInt(id),
        userId: req.user.id 
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pago' });
  }
});

// Actualizar estado de pago (para webhooks de proveedores de pago)
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      return res.status(400).json({ error: 'Estado de pago inválido' });
    }

    const payment = await prisma.payment.update({
      where: { 
        id: parseInt(id),
        userId: req.user.id 
      },
      data: { status },
    });

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado de pago' });
  }
});

// Obtener historial de pagos por propiedad
router.get('/property/:propertyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { propertyId } = req.params;
    const payments = await prisma.payment.findMany({
      where: { 
        propertyId: parseInt(propertyId),
        userId: req.user.id 
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de pagos' });
  }
});

// Obtener estadísticas de pagos
router.get('/stats/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const userId = req.user.id;

    const totalPayments = await prisma.payment.count({
      where: { userId },
    });

    const completedPayments = await prisma.payment.count({
      where: { 
        userId,
        status: 'completed' 
      },
    });

    const totalAmount = await prisma.payment.aggregate({
      where: { 
        userId,
        status: 'completed' 
      },
      _sum: { amount: true },
    });

    const pendingAmount = await prisma.payment.aggregate({
      where: { 
        userId,
        status: 'pending' 
      },
      _sum: { amount: true },
    });

    res.json({
      totalPayments,
      completedPayments,
      totalAmount: totalAmount._sum.amount || 0,
      pendingAmount: pendingAmount._sum.amount || 0,
      successRate: totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas de pagos' });
  }
});

export default router;
