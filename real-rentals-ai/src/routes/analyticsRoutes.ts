import express from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { updateLeaseRequestScreening } from '../services/screeningService';

const router = express.Router();

const FOLLOW_UP_HOURS = 24;

// Dashboard de analytics para propietarios
router.get('/owner/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo propietarios pueden acceder a este dashboard' });
    }

    const userId = req.user.id;

    // Obtener todas las propiedades del propietario
    const properties = await prisma.property.findMany({
      where: { ownerId: userId },
      include: {
        reviews: true,
        leaseRequests: true,
        images: true,
        views: true,
      },
    });

    // Calcular estadísticas
    const totalProperties = properties.length;
    const totalViews = properties.reduce((sum, p) => sum + p.views.length, 0);
    const totalReviews = properties.reduce((sum, p) => sum + p.reviews.length, 0);
    const averageRating = properties.reduce((sum, p) => {
      if (p.reviews.length === 0) return sum;
      const avg = p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length;
      return sum + avg;
    }, 0) / (totalProperties || 1);

    const totalLeaseRequests = properties.reduce((sum, p) => sum + p.leaseRequests.length, 0);
    const approvedLeases = properties.reduce((sum, p) => {
      return sum + p.leaseRequests.filter(lr => lr.status === 'approved').length;
    }, 0);

    const availableProperties = properties.filter(p => p.available).length;
    const occupiedProperties = totalProperties - availableProperties;

    // Estadísticas de precios (calcular de forma async)
    const revenuePromises = properties.map(async (p) => {
      const payments = await prisma.payment.findMany({
        where: { propertyId: p.id, status: 'completed' },
      });
      return payments.reduce((sum, pay) => sum + pay.amount, 0);
    });
    const revenues = await Promise.all(revenuePromises);
    const totalRevenue = revenues.reduce((sum, rev) => sum + rev, 0);

    // Vistas por propiedad
    const viewsByProperty = properties.map(p => ({
      propertyId: p.id,
      propertyTitle: p.title,
      views: p.views.length,
      uniqueViews: new Set(p.views.map(v => v.userId || v.ipAddress)).size,
    }));

    // Reviews por propiedad
    const reviewsByProperty = properties.map(p => ({
      propertyId: p.id,
      propertyTitle: p.title,
      reviewsCount: p.reviews.length,
      averageRating: p.reviews.length > 0
        ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
        : 0,
    }));

    // Interés por propiedad (solicitudes de alquiler)
    const interestByProperty = properties.map(p => ({
      propertyId: p.id,
      propertyTitle: p.title,
      leaseRequests: p.leaseRequests.length,
      approvedLeases: p.leaseRequests.filter(lr => lr.status === 'approved').length,
      pendingLeases: p.leaseRequests.filter(lr => lr.status === 'pending').length,
    }));

    // Vistas en el tiempo (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const viewsLast30Days = await (prisma as any).propertyView.groupBy({
      by: ['viewedAt'],
      where: {
        propertyId: { in: properties.map(p => p.id) },
        viewedAt: { gte: thirtyDaysAgo },
      },
      _count: { _all: true },
    });

    res.json({
      overview: {
        totalProperties,
        availableProperties,
        occupiedProperties,
        totalViews,
        totalReviews,
        averageRating: Number(averageRating.toFixed(2)),
        totalLeaseRequests,
        approvedLeases,
        conversionRate: totalViews > 0 ? Number(((Number(approvedLeases) / Number(totalViews)) * 100).toFixed(2)) : 0,
      },
      viewsByProperty,
      reviewsByProperty,
      interestByProperty,
      viewsLast30Days: viewsLast30Days.map((v: any) => ({
        date: v.viewedAt,
        count: v._count._all,
      })),
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Error al obtener analytics' });
  }
});

