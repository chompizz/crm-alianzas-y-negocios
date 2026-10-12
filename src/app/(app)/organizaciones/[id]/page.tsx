import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { ORGANIZATION_TYPES, RELATIONSHIP_LEVELS } from "@/lib/labels";
import { deleteOrganization } from "../actions";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      countries: { orderBy: { name: "asc" } },
      contacts: { orderBy: { name: "asc" }, include: { country: true } },
    },
  });
  if (!org) notFound();

  return (
    <>
      <PageHeader
        title={org.name}
        subtitle={[ORGANIZATION_TYPES[org.type], org.sector].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/organizaciones/${id}/editar`} className="btn-secondary">Editar</Link>
            <form action={deleteOrganization.bind(null, id)}>
              <button className="btn-danger">Eliminar</button>
            </form>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card space-y-3 lg:col-span-1">
          <h2 className="font-semibold">Ficha</h2>
          <div>
            <p className="text-xs uppercase text-slate-500">Países</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {org.countries.length ? org.countries.map((c) => <span key={c.code} className="chip">{c.name}</span>) : <span className="text-sm text-slate-400">Sin países</span>}
            </div>
          </div>
          {org.website && (
            <div>
              <p className="text-xs uppercase text-slate-500">Sitio web</p>
              <a href={org.website} target="_blank" rel="noreferrer" className="text-sm text-indigo-700 hover:underline">{org.website}</a>
            </div>
          )}
          {org.capabilities.length > 0 && (
            <div>
              <p className="text-xs uppercase text-slate-500">Capacidades</p>
              <div className="mt-1 flex flex-wrap gap-1">{org.capabilities.map((c) => <span key={c} className="chip">{c}</span>)}</div>
            </div>
          )}
          {org.tags.length > 0 && (
            <div>
              <p className="text-xs uppercase text-slate-500">Etiquetas</p>
              <div className="mt-1 flex flex-wrap gap-1">{org.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
            </div>
          )}
          {org.description && <p className="whitespace-pre-line text-sm text-slate-700">{org.description}</p>}
        </section>

        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Contactos</h2>
            <Link href={`/contactos/nuevo?org=${id}`} className="btn-secondary">Agregar contacto</Link>
          </div>
          <table className="table">
            <thead><tr><th>Nombre</th><th>Cargo</th><th>País</th><th>Relación</th><th>Email</th></tr></thead>
            <tbody>
              {org.contacts.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/contactos/${c.id}/editar`} className="font-medium text-indigo-700 hover:underline">{c.name}</Link></td>
                  <td>{c.position}</td>
                  <td>{c.country?.name}</td>
                  <td>{RELATIONSHIP_LEVELS[c.relationshipLevel]}</td>
                  <td>{c.email}</td>
                </tr>
              ))}
              {org.contacts.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Sin contactos todavía.</td></tr>}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-slate-400">Las alianzas en las que participa aparecerán aquí en la próxima etapa.</p>
        </section>
      </div>
    </>
  );
}
