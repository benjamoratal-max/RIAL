/**
 * Detección de anuncios duplicados o potencialmente falsos (similitud título/descripción).
 */
import prisma from '../lib/prisma';

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

export interface DuplicateCandidate {
  propertyId: number;
  title: string;
  similarityScore: number;
  reason: string;
}

export async function checkDuplicateProperty(propertyId: number): Promise<DuplicateCandidate[]> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { images: true },
  });
  if (!property) return [];

  const titleNorm = normalize(property.title);
  const descNorm = normalize(property.description);
  const tokensTitle = tokenSet(property.title);
  const tokensDesc = tokenSet(property.description);
  const allTokens = tokenSet(property.title + ' ' + property.description);

  const locationToken = (property.location || '').split(/[\s,]+/).find((w) => w.length > 3) ?? '';
  const others = await prisma.property.findMany({
    where: {
      id: { not: propertyId },
      ...(locationToken
        ? { location: { contains: locationToken } }
        : {}),
      createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, title: true, description: true, location: true },
    take: 250,
    orderBy: { createdAt: 'desc' },
  });

  const candidates: DuplicateCandidate[] = [];
  for (const other of others) {
    const otherTitle = normalize(other.title);
    const otherDesc = normalize(other.description);
    const simTitle = jaccardSimilarity(tokensTitle, tokenSet(other.title));
    const simDesc = jaccardSimilarity(tokensDesc, tokenSet(other.description || ''));
    const simAll = jaccardSimilarity(allTokens, tokenSet((other.title + ' ' + (other.description || '')).trim()));
    const exactTitle = titleNorm.length > 10 && otherTitle === titleNorm ? 1 : 0;
    const score = Math.max(simTitle * 0.5 + simDesc * 0.4 + exactTitle * 0.3, simAll * 0.9);
    if (score >= 0.5) {
      let reason = 'Similitud en título y descripción';
      if (exactTitle) reason = 'Título idéntico';
      else if (simTitle > 0.8) reason = 'Título muy similar';
      candidates.push({
        propertyId: other.id,
        title: other.title,
        similarityScore: Math.round(score * 100) / 100,
        reason,
      });
    }
  }

  candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  return candidates.slice(0, 5);
}

export async function saveDuplicateAlerts(propertyId: number, candidates: DuplicateCandidate[]): Promise<void> {
  await (prisma as any).propertyDuplicateAlert.deleteMany({ where: { propertyId } });
  if (!candidates.length) return;
  await (prisma as any).propertyDuplicateAlert.createMany({
    data: candidates.map((c) => ({
      propertyId,
      suspectedDuplicateOfId: c.propertyId,
      similarityScore: c.similarityScore,
    })),
  });
}

export async function getDuplicateAlertsForProperty(propertyId: number): Promise<any[]> {
  try {
    const alerts = await (prisma as any).propertyDuplicateAlert.findMany({
      where: { propertyId },
      include: { suspectedDuplicateOf: { select: { id: true, title: true, location: true } } },
      orderBy: { similarityScore: 'desc' },
    });
    return alerts;
  } catch {
    return [];
  }
}
