const express = require('express');
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const { createWriteStream, mkdirSync } = require('fs');
const path = require('path');

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todas las solicitudes de alquiler
router.get('/', async (req, res) => {
  try {
    const leases = await prisma.leaseRequest.findMany({
      include: { user: true, property: true },
    });
    res.json(leases);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes de alquiler' });
  }
});

// Crear una nueva solicitud de alquiler
router.post('/', async (req, res) => {
  const { userId, propertyId, durationMonths } = req.body;

  try {
    // Comprobar si la propiedad ya está alquilada (status approved)
    const existingLease = await prisma.leaseRequest.findFirst({
      where: {
        propertyId,
        status: 'approved',
      },
    });

    if (existingLease) {
      return res.status(400).json({ error: 'La propiedad ya está alquilada actualmente' });
    }

    const newLease = await prisma.leaseRequest.create({
      data: {
        userId,
        propertyId,
        durationMonths,
        status: 'pending', // pendiente de aprobación automática o por IA
      },
    });

    res.status(201).json(newLease);
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(400).json({ error: 'Error al crear la solicitud de alquiler' });
  }
});

// Cambiar el estado de una solicitud (aprobación/rechazo)
router.put('/:id/status', async (req, res) => {
  const { status } = req.body; // 'approved' o 'rejected'
  const { id } = req.params;

  try {
    const lease = await prisma.leaseRequest.update({
      where: { id: Number(id) },
      data: { status },
      include: { user: true, property: true },
    });

    // Si se aprueba, generar contrato en PDF
    if (status === 'approved') {
      // Crear carpeta contracts si no existe
      const contractsDir = path.join(__dirname, '../../contracts');
      mkdirSync(contractsDir, { recursive: true });

      const fileName = `lease_contract_${lease.id}.pdf`;
      const filePath = path.join(contractsDir, fileName);

      // Crear PDF
      const doc = new PDFDocument();
      doc.pipe(createWriteStream(filePath));

      doc.fontSize(18).text('CONTRATO DE ALQUILER', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Propiedad: ${lease.property.title}`);
      doc.text(`Ubicación: ${lease.property.location}`);
      doc.text(`Inquilino: ${lease.user.name} (${lease.user.email})`);
      doc.text(`Duración: ${lease.durationMonths} meses`);
      doc.moveDown();
      doc.text(`Fecha de inicio: ${new Date().toLocaleDateString()}`);
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`);
      doc.moveDown();
      doc.text('Este contrato fue generado automáticamente por la plataforma AI Broker.');
      doc.end();

      // Guardar en la base de datos
      await prisma.leaseContract.create({
        data: {
          leaseRequestId: lease.id,
          pdfUrl: `/contracts/${fileName}`,
        },
      });
    }

    res.json({ message: `Solicitud ${status}`, leaseId: lease.id });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(400).json({ error: 'Error al actualizar el estado de la solicitud' });
  }
});

// Obtener contrato de una solicitud específica
router.get('/:id/contract', async (req, res) => {
  const { id } = req.params;

  try {
    const leaseContract = await prisma.leaseContract.findUnique({
      where: { leaseRequestId: Number(id) },
      include: { 
        leaseRequest: { 
          include: { user: true, property: true } 
        } 
      }
    });

    if (!leaseContract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    res.json(leaseContract);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error al obtener el contrato' });
  }
});

// Descargar contrato
router.get('/:id/contract/download', async (req, res) => {
  const { id } = req.params;

  try {
    const leaseContract = await prisma.leaseContract.findUnique({
      where: { leaseRequestId: Number(id) }
    });

    if (!leaseContract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const filePath = path.join(__dirname, '../../contracts', `lease_contract_${id}.pdf`);
    
    // Verificar si el archivo existe
    if (!require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo de contrato no encontrado' });
    }

    res.download(filePath, `contrato_alquiler_${id}.pdf`);
  } catch (error) {
    console.error('Error al descargar contrato:', error);
    res.status(500).json({ error: 'Error al descargar el contrato' });
  }
});

module.exports = router;