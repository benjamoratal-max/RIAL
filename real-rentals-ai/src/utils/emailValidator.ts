import validator from 'validator';
import { logger } from './logger';

/**
 * Valida si un email es real y válido usando múltiples métodos
 */
export async function validateEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
  // 1. Validación básica de formato
  if (!validator.isEmail(email)) {
    return { valid: false, reason: 'Formato de email inválido' };
  }

  // 2. Validar dominio común
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, reason: 'Dominio inválido' };
  }

  // Lista de dominios temporales/descartables conocidos
  const disposableDomains = [
    'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
    'throwaway.email', 'temp-mail.org', 'getnada.com', 'mohmal.com',
    'yopmail.com', 'maildrop.cc', 'sharklasers.com', 'grr.la',
  ];

  if (disposableDomains.some(d => domain.includes(d))) {
    return { valid: false, reason: 'Email temporal/descartable no permitido' };
  }

  // 3. Validar MX records del dominio (verificar que el dominio acepta emails)
  // Hacer esto opcional y no bloquear si falla (puede fallar por problemas de red)
  try {
    const dns = await import('dns').then(m => m.promises);
    // Agregar timeout para evitar que se cuelgue
    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 3000)) // Timeout de 3 segundos
    ]).catch(() => []);
    
    // Solo rechazar si definitivamente no tiene MX records Y no es un dominio común
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com'];
    if (mxRecords.length === 0 && !commonDomains.some(d => domain.includes(d))) {
      // No rechazar, solo registrar advertencia
      logger.warn(`Dominio ${domain} no tiene MX records, pero permitiendo de todas formas`, 'EmailValidator');
    }
  } catch (error) {
    logger.warn(`No se pudo verificar MX records para ${domain}, permitiendo de todas formas`, 'EmailValidator', error as Error);
    // No fallar si no se puede verificar DNS - esto es común en redes móviles o con problemas de DNS
  }

  // 4. Validaciones adicionales
  if (email.length > 254) {
    return { valid: false, reason: 'Email demasiado largo' };
  }

  // 5. Verificar patrones sospechosos
  const suspiciousPatterns = [
    /test\d+@/i,
    /fake\d+@/i,
    /temp\d+@/i,
    /12345@/i,
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(email))) {
    return { valid: false, reason: 'Patrón de email sospechoso' };
  }

  return { valid: true };
}

/**
 * Limpia cuentas con emails no válidos
 */
export async function cleanupInvalidEmails(prisma: any): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    // Obtener todos los usuarios no verificados
    const users = await prisma.user.findMany({
      where: {
        emailValidated: false,
        OR: [
          { emailVerificationCodeExpires: { lt: new Date() } },
          { emailVerificationCodeExpires: null },
        ],
      },
    });

    for (const user of users) {
      try {
        const validation = await validateEmail(user.email);
        
        if (!validation.valid) {
          // Intentar validar una vez más antes de borrar
          const revalidation = await validateEmail(user.email);
          
          if (!revalidation.valid) {
            logger.info(`Eliminando cuenta con email inválido: ${user.email}`, 'EmailValidator', {
              userId: user.id,
              reason: revalidation.reason,
            });
            
            await prisma.user.delete({
              where: { id: user.id },
            });
            
            deleted++;
          }
        } else {
          // Marcar como válido si pasa la validación
          await prisma.user.update({
            where: { id: user.id },
            data: { emailValidated: true, emailLastValidated: new Date() },
          });
        }
      } catch (error) {
        logger.error(`Error al procesar usuario ${user.id}`, 'EmailValidator', error as Error);
        errors++;
      }
    }
  } catch (error) {
    logger.error('Error en limpieza de emails inválidos', 'EmailValidator', error as Error);
    errors++;
  }

  return { deleted, errors };
}
