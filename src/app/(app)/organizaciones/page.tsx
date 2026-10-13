import Link from "next/link";
import type { OrganizationType, Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/row-actions";
import { deleteOrganization } from "./actions";
import { db } from "@/lib/db";
import { ORGANIZATION_TYPES } from "@/lib/labels";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pais?: string; tipo?: string }>;
}) {
  const { q, pais, tipo } = await searchParams;
  const where: Prisma.OrganizationWhereInput = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (pais) where.countries = { some: { code: pais } };
  if (tipo && tipo in ORGANIZATION_TYPES) where.type = tipo as OrganizationType;

  const [organizations, countries] = await Promise.all([
    db.organization.findMany({
      where,
      orderBy: { name: "asc" },
      include: { countries: { orderBy: { name: "asc" } }, _count: { select: { contacts: true } } },
    }),
    db.country.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Organizaciones"
        subtitle="Socios, aliados potenciales e instituciones del ecosistema"
        actions={<Link href="/organizaciones/nueva" className="btn-primary">Nueva organización</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre" className="input max-w-xs" />
        <select name="pais" defaultValue={pais ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los tipos</option>
          {Object.entries(ORGANIZATION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Nombre</th><th>Tipo</th><th>Países</th><th>Sector</th><th>Contactos</th><th></th></tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td><Link href={`/organizaciones/${o.id}`} className="font-medium text-indigo-700 hover:underline">{o.name}</Link></td>
                <td>{ORGANIZATION_TYPES[o.type]}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {o.countries.map((c) => <span key={c.code} className="chip">{c.name}</span>)}
                  </div>
                </td>
                <td>{o.sector}</td>
                <td>{o._count.contacts}</td>
                <td>
                  <RowActions
                    editHref={`/organizaciones/${o.id}/editar`}
                    deleteAction={deleteOrganization.bind(null, o.id)}
                    confirm={`¿Eliminar "${o.name}"? Se borran también sus contactos y su participación en alianzas.`}
                    label={o.name}
                  />
                </td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">No hay organizaciones con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
