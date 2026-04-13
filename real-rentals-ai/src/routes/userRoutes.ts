import express from 'express';
import prisma from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import { requireVerification } from '../middleware/requireVerification';
import { validateBody, validateQuery } from '../middleware/validate';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { cache, CacheKeys } from '../utils/cache';
import { z } from 'zod';
import { createLimiter, writeLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Schema de validación para crear usuario
const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
  role: z.enum(['tenant', 'owner', 'admin']).optional().default('tenant'),
});

// Schema de validación para query params
const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: z.enum(['tenant', 'owner', 'admin']).optional(),
  search: z.string().optional(),
});

// Obtener todos los usuarios (con caché y paginación)
router.get('/', auth, validateQuery(userQuerySchema), asyncHandler(async (req: AuthRequest, res) => {
  const validatedQuery = req.query as unknown as z.infer<typeof userQuerySchema>;
  const { page = 1, pageSize = 20, role, search } = validatedQuery;
  
  // Solo admin puede ver todos los usuarios
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const take = Math.max(1, Math.min(100, Number(pageSize)));
  const skip = (Math.max(1, Number(page)) - 1) * take;

  // Crear clave de caché
  const cacheKey = CacheKeys.user(0) + `:list:${page}:${pageSize}:${role || ''}:${search || ''}`;
  
  // Intentar obtener del caché
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    logger.debug('Usuarios obtenidos del caché', 'User', { page, pageSize });
    return res.json(cached);
  }

  // Construir where clause
  const where: any = {};
  if (role) {
    where.role = role;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  // Query optimizado con select específico
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take,
      skip,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        verified: true,
        emailVerified: true,
        // No incluir password ni datos sensibles
      },
      orderBy: {
        id: 'desc', // Ordenar por ID (equivalente a createdAt)
      },
    }),
    prisma.user.count({ where }),
  ]);

  const result = {
    items: users,
    pagination: {
      page: Number(page),
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };

  // Guardar en caché (5 minutos)
  cache.set(cacheKey, result, 5 * 60 * 1000);

  logger.info(`Usuarios obtenidos: ${users.length}`, 'User', { page, pageSize, total });
  res.json(result);
}));

// Obtener usuario por ID (con caché)
router.get('/:id', auth, asyncHandler(async (req: AuthRequest, res) => {
  const userId = Number(req.params.id);
  
  // Solo puede ver su propio perfil o admin puede ver cualquiera
  if (req.user?.role !== 'admin' && req.user?.id !== userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const cacheKey = CacheKeys.user(userId);
  
  // Intentar obtener del caché
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    logger.debug(`Usuario ${userId} obtenido del caché`, 'User');
    return res.json(cached);
  }

  // Query optimizado
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      verified: true,
      emailVerified: true,
      twoFactorEnabled: true,
      // No incluir password
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Guardar en caché (10 minutos)
  cache.set(cacheKey, user, 10 * 60 * 1000);

  res.json(user);
}));

// Crear un nuevo usuario (solo admin)
router.post('/', auth, requireVerification, createLimiter, validateBody(createUserSchema), asyncHandler(async (req: AuthRequest, res) => {
  // Solo admin puede crear usuarios
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { name, email, password, role } = req.body;

  // Hash de contraseña
  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: { 
      name, 
      email, 
      password: hashed, 
      role: role || 'tenant' 
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      // No incluir password
    },
  });

  // Invalidar caché de lista de usuarios
  cache.delete(CacheKeys.user(0) + ':list:*');

  logger.info(`Usuario creado: ${newUser.email}`, 'User', { userId: newUser.id, role: newUser.role });
  res.status(201).json(newUser);
}));

// Actualizar usuario
router.patch('/:id', auth, writeLimiter, validateBody(createUserSchema.partial()), asyncHandler(async (req: AuthRequest, res) => {
  const userId = Number(req.params.id);
  
  // Solo puede actualizar su propio perfil o admin puede actualizar cualquiera
  if (req.user?.role !== 'admin' && req.user?.id !== userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const updates: any = {};
  if (req.body.name) updates.name = req.body.name;
  if (req.body.email) updates.email = req.body.email;
  if (req.body.role && req.user?.role === 'admin') updates.role = req.body.role;
  if (req.body.password) {
    const bcrypt = require('bcryptjs');
    updates.password = await bcrypt.hash(req.body.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      verified: true,
      emailVerified: true,
    },
  });

  // Invalidar caché
  cache.delete(CacheKeys.user(userId));
  cache.delete(CacheKeys.user(0) + ':list:*');

  logger.info(`Usuario actualizado: ${updated.email}`, 'User', { userId });
  res.json(updated);
}));

export default router;
