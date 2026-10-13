import { db } from "@/lib/db";

export type CountryRevenue = {
  code: string;
  name: string;
  // Oportunidades abiertas de las alianzas del país.
  opportunities: number;
  // Facturación potencial: suma del valor estimado de esas oportunidades.
  potential: number;
  // La misma suma ponderada por la probabilidad de cada oportunidad.
  weightedOpportunities: number;
  alliances: number;
};

// Consolidado por país de las oportunidades abiertas (lo que muestra el mapa del tablero).
export async function revenueByCountry(): Promise<CountryRevenue[]> {
  const opportunities = await db.opportunity.findMany({
    where: { status: "ABIERTA" },
    select: {
      estimatedValue: true,
      probability: true,
      allianceId: true,
      alliance: { select: { countryCode: true, country: { select: { name: true } } } },
    },
  });
  const rows = new Map<string, CountryRevenue & { allianceIds: Set<string> }>();
  for (const o of opportunities) {
    const code = o.alliance.countryCode;
    const row = rows.get(code) ?? {
      code,
      name: o.alliance.country.name,
      opportunities: 0,
      potential: 0,
      weightedOpportunities: 0,
      alliances: 0,
      allianceIds: new Set<string>(),
    };
    const value = Number(o.estimatedValue ?? 0);
    row.opportunities += 1;
    row.potential += value;
    row.weightedOpportunities += value * ((o.probability ?? 0) / 100);
    row.allianceIds.add(o.allianceId);
    rows.set(code, row);
  }
  return [...rows.values()]
    .map(({ allianceIds, ...r }) => ({ ...r, alliances: allianceIds.size }))
    .sort((x, y) => y.potential - x.potential || y.opportunities - x.opportunities);
}
