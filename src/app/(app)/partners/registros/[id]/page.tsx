import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/row-actions";
import { db } from "@/lib/db";
import { fmtDate, fmtUsd } from "@/lib/format";
import { registrationStage } from "@/lib/partners";
import { approve, deleteRegistration, reject } from "../../actions";

// Revisión de un registro: datos que cargó el partner, aviso de conflicto y aprobar (con ajustes) o rechazar.
export default async function ReviewRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const r = await db.dealRegistration.findUnique({
    where: { id },
    include: {
      alliance: { select: { id: true, name: true, country: { select: { name: true } } } },
      partner: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true } },
      opportunity: { select: { id: true, title: true, status: true } },
    },
  });
  if (!r) notFound();
  const country = r.clientCountryCode ? await db.country.findUnique({ where: { code: r.clientCountryCode }, select: { name: true } }) : null;
  const stage = registrationStage(r);
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="grid grid-cols-3 gap-2 py-1.5">
        <dt className="text-slate-500">{label}</dt>
        <dd className="col-span-2">{value}</dd>
      </div>
    ) : null;

  return (
    <>
      <PageHeader
        title={r.title}
        subtitle={`Registro de ${r.partner.name}`}
        actions={
          <DeleteButton
            action={deleteRegistration.bind(null, r.id)}
            confirm={`¿Eliminar el registro "${r.title}"?`}
            label={r.title}
            variant="button"
          />
        }
      />
      <p className="mb-4"><Link href="/partners" className="text-sm text-slate-500 hover:text-slate-800">← Volver a la bandeja</Link></p>
      {error && <p className="mb-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card text-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className={`chip ${stage.style}`}>{stage.label}</span>
            {r.reviewedBy && <span className="text-xs text-slate-500">por {r.reviewedBy.name} el {fmtDate(r.reviewedAt)}</span>}
          </div>
          {r.conflict && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-amber-700">⚠ {r.conflict}</p>}
          <dl className="divide-y divide-slate-100">
            {row("Partner", <Link href={`/organizaciones/${r.partner.id}`} className="hover:underline">{r.partner.name}</Link>)}
            {row("Registrado por", r.createdBy && `${r.createdBy.name} (${r.createdBy.email})`)}
            {row("Fecha", fmtDate(r.createdAt))}
            {row("Alianza", <Link href={`/alianzas/${r.alliance.id}`} className="hover:underline">{r.alliance.name} · {r.alliance.country.name}</Link>)}
            {row("Cliente", <span className="font-medium">{r.clientName}</span>)}
            {row("País del cliente", country?.name)}
            {row("Contacto", r.clientContact)}
            {row("Email", r.clientEmail)}
            {row("Valor estimado", fmtUsd(r.estimatedValue))}
            {row("Cierre esperado", fmtDate(r.expectedCloseDate))}
            {row("Notas", r.notes && <span className="whitespace-pre-line">{r.notes}</span>)}
            {row("Motivo del rechazo", r.rejectionReason)}
            {row("Oportunidad", r.opportunity && <Link href={`/oportunidades/${r.opportunity.id}/editar`} className="text-indigo-700 hover:underline">{r.opportunity.title}</Link>)}
          </dl>
        </div>
        {r.status === "PENDIENTE" && (
          <div className="space-y-4">
            <form action={approve.bind(null, r.id)} className="card space-y-3">
              <h2 className="font-semibold">Aprobar</h2>
              <p className="text-sm text-slate-500">Se crea una oportunidad en la alianza, marcada como traída por {r.partner.name}. Podés ajustar los datos.</p>
              <label className="block"><span className="label">Título</span><input name="title" defaultValue={r.title} className="input" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="label">Valor (USD)</span><input name="estimatedValue" inputMode="decimal" defaultValue={r.estimatedValue?.toString() ?? ""} className="input" /></label>
                <label className="block"><span className="label">Probabilidad (%)</span><input name="probability" type="number" min={0} max={100} className="input" /></label>
              </div>
              <button className="btn-primary">Aprobar</button>
            </form>
            <form action={reject.bind(null, r.id)} className="card space-y-3">
              <h2 className="font-semibold">Rechazar</h2>
              <label className="block">
                <span className="label">Motivo (lo ve el partner)</span>
                <textarea name="reason" required rows={2} className="input" />
              </label>
              <button className="btn-danger">Rechazar</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
