import Link from "next/link";
import type { OfferingKind } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/row-actions";

import { db } from "@/lib/db";
import { OFFERING_KINDS, OFFERING_STYLE } from "@/lib/labels";
import { createOffering, deleteOffering } from "./actions";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const [offerings, organizations, alliances] = await Promise.all([db.offering.findMany({
    where: tipo && tipo in OFFERING_KINDS ? { kind: tipo as OfferingKind } : {},
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: { organizations: { select: { id: true, name: true } }, _count: { select: { alliances: true } } },
  }),
  db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  db.alliance.findMany({ select: { id: true, name: true, country: { select: { name: true } } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Catálogo" subtitle="Productos, servicios y otros del ecosistema" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <form className="flex flex-wrap gap-2">
            <select name="tipo" defaultValue={tipo ?? ""} className="input max-w-[12rem]">
              <option value="">Todos los tipos</option>
              {Object.entries(OFFERING_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn-secondary">Filtrar</button>
          </form>
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead><tr><th>Nombre</th><th>Tipo</th><th>Lo ofrecen</th><th className="text-right">Alianzas</th><th></th></tr></thead>
              <tbody>
                {offerings.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/catalogo/${o.id}`} className="font-medium text-indigo-700 hover:underline">{o.name}</Link>
                      {o.description && <p className="max-w-md truncate text-xs text-slate-500">{o.description}</p>}
                    </td>
                    <td><span className={`rounded-full border px-2 py-0.5 text-xs ${OFFERING_STYLE[o.kind]}`}>{OFFERING_KINDS[o.kind]}</span></td>
                    <td className="text-sm">
                      {o.organizations.map((org, i) => (
                        <span key={org.id}>{i > 0 && ", "}<Link href={`/organizaciones/${org.id}`} className="hover:underline">{org.name}</Link></span>
                      ))}
                    </td>
                    <td className="text-right font-mono">{o._count.alliances}</td>
                    <td>
                      <RowActions
                        editHref={`/catalogo/${o.id}`}
                        deleteAction={deleteOffering.bind(null, o.id)}
                        confirm={`¿Eliminar "${o.name}" del catálogo?`}
                        label={o.name}
                      />
                    </td>
                  </tr>
                ))}
                {offerings.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Todavía no hay ítems en el catálogo.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <form action={createOffering} className="card space-y-3 self-start">
          <h2 className="font-semibold">Nuevo ítem</h2>
          <label className="block"><span className="label">Nombre *</span><input name="name" required className="input" /></label>
          <label className="block">
            <span className="label">Tipo</span>
            <select name="kind" defaultValue="PRODUCTO" className="input">
              {Object.entries(OFFERING_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block"><span className="label">Descripción</span><textarea name="description" rows={3} className="input" /></label>
          <div>
            <span className="label">Alianzas donde se usa</span>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
              {alliances.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="alliances" value={a.id} />
                  {a.name} <span className="text-xs text-slate-400">({a.country.name})</span>
                </label>
              ))}
              {alliances.length === 0 && <p className="text-sm text-slate-500">Sin alianzas.</p>}
            </div>
          </div>
          <div>
            <span className="label">Organizaciones que lo ofrecen</span>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
              {organizations.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="organizations" value={o.id} />
                  {o.name}
                </label>
              ))}
              {organizations.length === 0 && <p className="text-sm text-slate-500">Sin organizaciones.</p>}
            </div>
          </div>
          <button className="btn-primary w-full">Crear</button>
        </form>
      </div>
    </>
  );
}
