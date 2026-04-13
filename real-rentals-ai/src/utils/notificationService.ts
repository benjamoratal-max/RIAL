import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class NotificationService {
  // Crear notificación para un usuario específico
  static async createNotification(userId: number, title: string, message: string, type: string = 'info') {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
        },
      });
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Notificar cuando se crea una nueva propiedad
  static async notifyNewProperty(propertyId: number) {
    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: { owner: true },
      });

      if (!property) return;

      // Notificar a todos los inquilinos sobre la nueva propiedad
      const tenants = await prisma.user.findMany({
        where: { role: 'tenant' },
      });

      const notifications = tenants.map(tenant =>
        this.createNotification(
          tenant.id,
          'Nueva propiedad disponible',
          `Se ha publicado una nueva propiedad: ${property.title} en ${property.location}`,
          'info'
        )
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying new property:', error);
    }
  }

  // Notificar cuando se envía una solicitud de alquiler
  static async notifyLeaseRequest(leaseRequestId: number) {
    try {
      const leaseRequest = await prisma.leaseRequest.findUnique({
        where: { id: leaseRequestId },
        include: {
          user: true,
          property: { include: { owner: true } },
        },
      });

      if (!leaseRequest || !leaseRequest.property.owner) return;

      // Notificar al propietario
      await this.createNotification(
        leaseRequest.property.owner.id,
        'Nueva solicitud de alquiler',
        `${leaseRequest.user.name} ha solicitado alquilar ${leaseRequest.property.title}`,
        'info'
      );
    } catch (error) {
      console.error('Error notifying lease request:', error);
    }
  }

  // Notificar cuando se aprueba/rechaza una solicitud
  static async notifyLeaseRequestStatus(leaseRequestId: number, status: string) {
    try {
      const leaseRequest = await prisma.leaseRequest.findUnique({
        where: { id: leaseRequestId },
        include: {
          user: true,
          property: true,
        },
      });

      if (!leaseRequest) return;

      const statusText = status === 'approved' ? 'aprobada' : 'rechazada';
      const type = status === 'approved' ? 'success' : 'warning';

      await this.createNotification(
        leaseRequest.userId,
        `Solicitud de alquiler ${statusText}`,
        `Tu solicitud para alquilar ${leaseRequest.property.title} ha sido ${statusText}`,
        type
      );
    } catch (error) {
      console.error('Error notifying lease request status:', error);
    }
  }

  // Notificar cuando se envía un mensaje
  static async notifyNewMessage(senderId: number, receiverId: number, messageContent: string) {
    try {
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
      });

      if (!sender) return;

      await this.createNotification(
        receiverId,
        'Nuevo mensaje',
        `${sender.name} te ha enviado un mensaje: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`,
        'info'
      );
    } catch (error) {
      console.error('Error notifying new message:', error);
    }
  }

  // Notificar cuando se completa un pago
  static async notifyPaymentCompleted(paymentId: number) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          property: true,
        },
      });

      if (!payment) return;

      await this.createNotification(
        payment.userId,
        'Pago completado',
        `Tu pago de $${payment.amount} por ${payment.property.title} ha sido procesado exitosamente`,
        'success'
      );
    } catch (error) {
      console.error('Error notifying payment completed:', error);
    }
  }

  // Notificar cuando se publica una nueva reseña
  static async notifyNewReview(reviewId: number) {
    try {
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          user: true,
          property: { include: { owner: true } },
        },
      });

      if (!review || !review.property.owner) return;

      // Notificar al propietario sobre la nueva reseña
      await this.createNotification(
        review.property.owner.id,
        'Nueva reseña',
        `${review.user.name} ha dejado una reseña de ${review.rating} estrellas para ${review.property.title}`,
        'info'
      );
    } catch (error) {
      console.error('Error notifying new review:', error);
    }
  }

  // Limpiar notificaciones antiguas (más de 30 días)
  static async cleanOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
          read: true,
        },
      });
    } catch (error) {
      console.error('Error cleaning old notifications:', error);
    }
  }
}

export default NotificationService;
