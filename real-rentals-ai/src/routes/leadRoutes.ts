import express from 'express';
import prisma from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { computeLeadScoring } from '../services/leadScoringService';
import { verifyDocumentAutomatically } from '../utils/documentVerification';

const router = express.Router();

// Obtener leads del renter autenticado (lado renter de Application Readiness)
router.get('/mine', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    const renterId = req.user.id;
    const leadDelegate = (prisma as any).lead;
    if (!leadDelegate || typeof leadDelegate.findMany !== 'function') {
      logger.warn('Lead delegate no disponible en Prisma Client; devolviendo lista vacía para /mine', 'Lead');
      return res.json({ items: [] });
    }

    const leads = await leadDelegate.findMany({
      where: { renterId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
          },
        },
        broker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.json({ items: leads });
  } catch (error: any) {
    logger.error('Error obteniendo leads del renter', 'Lead', error as Error);
    // Fallback defensivo para no romper Perfil/Settings del renter
    return res.json({ items: [] });
  }
});

// Crear lead desde front (ej: contacto inicial, interés en listing)
router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    const {
      propertyId,
      source,
      name,
      email,
      phone,
      moveInDate,
      leaseTermMonths,
      notes,
    } = req.body || {};

    if (!propertyId || !source) {
      return res.status(400).json({ error: 'propertyId y source son obligatorios' });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true },
    });
    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const brokerId = property.ownerId ?? null;

    const lead = await (prisma as any).lead.create({
      data: {
        renterId: req.user.id,
        brokerId,
        propertyId,
        source,
        stage: 'new_inquiry',
        name,
        email,
        phone,
        moveInDate: moveInDate ? new Date(moveInDate) : null,
        leaseTermMonths: leaseTermMonths ?? null,
        notes,
      },
    });

    logger.info('Lead creado', 'Lead', { leadId: lead.id, brokerId, renterId: req.user.id, propertyId });
    return res.status(201).json(lead);
  } catch (error: any) {
    logger.error('Error creando lead', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al crear lead' });
  }
});

// Obtener pipeline de leads para broker/broker_admin (etapas)
router.get('/pipeline', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    const role = req.user.role;
    const isBroker = role === 'broker' || role === 'broker_admin';
    if (!isBroker && role !== 'admin') {
      return res.status(403).json({ error: 'Solo brokers o admins pueden ver el pipeline de leads' });
    }

    const brokerId = role === 'admin' ? undefined : req.user.id;

    const where: any = {};
    if (brokerId) {
      where.brokerId = brokerId;
    }

    const leads = await (prisma as any).lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { id: true, title: true, location: true } },
        renter: { select: { id: true, name: true, email: true } },
      },
    });

    // Agrupar por etapa para uso directo en un pipeline tipo Kanban
    const stages: Record<string, any[]> = {};
    leads.forEach((lead: any) => {
      const stage = lead.stage || 'new_inquiry';
      if (!stages[stage]) stages[stage] = [];
      stages[stage].push(lead);
    });

    return res.json({ stages });
  } catch (error: any) {
    logger.error('Error obteniendo pipeline de leads', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al obtener pipeline de leads' });
  }
});

