import express from 'express';
import prisma from '../lib/prisma';
import path from 'path';
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'fs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireVerification } from '../middleware/requireVerification';
import { asyncHandler } from '../middleware/errorHandler';
import { buildContractPdfContent } from '../utils/leaseContractTemplate';
import NotificationService from '../utils/notificationService';
import { updateLeaseRequestScreening } from '../services/screeningService';
import { cache, CacheKeys } from '../utils/cache';

const router = express.Router();

// Obtener todas las solicitudes de alquiler
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  try {
    const leases = await prisma.leaseRequest.findMany({
      include: { user: true, property: true },
    });
    res.json(leases);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener solicitudes de alquiler' });
  }
}));

// Crear una nueva solicitud de alquiler (requiere verificación)
router.post('/', authenticateToken, requireVerification, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  
  const { propertyId, durationMonths } = req.body;
  const userId = req.user.id;

  if (!propertyId || !durationMonths) {
    return res.status(400).json({ error: 'propertyId y durationMonths son requeridos' });
  }

  try {
    // Comprobar si la propiedad ya está alquilada (status approved)
    const existingLease = await prisma.leaseRequest.findFirst({
      where: {
        propertyId: parseInt(propertyId),
        status: 'approved',
      },
    });

    if (existingLease) {
      return res.status(400).json({ error: 'La propiedad ya está alquilada actualmente' });
    }

    const newLease = await prisma.leaseRequest.create({
      data: {
        userId,
        propertyId: parseInt(propertyId),
        durationMonths: parseInt(durationMonths),
        status: 'pending',
      },
    });

    setImmediate(async () => {
      try {
        await updateLeaseRequestScreening(newLease.id);
      } catch (_) {}
    });

    NotificationService.notifyLeaseRequest(newLease.id).catch(() => {});
    NotificationService.createNotification(
      userId,
      'Solicitud recibida',
      'Tu solicitud de alquiler fue recibida. El propietario la revisará y te contactará en 24-48 horas.',
      'info'
    ).catch(() => {});

    res.status(201).json(newLease);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear la solicitud de alquiler' });
  }
}));

// Marcar que el propietario respondió (para priorización y follow-up)
router.patch('/:id/responded', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const id = Number(req.params.id);
  const lease = await prisma.leaseRequest.findUnique({ where: { id }, include: { property: true } });
  if (!lease) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const prop = lease.property as any;
  if (prop.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  await prisma.leaseRequest.update({
    where: { id },
    data: { ownerRespondedAt: new Date() },
  });
  res.json({ ok: true });
}));

// Cambiar el estado de una solicitud (aprobación/rechazo).
// Solo el dueño de la propiedad (broker) o un admin pueden hacerlo.
router.put('/:id/status', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { status } = req.body; // 'approved' o 'rejected'
  const { id } = req.params;

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: "status debe ser 'approved' o 'rejected'" });
  }

  // Verificar permiso antes de modificar nada.
  const existing = await prisma.leaseRequest.findUnique({
    where: { id: Number(id) },
    include: { property: { select: { ownerId: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const isOwner = (existing.property as any)?.ownerId === req.user.id;
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No tenés permiso para gestionar esta solicitud' });
  }

  // No se puede aprobar una solicitud sobre una propiedad ya alquilada por otro.
  if (status === 'approved') {
    const otherApproved = await prisma.leaseRequest.findFirst({
      where: { propertyId: existing.propertyId, status: 'approved', NOT: { id: Number(id) } },
      select: { id: true },
    });
    if (otherApproved) {
      return res.status(409).json({ error: 'La propiedad ya tiene una solicitud aprobada' });
    }
  }

  try {
    const lease = await prisma.leaseRequest.update({
      where: { id: Number(id) },
      data: { status },
      include: { user: true, property: true },
    });

    // Si se aprueba, generar contrato en PDF completo y profesional
    if (status === 'approved') {
      const contractsDir = path.join(__dirname, '../../contracts');
      mkdirSync(contractsDir, { recursive: true });

      const fileName = `lease_contract_${lease.id}.pdf`;
      const filePath = path.join(contractsDir, fileName);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      doc.pipe(createWriteStream(filePath));

      const startDate = new Date();
      const contractData = {
        propertyTitle: lease.property.title,
        propertyLocation: lease.property.location ?? 'No especificada',
        tenantName: lease.user.name,
        tenantEmail: lease.user.email,
        durationMonths: lease.durationMonths,
        startDate: startDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        generationDate: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        monthlyPrice: lease.property.price ?? undefined,
      };

      buildContractPdfContent(doc, contractData);
      doc.end();

      // Asegurar registro de contrato (idempotente si ya existe)
      await prisma.leaseContract.upsert({
        where: { leaseRequestId: lease.id },
        create: {
          leaseRequestId: lease.id,
          pdfUrl: `/contracts/${fileName}`,
        },
        update: {
          pdfUrl: `/contracts/${fileName}`,
        },
      });
    }

    // Aprobar/rechazar cambia la disponibilidad: refrescar listado y ficha.
    cache.delete(CacheKeys.propertySummary(lease.propertyId));
    cache.deleteByPrefix('properties:');

    res.json({ message: `Solicitud ${status}`, leaseId: lease.id });
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar el estado de la solicitud' });
  }
}));

// Obtener la URL del contrato asociado a una solicitud
router.get('/:id/contract', async (req, res) => {
  const { id } = req.params;

  try {
    const contract = await prisma.leaseContract.findUnique({
      where: { leaseRequestId: Number(id) },
    });

    if (!contract || !contract.pdfUrl) {
      return res.status(404).json({ error: 'Contrato no encontrado para esta solicitud' });
    }

    // Opción A: devolver la URL pública (recomendado para frontend)
    return res.json({ url: contract.pdfUrl });

    // --- Opción B: enviar el archivo directamente (si preferís descargar desde este endpoint) ---
    // const absolutePath = path.join(__dirname, `../../${contract.pdfUrl}`);
    // return res.sendFile(absolutePath);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener el contrato' });
  }
});

export default router;