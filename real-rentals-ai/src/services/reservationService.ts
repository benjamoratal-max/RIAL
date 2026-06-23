import prisma from '../lib/prisma';
import NotificationService from '../utils/notificationService';
import { cache, CacheKeys } from '../utils/cache';
import { isStripeEnabled, createCheckoutSession, getStripe } from './stripeService';
import { sendPushToUser } from './pushService';
import { logger } from '../utils/logger';

export const DEPOSIT_PERCENT = 0.5;
export const BALANCE_DEADLINE_HOURS = 48;

/**
 * Invalida los cachés que dependen de la disponibilidad de una propiedad.
 * Se llama cuando una reserva cambia de estado (seña pagada, completada o
 * expirada) para que el listado y la ficha reflejen "alquilada" al instante.
 */
function invalidatePropertyAvailabilityCaches(propertyId: number) {
  try {
    cache.delete(CacheKeys.propertySummary(propertyId));
    cache.deleteByPrefix('properties:');
  } catch {
    /* el caché es best-effort; nunca debe romper el flujo de pago */
  }
}

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

    // El hold venció: la propiedad vuelve a estar disponible para otros.
    invalidatePropertyAvailabilityCaches(reservation.propertyId);

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

const RESERVATION_INCLUDE = {
  property: { select: { id: true, title: true, location: true, price: true, ownerId: true } },
} as const;

/** Email del inquilino (para el recibo de Stripe). Best-effort: nunca rompe el flujo. */
async function getUserEmail(userId: number): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  } catch {
    return null;
  }
}

/** Nombre del usuario (para mensajes legibles). Best-effort. */
async function getUserName(userId: number): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name?.trim() || 'Un inquilino';
  } catch {
    return 'Un inquilino';
  }
}

/**
 * Avisa al broker dueño de la propiedad sobre el avance de una reserva: notificación
 * in-app (campanita) + Web Push al dispositivo. Best-effort: nunca rompe el flujo de pago.
 * - 'reserved': un inquilino pagó la seña y bloqueó la propiedad 48 h.
 * - 'rented':   un inquilino completó el pago; la propiedad quedó alquilada.
 */
async function notifyBrokerOfReservation(reservation: any, kind: 'reserved' | 'rented') {
  try {
    const brokerId: number | null = reservation.property?.ownerId ?? null;
    if (!brokerId) return;

    const propertyTitle = reservation.property?.title || 'tu propiedad';
    const tenantName = await getUserName(reservation.userId);

    const title = kind === 'reserved' ? 'Propiedad reservada' : '¡Propiedad alquilada!';
    const message =
      kind === 'reserved'
        ? `${tenantName} pagó la seña de "${propertyTitle}". La propiedad quedó reservada mientras completa el saldo.`
        : `${tenantName} completó el pago de "${propertyTitle}". La adquisición está confirmada.`;
    const type = kind === 'rented' ? 'success' : 'info';

    await NotificationService.createNotification(brokerId, title, message, type).catch(() => {});
    await sendPushToUser(brokerId, {
      title,
      body: message,
      url: '/?brokerView=listings',
      tag: `reservation-${reservation.id}-${kind}`,
    }).catch(() => {});
  } catch {
    /* nunca debe romper el flujo de pago */
  }
}

/**
 * Transición común "seña pagada": marca la reserva como deposit_paid, arranca el
 * plazo de 48 h, refresca cachés de disponibilidad y notifica. La comparten el modo
 * simulado y el modo Stripe (fulfillment vía webhook).
 */
async function applyDepositPaid(reservation: any, paymentId: number) {
  const depositPaidAt = new Date();
  const balanceDueAt = addHours(depositPaidAt, BALANCE_DEADLINE_HOURS);

  const updated = await (prisma as any).rentalReservation.update({
    where: { id: reservation.id },
    data: {
      status: 'deposit_paid',
      depositPaidAt,
      balanceDueAt,
      depositPaymentId: paymentId,
    },
    include: RESERVATION_INCLUDE,
  });

  // La propiedad pasa a estar reservada: refrescar listado y ficha.
  invalidatePropertyAvailabilityCaches(reservation.propertyId);

  await NotificationService.createNotification(
    reservation.userId,
    'Seña registrada',
    `Tenés 48 horas (hasta ${balanceDueAt.toLocaleString('es-AR')}) para completar el pago del saldo o perdés la seña.`,
    'success'
  ).catch(() => {});

  // Avisar al broker dueño de la propiedad (in-app + push al dispositivo).
  await notifyBrokerOfReservation(updated, 'reserved');

  return updated;
}

/**
 * Transición común "saldo pagado": marca la reserva como completed, refresca cachés
 * y notifica. Compartida por el modo simulado y el modo Stripe.
 */
