import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { send2FACode } from '../utils/emailService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Generar código 2FA
function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

// Activar 2FA (solo por email)
router.post('/enable', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Verificar que el email esté verificado
  if (!user.emailVerified) {
    return res.status(400).json({ error: 'Debes verificar tu email antes de activar 2FA' });
  }

  // Actualizar usuario (solo email, SMS removido)
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorMethod: 'email',
    },
  });

  logger.info(`2FA activado para usuario ${req.user.id}`, '2FA', { method: 'email' });

  res.json({ 
    message: 'Autenticación de dos factores activada',
    method: 'email',
  });
}));

// Desactivar 2FA
router.post('/disable', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorMethod: null,
      twoFactorSecret: null,
    },
  });

  // Invalidar todos los códigos 2FA pendientes
  await prisma.twoFactorCode.updateMany({
    where: {
      userId: req.user.id,
      used: false,
    },
    data: { used: true },
  });

  logger.info(`2FA desactivado para usuario ${req.user.id}`, '2FA');

  res.json({ message: 'Autenticación de dos factores desactivada' });
}));

// Solicitar código 2FA (para login)
router.post('/request-code', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Por seguridad, no revelar si el usuario existe
    return res.json({ message: 'Si el usuario existe y tiene 2FA activado, se enviará un código' });
  }

  if (!user.twoFactorEnabled) {
    return res.status(400).json({ error: '2FA no está activado para esta cuenta' });
  }

  // Generar código
  const code = generate2FACode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutos

  // Guardar código
  await prisma.twoFactorCode.create({
    data: {
      userId: user.id,
      code,
      method: user.twoFactorMethod || 'email',
      expiresAt,
    },
  });

  // Enviar código por email (SMS removido)
  const sent = await send2FACode(user.email, code, user.name);

  if (!sent) {
    logger.warn(`No se pudo enviar código 2FA a usuario ${user.id}`, '2FA');
  }

  res.json({ 
    message: 'Código 2FA enviado',
    method: 'email',
    expiresIn: 300, // 5 minutos
  });
}));

// Verificar código 2FA (para login)
router.post('/verify-code', asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email y código requeridos' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.twoFactorEnabled) {
    return res.status(400).json({ error: 'Código inválido' });
  }

  // Buscar código válido (solo email)
  const twoFactorCode = await prisma.twoFactorCode.findFirst({
    where: {
      userId: user.id,
      code,
      method: 'email',
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!twoFactorCode) {
    return res.status(400).json({ error: 'Código inválido o expirado' });
  }

  // Marcar código como usado
  await prisma.twoFactorCode.update({
    where: { id: twoFactorCode.id },
    data: { used: true },
  });

  // Invalidar otros códigos pendientes del mismo usuario
  await prisma.twoFactorCode.updateMany({
    where: {
      userId: user.id,
      used: false,
      id: { not: twoFactorCode.id },
    },
    data: { used: true },
  });

  logger.info(`Código 2FA verificado para usuario ${user.id}`, '2FA');

  res.json({ 
    message: 'Código verificado',
    verified: true,
  });
}));

// Obtener estado de 2FA
router.get('/status', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id },
    select: {
      twoFactorEnabled: true,
      twoFactorMethod: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  res.json({
    enabled: user.twoFactorEnabled,
    method: user.twoFactorMethod || 'email',
  });
}));

export default router;
