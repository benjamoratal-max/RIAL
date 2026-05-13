import express from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { authLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { validateEmail } from '../utils/emailValidator';
import { send2FACode } from '../utils/emailService';

// Generar código 2FA
function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const router = express.Router();

// Generar código de verificación
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Registro (verificación de email es opcional)
router.post('/register', authLimiter, validateBody(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  
  // Validar que el email sea real (pero no obligatorio verificar)
  // Hacer la validación más permisiva para evitar errores de red
  let emailValidation: { valid: boolean; reason?: string | undefined } = { valid: true };
  try {
    emailValidation = await validateEmail(email);
  } catch (validationError: any) {
    // Si la validación falla por error de red/DNS, solo registrar advertencia pero permitir registro
    logger.warn(`Error al validar email ${email}, permitiendo registro de todas formas`, 'Auth', validationError);
    emailValidation = { valid: true, reason: undefined }; // Permitir registro si hay error de validación
  }

  // Solo rechazar si el email es claramente inválido (formato básico)
  if (!emailValidation.valid && emailValidation.reason?.includes('Formato')) {
    logger.warn(`Intento de registro con email inválido: ${email}`, 'Auth', { reason: emailValidation.reason });
    return res.status(400).json({ 
      error: 'Email no válido', 
      reason: emailValidation.reason 
    });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashed, 
        role: role || 'tenant',
        emailValidated: emailValidation.valid, // Marcar como validado solo si pasó la validación
        emailLastValidated: emailValidation.valid ? new Date() : null,
        // No generamos código de verificación automáticamente
      },
    });

    logger.info(`Usuario registrado: ${user.email}`, 'Auth', { userId: user.id, role: user.role });
    
    res.status(201).json({ 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role,
      emailVerified: false,
      message: 'Usuario registrado exitosamente. Puedes verificar tu email más tarde si lo deseas.',
    });
  } catch (e: any) {
    if (e.code === 'P2002') {
      logger.warn(`Intento de registro con email duplicado: ${email}`, 'Auth');
      return res.status(400).json({ error: 'El email ya está en uso' });
    }
    
    // Log detallado del error para debugging
    logger.error('Error en registro', 'Auth', e, { 
      email,
      errorCode: e.code,
      errorMessage: e.message,
      errorStack: process.env.NODE_ENV !== 'production' ? e.stack : undefined
    });
    
    // En desarrollo, devolver más información del error
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ 
        error: 'Error interno del servidor',
        message: e.message,
        code: e.code,
        details: e.meta || {}
      });
    }
    
    // Asegurar que el error se propague correctamente
    throw e;
  }
}));

// Verificar token reCAPTCHA con Google
async function verifyRecaptcha(token: string, secretKey: string): Promise<boolean> {
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  });
  const data = await res.json();
  return data.success === true && (data.score === undefined || data.score >= 0.5);
}

// Login con soporte para 2FA y reCAPTCHA
router.post('/login', authLimiter, validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password, twoFactorCode, recaptchaToken } = req.body;
  try {
    if (config.recaptchaSecretKey) {
      if (!recaptchaToken || typeof recaptchaToken !== 'string') {
        return res.status(400).json({ error: 'Verificación de seguridad (captcha) requerida. Completa el captcha e intenta de nuevo.' });
      }
      const valid = await verifyRecaptcha(recaptchaToken, config.recaptchaSecretKey);
      if (!valid) {
        return res.status(400).json({ error: 'Verificación de seguridad fallida. Intenta de nuevo.' });
      }
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    // Si tiene 2FA activado, verificar código
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        // Solicitar código 2FA
        const code = generate2FACode();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 5);

        await prisma.twoFactorCode.create({
          data: {
            userId: user.id,
            code,
            method: user.twoFactorMethod || 'email',
            expiresAt,
          },
        });

        // Enviar código por email (SMS removido)
        if (user.twoFactorMethod === 'email') {
          await send2FACode(user.email, code, user.name);
        }

        return res.status(200).json({ 
          requires2FA: true,
          method: user.twoFactorMethod,
          message: 'Código 2FA enviado',
        });
      }

      // Verificar código 2FA
      const twoFactorCodeRecord = await prisma.twoFactorCode.findFirst({
        where: {
          userId: user.id,
          code: twoFactorCode,
          method: user.twoFactorMethod || 'email',
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!twoFactorCodeRecord) {
        return res.status(401).json({ error: 'Código 2FA inválido o expirado' });
      }

      // Marcar código como usado
      await prisma.twoFactorCode.update({
        where: { id: twoFactorCodeRecord.id },
        data: { used: true },
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
    logger.info(`Login exitoso: ${user.email}`, 'Auth', { userId: user.id, role: user.role, twoFactorUsed: user.twoFactorEnabled });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        emailVerified: user.emailVerified,
        verified: user.verified,
      },
    });
  } catch (error) {
    logger.error('Error en login', 'Auth', error as Error, { email: req.body.email });
    throw error;
  }
}));

export default router;


