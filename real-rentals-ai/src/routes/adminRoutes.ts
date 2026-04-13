import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { cleanupInvalidEmails } from '../utils/emailValidator';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Middleware para verificar que sea admin
const requireAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden acceder a esta ruta' });
  }
  next();
};

// Limpiar cuentas con emails no válidos
router.post('/cleanup-invalid-emails', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const result = await cleanupInvalidEmails(prisma);
  
  logger.info(`Limpieza de emails inválidos completada`, 'Admin', result);
  
  res.json({
    message: 'Limpieza completada',
    deleted: result.deleted,
    errors: result.errors,
  });
}));

// Obtener estadísticas de usuarios
router.get('/user-stats', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const totalUsers = await prisma.user.count();
  const verifiedUsers = await prisma.user.count({ where: { emailVerified: true } });
  const usersWith2FA = await prisma.user.count({ where: { twoFactorEnabled: true } });
  const invalidEmails = await prisma.user.count({ 
    where: { 
      emailValidated: false,
      emailVerificationCodeExpires: { lt: new Date() },
    },
  });

  res.json({
    totalUsers,
    verifiedUsers,
    usersWith2FA,
    invalidEmails,
    verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0,
    twoFactorRate: totalUsers > 0 ? (usersWith2FA / totalUsers * 100).toFixed(2) : 0,
  });
}));

// Listar postulantes a broker para revisión manual (admin)
router.get('/broker-applicants', authenticateToken, requireAdmin, asyncHandler(async (_req: AuthRequest, res) => {
  const applicants = await prisma.user.findMany({
    where: { role: 'broker_applicant' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      verified: true,
      emailVerified: true,
      brokerProfile: {
        select: {
          id: true,
          verificationStatus: true,
          fullName: true,
          licenseNumber: true,
          licenseState: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { id: 'desc' },
    take: 200,
  });

  res.json({ items: applicants });
}));

// Activar postulante de broker (flujo controlado por admin)
router.post('/brokers/:userId/activate', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }

  const { targetRole = 'broker', reason } = req.body as { targetRole?: 'broker' | 'broker_admin'; reason?: string };
  if (targetRole !== 'broker' && targetRole !== 'broker_admin') {
    return res.status(400).json({ error: 'targetRole inválido. Usa broker o broker_admin' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      brokerProfile: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Solo se permite activar postulantes en este flujo.
  if (user.role !== 'broker_applicant') {
    return res.status(409).json({
      error: 'Solo se puede activar a usuarios con rol broker_applicant',
      currentRole: user.role,
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: targetRole },
    select: { id: true, name: true, email: true, role: true },
  });

  // Si el postulante ya cargó perfil, sincronizar estado de verificación y registrar log.
  if (user.brokerProfile) {
    const updatedProfile = await (prisma as any).brokerProfile.update({
      where: { id: user.brokerProfile.id },
      data: {
        verificationStatus: 'approved',
        verifiedAt: new Date(),
        verifiedBy: req.user!.id,
      },
    });

    await (prisma as any).brokerVerificationLog.create({
      data: {
        brokerProfileId: updatedProfile.id,
        action: 'approve',
        previousStatus: user.brokerProfile.verificationStatus,
        newStatus: 'approved',
        reason: reason || 'Aprobación manual por admin',
        requestedById: null,
        reviewedById: req.user!.id,
      },
    });
  }

  logger.info('Postulante activado como broker', 'Admin', {
    adminId: req.user?.id,
    userId: updatedUser.id,
    role: updatedUser.role,
  });

  return res.json({
    success: true,
    user: updatedUser,
    message: `Usuario activado como ${updatedUser.role}`,
  });
}));

export default router;
