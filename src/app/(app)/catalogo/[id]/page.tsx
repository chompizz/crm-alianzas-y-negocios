import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { OFFERING_KINDS } from "@/lib/labels";
import { deleteOffering, updateOffering } from "../actions";

export default async function OfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [offering, organizations, alliances] = await Promise.all([
    db.offering.findUnique({ where: { id }, include: { organizations: { select: { id: true } }, alliances: { select: { id: true } } } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.alliance.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, country: { select: { name: true } } } }),
  ]);
  if (!offering) notFound();
  const orgIds = offering.organizations.map((o) => o.id);
  const allianceIds = offering.alliances.map((a) => a.id);

  return (
    <>
      <PageHeader
        title={offering.name}
        subtitle={OFFERING_KINDS[offering.kind]}
        actions={
          <form action={deleteOffering.bind(null, id)}>
            <button className="btn-danger">Eliminar</button>
          </form>
        }
      />
      <form action={updateOffering.bind(null, id)} className="card max-w-3xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">Nombre *</span><input name="name" required defaultValue={offering.name} className="input" /></label>
          <label>
            <span className="label">Tipo</span>
            <select name="kind" defaultValue={offering.kind} className="input">
              {Object.entries(OFFERING_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><span className="label">Descripción</span><textarea name="description" rows={3} defaultValue={offering.description ?? ""} className="input" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Organizaciones que lo ofrecen</span>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
              {organizations.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="organizations" value={o.id} defaultChecked={orgIds.includes(o.id)} />
                  {o.name}
                </label>
              ))}
              {organizations.length === 0 && <p className="text-sm text-slate-500">Sin organizaciones.</p>}
            </div>
          </div>
          <div>
            <span className="label">Alianzas donde se usa</span>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
              {alliances.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="alliances" value={a.id} defaultChecked={allianceIds.includes(a.id)} />
                  {a.name} <span className="text-xs text-slate-400">({a.country.name})</span>
                </label>
              ))}
              {alliances.length === 0 && <p className="text-sm text-slate-500">Sin alianzas.</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary">Guardar</button>
          <Link href="/catalogo" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
