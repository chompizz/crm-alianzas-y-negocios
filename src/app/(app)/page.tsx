import Link from "next/link";
import type { AllianceStage } from "@prisma/client";
import { AllianceMap } from "@/components/alliance-map";
import { PageHeader } from "@/components/page-header";
import { revenueByCountry } from "@/lib/country-revenue";
import { dimensionSummary } from "@/lib/dimension-summary";
import { db } from "@/lib/db";
import { fmtDate, fmtUsdCompact, startOfTodayUtc } from "@/lib/format";
import { ALLIANCE_STAGES, DIMENSION_STYLE, DIMENSIONS, HEALTH_DOT } from "@/lib/labels";

const STALE_DAYS = 30;

export default async function DashboardPage() {
  const today = startOfTodayUtc();
  const staleSince = new Date(today.getTime() - STALE_DAYS * 864e5);

  const [alliances, overdue, organizations, orgCountryCounts] = await Promise.all([
    db.alliance.findMany({
      where: { stage: { not: "CERRADA" } },
      include: {
        country: true,
        interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
    }),
    db.commitment.findMany({
      where: { status: "PENDIENTE", dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { alliance: { select: { id: true, name: true } }, owner: { select: { name: true } } },
    }),
    db.organization.count(),
    db.organization.findMany({ select: { _count: { select: { countries: true } } } }),
  ]);
  const openOpportunities = await db.opportunity.findMany({
    where: { status: "ABIERTA", alliance: { stage: { not: "CERRADA" } } },
    select: { estimatedValue: true, probability: true },
  });
  const weightedPipeline = openOpportunities.reduce((s, o) => s + Number(o.estimatedValue ?? 0) * ((o.probability ?? 0) / 100), 0);
  const [countryRevenue, dimensions] = await Promise.all([revenueByCountry(), dimensionSummary()]);
  const overdueTotal = await db.commitment.count({ where: { status: "PENDIENTE", dueDate: { lt: today } } });
  const multiCountry = orgCountryCounts.filter((o) => o._count.countries > 1).length;

  const active = alliances.filter((a) => a.stage === "ACTIVA").length;
  const expected = alliances.reduce((sum, a) => sum + Number(a.expectedValue ?? 0), 0);
  const stale = alliances
    .filter((a) => (a.interactions[0]?.date ?? a.createdAt) < staleSince)
    .map((a) => ({ ...a, last: a.interactions[0]?.date ?? null }));

  // Matriz país × etapa.
  const stages = (Object.keys(ALLIANCE_STAGES) as AllianceStage[]).filter((s) => s !== "CERRADA");
  const byCountry = new Map<string, { code: string; name: string; counts: Record<string, number>; red: number }>();
  for (const a of alliances) {
    const row = byCountry.get(a.countryCode) ?? { code: a.countryCode, name: a.country.name, counts: {}, red: 0 };
    row.counts[a.stage] = (row.counts[a.stage] ?? 0) + 1;
    if (a.health === "ROJO") row.red += 1;
    byCountry.set(a.countryCode, row);
  }
  const countryRows = [...byCountry.values()].sort((x, y) => x.name.localeCompare(y.name));

  return (
    <>
      <PageHeader title="Tablero" subtitle="Portafolio de alianzas" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Alianzas abiertas" value={String(alliances.length)} hint={`${active} activas`} href="/alianzas" />
        <Stat label="Valor esperado" value={fmtUsdCompact(expected)} hint="alianzas abiertas" href="/alianzas" />
        <Stat label="Oportunidades" value={fmtUsdCompact(weightedPipeline)} hint={`${openOpportunities.length} abiertas, valor ponderado`} href="/oportunidades" />
        <Stat label="Compromisos vencidos" value={String(overdueTotal)} hint="pendientes con fecha pasada" href="/compromisos?vista=vencidos" alert={overdueTotal > 0} />
        <Stat label="Organizaciones" value={String(organizations)} hint={`${multiCountry} multipaís`} href="/organizaciones" />
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dimensions.map((d) => (
          <Link key={d.dimension} href={`/dimensiones#${d.dimension.toLowerCase()}`} className="card block p-4 transition hover:border-indigo-300">
            <div className="flex items-center justify-between">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${DIMENSION_STYLE[d.dimension]}`}>{DIMENSIONS[d.dimension]}</span>
              <span className="font-mono text-xs text-slate-500">{d.avgProgress}% avance</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-mono text-lg font-semibold text-slate-900">{d.openAlliances}</span> alianzas ·{" "}
              <span className="font-mono text-lg font-semibold text-slate-900">{d.initiatives}</span> iniciativas ·{" "}
              <span className="font-mono text-lg font-semibold text-slate-900">{d.openOpportunities}</span> oport.
            </p>
          </Link>
        ))}
      </section>

      <AllianceMap data={countryRevenue} />

      <section className="card mb-6 overflow-x-auto">
        <h2 className="mb-3 font-semibold">Alianzas por país y etapa</h2>
        {countryRows.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay alianzas. <Link href="/alianzas/nueva" className="text-indigo-700 hover:underline">Crear la primera</Link>.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>País</th>{stages.map((s) => <th key={s} className="text-center">{ALLIANCE_STAGES[s]}</th>)}<th className="text-center">En rojo</th></tr>
            </thead>
            <tbody>
              {countryRows.map((r) => (
                <tr key={r.code}>
                  <td><Link href={`/alianzas?pais=${r.code}`} className="font-medium text-indigo-700 hover:underline">{r.name}</Link></td>
                  {stages.map((s) => <td key={s} className="text-center">{r.counts[s] ?? ""}</td>)}
                  <td className={`text-center ${r.red ? "font-medium text-red-600" : ""}`}>{r.red || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Compromisos vencidos</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {overdue.map((c) => (
              <li key={c.id} className="py-2">
                <p>{c.description}</p>
                <p className="text-xs text-slate-500">
                  {c.alliance && <Link href={`/alianzas/${c.alliance.id}`} className="hover:underline">{c.alliance.name}</Link>}
                  {" · "}{c.party === "SOCIO" ? "Socio" : c.owner?.name ?? "Nosotros"}
                  {" · "}<span className="text-red-600">{fmtDate(c.dueDate)}</span>
                </p>
              </li>
            ))}
            {overdue.length === 0 && <li className="py-2 text-slate-500">No hay compromisos vencidos.</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Sin contacto hace {STALE_DAYS} días o más</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {stale.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${HEALTH_DOT[a.health]}`} />
                  <Link href={`/alianzas/${a.id}`} className="hover:underline">{a.name}</Link>
                  <span className="ml-1 text-xs text-slate-500">{a.country.name}</span>
                </span>
                <span className="text-xs text-slate-500">{a.last ? `último: ${fmtDate(a.last)}` : "sin interacciones"}</span>
              </li>
            ))}
            {stale.length === 0 && <li className="py-2 text-slate-500">Todas las alianzas tienen contacto reciente.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, hint, href, alert }: { label: string; value: string; hint: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="card block transition hover:border-indigo-300 hover:shadow-[0_0_24px_-6px_rgb(34_211_238/0.5)]">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-semibold tracking-tight ${alert ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-400">{hint}</p>
    </Link>
  );
}
