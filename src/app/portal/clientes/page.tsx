import { requirePartner } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { fmtDate, fmtUsd } from "@/lib/format";

// Clientes que el partner trajo y se ganaron.
export default async function PortalClients() {
  const partner = await requirePartner();
  const won = await db.dealRegistration.findMany({
    where: { partnerId: partner.organizationId, opportunity: { status: "GANADA" } },
    orderBy: { updatedAt: "desc" },
    include: { alliance: { select: { name: true } }, opportunity: { select: { estimatedValue: true, updatedAt: true } } },
  });
  const total = won.reduce((s, r) => s + Number(r.opportunity?.estimatedValue ?? r.estimatedValue ?? 0), 0);
  return (
    <>
      <PageHeader title="Mis clientes" subtitle="Oportunidades que trajiste y se ganaron" />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="card"><p className="text-sm text-slate-500">Clientes ganados</p><p className="text-2xl font-semibold">{won.length}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Valor ganado</p><p className="text-2xl font-semibold">{fmtUsd(total)}</p></div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Cliente</th><th>Oportunidad</th><th>Alianza</th><th className="text-right">Valor</th><th>Ganada</th></tr></thead>
          <tbody>
            {won.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.clientName}</td>
                <td>{r.title}</td>
                <td>{r.alliance.name}</td>
                <td className="text-right">{fmtUsd(r.opportunity?.estimatedValue ?? r.estimatedValue)}</td>
                <td>{fmtDate(r.opportunity?.updatedAt)}</td>
              </tr>
            ))}
            {won.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Todavía no hay clientes ganados.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
