/**
 * Configuración y validación de variables de entorno
 * Este archivo valida que todas las variables requeridas estén presentes
 */
import dotenv from 'dotenv';

dotenv.config();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  
  if (!value) {
    throw new Error(
      `Variable de entorno requerida faltante: ${name}. ` +
      `Por favor, configura esta variable en tu archivo .env`
    );
  }
  
  return value;
}

function getEnvVarOptional(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

// Validar variables críticas en producción
const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  // JWT Secret - CRÍTICO: debe estar configurado
  jwtSecret: isProduction 
    ? getEnvVar('JWT_SECRET')
    : getEnvVar('JWT_SECRET', 'dev_secret_change_me_in_production'),
  
  // Puerto del servidor
  port: parseInt(getEnvVarOptional('PORT', '3000') || '3000', 10),
  
  // CORS - Orígenes permitidos
  // Permite agregar URLs de ngrok u otros túneles mediante variable de entorno
  corsOrigins: getEnvVarOptional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000')
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean) || ['http://localhost:5173'],
  
  // URL pública del backend (para ngrok u otros túneles)
  publicBackendUrl: getEnvVarOptional('PUBLIC_BACKEND_URL'),
  
  // URL pública del frontend (para ngrok u otros túneles)
  publicFrontendUrl: getEnvVarOptional('PUBLIC_FRONTEND_URL'),
  
  // Base de datos
  databaseUrl: getEnvVarOptional('DATABASE_URL'),
  
  // reCAPTCHA (opcional: si no se configura, el login no exige captcha)
  recaptchaSecretKey: getEnvVarOptional('RECAPTCHA_SECRET_KEY'),

  // Integración de listings reales (RentCast)
  rentcastApiKey: getEnvVarOptional('RENTCAST_API_KEY'),
  googleMapsApiKey: getEnvVarOptional('GOOGLE_MAPS_API_KEY'),

  // Entorno
  nodeEnv: getEnvVarOptional('NODE_ENV', 'development'),
  isProduction,
};

// Validar configuración al cargar el módulo
if (isProduction && config.jwtSecret === 'dev_secret_change_me') {
  throw new Error(
    'ERROR CRÍTICO: JWT_SECRET no puede usar el valor por defecto en producción. ' +
    'Por favor, configura una variable de entorno JWT_SECRET segura.'
  );
}

export default config;

