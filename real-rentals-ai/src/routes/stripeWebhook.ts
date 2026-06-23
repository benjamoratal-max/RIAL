/**
 * Webhook de Stripe — única fuente de verdad de los cobros.
 *
 * Stripe envía un POST firmado cuando una sesión de Checkout se completa. Aquí
 * verificamos la firma (con STRIPE_WEBHOOK_SECRET) y, si el pago está confirmado,
 * avanzamos el estado de la reserva. Este handler DEBE montarse con
 * `express.raw({ type: 'application/json' })` y ANTES de `express.json()`, porque
 * la verificación de firma necesita el cuerpo crudo sin parsear.
 */
import { Request, Response } from 'express';
import type Stripe from 'stripe';
import { constructWebhookEvent, isStripeEnabled } from '../services/stripeService';
import { fulfillCheckoutSession } from '../services/reservationService';
import { logger } from '../utils/logger';

export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!isStripeEnabled()) {
    return res.status(503).json({ error: 'Stripe no está configurado' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).send('Falta la cabecera stripe-signature');
  }

  let event: Stripe.Event;
  try {
    // req.body es un Buffer crudo gracias a express.raw().
    event = constructWebhookEvent(req.body as Buffer, signature);
  } catch (err: any) {
    logger.warn(`Webhook Stripe con firma inválida: ${err.message}`, 'Stripe');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      // Solo confirmamos si el pago realmente se cobró.
      if (session.payment_status === 'paid') {
        await fulfillCheckoutSession(session as any);
      }
    }
    // Respondemos 200 a cualquier otro evento para que Stripe no reintente.
    return res.json({ received: true });
  } catch (err: any) {
    logger.error('Error procesando webhook de Stripe', 'Stripe', err);
    // 500 → Stripe reintentará la entrega del evento más tarde.
    return res.status(500).json({ error: 'Error procesando el evento' });
  }
}
