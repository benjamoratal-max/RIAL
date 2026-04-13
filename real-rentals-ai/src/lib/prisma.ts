import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  errorFormat: 'pretty',
});

// Manejar errores de conexión
prisma.$connect()
  .then(() => {
    logger.info('Conexión a base de datos establecida', 'Database');
  })
  .catch((error) => {
    logger.error('Error conectando a base de datos', 'Database', error);
  });

// Manejar desconexión al cerrar la aplicación
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
