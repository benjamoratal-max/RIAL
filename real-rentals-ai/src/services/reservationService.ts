import prisma from '../lib/prisma';
import NotificationService from '../utils/notificationService';

export const DEPOSIT_PERCENT = 0.5;
export const BALANCE_DEADLINE_HOURS = 48;

export type ReservationStatus =
  | 'pending_deposit'
  | 'deposit_paid'
  | 'completed'
  | 'expired'
  | 'cancelled';

export function calculateReservationAmounts(
  monthlyRent: number,
  durationMonths: number,
  securityDeposit = 0
) {
  const rentTotal = monthlyRent * durationMonths;
  const totalAmount = rentTotal + securityDeposit;
  const depositAmount = Math.round(totalAmount * DEPOSIT_PERCENT * 100) / 100;
  const balanceAmount = Math.round((totalAmount - depositAmount) * 100) / 100;
  return { rentTotal, totalAmount, depositAmount, balanceAmount, securityDeposit };
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function expireStaleReservations(): Promise<number> {
  const now = new Date();
  const stale = await (prisma as any).rentalReservation.findMany({
    where: {
      status: 'deposit_paid',
      balanceDueAt: { lt: now },
    },
  });

  for (const reservation of stale) {
    await (prisma as any).rentalReservation.update({
      where: { id: reservation.id },
      data: { status: 'expired', updatedAt: now },
    });

    if (reservation.depositPaymentId) {
      await prisma.payment.update({
        where: { id: reservation.depositPaymentId },
        data: {
          status: 'forfeited',
          description: 'Seña perdida — plazo de 48 h vencido sin completar el pago',
        },
      });
    }

    await NotificationService.createNotification(
      reservation.userId,
      'Plazo de pago vencido',
      'No completaste el pago del saldo en 48 horas. La seña de esta reserva no es reembolsable.',
      'warning'
    ).catch(() => {});
  }

  return stale.length;
}

async function simulatePaymentCompletion(paymentId: number) {
  setTimeout(async () => {
    try {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'completed' },
      });
      await NotificationService.notifyPaymentCompleted(paymentId);
    } catch {
      /* non-critical */
    }
  }, 1500);
}

export async function assertNoConflictingHold(propertyId: number, userId: number) {
  await expireStaleReservations();

  const conflict = await (prisma as any).rentalReservation.findFirst({
    where: {
      propertyId,
      status: { in: ['deposit_paid', 'completed'] },
      NOT: { userId },
    },
  });

  if (conflict) {
    const err = new Error('Esta propiedad tiene una reserva activa de otro inquilino');
    (err as any).statusCode = 409;
    throw err;
  }
}

export async function createReservation(input: {
  userId: number;
  propertyId: number;
  durationMonths: number;
  startDate?: string | null;
  leaseRequestId?: number | null;
  securityDeposit?: number;
}) {
  const property = await prisma.property.findUnique({ where: { id: input.propertyId } });
  if (!property) {
    const err = new Error('Propiedad no encontrada');
    (err as any).statusCode = 404;
    throw err;
  }

  await assertNoConflictingHold(input.propertyId, input.userId);

  const securityDeposit =
    typeof input.securityDeposit === 'number' && input.securityDeposit >= 0
      ? input.securityDeposit
      : property.price;
  const amounts = calculateReservationAmounts(
    property.price,
    input.durationMonths,
    securityDeposit
  );

  const reservation = await (prisma as any).rentalReservation.create({
    data: {
      userId: input.userId,
      propertyId: input.propertyId,
      leaseRequestId: input.leaseRequestId ?? null,
      status: 'pending_deposit',
      durationMonths: input.durationMonths,
      startDate: input.startDate ? new Date(input.startDate) : null,
      monthlyRent: property.price,
      securityDeposit: amounts.securityDeposit,
      totalAmount: amounts.totalAmount,
      depositAmount: amounts.depositAmount,
      balanceAmount: amounts.balanceAmount,
    },
    include: {
      property: { select: { id: true, title: true, location: true, price: true } },
    },
  });

  return reservation;
}

