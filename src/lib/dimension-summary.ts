import type { Dimension } from "@prisma/client";
import { db } from "@/lib/db";
import { DIMENSIONS } from "@/lib/labels";

export type DimensionSummary = {
  dimension: Dimension;
  openAlliances: number;
  allianceValue: number; // valor esperado de alianzas abiertas (USD)
  initiatives: number;
  avgProgress: number; // promedio de avance de sus iniciativas (0 a 100)
  openOpportunities: number;
  weightedOpportunities: number; // oportunidades abiertas ponderadas por probabilidad (USD)
  pendingCommitments: number; // compromisos pendientes de sus alianzas e iniciativas
  recentAlliances: { id: string; name: string; country: string }[];
  recentInitiatives: { id: string; name: string; progress: number }[];
};

export async function dimensionSummary(): Promise<DimensionSummary[]> {
  const [alliances, initiatives, opportunities, commitments] = await Promise.all([
    db.alliance.findMany({
      where: { stage: { not: "CERRADA" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, dimension: true, expectedValue: true, country: { select: { name: true } } },
    }),
    db.initiative.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, dimension: true, progress: true } }),
    db.opportunity.findMany({ where: { status: "ABIERTA" }, select: { dimension: true, estimatedValue: true, probability: true } }),
    db.commitment.findMany({
      where: { status: "PENDIENTE" },
      select: { alliance: { select: { dimension: true } }, initiative: { select: { dimension: true } } },
    }),
  ]);

  return (Object.keys(DIMENSIONS) as Dimension[]).map((dimension) => {
    const as = alliances.filter((a) => a.dimension === dimension);
    const is = initiatives.filter((i) => i.dimension === dimension);
    const os = opportunities.filter((o) => o.dimension === dimension);
    return {
      dimension,
      openAlliances: as.length,
      allianceValue: as.reduce((s, a) => s + Number(a.expectedValue ?? 0), 0),
      initiatives: is.length,
      avgProgress: is.length ? Math.round(is.reduce((s, i) => s + i.progress, 0) / is.length) : 0,
      openOpportunities: os.length,
      weightedOpportunities: os.reduce((s, o) => s + Number(o.estimatedValue ?? 0) * ((o.probability ?? 0) / 100), 0),
      pendingCommitments: commitments.filter((c) => (c.alliance ?? c.initiative)?.dimension === dimension).length,
      recentAlliances: as.slice(0, 4).map((a) => ({ id: a.id, name: a.name, country: a.country.name })),
      recentInitiatives: is.slice(0, 4).map((i) => ({ id: i.id, name: i.name, progress: i.progress })),
    };
  });
}
