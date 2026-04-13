import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendVerificationCode } from '../utils/emailService';
import { validateEmail } from '../utils/emailValidator';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Generar código de verificación aleatorio
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

// Enviar código de verificación de email
router.post('/send-code', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (user.emailVerified) {
    return res.status(400).json({ error: 'El email ya está verificado' });
  }

  // Validar que el email sea válido antes de enviar código
  const emailValidation = await validateEmail(user.email);
  if (!emailValidation.valid) {
    return res.status(400).json({ 
      error: 'Email no válido', 
      reason: emailValidation.reason 
    });
  }

  // Generar código
  const code = generateVerificationCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutos

  // Guardar código en base de datos
  await prisma.emailVerificationCode.create({
    data: {
      userId: user.id,
      code,
      type: 'email_verification',
      expiresAt,
    },
  });

  // Actualizar código en usuario (para compatibilidad)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCode: code,
      emailVerificationCodeExpires: expiresAt,
    },
  });

  // Enviar email
  const emailSent = await sendVerificationCode(user.email, code, user.name);
  
  if (!emailSent) {
    logger.warn(`No se pudo enviar email de verificación a ${user.email}`, 'EmailVerification');
  }

  res.json({ 
    message: 'Código de verificación enviado',
    expiresIn: 600, // 10 minutos en segundos
  });
}));

// Verificar código de email
router.post('/verify', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Código requerido' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (user.emailVerified) {
    return res.status(400).json({ error: 'El email ya está verificado' });
  }

  // Buscar código válido
  const verificationCode = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      code,
      type: 'email_verification',
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!verificationCode) {
    return res.status(400).json({ error: 'Código inválido o expirado' });
  }

  // Marcar código como usado
  await prisma.emailVerificationCode.update({
    where: { id: verificationCode.id },
    data: { used: true },
  });

  // Obtener estado actual del usuario
  const currentUser = await prisma.user.findUnique({ where: { id: user.id } });
  const hasDocumentVerification = currentUser?.verified && currentUser.verificationMethod !== 'email';

  // Determinar método de verificación
  const verificationMethod = hasDocumentVerification ? 'both' : 'email';

  // Marcar email como verificado y actualizar estado de verificación general
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailValidated: true,
      emailLastValidated: new Date(),
      emailVerificationCode: null,
      emailVerificationCodeExpires: null,
      // Si no estaba verificado, marcar como verificado ahora
      verified: !currentUser?.verified ? true : currentUser.verified,
      verifiedAt: !currentUser?.verified ? new Date() : currentUser.verifiedAt,
      verificationMethod: verificationMethod,
    },
  });

  logger.info(`Email verificado para usuario ${user.id}`, 'EmailVerification');

  res.json({ 
    message: 'Email verificado exitosamente',
    verified: true,
    accountVerified: !currentUser?.verified ? true : currentUser.verified,
  });
}));

// Reenviar código de verificación
router.post('/resend-code', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (user.emailVerified) {
    return res.status(400).json({ error: 'El email ya está verificado' });
  }

  // Invalidar códigos anteriores
  await prisma.emailVerificationCode.updateMany({
    where: {
      userId: user.id,
      type: 'email_verification',
      used: false,
    },
    data: { used: true },
  });

  // Enviar nuevo código (reutilizar lógica del endpoint send-code)
  const code = generateVerificationCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  await prisma.emailVerificationCode.create({
    data: {
      userId: user.id,
      code,
      type: 'email_verification',
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCode: code,
      emailVerificationCodeExpires: expiresAt,
    },
  });

  const emailSent = await sendVerificationCode(user.email, code, user.name);

  res.json({ 
    message: 'Código reenviado',
    expiresIn: 600,
  });
}));

// Obtener estado de verificación de email
router.get('/status', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id },
    select: {
      email: true,
      emailVerified: true,
      emailVerifiedAt: true,
      emailValidated: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  res.json({
    email: user.email,
    verified: user.emailVerified,
    verifiedAt: user.emailVerifiedAt,
    validated: user.emailValidated,
  });
}));

export default router;
