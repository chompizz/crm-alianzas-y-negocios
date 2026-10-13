import Link from "next/link";
import { requirePartner } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/row-actions";
import { db } from "@/lib/db";
import { fmtDate, fmtUsd } from "@/lib/format";
import { registrationStage } from "@/lib/partners";
import { removeRegistration } from "./actions";

const OK = { registrada: "Listo, registramos la oportunidad. Te avisamos por email cuando el equipo la revise.", guardada: "Cambios guardados." };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const partner = await requirePartner();
  const registrations = await db.dealRegistration.findMany({
    where: { partnerId: partner.organizationId },
    orderBy: { createdAt: "desc" },
    include: { alliance: { select: { name: true } }, opportunity: { select: { status: true } }, createdBy: { select: { name: true } } },
  });
  const rows = registrations.map((r) => ({ ...r, stage: registrationStage(r) }));
  const count = (k: string) => rows.filter((r) => r.stage.key === k).length;
  const live = rows.filter((r) => r.stage.key === "APROBADA" || r.stage.key === "PENDIENTE");
  const pipeline = live.reduce((s, r) => s + Number(r.estimatedValue ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Mis oportunidades"
        subtitle={partner.organizationName}
        actions={<Link href="/portal/registrar" className="btn-primary">Registrar oportunidad</Link>}
      />
      {ok && ok in OK && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{OK[ok as keyof typeof OK]}</p>}
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <div className="card"><p className="text-sm text-slate-500">Pendientes</p><p className="text-2xl font-semibold">{count("PENDIENTE")}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Aprobadas en curso</p><p className="text-2xl font-semibold">{count("APROBADA")}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Ganadas</p><p className="text-2xl font-semibold">{count("GANADA")}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Valor en juego</p><p className="text-2xl font-semibold">{fmtUsd(pipeline)}</p></div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Cliente</th><th>Oportunidad</th><th>Alianza</th><th className="text-right">Valor</th><th>Cierre esperado</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.clientName}</td>
                <td>
                  {r.title}
                  <p className="text-xs text-slate-500">Registrada el {fmtDate(r.createdAt)}{r.createdBy ? ` por ${r.createdBy.name}` : ""}</p>
                </td>
                <td>{r.alliance.name}</td>
                <td className="text-right">{fmtUsd(r.estimatedValue)}</td>
                <td>{fmtDate(r.expectedCloseDate)}</td>
                <td>
                  <span className={`chip whitespace-nowrap ${r.stage.style}`}>{r.stage.label}</span>
                  {r.status === "RECHAZADA" && r.rejectionReason && <p className="mt-1 max-w-xs text-xs text-slate-500">Motivo: {r.rejectionReason}</p>}
                </td>
                <td>
                  {r.status === "PENDIENTE" && (
                    <RowActions
                      editHref={`/portal/registros/${r.id}/editar`}
                      deleteAction={removeRegistration.bind(null, r.id)}
                      confirm={`¿Eliminar el registro "${r.title}" de ${r.clientName}?`}
                      label={r.title}
                    />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-500">Todavía no registraste oportunidades.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
