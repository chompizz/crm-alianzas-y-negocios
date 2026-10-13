import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { CLIENT_STATUSES } from "@/lib/labels";
import { createClient } from "../actions";

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ alianza?: string }> }) {
  const { alianza } = await searchParams;
  const [alliances, organizations] = await Promise.all([
    db.alliance.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, country: { select: { name: true } } } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Nuevo cliente" subtitle="Se asigna a una alianza" />
      <form action={createClient} className="card max-w-2xl space-y-4">
        <label className="block">
          <span className="label">Alianza *</span>
          <select name="allianceId" required defaultValue={alianza ?? ""} className="input">
            <option value="" disabled>Elegir alianza...</option>
            {alliances.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.country.name})</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Organización existente</span>
            <select name="organizationId" defaultValue="" className="input">
              <option value="">Elegir...</option>
              {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">...o cliente nuevo</span>
            <input name="newName" placeholder="Nombre de la empresa" className="input" />
          </label>
          <label>
            <span className="label">Estado</span>
            <select name="status" defaultValue="ACTIVO" className="input">
              {Object.entries(CLIENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Facturación anual USD</span>
            <input name="revenue" inputMode="decimal" className="input" />
          </label>
          <label>
            <span className="label">Cliente desde</span>
            <input name="since" type="date" className="input" />
          </label>
        </div>
        <label className="block">
          <span className="label">Notas</span>
          <textarea name="notes" rows={2} placeholder="Qué compra, condiciones, contacto clave..." className="input" />
        </label>
        <p className="text-xs text-slate-500">Si el cliente es nuevo, se crea como organización en el país de la alianza.</p>
        <div className="flex gap-2">
          <button className="btn-primary">Crear cliente</button>
          <Link href="/clientes" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
