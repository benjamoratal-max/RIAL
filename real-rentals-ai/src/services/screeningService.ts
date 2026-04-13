/**
 * Screening de solicitantes: score de riesgo y banderas rojas (mora, inconsistencias, fraude).
 */
import prisma from '../lib/prisma';

const DISPOSABLE_EMAIL_PATTERNS = [
  /@tempmail\./i,
  /@throwaway\./i,
  /@fake\d*@/i,
  /@guerrillamail/i,
  /@mailinator/i,
  /@10minutemail/i,
  /@temp-mail/i,
  /@yopmail/i,
];

export interface ScreeningResult {
  riskScore: number;
  redFlags: string[];
}

export async function computeLeaseRequestScreening(leaseRequestId: number): Promise<ScreeningResult> {
  const request = await prisma.leaseRequest.findUnique({
    where: { id: leaseRequestId },
    include: { user: true },
  });
  if (!request) return { riskScore: 0, redFlags: [] };

  const redFlags: string[] = [];
  let riskScore = 0;

  const user = request.user as any;

  if (!user.verified) {
    redFlags.push('Cuenta no verificada');
    riskScore += 25;
  }
  if (!user.emailVerified) {
    redFlags.push('Email no verificado');
    riskScore += 15;
  }
  const email = (user.email || '').toLowerCase();
  if (DISPOSABLE_EMAIL_PATTERNS.some((p) => p.test(email))) {
    redFlags.push('Email desechable o temporal');
    riskScore += 35;
  }
  if (!user.name || user.name.trim().length < 3) {
    redFlags.push('Nombre incompleto o vacío');
    riskScore += 10;
  }
  if (user.emailValidated === false && user.emailValidationAttempts > 2) {
    redFlags.push('Email con intentos de validación fallidos');
    riskScore += 20;
  }

  riskScore = Math.min(100, riskScore);
  return { riskScore, redFlags };
}

export async function updateLeaseRequestScreening(leaseRequestId: number): Promise<void> {
  const { riskScore, redFlags } = await computeLeaseRequestScreening(leaseRequestId);
  await prisma.leaseRequest.update({
    where: { id: leaseRequestId },
    data: {
      riskScore,
      redFlags: redFlags.length ? JSON.stringify(redFlags) : null,
    },
  });
}