// Actualizar etapa de un lead (mover en el pipeline)
router.patch('/:id/stage', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    const id = Number(req.params.id);
    const { stage, nextStep, nextStepDueAt } = req.body as { stage: string; nextStep?: string; nextStepDueAt?: string };
    if (Number.isNaN(id) || !stage) {
      return res.status(400).json({ error: 'ID y stage son obligatorios' });
    }

    const lead = await (prisma as any).lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const role = req.user.role;
    const isBrokerOwner = lead.brokerId === req.user.id;
    const isAdmin = role === 'admin';
    if (!isBrokerOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este lead' });
    }

    const updated = await (prisma as any).lead.update({
      where: { id },
      data: {
        stage,
        nextStep: nextStep ?? lead.nextStep,
        nextStepDueAt: nextStepDueAt ? new Date(nextStepDueAt) : lead.nextStepDueAt,
        lastInteractionAt: new Date(),
      },
    });

    await (prisma as any).leadActivity.create({
      data: {
        leadId: id,
        actorId: req.user.id,
        type: 'status_change',
        description: `Cambio de etapa a ${stage}`,
        fromStage: lead.stage,
        toStage: stage,
      },
    });

    // Recalcular scoring por reglas (modo local) al mover etapa
    const scoring = await computeLeadScoring(id);
    await (prisma as any).lead.update({
      where: { id },
      data: {
        urgency: scoring.urgency,
        intentScore: scoring.intentScore,
        probability: scoring.probability,
      },
    });

    return res.json({ ...updated, scoring });
  } catch (error: any) {
    logger.error('Error actualizando etapa de lead', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al actualizar etapa de lead' });
  }
});

// Crear / actualizar showing asociado a un lead
router.post('/:id/showings', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    const id = Number(req.params.id);
    const { scheduledAt, visitType, notes } = req.body as { scheduledAt: string; visitType?: string; notes?: string };
    if (Number.isNaN(id) || !scheduledAt) {
      return res.status(400).json({ error: 'ID de lead y fecha/hora de visita son obligatorios' });
    }

    const lead = await (prisma as any).lead.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!lead || !lead.property) {
      return res.status(404).json({ error: 'Lead o propiedad asociada no encontrada' });
    }

    const role = req.user.role;
    const isBrokerOwner = lead.brokerId === req.user.id;
    const isAdmin = role === 'admin';
    if (!isBrokerOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para coordinar visitas para este lead' });
    }

    const showing = await (prisma as any).showing.create({
      data: {
        leadId: lead.id,
        propertyId: lead.propertyId!,
        brokerId: lead.brokerId,
        renterId: lead.renterId,
        scheduledAt: new Date(scheduledAt),
        visitType: visitType ?? 'in_person',
        status: 'scheduled',
        notes,
      },
    });

    await (prisma as any).leadActivity.create({
      data: {
        leadId: id,
        actorId: req.user.id,
        type: 'note',
        description: `Visita agendada para ${showing.scheduledAt.toISOString()}`,
      },
    });

    return res.status(201).json(showing);
  } catch (error: any) {
    logger.error('Error creando showing', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al crear showing' });
  }
});

// Analizar/scoring de un lead usando reglas o IA generativa cuando esté disponible
router.post('/:id/analyze', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const lead = await (prisma as any).lead.findUnique({
      where: { id },
      include: {
        activities: true,
        showings: true,
        property: { select: { id: true, title: true, location: true, price: true } },
        renter: { select: { id: true, name: true, email: true } },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const role = req.user.role;
    const isBrokerOwner = lead.brokerId === req.user.id;
    const isAdmin = role === 'admin';
    if (!isBrokerOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para analizar este lead' });
    }

    // Modo base: scoring por reglas locales (si IA generativa no está configurada o falla)
    const baseScoring = await computeLeadScoring(id);

    // Por ahora, devolvemos el scoring basado en reglas; más adelante se puede
    // integrar con /api/ai/generate para explicaciones más ricas si Ollama está disponible.
    await (prisma as any).lead.update({
      where: { id },
      data: {
        urgency: baseScoring.urgency,
        intentScore: baseScoring.intentScore,
        probability: baseScoring.probability,
      },
    });

    return res.json({
      leadId: id,
      scoring: baseScoring,
    });
  } catch (error: any) {
    logger.error('Error analizando lead', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al analizar lead' });
  }
});

// Checklist de documentos (Application Readiness) para un lead
router.get('/:id/documents', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const lead = await (prisma as any).lead.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const isRenter = lead.renterId === req.user.id;
    const isBrokerOwner = lead.brokerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isRenter && !isBrokerOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para ver estos documentos' });
    }

    return res.json({ documents: lead.documents });
  } catch (error: any) {
    logger.error('Error obteniendo documentos de lead', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al obtener documentos del lead' });
  }
});

