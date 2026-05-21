import prisma from '../lib/prisma';
import {
  addOneHour,
  createCalendarEvent,
  isGoogleCalendarConfigured,
  miamiWallClockToDate,
} from './calendarService';
import { logger } from '../utils/logger';

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

  const showing = await prisma.showing.create({
    data: {
      propertyId,
      brokerId,
      renterId,
      scheduledAt,
      status: 'scheduled',
      visitType: visitTypeDb,
      notes,
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
  };
}
