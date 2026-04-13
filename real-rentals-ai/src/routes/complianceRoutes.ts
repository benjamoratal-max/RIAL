import express from 'express';
import prisma from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

function ensureCompliance(req: AuthRequest, res: express.Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  if (req.user.role !== 'compliance_admin' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Solo usuarios de compliance/admin pueden acceder a este módulo' });
    return false;
  }
  return true;
}

// Cola de brokers pendientes de revisión
router.get('/brokers/pending', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const { status } = req.query as { status?: string };
    const statuses = status
      ? [status]
      : ['pending_review', 'more_info'] as string[];

    const profiles = await (prisma as any).brokerProfile.findMany({
      where: { verificationStatus: { in: statuses } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.json({ items: profiles });
  } catch (error: any) {
    logger.error('Error obteniendo brokers pendientes', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al obtener brokers pendientes' });
  }
});

// Listado de publicaciones con posibles flags de calidad / duplicados
router.get('/listings/review', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const properties = await prisma.property.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: { id: true, name: true, email: true, role: true },
        },
        images: true,
      },
    });

    const propertyIds = properties.map((p) => p.id);

    const duplicateAlerts = propertyIds.length
      ? await prisma.propertyDuplicateAlert.findMany({
          where: { propertyId: { in: propertyIds } },
        })
      : [];

    const alertsByProperty = new Map<number, any[]>();
    duplicateAlerts.forEach((alert) => {
      const arr = alertsByProperty.get(alert.propertyId) || [];
      arr.push(alert);
      alertsByProperty.set(alert.propertyId, arr);
    });

    const items = properties.map((p) => {
      const flags: string[] = [];

      if (!p.images || p.images.length === 0) {
        flags.push('SIN_IMAGENES');
      } else if (p.images.length < 3) {
        flags.push('POCAS_IMAGENES');
      }

      if (!p.description || p.description.length < 120) {
        flags.push('DESCRIPCION_CORTA');
      }

      const dups = alertsByProperty.get(p.id) || [];
      if (dups.length > 0) {
        flags.push('SOSPECHA_DUPLICADO');
      }

      if (!p.verified) {
        flags.push('LISTING_NO_VERIFICADO');
      }

      if (!p.ownerId) {
        flags.push('SIN_OWNER_ASIGNADO');
      }

      return {
        property: {
          id: p.id,
          title: p.title,
          location: p.location,
          price: p.price,
          createdAt: p.createdAt,
          verified: (p as any).verified ?? false,
        },
        owner: p.owner,
        flags,
        duplicateAlerts: dups,
      };
    });

    res.json({ items });
  } catch (error: any) {
    logger.error('Error obteniendo listado de publicaciones para compliance', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al obtener publicaciones para revisión' });
  }
});

// Detalle de un broker + historial
router.get('/brokers/:id', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const profile = await (prisma as any).brokerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil de broker no encontrado' });
    }

    const logs = await (prisma as any).brokerVerificationLog.findMany({
      where: { brokerProfileId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ profile, logs });
  } catch (error: any) {
    logger.error('Error obteniendo detalle de broker', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al obtener detalle de broker' });
  }
});

// Decisión sobre un broker: approve / reject / more_info / suspend
router.post('/brokers/:id/decision', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { action, reason } = req.body as { action: string; reason?: string };
    if (!action || !['approve', 'reject', 'more_info', 'suspend', 'reactivate'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida' });
    }

    const profile = await (prisma as any).brokerProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!profile) {
      return res.status(404).json({ error: 'Perfil de broker no encontrado' });
    }

    let newStatus = profile.verificationStatus;
    if (action === 'approve') newStatus = 'approved';
    if (action === 'reject') newStatus = 'rejected';
    if (action === 'more_info') newStatus = 'more_info';
    if (action === 'suspend') newStatus = 'suspended';
    if (action === 'reactivate') newStatus = 'approved';

    const updatedProfile = await (prisma as any).brokerProfile.update({
      where: { id },
      data: {
        verificationStatus: newStatus,
        verifiedAt: action === 'approve' || action === 'reactivate' ? new Date() : profile.verifiedAt,
        verifiedBy: req.user!.id,
      },
    });

    // Log de verificación
    await (prisma as any).brokerVerificationLog.create({
      data: {
        brokerProfileId: id,
        action,
        previousStatus: profile.verificationStatus,
        newStatus,
        reason,
        requestedById: null,
        reviewedById: req.user!.id,
      },
    });

    // Actualizar rol de usuario cuando se aprueba
    if ((action === 'approve' || action === 'reactivate') && profile.user) {
      await prisma.user.update({
        where: { id: profile.user.id },
        data: {
          role: profile.user.role === 'broker_admin' ? 'broker_admin' : 'broker',
        },
      });
    }

    // Cuando se rechaza o suspende no cambiamos el rol por ahora

    res.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    logger.error('Error aplicando decisión de compliance', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al aplicar la decisión de compliance' });
  }
});

// Incidentes / flags reportados
router.get('/incidents', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const { status } = req.query as { status?: string };
    const where: any = {};
    if (status) where.status = status;

    const incidents = await (prisma as any).complianceIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ items: incidents });
  } catch (error: any) {
    logger.error('Error obteniendo incidentes de compliance', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al obtener incidentes' });
  }
});

// Suspensiones activas
router.get('/suspensions', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const suspensions = await (prisma as any).suspension.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        property: { select: { id: true, title: true, location: true } },
      },
    });

    res.json({ items: suspensions });
  } catch (error: any) {
    logger.error('Error obteniendo suspensiones', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al obtener suspensiones' });
  }
});

// Levantar suspensión
router.post('/suspensions/:id/lift', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const suspension = await (prisma as any).suspension.update({
      where: { id },
      data: {
        status: 'lifted',
        liftedAt: new Date(),
      },
    });

    res.json({ suspension });
  } catch (error: any) {
    logger.error('Error levantando suspensión', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al levantar suspensión' });
  }
});

// Audit logs
router.get('/audit-logs', auth, async (req: AuthRequest, res) => {
  if (!ensureCompliance(req, res)) return;
  try {
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = Number(entityId);

    const logs = await (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ items: logs });
  } catch (error: any) {
    logger.error('Error obteniendo audit logs', 'Compliance', error as Error);
    res.status(500).json({ error: 'Error al obtener audit logs' });
  }
});

export default router;

