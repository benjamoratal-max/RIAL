// SMS removido - solo se usa email para 2FA
// import twilio from 'twilio';
import { logger } from './logger';

// SMS deshabilitado - solo se usa email para 2FA
// const twilioClient = null;
// const twilioPhoneNumber = null;

export async function sendSMS(to: string, message: string): Promise<boolean> {
  // SMS deshabilitado - solo se usa email para 2FA
  logger.warn('SMS deshabilitado. Solo se usa email para 2FA.', 'SMSService', { to });
  logger.info(`[DEV] SMS simulado a ${to}: ${message}`, 'SMSService');
  return false;
}

export async function send2FACodeSMS(phoneNumber: string, code: string): Promise<boolean> {
  const message = `Tu código de autenticación RIAL es: ${code}\n\nEste código expira en 5 minutos. No compartas este código con nadie.`;
  return sendSMS(phoneNumber, message);
}
