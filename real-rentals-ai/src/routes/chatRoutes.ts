import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import NotificationService from '../utils/notificationService';

const router = express.Router();

// Obtener conversaciones del usuario
router.get('/conversations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const userId = req.user.id;
    
    // Obtener mensajes enviados y recibidos
    const sentMessages = await prisma.message.findMany({
      where: { senderId: userId },
      include: { receiver: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: userId },
      include: { sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Agrupar por usuario
    const conversations = new Map();
    
    sentMessages.forEach(msg => {
      const otherUserId = msg.receiverId;
      if (!conversations.has(otherUserId)) {
        conversations.set(otherUserId, {
          userId: otherUserId,
          userName: msg.receiver.name,
          userEmail: msg.receiver.email,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unreadCount: 0,
        });
      }
    });

    receivedMessages.forEach(msg => {
      const otherUserId = msg.senderId;
      if (!conversations.has(otherUserId)) {
        conversations.set(otherUserId, {
          userId: otherUserId,
          userName: msg.sender.name,
          userEmail: msg.sender.email,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unreadCount: 0,
        });
      } else {
        const conv = conversations.get(otherUserId);
        if (msg.createdAt > conv.lastMessageTime) {
          conv.lastMessage = msg.content;
          conv.lastMessageTime = msg.createdAt;
        }
        if (!msg.read) conv.unreadCount++;
      }
    });

    const conversationsList = Array.from(conversations.values())
      .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    res.json(conversationsList);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

// Obtener mensajes con un usuario específico
router.get('/messages/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: parseInt(userId) },
          { senderId: parseInt(userId), receiverId: currentUserId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Marcar mensajes como leídos
    await prisma.message.updateMany({
      where: {
        senderId: parseInt(userId),
        receiverId: currentUserId,
        read: false,
      },
      data: { read: true },
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Enviar mensaje
router.post('/send', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { receiverId, content } = req.body;
    const senderId = req.user.id;

    if (!content || !receiverId) {
      return res.status(400).json({ error: 'Contenido y destinatario son requeridos' });
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId: parseInt(receiverId),
        content,
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
    });

    // Si el remitente es propietario y el destinatario tiene solicitudes pendientes en sus propiedades, marcar como respondido
    try {
      await prisma.leaseRequest.updateMany({
        where: {
          userId: parseInt(receiverId),
          status: 'pending',
          ownerRespondedAt: null,
          property: { ownerId: senderId },
        },
        data: { ownerRespondedAt: new Date() },
      });
    } catch (_) {}

    // Notificar al receptor sobre el nuevo mensaje
    await NotificationService.notifyNewMessage(senderId, parseInt(receiverId), content);

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Marcar mensajes como leídos
router.patch('/messages/:userId/read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { userId } = req.params;
    const currentUserId = req.user.id;

    await prisma.message.updateMany({
      where: {
        senderId: parseInt(userId),
        receiverId: currentUserId,
        read: false,
      },
      data: { read: true },
    });

    res.json({ message: 'Mensajes marcados como leídos' });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar mensajes como leídos' });
  }
});

// Obtener contador de mensajes no leídos
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const count = await prisma.message.count({
      where: {
        receiverId: req.user.id,
        read: false,
      },
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener contador de mensajes' });
  }
});

export default router;
