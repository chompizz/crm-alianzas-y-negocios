import Link from "next/link";
import type { Prisma, RegistrationStatus } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/row-actions";
import { db } from "@/lib/db";
import { fmtDate, fmtUsd } from "@/lib/format";
import { REGISTRATION_STATUSES } from "@/lib/labels";
import { registrationStage } from "@/lib/partners";
import { deleteRegistration } from "./actions";
import { PartnerTabs } from "./tabs";

const OK = { aprobada: "Registro aprobado: ya es una oportunidad de la alianza.", rechazada: "Registro rechazado. Le avisamos al partner." };

// Bandeja de oportunidades registradas por los partners desde el portal.
export default async function PartnerRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; partner?: string; ok?: string }>;
}) {
  const { estado = "PENDIENTE", partner, ok } = await searchParams;
  const where: Prisma.DealRegistrationWhereInput = {};
  if (estado in REGISTRATION_STATUSES) where.status = estado as RegistrationStatus;
  if (partner) where.partnerId = partner;

  const [registrations, partners, pending] = await Promise.all([
    db.dealRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        alliance: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
        opportunity: { select: { id: true, status: true } },
        reviewedBy: { select: { name: true } },
      },
    }),
    db.organization.findMany({ where: { partnerRegistrations: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.dealRegistration.count({ where: { status: "PENDIENTE" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Oportunidades que registran los partners desde su portal"
      />
      <PartnerTabs active="registros" pending={pending} />
      {ok && ok in OK && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{OK[ok as keyof typeof OK]}</p>}
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="estado" defaultValue={estado} className="input max-w-[12rem]">
          {Object.entries(REGISTRATION_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="TODAS">Todas</option>
        </select>
        <select name="partner" defaultValue={partner ?? ""} className="input max-w-[14rem]">
          <option value="">Todos los partners</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Partner</th><th>Cliente</th><th>Oportunidad</th><th>Alianza</th><th className="text-right">Valor</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {registrations.map((r) => {
              const stage = registrationStage(r);
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                  <td><Link href={`/organizaciones/${r.partner.id}`} className="hover:underline">{r.partner.name}</Link></td>
                  <td>
                    <span className="font-medium">{r.clientName}</span>
                    {r.conflict && <p className="text-xs text-amber-600" title={r.conflict}>⚠ {r.conflict}</p>}
                  </td>
                  <td><Link href={`/partners/registros/${r.id}`} className="font-medium text-indigo-700 hover:underline">{r.title}</Link></td>
                  <td><Link href={`/alianzas/${r.alliance.id}`} className="hover:underline">{r.alliance.name}</Link></td>
                  <td className="text-right">{fmtUsd(r.estimatedValue)}</td>
                  <td>
                    <span className={`chip whitespace-nowrap ${stage.style}`}>{stage.label}</span>
                    {r.reviewedBy && <p className="text-xs text-slate-500">por {r.reviewedBy.name}</p>}
                  </td>
                  <td>
                    <RowActions
                      editHref={`/partners/registros/${r.id}`}
                      deleteAction={deleteRegistration.bind(null, r.id)}
                      confirm={`¿Eliminar el registro "${r.title}" de ${r.partner.name}?${r.opportunity ? " La oportunidad ya creada se mantiene." : ""}`}
                      label={r.title}
                    />
                  </td>
                </tr>
              );
            })}
            {registrations.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-500">No hay registros con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
