import express from 'express';
import path from 'path';
import os from 'os';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import config from './config/env';
import { logger } from './utils/logger';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import userRoutes from './routes/userRoutes';
import propertyRoutes from './routes/propertyRoutes';
import leaseRoutes from './routes/leaseRoutes';
import authRoutes from './routes/authRoutes';
import reviewRoutes from './routes/reviewRoutes';
import notificationRoutes from './routes/notificationRoutes';
import chatRoutes from './routes/chatRoutes';
import paymentRoutes from './routes/paymentRoutes';
import alertRoutes from './routes/alertRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import verificationRoutes from './routes/verificationRoutes';
import comparisonRoutes from './routes/comparisonRoutes';
import emailVerificationRoutes from './routes/emailVerificationRoutes';
import twoFactorRoutes from './routes/twoFactorRoutes';
import adminRoutes from './routes/adminRoutes';
import aiRoutes from './routes/aiRoutes';
import brokerRoutes from './routes/brokerRoutes';
import complianceRoutes from './routes/complianceRoutes';
import configRoutes from './routes/configRoutes';
import leadRoutes from './routes/leadRoutes';
import healthRoutes from './routes/healthRoutes';

const app = express();

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false, // Desactivar en desarrollo para facilitar debugging
  crossOriginEmbedderPolicy: false, // Permitir recursos externos
}));

// Compresión de respuestas (reduce significativamente el tamaño de las respuestas JSON)
app.use(compression({
  filter: (req: express.Request, res: express.Response) => {
    // Comprimir todas las respuestas excepto si el cliente no lo soporta
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Nivel de compresión balanceado (1-9)
  threshold: 1024, // Solo comprimir respuestas mayores a 1KB
}));

// Configurar CORS con orígenes permitidos específicos
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // En desarrollo, permitir cualquier origen local (localhost o IPs locales)
    if (!config.isProduction) {
      if (!origin) {
        // Permitir requests sin origen (mobile apps, Postman, etc.) solo en desarrollo
        return callback(null, true);
      }
      
      // Permitir localhost, 127.0.0.1, y IPs locales (192.168.x.x, 10.x.x.x, etc.)
      if (origin.includes('localhost') || 
          origin.includes('127.0.0.1') ||
          /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
          /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
          /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      
      // Permitir URLs de ngrok y otros servicios de tunneling comunes
      if (origin && (
        origin.includes('.ngrok.io') ||
        origin.includes('.ngrok-free.app') ||
        origin.includes('.ngrok.app') ||
        origin.includes('.loca.lt') ||
        origin.includes('.local.run') ||
        origin.includes('.cloudflared.io') ||
        origin.includes('.trycloudflare.com') ||
        origin.includes('.cfargotunnel.com') ||
        origin.startsWith('https://') // Permitir cualquier HTTPS en desarrollo (para dominios propios)
      )) {
        return callback(null, true);
      }
      
      // Verificar URLs públicas configuradas
      if (config.publicFrontendUrl && origin === config.publicFrontendUrl) {
        return callback(null, true);
      }
      
      // También verificar la lista de orígenes permitidos
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // En desarrollo, ser permisivo con otros orígenes
      return callback(null, true);
    }
    
    // En producción, usar la lista de orígenes permitidos estrictamente
    if (origin && config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else if (!origin) {
      // Permitir requests sin Origin (health checks, server-to-server, navegación directa a la URL del backend)
      callback(null, true);
    } else {
      callback(new Error('CORS: Origen no permitido'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Soportar payloads base64 de imágenes de documento (DNI/pasaporte) en verificación
app.use(express.json({ limit: '15mb' }));

// Request logging (antes de rate limiting para capturar todas las peticiones)
app.use(requestLogger);

// Aplicar rate limiting general a todas las rutas
app.use('/api', generalLimiter);

// Servir archivos estáticos de contratos (PDFs)
app.use('/contracts', express.static(path.join(__dirname, '../contracts')));

// Servir archivos estáticos públicos (favicon, robots.txt, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Ruta raíz - información del API
app.get('/', (req, res) => {
  res.json({
    name: 'RIAL APP API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      properties: '/api/properties',
      leases: '/api/leases',
      payments: '/api/payments',
      reviews: '/api/reviews',
      notifications: '/api/notifications',
      chat: '/api/chat',
      alerts: '/api/alerts',
      analytics: '/api/analytics',
      brokers: '/api/brokers',
      compliance: '/api/compliance',
      verification: '/api/verification',
      emailVerification: '/api/email-verification',
      twoFactor: '/api/2fa',
      admin: '/api/admin',
      ai: '/api/ai',
      config: '/api/config',
      leads: '/api/leads',
      health: '/health',
    },
    environment: config.nodeEnv,
  });
});

// Fecha del servidor (fuente de verdad para validar fechas de alquiler; no depende del reloj del cliente)
app.get('/api/server-date', (req, res) => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  res.json({ date });
});

// Rutas API
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/leases', leaseRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/comparison', comparisonRoutes);
app.use('/api/email-verification', emailVerificationRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/config', configRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/brokers', brokerRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/health', healthRoutes);

// Manejar rutas no encontradas (debe ir antes del error handler)
app.use(notFoundHandler);

// Middleware de manejo de errores (debe ser el último)
app.use(errorHandler);

// Escuchar en todas las interfaces de red (0.0.0.0) para permitir acceso desde otros dispositivos
app.listen(config.port, '0.0.0.0', () => {
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  // Detectar IP local automáticamente
  for (const name of Object.keys(networkInterfaces)) {
    const interfaces = networkInterfaces[name];
    if (!interfaces) continue;
    
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }
  
  logger.info(`Server running on http://localhost:${config.port}`, 'Server');
  logger.info(`Server accessible from network at http://${localIP}:${config.port}`, 'Server');
  logger.info(`API endpoints available at http://${localIP}:${config.port}/api`, 'Server');
  logger.info(`Environment: ${config.nodeEnv}`, 'Server');
  logger.info(`CORS: Permitting local network access in development`, 'Server');
});
