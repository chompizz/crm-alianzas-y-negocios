import Link from "next/link";
import type { OpportunityStatus, Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { fmtUsd } from "@/lib/format";
import { OPPORTUNITY_STATUSES } from "@/lib/labels";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; pais?: string }>;
}) {
  const { estado = "ABIERTA", pais } = await searchParams;
  const where: Prisma.OpportunityWhereInput = {};
  if (estado in OPPORTUNITY_STATUSES) where.status = estado as OpportunityStatus;
  if (pais) where.alliance = { countryCode: pais };

  const [opportunities, countries] = await Promise.all([
    db.opportunity.findMany({
      where,
      orderBy: [{ estimatedValue: { sort: "desc", nulls: "last" } }],
      include: { alliance: { select: { id: true, name: true, country: { select: { name: true } } } } },
    }),
    db.country.findMany({ where: { alliances: { some: {} } }, orderBy: { name: "asc" } }),
  ]);
  const total = opportunities.reduce((s, o) => s + Number(o.estimatedValue ?? 0), 0);
  const weighted = opportunities.reduce((s, o) => s + Number(o.estimatedValue ?? 0) * ((o.probability ?? 0) / 100), 0);

  return (
    <>
      <PageHeader
        title="Oportunidades"
        subtitle="Negocios conjuntos que nacen de las alianzas"
        actions={<Link href="/oportunidades/nueva" className="btn-primary">Nueva oportunidad</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="estado" defaultValue={estado} className="input max-w-[12rem]">
          {Object.entries(OPPORTUNITY_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="TODAS">Todas</option>
        </select>
        <select name="pais" defaultValue={pais ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="card"><p className="text-sm text-slate-500">Valor total</p><p className="text-2xl font-semibold">{fmtUsd(total)}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Valor ponderado por probabilidad</p><p className="text-2xl font-semibold">{fmtUsd(weighted)}</p></div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Oportunidad</th><th>Alianza</th><th>País</th><th className="text-right">Valor</th><th className="text-right">Prob.</th><th>Estado</th></tr></thead>
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td><Link href={`/oportunidades/${o.id}/editar`} className="font-medium text-indigo-700 hover:underline">{o.title}</Link></td>
                <td><Link href={`/alianzas/${o.alliance.id}`} className="hover:underline">{o.alliance.name}</Link></td>
                <td>{o.alliance.country.name}</td>
                <td className="text-right">{fmtUsd(o.estimatedValue)}</td>
                <td className="text-right">{o.probability != null ? `${o.probability}%` : ""}</td>
                <td>{OPPORTUNITY_STATUSES[o.status]}</td>
              </tr>
            ))}
            {opportunities.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No hay oportunidades con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
