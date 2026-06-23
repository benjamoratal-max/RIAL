import prisma from '../lib/prisma';
import {
  addOneHour,
  buildGoogleCalendarLink,
  createCalendarEvent,
  isGoogleCalendarConfigured,
  miamiWallClockToDate,
} from './calendarService';
import NotificationService from '../utils/notificationService';
import { sendPushToUser } from './pushService';
import { logger } from '../utils/logger';

/** Duración aproximada de una visita: 1 hora. Define la ventana de no solapamiento. */
const VISIT_DURATION_MS = 60 * 60 * 1000;

/** Estados de showing que ocupan la agenda del broker (bloquean nuevos turnos). */
const ACTIVE_SHOWING_STATUSES = ['proposed', 'scheduled'];

/** Formatea un instante en hora local de Miami para los mensajes de notificación. */
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

export interface ScheduleVisitInput {
  date: string;
  time: string;
  visitType?: 'in_person' | 'video_call';
  message?: string;
}

export interface ScheduleVisitResult {
  id: number;
  propertyId: number;
  date: string;
  time: string;
  visitType: string;
  status: string;
  scheduledAt: string;
  calendarConnected: boolean;
  googleEventLink?: string;
  /** Enlace universal "Agregar a Google Calendar" para que el inquilino lo guarde en su propio calendario. */
  addToCalendarUrl: string;
}