// Actualizar estado de documentos:
// - brokers/admin: pueden cambiar estado (pending/received/approved/rejected) y URL
// - renters: solo deberían subir documentos desde un endpoint dedicado (no aquí)
router.patch('/:id/documents', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const lead = await (prisma as any).lead.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const isBrokerOwner = lead.brokerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isBrokerOwner && !isAdmin) {
      return res.status(403).json({ error: 'Solo brokers asignados o admins pueden actualizar documentos' });
    }

    const updates = (req.body?.documents || []) as Array<{
      id?: number;
      type: string;
      status?: string;
      url?: string;
      metadata?: any;
    }>;

    const results: any[] = [];

    for (const doc of updates) {
      if (doc.id) {
        const updated = await (prisma as any).leadDocument.update({
          where: { id: doc.id },
          data: {
            status: doc.status ?? undefined,
            url: doc.url ?? undefined,
            metadata: doc.metadata ? JSON.stringify(doc.metadata) : undefined,
          },
        });
        results.push(updated);
      } else {
        const created = await (prisma as any).leadDocument.create({
          data: {
            leadId: id,
            type: doc.type,
            status: doc.status ?? 'pending',
            url: doc.url ?? null,
            metadata: doc.metadata ? JSON.stringify(doc.metadata) : null,
          },
        });
        results.push(created);
      }
    }

    // Registrar actividad
    await (prisma as any).leadActivity.create({
      data: {
        leadId: id,
        actorId: req.user.id,
        type: 'note',
        description: 'Checklist de documentos actualizada',
      },
    });

    return res.json({ documents: results });
  } catch (error: any) {
    logger.error('Error actualizando documentos de lead', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al actualizar documentos del lead' });
  }
});

// Upload de documentos por parte del renter (solo URL)
router.post('/:id/documents/upload', auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const lead = await (prisma as any).lead.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const isRenter = lead.renterId === req.user.id;
    if (!isRenter) {
      return res.status(403).json({ error: 'Solo el renter asociado puede subir documentos para este lead' });
    }

    const { type, url } = req.body as { type?: string; url?: string };
    if (!type || !url) {
      return res.status(400).json({ error: 'type y url son obligatorios' });
    }

    // Validación estricta (OCR) solo para identidad del renter en alquiler
    // - `id_photo`: foto solo del documento
    // - `id_selfie`: selfie con el DNI en la mano
    // Nota: por ahora usamos el mismo verificador `dni` para ambas imágenes.
    const needsIdentityVerification = type === 'id_photo' || type === 'id_selfie' || type === 'id';
    let verification = null;
    let status: string = 'received';
    let metadata: any = null;

    if (needsIdentityVerification) {
      verification = await verifyDocumentAutomatically(url, 'dni');
      status = verification.verified ? 'approved' : 'rejected';
      metadata = {
        verified: verification.verified,
        score: verification.score,
        reason: verification.reason,
        extractedData: verification.extractedData ?? null,
        // Para auditoría visual del caso: qué tipo de checklist se validó
        checklistType: type,
      };
    }

    const created = await (prisma as any).leadDocument.create({
      data: {
        leadId: id,
        type,
        status,
        url,
        metadata,
      },
    });

    await (prisma as any).leadActivity.create({
      data: {
        leadId: id,
        actorId: req.user.id,
        type: 'note',
        description: needsIdentityVerification
          ? `Renter subió ${type} y fue validado automáticamente (${status})`
          : `Renter subió documento de tipo ${type}`,
      },
    });

    return res.status(201).json({ document: created });
  } catch (error: any) {
    logger.error('Error subiendo documento de renter', 'Lead', error as Error);
    return res.status(500).json({ error: 'Error al subir documento' });
  }
});

export default router;

