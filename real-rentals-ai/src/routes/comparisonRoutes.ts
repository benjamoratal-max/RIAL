import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Comparar múltiples propiedades
router.post('/compare', async (req, res) => {
  try {
    const { propertyIds } = req.body;

    if (!Array.isArray(propertyIds) || propertyIds.length < 2 || propertyIds.length > 4) {
      return res.status(400).json({ error: 'Debes proporcionar entre 2 y 4 IDs de propiedades' });
    }

    const properties = await prisma.property.findMany({
      where: {
        id: { in: propertyIds.map((id: string) => parseInt(id)) },
      },
      include: {
        images: true,
        reviews: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (properties.length !== propertyIds.length) {
      return res.status(404).json({ error: 'Algunas propiedades no fueron encontradas' });
    }

    // Calcular promedios y estadísticas para cada propiedad
    const comparisonPromises = properties.map(async (p) => {
      const imageUrls = p.images ? p.images.map((img: any) => img.url) : [];
      const averageRating = p.reviews.length > 0
        ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
        : 0;

      // Verificar disponibilidad
      const approvedLease = await prisma.leaseRequest.findFirst({
        where: { propertyId: p.id, status: 'approved' },
      });

      return {
        id: p.id,
        title: p.title,
        location: p.location,
        price: p.price,
        description: p.description,
        images: imageUrls,
        owner: p.owner,
        bedrooms: p.bedrooms || null,
        bathrooms: p.bathrooms || null,
        area: p.area || null,
        propertyType: p.propertyType || null,
        verified: p.verified,
        averageRating: Number(averageRating.toFixed(2)),
        reviewsCount: p.reviews.length,
        isAvailable: !approvedLease,
        createdAt: p.createdAt,
      };
    });

    const comparisonData = await Promise.all(comparisonPromises);

    res.json({
      properties: comparisonData,
      comparison: {
        priceRange: {
          min: Math.min(...comparisonData.map(p => p.price)),
          max: Math.max(...comparisonData.map(p => p.price)),
          average: comparisonData.reduce((sum, p) => sum + p.price, 0) / comparisonData.length,
        },
        ratingRange: {
          min: Math.min(...comparisonData.map(p => p.averageRating)),
          max: Math.max(...comparisonData.map(p => p.averageRating)),
          average: comparisonData.reduce((sum, p) => sum + p.averageRating, 0) / comparisonData.length,
        },
        availableCount: comparisonData.filter(p => p.isAvailable).length,
        verifiedCount: comparisonData.filter(p => p.verified).length,
      },
    });
  } catch (error) {
    console.error('Error comparing properties:', error);
    res.status(500).json({ error: 'Error al comparar propiedades' });
  }
});

// Guardar comparación en historial (si el usuario está autenticado)
router.post('/save', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { propertyIds, name } = req.body;

    if (!Array.isArray(propertyIds) || propertyIds.length < 2) {
      return res.status(400).json({ error: 'Debes proporcionar al menos 2 IDs de propiedades' });
    }

    // Aquí podrías guardar la comparación en una tabla de historial si es necesario
    // Por ahora solo devolvemos la comparación
    res.json({ message: 'Comparación guardada (funcionalidad pendiente)' });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar comparación' });
  }
});

export default router;

