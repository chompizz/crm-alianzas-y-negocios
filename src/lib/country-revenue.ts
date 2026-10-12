import { db } from "@/lib/db";

export type CountryRevenue = {
  code: string;
  name: string;
  alliances: number;
  // Facturación potencial: suma del valor esperado de las alianzas abiertas del país.
  potential: number;
  // Oportunidades abiertas del país ponderadas por probabilidad.
  weightedOpportunities: number;
};

export async function revenueByCountry(): Promise<CountryRevenue[]> {
  const alliances = await db.alliance.findMany({
    where: { stage: { not: "CERRADA" } },
    select: {
      countryCode: true,
      expectedValue: true,
      country: { select: { name: true } },
      opportunities: { where: { status: "ABIERTA" }, select: { estimatedValue: true, probability: true } },
    },
  });
  const rows = new Map<string, CountryRevenue>();
  for (const a of alliances) {
    const row = rows.get(a.countryCode) ?? { code: a.countryCode, name: a.country.name, alliances: 0, potential: 0, weightedOpportunities: 0 };
    row.alliances += 1;
    row.potential += Number(a.expectedValue ?? 0);
    for (const o of a.opportunities) row.weightedOpportunities += Number(o.estimatedValue ?? 0) * ((o.probability ?? 0) / 100);
    rows.set(a.countryCode, row);
  }
  return [...rows.values()].sort((x, y) => y.potential - x.potential || y.alliances - x.alliances);
}
