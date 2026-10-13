import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DeleteButton, PencilIcon, RowActions } from "@/components/row-actions";
import { db } from "@/lib/db";
import { OfferingsSection } from "@/components/offerings-section";
import { fmtUsd } from "@/lib/format";
import { ALLIANCE_STAGES, CLIENT_STATUS_STYLE, CLIENT_STATUSES, HEALTH_DOT, ORGANIZATION_TYPES, PARTICIPANT_ROLES, RELATIONSHIP_LEVELS } from "@/lib/labels";
import { removeClient, removeParticipant } from "../../alianzas/actions";
import { deleteContact } from "../../contactos/actions";
import { deleteOrganization } from "../actions";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [org, catalog] = await Promise.all([db.organization.findUnique({
    where: { id },
    include: {
      countries: { orderBy: { name: "asc" } },
      contacts: { orderBy: { name: "asc" }, include: { country: true } },
      participations: {
        include: { alliance: { include: { country: true } } },
        orderBy: { alliance: { country: { name: "asc" } } },
      },
      parent: { select: { id: true, name: true } },
      subsidiaries: { select: { id: true, name: true, type: true }, orderBy: { name: "asc" } },
      offerings: { select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } },
      clientOf: { include: { alliance: { select: { id: true, name: true, country: { select: { name: true } } } } } },
    },
  }),
  db.offering.findMany({ select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } }),
  ]);
  if (!org) notFound();

  return (
    <>
      <PageHeader
        title={org.name}
        subtitle={[ORGANIZATION_TYPES[org.type], org.sector].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/organizaciones/${id}/editar`} className="btn-secondary inline-flex items-center gap-1.5"><PencilIcon />Editar</Link>
            <DeleteButton action={deleteOrganization.bind(null, id)} confirm={`¿Eliminar "${org.name}"? Se borran también sus contactos y su participación en alianzas.`} label="organización" variant="button" />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card space-y-3 lg:col-span-1">
          <h2 className="font-semibold">Ficha</h2>
          <div>
            <p className="text-xs uppercase text-slate-500">Grupo</p>
            {org.parent ? (
              <p className="mt-1 text-sm">
                Filial de{" "}
                <Link href={`/organizaciones/${org.parent.id}`} className="font-medium text-indigo-700 hover:underline">{org.parent.name}</Link>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">{org.subsidiaries.length ? "Casa matriz" : "Independiente"}</p>
            )}
          </div>
          {org.subsidiaries.length > 0 && (
            <div>
              <p className="text-xs uppercase text-slate-500">Filiales ({org.subsidiaries.length})</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {org.subsidiaries.map((s) => (
                  <Link key={s.id} href={`/organizaciones/${s.id}`} className="chip hover:text-indigo-700">{s.name}</Link>
                ))}
              </div>
            </div>
          )}
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
            <thead><tr><th>Nombre</th><th>Cargo</th><th>País</th><th>Relación</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {org.contacts.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/contactos/${c.id}/editar`} className="font-medium text-indigo-700 hover:underline">{c.name}</Link></td>
                  <td>{c.position}</td>
                  <td>{c.country?.name}</td>
                  <td>{RELATIONSHIP_LEVELS[c.relationshipLevel]}</td>
                  <td>{c.email}</td>
                  <td>
                    <RowActions
                      editHref={`/contactos/${c.id}/editar`}
                      deleteAction={deleteContact.bind(null, c.id, `/organizaciones/${id}`)}
                      confirm={`¿Eliminar a ${c.name}?`}
                      label={c.name}
                    />
                  </td>
                </tr>
              ))}
              {org.contacts.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Sin contactos todavía.</td></tr>}
            </tbody>
          </table>
        </section>

        <div className="lg:col-span-3">
          <OfferingsSection
            target="organizacion"
            targetId={id}
            assigned={org.offerings}
            available={catalog}
            title="Productos y servicios"
            hint="Lo que esta organización ofrece o aporta. Se elige del catálogo o se crea al vuelo."
          />
        </div>

        <section className="card lg:col-span-3">
          <h2 className="mb-3 font-semibold">Alianzas en las que participa</h2>
          <table className="table">
            <thead><tr><th>Alianza</th><th>País</th><th>Rol</th><th>Etapa</th><th></th></tr></thead>
            <tbody>
              {org.participations.map((p) => (
                <tr key={p.allianceId}>
                  <td>
                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${HEALTH_DOT[p.alliance.health]}`} />
                    <Link href={`/alianzas/${p.allianceId}`} className="font-medium text-indigo-700 hover:underline">{p.alliance.name}</Link>
                  </td>
                  <td>{p.alliance.country.name}</td>
                  <td>
                    {PARTICIPANT_ROLES[p.roleType]}
                    {p.role && <span className="block text-xs text-slate-500">{p.role}</span>}
                  </td>
                  <td>{ALLIANCE_STAGES[p.alliance.stage]}</td>
                  <td>
                    <RowActions
                      editHref={`/alianzas/${p.allianceId}?participante=${id}#participantes`}
                      deleteAction={removeParticipant.bind(null, p.allianceId, id)}
                      confirm={`¿Sacar a ${org.name} de la alianza "${p.alliance.name}"?`}
                      label={p.alliance.name}
                    />
                  </td>
                </tr>
              ))}
              {org.participations.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Todavía no participa en ninguna alianza.</td></tr>}
            </tbody>
          </table>
        </section>
        {org.clientOf.length > 0 && (
          <section className="card lg:col-span-3">
            <h2 className="mb-3 font-semibold">Es cliente de</h2>
            <table className="table">
              <thead><tr><th>Alianza</th><th>País</th><th>Estado</th><th>Facturación anual</th><th></th></tr></thead>
              <tbody>
                {org.clientOf.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/alianzas/${c.allianceId}`} className="font-medium text-indigo-700 hover:underline">{c.alliance.name}</Link></td>
                    <td>{c.alliance.country.name}</td>
                    <td><span className={`rounded-full border px-2 py-0.5 text-xs ${CLIENT_STATUS_STYLE[c.status]}`}>{CLIENT_STATUSES[c.status]}</span></td>
                    <td className="font-mono">{fmtUsd(c.revenue)}</td>
                    <td>
                      <RowActions
                        editHref={`/alianzas/${c.allianceId}?cliente=${c.id}#clientes`}
                        deleteAction={removeClient.bind(null, c.allianceId, c.id)}
                        confirm={`¿Quitar a ${org.name} de los clientes de "${c.alliance.name}"?`}
                        label={c.alliance.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
