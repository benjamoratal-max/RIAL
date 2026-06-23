/**
 * Recordatorios automáticos de visitas (showings): avisa a inquilino y broker
 * 24 horas y 1 hora antes del turno, vía notificación in-app + Web Push.
 *
 * Se ejecuta periódicamente desde un setInterval en `index.ts`. Cada recordatorio
 * se marca con un timestamp en `Showing` (reminder24hSentAt / reminder1hSentAt)
 * para no reenviarlo. Idempotente y best-effort: nunca lanza.
 */
import prisma from '../lib/prisma';
import NotificationService from '../utils/notificationService';
import { sendPushToUser } from './pushService';
import { logger } from '../utils/logger';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ACTIVE_SHOWING_STATUSES = ['proposed', 'scheduled'];

function formatMiami(dt: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/New_York',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt);
}

type ReminderKind = '24h' | '1h';

interface ShowingWithProperty {
  id: number;
  brokerId: number | null;
  renterId: number | null;
  scheduledAt: Date;
  visitType: string;
  property: { title: string } | null;
}

/** Envía el recordatorio a inquilino y broker (in-app + push). Best-effort. */
async function sendReminder(showing: ShowingWithProperty, kind: ReminderKind): Promise<void> {
  const propertyTitle = showing.property?.title || 'la propiedad';
  const modalidad = showing.visitType === 'virtual' ? 'videollamada' : 'visita presencial';
  const when = formatMiami(showing.scheduledAt);
  const cuando = kind === '24h' ? 'mañana' : 'en 1 hora';

  const title = kind === '24h' ? 'Recordatorio: visita mañana' : 'Recordatorio: visita en 1 hora';
  const message = `Tu ${modalidad} a "${propertyTitle}" es ${cuando} (${when}, hora de Miami).`;

  const recipients = [showing.renterId, showing.brokerId].filter(
    (id): id is number => typeof id === 'number'
  );

  await Promise.all(
    recipients.map(async (userId) => {
      await NotificationService.createNotification(userId, title, message, 'info').catch(() => {});
      await sendPushToUser(userId, {
        title,
        body: message,
        url: '/',
        tag: `visit-${showing.id}-${kind}`,
      }).catch(() => {});
    })
  );
}

/**
 * Procesa todos los recordatorios pendientes. Para cada ventana (24 h / 1 h) busca
 * showings activos cuyo turno entra en el umbral y aún no fueron avisados, los notifica
 * y sella el timestamp correspondiente. Solo considera visitas todavía futuras.
 */
export async function processVisitReminders(): Promise<void> {
  try {
    const now = new Date();

    // --- 24 horas antes ---
    const due24h = (await prisma.showing.findMany({
      where: {
        status: { in: ACTIVE_SHOWING_STATUSES },
        reminder24hSentAt: null,
        scheduledAt: { gt: now, lte: new Date(now.getTime() + ONE_DAY_MS) },
      },
      select: {
        id: true,
        brokerId: true,
        renterId: true,
        scheduledAt: true,
        visitType: true,
        property: { select: { title: true } },
      },
    })) as ShowingWithProperty[];

    for (const showing of due24h) {
      await sendReminder(showing, '24h');
      await prisma.showing
        .update({ where: { id: showing.id }, data: { reminder24hSentAt: new Date() } })
        .catch(() => {});
    }

    // --- 1 hora antes ---
    const due1h = (await prisma.showing.findMany({
      where: {
        status: { in: ACTIVE_SHOWING_STATUSES },
        reminder1hSentAt: null,
        scheduledAt: { gt: now, lte: new Date(now.getTime() + ONE_HOUR_MS) },
      },
      select: {
        id: true,
        brokerId: true,
        renterId: true,
        scheduledAt: true,
        visitType: true,
        property: { select: { title: true } },
      },
    })) as ShowingWithProperty[];

    for (const showing of due1h) {
      await sendReminder(showing, '1h');
      await prisma.showing
        .update({ where: { id: showing.id }, data: { reminder1hSentAt: new Date() } })
        .catch(() => {});
    }

    if (due24h.length || due1h.length) {
      logger.info(
        `Recordatorios de visita enviados: ${due24h.length} de 24h, ${due1h.length} de 1h`,
        'VisitReminders'
      );
    }
  } catch (err) {
    logger.error(
      `Error procesando recordatorios de visita: ${
        err instanceof Error ? err.message : String(err)
      }`,
      'VisitReminders'
    );
  }
}