// Dashboard de analytics para brokers / broker_admin
router.get('/broker/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });

    if (req.user.role !== 'broker' && req.user.role !== 'broker_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo brokers o admins pueden acceder a este dashboard' });
    }

    const brokerId = req.user.role === 'admin' ? undefined : req.user.id;

    const whereLead: any = {};
    if (brokerId) whereLead.brokerId = brokerId;

    const leads = await (prisma as any).lead.findMany({
      where: whereLead,
      include: {
        showings: true,
      },
    });

    const totalLeads = leads.length;
    const byStage: Record<string, number> = {};
    let respondedLeads = 0;
    let totalResponseHours = 0;
    let showingsScheduled = 0;
    let showingsCompleted = 0;
    let applicationsReady = 0;
    let signedLeases = 0;

    leads.forEach((lead: any) => {
      const stage = lead.stage || 'new_inquiry';
      byStage[stage] = (byStage[stage] || 0) + 1;

      if (lead.lastInteractionAt) {
        respondedLeads += 1;
        const diffHours =
          (new Date(lead.lastInteractionAt).getTime() - new Date(lead.createdAt).getTime()) /
          (1000 * 60 * 60);
        if (!isNaN(diffHours) && diffHours >= 0) {
          totalResponseHours += diffHours;
        }
      }

      const leadShowings = lead.showings || [];
      showingsScheduled += leadShowings.filter((s: any) => s.status === 'scheduled').length;
      showingsCompleted += leadShowings.filter((s: any) => s.status === 'completed').length;

      if (stage === 'application_ready') applicationsReady += 1;
      if (stage === 'signed') signedLeases += 1;
    });

    const averageResponseHours =
      respondedLeads > 0 ? totalResponseHours / respondedLeads : 0;

    const overview = {
      totalLeads,
      leadsByStage: byStage,
      averageResponseHours: Number(averageResponseHours.toFixed(1)),
      showingsScheduled,
      showingsCompleted,
      applicationsReady,
      signedLeases,
      pipelineConversion: totalLeads > 0 ? Number(((signedLeases / totalLeads) * 100).toFixed(1)) : 0,
      funnel: {
        leads: totalLeads,
        leadsWithShowings:
          showingsScheduled > 0
            ? leads.filter((l: any) => (l.showings || []).some((s: any) => s.status === 'scheduled' || s.status === 'completed')).length
            : 0,
        applicationReady: applicationsReady,
        signed: signedLeases,
      },
    };

    // Productividad por broker/equipo (solo cuando se consulta como admin/broker_admin)
    let productivityByBroker: any[] = [];
    if (req.user.role === 'broker_admin' || req.user.role === 'admin') {
      const brokerAggregation = await (prisma as any).lead.groupBy({
        by: ['brokerId'],
        where: whereLead,
        _count: { _all: true },
      });

      const brokerIds = brokerAggregation.map((b: any) => b.brokerId).filter((id: number | null) => !!id);
      const brokers = brokerIds.length
        ? await prisma.user.findMany({
            where: { id: { in: brokerIds } },
            select: { id: true, name: true, email: true, role: true },
          })
        : [];
      const brokerMap = new Map(brokers.map((b) => [b.id, b]));

      productivityByBroker = brokerAggregation.map((b: any) => {
        const brokerLeads = leads.filter((l: any) => l.brokerId === b.brokerId);
        const brokerShowingsScheduled = brokerLeads.reduce(
          (acc: number, l: any) => acc + (l.showings || []).filter((s: any) => s.status === 'scheduled').length,
          0,
        );
        const brokerShowingsCompleted = brokerLeads.reduce(
          (acc: number, l: any) => acc + (l.showings || []).filter((s: any) => s.status === 'completed').length,
          0,
        );
        const brokerApplicationsReady = brokerLeads.filter((l: any) => l.stage === 'application_ready').length;
        const brokerSigned = brokerLeads.filter((l: any) => l.stage === 'signed').length;

        return {
          brokerId: b.brokerId,
          broker: brokerMap.get(b.brokerId) || null,
          totalLeads: b._count._all,
          showingsScheduled: brokerShowingsScheduled,
          showingsCompleted: brokerShowingsCompleted,
          applicationsReady: brokerApplicationsReady,
          signedLeases: brokerSigned,
          conversionRate:
            b._count._all > 0 ? Number(((brokerSigned / b._count._all) * 100).toFixed(1)) : 0,
        };
      });
    }

    res.json({ overview, productivityByBroker });
  } catch (error) {
    console.error('Error getting broker analytics:', error);
    res.status(500).json({ error: 'Error al obtener analytics de broker' });
  }
});

