import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import NotificationService from '../utils/notificationService';

const router = express.Router();

// Obtener todas las alertas del usuario
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const alerts = await prisma.alert.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

// Crear una nueva alerta
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { type, location, minPrice, maxPrice, propertyId } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'El tipo de alerta es requerido' });
    }

    const alert = await prisma.alert.create({
      data: {
        userId: req.user.id,
        type,
        location: location || null,
        minPrice: minPrice ? Number(minPrice) : null,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        propertyId: propertyId ? Number(propertyId) : null,
      },
    });

    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear alerta' });
  }
});

// Actualizar una alerta
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { id } = req.params;
    const { isActive, location, minPrice, maxPrice } = req.body;

    const alert = await prisma.alert.findFirst({
      where: { id: parseInt(id), userId: req.user.id },
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    const updated = await prisma.alert.update({
      where: { id: parseInt(id) },
      data: {
        isActive: isActive !== undefined ? isActive : alert.isActive,
        location: location !== undefined ? location : alert.location,
        minPrice: minPrice !== undefined ? Number(minPrice) : alert.minPrice,
        maxPrice: maxPrice !== undefined ? Number(maxPrice) : alert.maxPrice,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar alerta' });
  }
});

// Eliminar una alerta
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { id } = req.params;

    const alert = await prisma.alert.findFirst({
      where: { id: parseInt(id), userId: req.user.id },
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    await prisma.alert.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Alerta eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar alerta' });
  }
});

// Servicio para verificar y disparar alertas (debe ejecutarse periódicamente)
export async function checkAndTriggerAlerts() {
  try {
    const activeAlerts = await prisma.alert.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    for (const alert of activeAlerts) {
      let properties: any[] = [];

      if (alert.type === 'price_drop' && alert.propertyId) {
        // Verificar si el precio de la propiedad bajó
        const property = await prisma.property.findUnique({
          where: { id: alert.propertyId },
        });
        if (property && alert.maxPrice && property.price < alert.maxPrice) {
          await NotificationService.createNotification(
            alert.userId,
            'Precio bajó',
            `La propiedad "${property.title}" ahora cuesta $${property.price}`,
            'success'
          );
        }
      } else if (alert.type === 'availability' && alert.propertyId) {
        // Verificar si la propiedad está disponible
        const property = await prisma.property.findUnique({
          where: { id: alert.propertyId },
        });
        if (property && property.available) {
          await NotificationService.createNotification(
            alert.userId,
            'Propiedad disponible',
            `La propiedad "${property.title}" está disponible`,
            'info'
          );
        }
      } else if (alert.type === 'new_property') {
        // Buscar nuevas propiedades que coincidan con los criterios
        const where: any = {};
        if (alert.location) where.location = alert.location;
        if (alert.minPrice || alert.maxPrice) {
          where.price = {};
          if (alert.minPrice) where.price.gte = alert.minPrice;
          if (alert.maxPrice) where.price.lte = alert.maxPrice;
        }

        properties = await prisma.property.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        if (properties.length > 0) {
          await NotificationService.createNotification(
            alert.userId,
            'Nuevas propiedades disponibles',
            `Se encontraron ${properties.length} propiedades que coinciden con tus criterios`,
            'info'
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking alerts:', error);
  }
}

export default router;

