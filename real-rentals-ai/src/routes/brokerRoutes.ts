import express from 'express';
import prisma from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Obtener o crear (en blanco) el perfil de broker del usuario actual
router.get('/me', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    let profile = await (prisma as any).brokerProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      // No creamos automáticamente un perfil completo, solo devolvemos estado "sin aplicar"
      return res.json({ profile: null, status: 'not_applied' });
    }

    const logs = await (prisma as any).brokerVerificationLog.findMany({
      where: { brokerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({ profile, logs });
  } catch (error: any) {
    logger.error('Error obteniendo perfil de broker', 'Broker', error as Error, { userId: req.user?.id });
    return res.status(500).json({ error: 'Error al obtener el perfil de broker' });
  }
});

// Aplicar / actualizar datos de broker (pasos 1–3 combinados por ahora)
router.post('/apply', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    const {
      fullName,
      phone,
      market,
      brokerageName,
      position,
      businessAddress,
      licenseNumber,
      licenseState,
      licenseType,
      licenseExpiration,
      brokerOfRecord,
    } = req.body || {};

    if (!fullName || !licenseNumber || !licenseState) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios',
        message: 'fullName, licenseNumber y licenseState son obligatorios para aplicar como broker',
      });
    }

    const parsedExpiration =
      licenseExpiration ? new Date(licenseExpiration) : null;

    // Crear o actualizar perfil
    const existing = await (prisma as any).brokerProfile.findUnique({
      where: { userId: req.user.id },
    });

    const profile = existing
      ? await (prisma as any).brokerProfile.update({
          where: { userId: req.user.id },
          data: {
            fullName,
            phone,
            market,
            brokerageName,
            position,
            businessAddress,
            licenseNumber,
            licenseState,
            licenseType,
            licenseExpiration: parsedExpiration ?? existing.licenseExpiration,
            brokerOfRecord,
            verificationStatus: 'pending_review',
          },
        })
      : await (prisma as any).brokerProfile.create({
          data: {
            userId: req.user.id,
            fullName,
            phone,
            market,
            brokerageName,
            position,
            businessAddress,
            licenseNumber,
            licenseState,
            licenseType,
            licenseExpiration: parsedExpiration ?? null,
            brokerOfRecord,
            verificationStatus: 'pending_review',
          },
        });

    // Registrar log
    await (prisma as any).brokerVerificationLog.create({
      data: {
        brokerProfileId: profile.id,
        action: existing ? 'submitted_update' : 'submitted',
        previousStatus: existing?.verificationStatus ?? null,
        newStatus: 'pending_review',
        requestedById: req.user.id,
      },
    });

    // Forzar rol broker_applicant si no es admin/sistema
    if (req.user.role !== 'admin' && req.user.role !== 'compliance_admin') {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'broker_applicant' },
      });
    }

    return res.status(200).json({
      success: true,
      profile,
      message: 'Solicitud de broker enviada. Será revisada por el equipo de compliance.',
    });
  } catch (error: any) {
    logger.error('Error en apply de broker', 'Broker', error as Error, { userId: req.user?.id });
    return res.status(500).json({ error: 'Error al enviar la solicitud de broker' });
  }
});

export default router;

