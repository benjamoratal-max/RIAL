/**
 * Integración con Stripe Checkout para el cobro de reservas (seña + saldo).
 *
 * Usamos Stripe Checkout (página alojada por Stripe): el inquilino es redirigido a
 * stripe.com para ingresar la tarjeta, así los datos sensibles NUNCA pasan por
 * nuestros servidores (cumplimiento PCI SAQ-A). Stripe se encarga de 3D Secure,
 * recibos y Apple/Google Pay automáticamente.
 *
 * Si STRIPE_SECRET_KEY no está configurada, `isStripeEnabled()` devuelve false y el
 * flujo de reservas cae al modo simulado (ver reservationService) sin romper nada.
 */
import Stripe from 'stripe';
import config from '../config/env';
import { logger } from '../utils/logger';

let stripeClient: Stripe | null = null;

/** ¿Están configuradas las claves de Stripe? Si no, se usa el modo simulado. */
export function isStripeEnabled(): boolean {
  return Boolean(config.stripeSecretKey);
}

/** Cliente Stripe perezoso (se crea una sola vez). Lanza si falta la clave. */
export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!config.stripeSecretKey) {
      throw new Error('Stripe no está configurado: falta STRIPE_SECRET_KEY');
    }
    // Sin fijar apiVersion: usa la versión por defecto de la cuenta/librería.
    stripeClient = new Stripe(config.stripeSecretKey);
  }
  return stripeClient;
}

/**
 * URL base del frontend para construir success_url / cancel_url.
 * Stripe exige URLs absolutas; en desarrollo cae a http://localhost:5173.
 */
export function frontendBaseUrl(): string {
  const base =
    config.frontendUrl ||
    config.publicFrontendUrl ||
    config.corsOrigins[0] ||
    'http://localhost:5173';
  return base.replace(/\/$/, '');
}

export type CheckoutKind = 'deposit' | 'balance';

/**
 * Crea una sesión de Stripe Checkout para la seña o el saldo de una reserva.
 * Toda la información necesaria para confirmar el pago (vía webhook) viaja en
 * `metadata`, de modo que el webhook es la única fuente de verdad del cobro.
 */
export async function createCheckoutSession(params: {
  reservation: {
    id: number;
    userId: number;
    propertyId: number;
    depositAmount: number;
    balanceAmount: number;
    currency?: string | null;
    property?: { title?: string | null } | null;
  };
  kind: CheckoutKind;
  paymentId: number;
  customerEmail?: string | null;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const { reservation, kind, paymentId } = params;

  const amount = kind === 'deposit' ? reservation.depositAmount : reservation.balanceAmount;
  if (!(amount > 0)) {
    throw new Error('El monto a cobrar debe ser mayor a cero');
  }

  const propertyTitle = reservation.property?.title || 'Propiedad';
  const label =
    kind === 'deposit'
      ? `Seña (50%) — ${propertyTitle}`
      : `Saldo restante — ${propertyTitle}`;

  const currency = (reservation.currency || 'usd').toLowerCase();
  const base = frontendBaseUrl();
  const metadata = {
    reservationId: String(reservation.id),
    userId: String(reservation.userId),
    kind,
    paymentId: String(paymentId),
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: params.customerEmail || undefined,
    client_reference_id: String(reservation.id),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(amount * 100), // Stripe trabaja en centavos
          product_data: {
            name: label,
            description: `Reserva #${reservation.id} · RIAL`,
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url: `${base}/?stripe=success&reservation=${reservation.id}&kind=${kind}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?stripe=cancel&reservation=${reservation.id}&kind=${kind}`,
  });

  logger.info(
    `Stripe Checkout creada (${kind}) reserva=${reservation.id} session=${session.id}`,
    'Stripe'
  );
  return session;
}

/**
 * Verifica la firma del webhook y reconstruye el evento. Requiere el cuerpo crudo
 * (Buffer) y STRIPE_WEBHOOK_SECRET. Garantiza que el evento venga realmente de Stripe.
 */
export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const stripe = getStripe();
  if (!config.stripeWebhookSecret) {
    throw new Error('Falta STRIPE_WEBHOOK_SECRET para verificar el webhook');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}