// Leads para propietarios: solicitudes con screening, priorización y follow-up
router.get('/owner/leads', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo propietarios o admins' });
    }

    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id },
      select: { id: true, title: true, location: true },
    });
    const propertyIds = properties.map((p) => p.id);
    if (propertyIds.length === 0) return res.json({ leads: [], propertyMap: {} });

    let leads = await prisma.leaseRequest.findMany({
      where: { propertyId: { in: propertyIds } },
      include: { user: { select: { id: true, name: true, email: true, verified: true } }, property: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });

    for (const lead of leads) {
      if (lead.riskScore == null) {
        try {
          await updateLeaseRequestScreening(lead.id);
        } catch (_) {}
      }
    }
    leads = await prisma.leaseRequest.findMany({
      where: { propertyId: { in: propertyIds } },
      include: { user: { select: { id: true, name: true, email: true, verified: true } }, property: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - FOLLOW_UP_HOURS);

    const propertyMap: Record<number, { title: string; location: string }> = {};
    properties.forEach((p) => {
      propertyMap[p.id] = { title: p.title, location: p.location || '' };
    });

    const withPriority = leads.map((l) => {
      const needsFollowUp = l.status === 'pending' && l.createdAt < cutoff && !(l as any).ownerRespondedAt;
      const redFlags = (l as any).redFlags ? (JSON.parse((l as any).redFlags) as string[]) : [];
      return {
        ...l,
        redFlags,
        needsFollowUp,
        priorityScore: (needsFollowUp ? 100 : 0) + (100 - ((l as any).riskScore ?? 0)),
      };
    });

    withPriority.sort((a, b) => b.priorityScore - a.priorityScore);

    return res.json({ leads: withPriority, propertyMap });
  } catch (error) {
    console.error('Error getting leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// Estadísticas de una propiedad específica
router.get('/property/:propertyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { propertyId } = req.params;

    const property = await prisma.property.findUnique({
      where: { id: parseInt(propertyId) },
      include: {
        reviews: true,
        leaseRequests: true,
        views: true,
        images: true,
      },
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Verificar que el usuario es el propietario o admin
    if (property.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para ver estas estadísticas' });
    }

    const totalViews = property.views.length;
    const uniqueViews = new Set(property.views.map(v => v.userId || v.ipAddress)).size;
    const averageRating = property.reviews.length > 0
      ? property.reviews.reduce((sum, r) => sum + r.rating, 0) / property.reviews.length
      : 0;

    const leaseRequests = property.leaseRequests.length;
    const approvedLeases = property.leaseRequests.filter(lr => lr.status === 'approved').length;
    const pendingLeases = property.leaseRequests.filter(lr => lr.status === 'pending').length;

    // Vistas en el tiempo
    const viewsByDate = await (prisma as any).propertyView.groupBy({
      by: ['viewedAt'],
      where: { propertyId: parseInt(propertyId) },
      _count: { _all: true },
      orderBy: { viewedAt: 'asc' },
    });

    res.json({
      propertyId: property.id,
      propertyTitle: property.title,
      overview: {
        totalViews,
        uniqueViews,
        totalReviews: property.reviews.length,
        averageRating: Number(averageRating.toFixed(2)),
        leaseRequests,
        approvedLeases,
        pendingLeases,
        conversionRate: totalViews > 0 ? Number(((Number(approvedLeases) / Number(totalViews)) * 100).toFixed(2)) : 0,
      },
      viewsByDate: viewsByDate.map((v: any) => ({
        date: v.viewedAt,
        count: v._count._all,
      })),
      recentViews: property.views.slice(-10),
    });
  } catch (error) {
    console.error('Error getting property analytics:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de la propiedad' });
  }
});

export default router;