async function applyBalancePaid(reservation: any, paymentId: number) {
  const updated = await (prisma as any).rentalReservation.update({
    where: { id: reservation.id },
    data: {
      status: 'completed',
      balancePaidAt: new Date(),
      balancePaymentId: paymentId,
    },
    include: RESERVATION_INCLUDE,
  });

  // Alquiler confirmado: la propiedad queda ocupada de forma definitiva.
  invalidatePropertyAvailabilityCaches(reservation.propertyId);

  await NotificationService.createNotification(
    reservation.userId,
    'Pago completado',
    'Completaste el pago de tu reserva. Pronto habilitaremos el acceso digital según el contrato.',
    'success'
  ).catch(() => {});

  // Avisar al broker dueño de la propiedad que se concretó la adquisición.
  await notifyBrokerOfReservation(updated, 'rented');

  return updated;
}

/** Marca el saldo como vencido y la seña como perdida cuando pasó el plazo de 48 h. */
async function markBalanceExpired(reservation: any) {
  await (prisma as any).rentalReservation.update({
    where: { id: reservation.id },
    data: { status: 'expired' },
  });
  if (reservation.depositPaymentId) {
    await prisma.payment.update({
      where: { id: reservation.depositPaymentId },
      data: { status: 'forfeited' },
    });
  }
}

/**
 * MODO SIMULADO de la seña (sin Stripe configurado): crea el pago, lo da por
 * pagado al instante y lo confirma tras un breve delay. Útil en desarrollo.
 */
export async function payDeposit(reservationId: number, userId: number, paymentMethod = 'stripe') {
  const reservation = await getReservationForUser(reservationId, userId);
  if (reservation.status !== 'pending_deposit') {
    const err = new Error('La seña ya fue abonada o la reserva no está pendiente');
    (err as any).statusCode = 400;
    throw err;
  }

  // Revalidar que nadie haya tomado la propiedad entre la creación de la reserva
  // y el pago de la seña (evita doble reserva por carrera entre dos inquilinos).
  await assertNoConflictingHold(reservation.propertyId, userId);

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

  const updated = await applyDepositPaid(reservation, payment.id);
  await simulatePaymentCompletion(payment.id);

  return { reservation: updated, payment };
}

/**
 * MODO SIMULADO del saldo (sin Stripe configurado).
 */
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
    await markBalanceExpired(reservation);
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

  const updated = await applyBalancePaid(reservation, payment.id);
  await simulatePaymentCompletion(payment.id);

  return { reservation: updated, payment };
}

// ────────────────────────────────────────────────────────────────────────────
//  MODO STRIPE (cobro real con tarjeta vía Stripe Checkout)
//  Estas funciones crean la sesión de pago; la reserva SOLO cambia de estado
//  cuando Stripe confirma el cobro vía webhook (fulfillCheckoutSession).
// ────────────────────────────────────────────────────────────────────────────

/** Crea la sesión de Checkout para la SEÑA y devuelve la URL a la que redirigir. */
export async function startDepositCheckout(reservationId: number, userId: number) {
  const reservation = await getReservationForUser(reservationId, userId);
  if (reservation.status !== 'pending_deposit') {
    const err = new Error('La seña ya fue abonada o la reserva no está pendiente');
    (err as any).statusCode = 400;
    throw err;
  }
  await assertNoConflictingHold(reservation.propertyId, userId);

  const payment = await prisma.payment.create({
    data: {
      userId,
      propertyId: reservation.propertyId,
      amount: reservation.depositAmount,
      paymentMethod: 'stripe',
      paymentType: 'reservation_deposit',
      description: `Seña (50%) — ${reservation.property?.title || 'Propiedad'}`,
      status: 'pending',
    },
  });

  const customerEmail = await getUserEmail(userId);
  const session = await createCheckoutSession({
    reservation,
    kind: 'deposit',
    paymentId: payment.id,
    customerEmail,
  });

  // Guardamos el id de sesión para trazabilidad (se sobrescribe con el
  // payment_intent al confirmarse el cobro).
  await prisma.payment.update({
    where: { id: payment.id },
    data: { transactionId: session.id },
  });

  return { checkoutUrl: session.url, sessionId: session.id, payment };
}

