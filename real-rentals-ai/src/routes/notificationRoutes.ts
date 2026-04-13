import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Obtener todas las notificaciones del usuario
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Marcar notificación como leída
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { id } = req.params;
    const notification = await prisma.notification.update({
      where: { 
        id: parseInt(id),
        userId: req.user.id 
      },
      data: { read: true },
    });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar notificación como leída' });
  }
});

// Marcar todas las notificaciones como leídas
router.patch('/read-all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    await prisma.notification.updateMany({
      where: { 
        userId: req.user.id,
        read: false 
      },
      data: { read: true },
    });
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar notificaciones como leídas' });
  }
});

// Eliminar notificación
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { id } = req.params;
    await prisma.notification.delete({
      where: { 
        id: parseInt(id),
        userId: req.user.id 
      },
    });
    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});

// Obtener contador de notificaciones no leídas
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const count = await prisma.notification.count({
      where: { 
        userId: req.user.id,
        read: false 
      },
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener contador de notificaciones' });
  }
});

export default router;