export async function getReservationForUser(id: number, userId: number) {
  await expireStaleReservations();
  const reservation = await (prisma as any).rentalReservation.findFirst({
    where: { id, userId },
    include: {
      property: { select: { id: true, title: true, location: true, price: true } },
    },
  });
  if (!reservation) {
    const err = new Error('Reserva no encontrada');
    (err as any).statusCode = 404;
    throw err;
  }
  return reservation;
}

export async function payDeposit(reservationId: number, userId: number, paymentMethod = 'stripe') {
  const reservation = await getReservationForUser(reservationId, userId);
  if (reservation.status !== 'pending_deposit') {
    const err = new Error('La seña ya fue abonada o la reserva no está pendiente');
    (err as any).statusCode = 400;
    throw err;
  }

  const transactionId = `DEP_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const payment = await prisma.payment.create({
    data: {
      userId,
      propertyId: reservation.propertyId,
      amount: reservation.depositAmount,
      paymentMethod,
      paymentType: 'reservation_deposit',
      transactionId,
      description: `Seña (50%) — ${reservation.property?.title || 'Propiedad'}`,
      status: 'pending',
    },
  });

  const depositPaidAt = new Date();
  const balanceDueAt = addHours(depositPaidAt, BALANCE_DEADLINE_HOURS);

  const updated = await (prisma as any).rentalReservation.update({
    where: { id: reservationId },
    data: {
      status: 'deposit_paid',
      depositPaidAt,
      balanceDueAt,
      depositPaymentId: payment.id,
    },
    include: {
      property: { select: { id: true, title: true, location: true, price: true } },
    },
  });

  await simulatePaymentCompletion(payment.id);

  await NotificationService.createNotification(
    userId,
    'Seña registrada',
    `Tenés 48 horas (hasta ${balanceDueAt.toLocaleString('es-AR')}) para completar el pago del saldo o perdés la seña.`,
    'success'
  ).catch(() => {});

  return { reservation: updated, payment };
}

export async function payBalance(reservationId: number, userId: number, paymentMethod = 'stripe') {
  await expireStaleReservations();
  const reservation = await getReservationForUser(reservationId, userId);

  if (reservation.status === 'expired') {
    const err = new Error('El plazo de 48 horas venció. La seña no es reembolsable.');
    (err as any).statusCode = 410;
    throw err;
  }

  if (reservation.status !== 'deposit_paid') {
    const err = new Error('Primero debés abonar la seña');
    (err as any).statusCode = 400;
    throw err;
  }

  const now = new Date();
  if (reservation.balanceDueAt && now > reservation.balanceDueAt) {
    await (prisma as any).rentalReservation.update({
      where: { id: reservationId },
      data: { status: 'expired' },
    });
    if (reservation.depositPaymentId) {
      await prisma.payment.update({
        where: { id: reservation.depositPaymentId },
        data: { status: 'forfeited' },
      });
    }
    const err = new Error('El plazo de 48 horas venció. La seña no es reembolsable.');
    (err as any).statusCode = 410;
    throw err;
  }

  const transactionId = `BAL_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const payment = await prisma.payment.create({
    data: {
      userId,
      propertyId: reservation.propertyId,
      amount: reservation.balanceAmount,
      paymentMethod,
      paymentType: 'reservation_balance',
      transactionId,
      description: `Saldo restante — ${reservation.property?.title || 'Propiedad'}`,
      status: 'pending',
    },
  });

  const updated = await (prisma as any).rentalReservation.update({
    where: { id: reservationId },
    data: {
      status: 'completed',
      balancePaidAt: now,
      balancePaymentId: payment.id,
    },
    include: {
      property: { select: { id: true, title: true, location: true, price: true } },
    },
  });

  await simulatePaymentCompletion(payment.id);

  await NotificationService.createNotification(
    userId,
    'Pago completado',
    'Completaste el pago de tu reserva. Pronto habilitaremos el acceso digital según el contrato.',
    'success'
  ).catch(() => {});

  return { reservation: updated, payment };
}
