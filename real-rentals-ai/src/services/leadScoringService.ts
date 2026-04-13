import prisma from '../lib/prisma';

export interface LeadScoringResult {
  urgency: 'low' | 'medium' | 'high';
  intentScore: number; // 0-100
  probability: number; // 0-100
}

/**
 * Scoring basado en reglas para leads cuando no se usa IA generativa.
 * Considera etapa, riesgo, tiempo sin respuesta, redFlags, etc.
 */
export async function computeLeadScoring(leadId: number): Promise<LeadScoringResult> {
  const lead = await (prisma as any).lead.findUnique({
    where: { id: leadId },
    include: {
      activities: true,
      showings: true,
    },
  });

  if (!lead) {
    return { urgency: 'low', intentScore: 0, probability: 0 };
  }

  let score = 0;

  // Etapa del pipeline
  const stage = (lead.stage || 'new_inquiry').toLowerCase();
  if (stage === 'new_inquiry' || stage === 'contacted') score += 20;
  if (stage === 'pre_qualified' || stage === 'showing_proposed') score += 40;
  if (stage === 'showing_scheduled' || stage === 'showing_completed') score += 60;
  if (stage === 'interested' || stage === 'documents_requested' || stage === 'documents_received') score += 75;
  if (stage === 'application_ready' || stage === 'negotiation' || stage === 'lease_ready') score += 90;

  // Visitas agendadas o completadas aumentan probabilidad
  const upcomingShowings = lead.showings.filter(
    (s: any) => s.status === 'scheduled' && s.scheduledAt > new Date()
  );
  const pastShowings = lead.showings.filter((s: any) => s.status === 'completed');
  if (upcomingShowings.length > 0) score += 10;
  if (pastShowings.length > 0) score += 15;

  // Actividad reciente
  const lastActivity =
    lead.lastInteractionAt ||
    (lead.activities.length
      ? lead.activities.reduce((latest: Date | null, act: any) => {
          const d = act.createdAt as Date;
          if (!latest || d > latest) return d;
          return latest;
        }, null as Date | null)
      : null);
  if (lastActivity) {
    const hoursSince =
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
    if (hoursSince <= 24) score += 10;
    else if (hoursSince <= 72) score += 5;
    else score -= 10;
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  let urgency: LeadScoringResult['urgency'] = 'low';
  if (score >= 70) urgency = 'high';
  else if (score >= 40) urgency = 'medium';

  const intentScore = score;
  const probability = Math.round(score * 0.9);

  return { urgency, intentScore, probability };
}

