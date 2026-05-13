import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { processDocumentVerification } from '../utils/documentVerification';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

function toValidDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Solicitar verificación por documento (automática)
router.post('/document', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  
  const { documentUrl, documentType } = req.body;

  if (!documentUrl) {
    return res.status(400).json({ error: 'URL del documento requerida' });
  }

  if (!documentType || !['dni', 'passport', 'driver_license'].includes(documentType)) {
    return res.status(400).json({ error: 'Tipo de documento inválido. Debe ser: dni, passport o driver_license' });
  }

  try {
    // Obtener usuario y verificación existente
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const existingVerification = await prisma.verification.findUnique({
      where: { userId: req.user.id },
    });

    // Si ya hay una verificación de documento aprobada, no permitir otra
    if (existingVerification?.status === 'verified' && existingVerification.type === 'identity') {
      return res.status(400).json({ error: 'Ya tienes un documento verificado' });
    }

    // Procesar verificación automáticamente
    const verificationResult = await processDocumentVerification(
      documentUrl,
      documentType,
      req.user.id
    );

    // Determinar estado basado en el resultado
    let status: string;
    let verifiedAt: Date | null = null;
    let verifiedBy: number | null = null;
    let notes: string | null = null;

    if (verificationResult.verified && verificationResult.extractedData?.isAdult) {
      status = 'verified';
      verifiedAt = new Date();
      verifiedBy = req.user.id; // Auto-verificado por el sistema
      notes = `Verificación automática exitosa (Score: ${(verificationResult.score * 100).toFixed(1)}%)`;
    
      // Actualizar usuario como verificado
      const verificationMethods = user?.emailVerified ? 'both' : 'document';
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
          verificationMethod: verificationMethods,
        },
      });
    } else {
      status = 'rejected';
      notes = verificationResult.reason || 'El documento no cumple con los criterios de verificación';
    }

    const extractedBirthDate = toValidDateOrNull(verificationResult.extractedData?.birthDate);
    const extractedExpiryDate = toValidDateOrNull(verificationResult.extractedData?.expiryDate);

    // Guardar o actualizar verificación
    const verification = await prisma.verification.upsert({
    where: { userId: req.user.id },
    create: {
      userId: req.user.id,
      type: 'identity',
      status,
      documentUrl,
      verifiedAt,
      verifiedBy,
      notes,
      autoVerified: verificationResult.verified,
      verificationScore: verificationResult.score,
      documentType: documentType,
      extractedName: verificationResult.extractedData?.name,
      extractedNumber: verificationResult.extractedData?.number,
      extractedBirthDate,
      extractedExpiryDate,
      extractedData: verificationResult.extractedData ? JSON.stringify(verificationResult.extractedData) : null,
      isAdult: verificationResult.extractedData?.isAdult,
      age: verificationResult.extractedData?.age,
    },
    update: {
      type: 'identity',
      status,
      documentUrl,
      verifiedAt,
      verifiedBy,
      notes,
      autoVerified: verificationResult.verified,
      verificationScore: verificationResult.score,
      documentType: documentType,
      extractedName: verificationResult.extractedData?.name,
      extractedNumber: verificationResult.extractedData?.number,
      extractedBirthDate,
      extractedExpiryDate,
      extractedData: verificationResult.extractedData ? JSON.stringify(verificationResult.extractedData) : null,
      isAdult: verificationResult.extractedData?.isAdult,
      age: verificationResult.extractedData?.age,
    },
  });

    logger.info(`Verificación por documento ${status} para usuario ${req.user.id}`, 'Verification', {
      documentType,
      verified: verificationResult.verified,
      score: verificationResult.score,
      isAdult: verificationResult.extractedData?.isAdult,
    });

    res.status(201).json({
      ...verification,
      verificationResult: {
        verified: verificationResult.verified,
        score: verificationResult.score,
        reason: verificationResult.reason,
        isAdult: verificationResult.extractedData?.isAdult,
        age: verificationResult.extractedData?.age,
      },
    });
  } catch (error: any) {
    logger.error('Error interno procesando verificación de documento', 'Verification', error as Error, {
      userId: req.user.id,
      documentType,
    });
    return res.status(200).json({
      verificationResult: {
        verified: false,
        score: 0,
        reason: 'No pudimos procesar tu documento en este momento. Intenta con una foto más clara (JPG/PNG) o vuelve a intentar en unos minutos.',
      },
    });
  }
}));

// Obtener estado de verificación del usuario
router.get('/status', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      verified: true,
      verifiedAt: true,
      verificationMethod: true,
      emailVerified: true,
      emailVerifiedAt: true,
    },
  });

  const verification = await prisma.verification.findUnique({
    where: { userId: req.user.id },
  });

  res.json({
    verified: user?.verified || false,
    verifiedAt: user?.verifiedAt,
    verificationMethod: user?.verificationMethod,
    emailVerified: user?.emailVerified || false,
    emailVerifiedAt: user?.emailVerifiedAt,
    documentVerified: verification?.status === 'verified',
    documentStatus: verification?.status || 'none',
    documentType: verification?.documentType,
    documentVerifiedAt: verification?.verifiedAt,
  });
}));

// Aprobar/Rechazar verificación (solo admin)
router.patch('/:userId/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden verificar usuarios' });
    }

    const { userId } = req.params;
    const { status, notes } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const verification = await prisma.verification.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!verification) {
      return res.status(404).json({ error: 'Solicitud de verificación no encontrada' });
    }

    const updated = await prisma.verification.update({
      where: { userId: parseInt(userId) },
      data: {
        status,
        verifiedAt: status === 'verified' ? new Date() : null,
        verifiedBy: status === 'verified' ? req.user.id : null,
        notes: notes || null,
      },
    });

    const uid = parseInt(userId, 10);
    if (status === 'verified') {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { emailVerified: true } });
      await prisma.user.update({
        where: { id: uid },
        data: {
          verified: true,
          verifiedAt: new Date(),
          verificationMethod: u?.emailVerified ? 'both' : 'document',
        },
      });
    } else if (status === 'rejected') {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { emailVerified: true } });
      await prisma.user.update({
        where: { id: uid },
        data: {
          verified: false,
          verifiedAt: null,
          verificationMethod: u?.emailVerified ? 'email' : null,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar verificación' });
  }
});

// Obtener todas las solicitudes de verificación pendientes (solo admin)
router.get('/pending', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver solicitudes pendientes' });
    }

    const pending = await prisma.verification.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
  }
});

export default router;

