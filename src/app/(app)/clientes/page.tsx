import Link from "next/link";
import type { ClientStatus, Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { fmtDate, fmtUsd } from "@/lib/format";
import { CLIENT_STATUS_STYLE, CLIENT_STATUSES } from "@/lib/labels";

// Todos los clientes de todas las alianzas.
export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ estado?: string; pais?: string }> }) {
  const { estado, pais } = await searchParams;
  const where: Prisma.AllianceClientWhereInput = {};
  if (estado && estado in CLIENT_STATUSES) where.status = estado as ClientStatus;
  if (pais) where.alliance = { countryCode: pais };

  const [clients, countries] = await Promise.all([
    db.allianceClient.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        alliance: { select: { id: true, name: true, country: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { organization: { name: "asc" } }],
    }),
    db.country.findMany({ where: { alliances: { some: { clients: { some: {} } } } }, orderBy: { name: "asc" } }),
  ]);
  const active = clients.filter((c) => c.status === "ACTIVO");
  const total = active.reduce((s, c) => s + Number(c.revenue ?? 0), 0);

  return (
    <>
      <PageHeader title="Clientes" subtitle="Clientes que atienden las alianzas" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap gap-2">
          <select name="estado" defaultValue={estado ?? ""} className="input max-w-[12rem]">
            <option value="">Todos los estados</option>
            {Object.entries(CLIENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="pais" defaultValue={pais ?? ""} className="input max-w-[12rem]">
            <option value="">Todos los países</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <button className="btn-secondary">Filtrar</button>
        </form>
        <p className="text-sm text-slate-500">
          {active.length} activos · facturación anual <span className="font-mono font-semibold text-indigo-700">{fmtUsd(total) || "US$ 0"}</span>
        </p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Cliente</th><th>Alianza</th><th>País</th><th>Estado</th><th>Facturación anual</th><th>Desde</th></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/organizaciones/${c.organizationId}`} className="font-medium text-indigo-700 hover:underline">{c.organization.name}</Link></td>
                <td><Link href={`/alianzas/${c.allianceId}`} className="hover:underline">{c.alliance.name}</Link></td>
                <td>{c.alliance.country.name}</td>
                <td><span className={`rounded-full border px-2 py-0.5 text-xs ${CLIENT_STATUS_STYLE[c.status]}`}>{CLIENT_STATUSES[c.status]}</span></td>
                <td className="font-mono">{fmtUsd(c.revenue)}</td>
                <td>{fmtDate(c.since)}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">Todavía no hay clientes. Se cargan desde la ficha de cada alianza.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