export async function schedulePropertyVisit(
  propertyId: number,
  renterId: number,
  input: ScheduleVisitInput
): Promise<ScheduleVisitResult> {
  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(input.date);
  const timeMatch = /^\d{2}:\d{2}$/.test(input.time);
  if (!dateMatch || !timeMatch) {
    throw Object.assign(new Error('Fecha u hora inválida'), { statusCode: 400 });
  }

  const visitDate = new Date(`${input.date}T12:00:00Z`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (visitDate < today) {
    throw Object.assign(new Error('La fecha debe ser hoy o posterior'), { statusCode: 400 });
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owner: { select: { id: true, email: true, name: true } },
    },
  });
  if (!property) {
    throw Object.assign(new Error('Propiedad no encontrada'), { statusCode: 404 });
  }

  const brokerId = property.ownerId;
  if (!brokerId) {
    throw Object.assign(new Error('Propiedad sin broker asignado'), { statusCode: 400 });
  }
  const renter = await prisma.user.findUnique({
    where: { id: renterId },
    select: { id: true, email: true, name: true },
  });
  if (!renter?.email) {
    throw Object.assign(new Error('Usuario sin correo registrado'), { statusCode: 400 });
  }

  const brokerProfile = await prisma.brokerProfile.findUnique({
    where: { userId: brokerId },
    select: {
      googleCalendarRefreshToken: true,
      googleCalendarConnectedAt: true,
      fullName: true,
    },
  });

  const brokerUser = property.owner;
  if (!brokerUser?.email) {
    throw Object.assign(new Error('El broker de esta propiedad no tiene correo'), { statusCode: 400 });
  }

  const visitTypeDb =
    input.visitType === 'video_call' ? 'virtual' : (input.visitType ?? 'in_person');
  const scheduledAt = miamiWallClockToDate(input.date, input.time);
  const notes = input.message?.trim() || null;

  // No permitir dos visitas solapadas para el mismo broker: una visita dura ~1 hora,
  // así que cualquier turno activo a menos de 60 min del nuevo se considera conflicto.
  // (brokerId = property.ownerId, por lo que esto también cubre la misma propiedad.)
  const conflict = await prisma.showing.findFirst({
    where: {
      brokerId,
      status: { in: ACTIVE_SHOWING_STATUSES },
      scheduledAt: {
        gt: new Date(scheduledAt.getTime() - VISIT_DURATION_MS),
        lt: new Date(scheduledAt.getTime() + VISIT_DURATION_MS),
      },
    },
    select: { id: true },
  });
  if (conflict) {
    throw Object.assign(
      new Error('Ese horario ya está reservado para una visita. Por favor elegí otro horario.'),
      { statusCode: 409 }
    );
  }

  // Pre-sellar los recordatorios cuyo umbral ya pasó al momento de agendar
  // (p. ej. una visita para dentro de 2 h no debe disparar el recordatorio de 24 h).
  const msToVisit = scheduledAt.getTime() - Date.now();
  const now = new Date();

  const showing = await prisma.showing.create({
    data: {
      propertyId,
      brokerId,
      renterId,
      scheduledAt,
      status: 'scheduled',
      visitType: visitTypeDb,
      notes,
      reminder24hSentAt: msToVisit <= 24 * 60 * 60 * 1000 ? now : null,
      reminder1hSentAt: msToVisit <= 60 * 60 * 1000 ? now : null,
    },
  });

  let googleEventLink: string | undefined;
  const refreshToken = brokerProfile?.googleCalendarRefreshToken;

  if (refreshToken && isGoogleCalendarConfigured()) {
    try {
      const startTime = `${input.date}T${input.time}:00`;
      const endTime = addOneHour(input.date, input.time);
      const event = await createCalendarEvent(refreshToken, {
        propertyTitle: property.title,
        propertyAddress: property.location ?? 'Miami-Dade, FL',
        tenantEmail: renter.email,
        brokerEmail: brokerUser.email,
        startTime,
        endTime,
        visitType: input.visitType,
        message: input.message,
      });

      googleEventLink = event.htmlLink ?? undefined;
      await prisma.showing.update({
        where: { id: showing.id },
        data: {
          googleEventId: event.id ?? null,
          googleHtmlLink: googleEventLink ?? null,
        },
      });
    } catch (err) {
      logger.error(
        `Google Calendar event creation failed (showing ${showing.id}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Enlace universal para que ambas partes guarden la visita en su propio Google
  // Calendar (no depende de que el broker haya conectado OAuth).
  const addToCalendarUrl = buildGoogleCalendarLink({
    propertyTitle: property.title,
    location:
      input.visitType === 'video_call'
        ? 'Videollamada — RIAL (Miami-Dade)'
        : property.location ?? 'Miami-Dade, FL',
    start: scheduledAt,
    end: new Date(scheduledAt.getTime() + VISIT_DURATION_MS),
    details: notes
      ? `Visita agendada desde RIAL.\nMensaje: ${notes}`
      : 'Visita agendada desde RIAL.',
  });

  // Avisar al broker dueño de la propiedad que un inquilino agendó una visita
  // (in-app + Web Push). Best-effort: nunca debe romper el agendamiento.
  await notifyBrokerOfNewVisit({
    brokerId,
    renterName: renter.name?.trim() || 'Un inquilino',
    propertyTitle: property.title,
    scheduledAt,
    visitTypeDb,
    showingId: showing.id,
  }).catch(() => {});

  return {
    id: showing.id,
    propertyId,
    date: input.date,
    time: input.time,
    visitType: visitTypeDb,
    status: showing.status,
    scheduledAt: scheduledAt.toISOString(),
    calendarConnected: Boolean(refreshToken && brokerProfile?.googleCalendarConnectedAt),
    googleEventLink,
    addToCalendarUrl,
  };
}

/**
 * Notifica al broker (in-app + Web Push) que un inquilino agendó una visita a su
 * propiedad. Best-effort: cualquier fallo se ignora para no romper el agendamiento.
 */
async function notifyBrokerOfNewVisit(params: {
  brokerId: number;
  renterName: string;
  propertyTitle: string;
  scheduledAt: Date;
  visitTypeDb: string;
  showingId: number;
}): Promise<void> {
  const when = formatMiami(params.scheduledAt);
  const modalidad = params.visitTypeDb === 'virtual' ? 'videollamada' : 'visita presencial';
  const title = 'Nueva visita agendada';
  const message = `${params.renterName} agendó una ${modalidad} para "${params.propertyTitle}" el ${when} (hora de Miami).`;

  await NotificationService.createNotification(params.brokerId, title, message, 'info').catch(
    () => {}
  );
  await sendPushToUser(params.brokerId, {
    title,
    body: message,
    url: '/?brokerView=listings',
    tag: `visit-${params.showingId}-new`,
  }).catch(() => {});
}
