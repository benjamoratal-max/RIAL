import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

/**
 * Middleware para requerir que el usuario esté verificado
 * Necesario para comprar, alquilar o vender propiedades
 */
export async function requireVerification(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { verified: true, verificationMethod: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.verified) {
      return res.status(403).json({
        error: 'Cuenta no verificada',
        message: 'Debes verificar tu identidad con una foto de cédula o pasaporte para realizar esta acción',
        requiresVerification: true,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar estado de cuenta' });
  }
}
