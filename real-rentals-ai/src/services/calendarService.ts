import { google } from 'googleapis';
import config from '../config/env';

const MIAMI_TIMEZONE = 'America/New_York';

function getOAuth2Client() {
  const clientId = config.googleClientId;
  const clientSecret = config.googleClientSecret;
  const redirectUri = config.googleRedirectUri;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('GOOGLE_CALENDAR_NOT_CONFIGURED');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);
}

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export interface CalendarEventDetails {
  propertyTitle: string;
  propertyAddress: string;
  tenantEmail: string;
  brokerEmail: string;
  startTime: string;
  endTime: string;
  visitType?: 'in_person' | 'video_call';
  message?: string;
}

export async function createCalendarEvent(
  refreshToken: string,
  eventDetails: CalendarEventDetails
) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const isVirtual = eventDetails.visitType === 'video_call';
  const location = isVirtual
    ? 'Videollamada — RIAL (Miami-Dade)'
    : eventDetails.propertyAddress;

  const descriptionLines = [
    'Visita agendada desde RIAL.',
    `Inquilino: ${eventDetails.tenantEmail}`,
    `Broker: ${eventDetails.brokerEmail}`,
  ];
  if (isVirtual) descriptionLines.push('Modalidad: videollamada');
  if (eventDetails.message?.trim()) {
    descriptionLines.push('', `Mensaje: ${eventDetails.message.trim()}`);
  }

  const event = {
    summary: `Visita: ${eventDetails.propertyTitle}`,
    location,
    description: descriptionLines.join('\n'),
    start: {
      dateTime: eventDetails.startTime,
      timeZone: MIAMI_TIMEZONE,
    },
    end: {
      dateTime: eventDetails.endTime,
      timeZone: MIAMI_TIMEZONE,
    },
    attendees: [
      { email: eventDetails.tenantEmail },
      { email: eventDetails.brokerEmail },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: 'all',
  });

  return response.data;
}

/**
 * Construye un enlace "Agregar a Google Calendar" (acción TEMPLATE) que cualquiera
 * de las dos partes puede abrir para guardar la visita en SU propio calendario, sin
 * necesidad de conectar OAuth. Sirve como respaldo universal del evento que se crea
 * en el calendario del broker conectado.
 */
export function buildGoogleCalendarLink(params: {
  propertyTitle: string;
  location: string;
  start: Date;
  end: Date;
  details?: string;
}): string {
  const toGoogleUtc = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const qs = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Visita: ${params.propertyTitle}`,
    dates: `${toGoogleUtc(params.start)}/${toGoogleUtc(params.end)}`,
    location: params.location,
    details: params.details ?? 'Visita agendada desde RIAL.',
    ctz: MIAMI_TIMEZONE,
  });
  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}

/** Suma una hora a date + time (formato YYYY-MM-DD y HH:mm). */
export function addOneHour(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const endH = h + 1;
  return `${date}T${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** Horario local Miami → instante UTC para Prisma. */
export function miamiWallClockToDate(date: string, time: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  let utc = Date.UTC(y, mo - 1, d, hh, mm, 0);
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: MIAMI_TIMEZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      })
        .formatToParts(new Date(utc))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, Number(p.value)])
    );
    const nyMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second ?? 0
    );
    const wantMs = Date.UTC(y, mo - 1, d, hh, mm, 0);
    utc += wantMs - nyMs;
  }
  return new Date(utc);
}
