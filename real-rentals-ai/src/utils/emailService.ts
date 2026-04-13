import nodemailer from 'nodemailer';
import { logger } from './logger';

// Configuración del transporter de email
// En desarrollo, puedes usar servicios como Mailtrap, Ethereal, o Gmail
const createTransporter = () => {
  // Configuración desde variables de entorno
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  // Si no hay credenciales configuradas, usar Ethereal (solo para desarrollo)
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    logger.warn('No hay credenciales SMTP configuradas. Usando modo de prueba.', 'EmailService');
    // En desarrollo, puedes usar Ethereal Email para pruebas
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass',
      },
    });
  }

  return nodemailer.createTransport(emailConfig);
};

const transporter = createTransporter();

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@rial.com',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Convertir HTML a texto plano si no se proporciona
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email enviado a ${to}`, 'EmailService', { messageId: info.messageId });
    return true;
  } catch (error) {
    logger.error('Error al enviar email', 'EmailService', error as Error, { to, subject });
    return false;
  }
}

export async function sendVerificationCode(email: string, code: string, name: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RIAL - Verificación de Email</h1>
        </div>
        <div class="content">
          <p>Hola ${name},</p>
          <p>Gracias por registrarte en RIAL. Para verificar tu dirección de email, por favor ingresa el siguiente código:</p>
          <div class="code">${code}</div>
          <p>Este código expirará en 10 minutos.</p>
          <p>Si no solicitaste este código, puedes ignorar este email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} RIAL. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Verifica tu email - RIAL',
    html,
  });
}

export async function send2FACode(email: string, code: string, name: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #f5576c; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #f5576c; letter-spacing: 5px; margin: 20px 0; border-radius: 5px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Código de Autenticación</h1>
        </div>
        <div class="content">
          <p>Hola ${name},</p>
          <p>Se ha solicitado un código de autenticación de dos factores para tu cuenta.</p>
          <div class="code">${code}</div>
          <div class="warning">
            <strong>⚠️ Importante:</strong> Este código expirará en 5 minutos. No compartas este código con nadie.
          </div>
          <p>Si no solicitaste este código, por favor cambia tu contraseña inmediatamente.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} RIAL. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Código de autenticación - RIAL',
    html,
  });
}