/** Crea la sesión de Checkout para el SALDO y devuelve la URL a la que redirigir. */
export async function startBalanceCheckout(reservationId: number, userId: number) {
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
    await markBalanceExpired(reservation);
    const err = new Error('El plazo de 48 horas venció. La seña no es reembolsable.');
    (err as any).statusCode = 410;
    throw err;
  }

  const payment = await prisma.payment.create({
    data: {
      userId,
      propertyId: reservation.propertyId,
      amount: reservation.balanceAmount,
      paymentMethod: 'stripe',
      paymentType: 'reservation_balance',
      description: `Saldo restante — ${reservation.property?.title || 'Propiedad'}`,
      status: 'pending',
    },
  });

  const customerEmail = await getUserEmail(userId);
  const session = await createCheckoutSession({
    reservation,
    kind: 'balance',
    paymentId: payment.id,
    customerEmail,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { transactionId: session.id },
  });

  return { checkoutUrl: session.url, sessionId: session.id, payment };
}

/**
 * Inicia el pago (seña o saldo) eligiendo automáticamente el modo según haya o no
 * claves de Stripe. Si Stripe está activo devuelve `{ checkoutUrl }` para redirigir;
 * si no, ejecuta el cobro simulado y devuelve la reserva ya actualizada.
 */
export async function initiateReservationPayment(
  reservationId: number,
  userId: number,
  kind: 'deposit' | 'balance'
) {
  if (isStripeEnabled()) {
    const result =
      kind === 'deposit'
        ? await startDepositCheckout(reservationId, userId)
        : await startBalanceCheckout(reservationId, userId);
    return { stripe: true as const, checkoutUrl: result.checkoutUrl };
  }

  const result =
    kind === 'deposit'
      ? await payDeposit(reservationId, userId)
      : await payBalance(reservationId, userId);
  return { stripe: false as const, ...result };
}

/**
 * Confirma un cobro de Stripe a partir de la sesión de Checkout completada.
 * Lo invoca EXCLUSIVAMENTE el webhook (única fuente de verdad del pago). Es
 * idempotente: si la reserva ya avanzó de estado, no hace nada.
 */
export async function fulfillCheckoutSession(session: {
  metadata?: Record<string, string> | null;
  payment_intent?: string | { id: string } | null;
  id?: string;
}) {
  const reservationId = Number(session.metadata?.reservationId);
  const kind = session.metadata?.kind as 'deposit' | 'balance' | undefined;
  const paymentId = Number(session.metadata?.paymentId);

  if (!reservationId || !kind || !paymentId) {
    logger.warn(`Webhook Stripe sin metadata válida (session=${session.id})`, 'Stripe');
    return;
  }

  const reservation = await (prisma as any).rentalReservation.findUnique({
    where: { id: reservationId },
    include: RESERVATION_INCLUDE,
  });
  if (!reservation) {
    logger.warn(`Webhook Stripe: reserva ${reservationId} no encontrada`, 'Stripe');
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  const finalTxnId = paymentIntentId || session.id || undefined;

  if (kind === 'deposit') {
    if (reservation.status !== 'pending_deposit') {
      logger.info(`Webhook deposit ya procesado (reserva=${reservationId})`, 'Stripe');
      return; // idempotente
    }
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'completed', transactionId: finalTxnId },
    });
    await applyDepositPaid(reservation, paymentId);
  } else {
    if (reservation.status !== 'deposit_paid') {
      logger.info(`Webhook balance no aplicable (reserva=${reservationId}, estado=${reservation.status})`, 'Stripe');
      return; // idempotente / fuera de plazo ya gestionado
    }
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'completed', transactionId: finalTxnId },
    });
    await applyBalancePaid(reservation, paymentId);
  }

  await NotificationService.notifyPaymentCompleted(paymentId).catch(() => {});
  logger.info(`Cobro Stripe confirmado (${kind}) reserva=${reservationId} pago=${paymentId}`, 'Stripe');
}

/**
 * Confirma un pago al volver de Stripe Checkout (success_url con session_id).
 * Complementa al webhook: útil en local si stripe listen no está corriendo y
 * mejora la UX al actualizar el estado de inmediato. Idempotente vía fulfillCheckoutSession.
 */
export async function confirmCheckoutSession(
  reservationId: number,
  userId: number,
  sessionId: string
) {
  if (!isStripeEnabled()) {
    const err = new Error('Stripe no está configurado');
    (err as any).statusCode = 503;
    throw err;
  }

  await getReservationForUser(reservationId, userId);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const metaReservationId = Number(session.metadata?.reservationId);
  const metaUserId = Number(session.metadata?.userId);
  if (metaReservationId !== reservationId || metaUserId !== userId) {
    const err = new Error('La sesión de pago no corresponde a esta reserva');
    (err as any).statusCode = 403;
    throw err;
  }

  if (session.payment_status !== 'paid') {
    const err = new Error('El pago aún no está confirmado por Stripe');
    (err as any).statusCode = 409;
    throw err;
  }

  await fulfillCheckoutSession(session);
  return getReservationForUser(reservationId, userId);
}
