import Link from "next/link";
import { notFound } from "next/navigation";
import { CommitmentRow } from "@/components/commitment-row";
import { OfferingsSection } from "@/components/offerings-section";
import { OwnersPicker } from "@/components/owners-picker";
import { deleteInteraction } from "../../interacciones/actions";
import { deleteInitiative } from "../../iniciativas/actions";
import { deleteOpportunity } from "../../oportunidades/actions";
import { ClientsSection } from "./clients-section";
import { PageHeader } from "@/components/page-header";
import { DeleteButton, PencilIcon, RowActions } from "@/components/row-actions";
import { ProgressBar } from "@/components/progress-bar";
import { db } from "@/lib/db";
import { ownerNames, ownersSelect } from "@/lib/owners";
import { dateInput, fmtDate, fmtUsd } from "@/lib/format";
import {
  ALLIANCE_STAGES,
  ALLIANCE_TYPES, DIMENSIONS,
  COMMITMENT_PARTIES,
  HEALTH,
  HEALTH_DOT,
  INTERACTION_TYPES,
  OPPORTUNITY_STATUSES,
  PARTICIPANT_ROLES,
} from "@/lib/labels";
import {
  addCommitment,
  addInteraction,
  addParticipant,
  deleteAlliance,
  moveAllianceStage,
  removeParticipant,
} from "../actions";

export default async function AlliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cliente?: string; participante?: string }>;
}) {
  const { id } = await params;
  const { cliente, participante } = await searchParams;
  const alliance = await db.alliance.findUnique({
    where: { id },
    include: {
      country: true,
      ...ownersSelect,
      participants: {
        orderBy: { organization: { name: "asc" } },
        include: {
          organization: {
            include: { contacts: { orderBy: { name: "asc" } }, parent: { select: { id: true, name: true } } },
          },
        },
      },
      interactions: {
        orderBy: { date: "desc" },
        include: { contacts: { select: { name: true } }, author: { select: { name: true } }, commitments: true },
      },
      commitments: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        include: ownersSelect,
      },
      opportunities: { orderBy: { createdAt: "desc" } },
      initiatives: { orderBy: { name: "asc" }, select: { id: true, name: true, progress: true } },
      offerings: { select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } },
      clients: {
        include: { organization: { select: { id: true, name: true } } },
        orderBy: [{ status: "asc" }, { organization: { name: "asc" } }],
      },
    },
  });
  if (!alliance) notFound();

  const [organizations, users, catalog, allOrgs] = await Promise.all([
    db.organization.findMany({
      where: { id: { notIn: alliance.participants.map((p) => p.organizationId) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, countries: { select: { code: true } } },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.offering.findMany({ select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } }),
    db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Primero las organizaciones que operan en el país de la alianza.
  const inCountry = organizations.filter((o) => o.countries.some((c) => c.code === alliance.countryCode));
  const elsewhere = organizations.filter((o) => !o.countries.some((c) => c.code === alliance.countryCode));
  const contacts = alliance.participants.flatMap((p) => p.organization.contacts.map((c) => ({ ...c, orgName: p.organization.name })));
  const today = dateInput(new Date());
  const editingParticipant = alliance.participants.find((p) => p.organizationId === participante);

  return (
    <>
      <PageHeader
        title={alliance.name}
        subtitle={`${alliance.country.name} · ${ALLIANCE_TYPES[alliance.type]} · ${DIMENSIONS[alliance.dimension]}`}
        actions={
          <>
            <Link href={`/alianzas/${id}/editar`} className="btn-secondary inline-flex items-center gap-1.5"><PencilIcon />Editar</Link>
            <DeleteButton action={deleteAlliance.bind(null, id)} confirm={`¿Eliminar la alianza "${alliance.name}"? Se borran también sus participantes, clientes, oportunidades y compromisos.`} label="alianza" variant="button" />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <section className="card space-y-3 text-sm">
            <form action={moveAllianceStage.bind(null, id)} className="flex items-end gap-2">
              <label className="flex-1">
                <span className="label">Etapa</span>
                <select name="stage" defaultValue={alliance.stage} className="input">
                  {Object.entries(ALLIANCE_STAGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <button className="btn-secondary">Mover</button>
            </form>
            <Field label="Salud">
              <span className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[alliance.health]}`} />
                {HEALTH[alliance.health]}
              </span>
            </Field>
            <Field label={alliance.owners.length > 1 ? "Responsables" : "Responsable"}>{ownerNames(alliance.owners, "Sin asignar")}</Field>
            <Field label="Valor esperado">{fmtUsd(alliance.expectedValue) || "Sin estimar"}</Field>
            <Field label="Inicio">{fmtDate(alliance.startDate) || "Sin fecha"}</Field>
            <Field label="Renovación">{fmtDate(alliance.renewalDate) || "Sin fecha"}</Field>
            {alliance.objectives && <Field label="Objetivos"><p className="whitespace-pre-line">{alliance.objectives}</p></Field>}
          </section>

          <section id="participantes" className="card scroll-mt-4">
            <h2 className="mb-3 font-semibold">Participantes</h2>
            <ul className="mb-3 divide-y divide-slate-100">
              {alliance.participants.map((p) => (
                <li key={p.organizationId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <Link href={`/organizaciones/${p.organizationId}`} className="font-medium text-indigo-700 hover:underline">{p.organization.name}</Link>
                    <span className="ml-2 chip">{PARTICIPANT_ROLES[p.roleType]}</span>
                    {p.role && <span className="block text-xs text-slate-500">{p.role}</span>}
                    {p.organization.parent && <span className="block text-xs text-slate-500">Grupo {p.organization.parent.name}</span>}
                  </span>
                  <RowActions
                    editHref={`/alianzas/${id}?participante=${p.organizationId}#participantes`}
                    scroll={false}
                    deleteAction={removeParticipant.bind(null, id, p.organizationId)}
                    confirm={`¿Quitar a ${p.organization.name} de esta alianza? La organización no se borra.`}
                    label={p.organization.name}
                  />
                </li>
              ))}
              {alliance.participants.length === 0 && <li className="py-2 text-sm text-slate-500">Sin participantes.</li>}
            </ul>
            {editingParticipant ? (
              <form action={addParticipant.bind(null, id)} className="space-y-2 rounded-lg border border-indigo-500/40 p-3">
                <input type="hidden" name="organizationId" value={editingParticipant.organizationId} />
                <p className="text-sm font-medium">Editar rol de {editingParticipant.organization.name}</p>
                <select name="roleType" defaultValue={editingParticipant.roleType} className="input">
                  {Object.entries(PARTICIPANT_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input name="role" defaultValue={editingParticipant.role ?? ""} placeholder="Detalle del rol (opcional)" className="input" />
                <div className="flex gap-2">
                  <button className="btn-primary">Guardar</button>
                  <Link href={`/alianzas/${id}#participantes`} scroll={false} className="btn-secondary">Cancelar</Link>
                </div>
              </form>
            ) : (
            <form action={addParticipant.bind(null, id)} className="space-y-2">
              <select name="organizationId" required defaultValue="" className="input">
                <option value="" disabled>Agregar organización...</option>
                {inCountry.length > 0 && (
                  <optgroup label={`Operan en ${alliance.country.name}`}>
                    {inCountry.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </optgroup>
                )}
                {elsewhere.length > 0 && (
                  <optgroup label="Otras">
                    {elsewhere.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </optgroup>
                )}
              </select>
              <div className="flex gap-2">
                <select name="roleType" defaultValue="SOCIO" className="input">
                  {Object.entries(PARTICIPANT_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button className="btn-secondary">Agregar</button>
              </div>
              <input name="role" placeholder="Detalle del rol (opcional): aporta tecnología, co-financia 30%..." className="input" />
            </form>
            )}
          </section>

          <OfferingsSection
            target="alianza"
            targetId={id}
            assigned={alliance.offerings}
            available={catalog}
            title="Productos y servicios"
            hint="Qué se vende, integra o entrega en esta alianza."
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Oportunidades</h2>
                <Link href={`/oportunidades/nueva?alianza=${id}`} className="text-sm text-indigo-700 hover:underline">Agregar</Link>
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {alliance.opportunities.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <Link href={`/oportunidades/${o.id}/editar`} className="hover:underline">{o.title}</Link>
                      <span className="block text-xs text-slate-500">
                        {fmtUsd(o.estimatedValue)}{o.probability != null && ` · ${o.probability}%`} · {OPPORTUNITY_STATUSES[o.status]}
                      </span>
                    </span>
                    <RowActions
                      editHref={`/oportunidades/${o.id}/editar`}
                      deleteAction={deleteOpportunity.bind(null, o.id, `/alianzas/${id}`)}
                      confirm={`¿Eliminar la oportunidad "${o.title}"?`}
                      label={o.title}
                    />
                  </li>
                ))}
                {alliance.opportunities.length === 0 && <li className="py-2 text-slate-500">Sin oportunidades.</li>}
              </ul>
            </section>
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Iniciativas</h2>
                <Link href="/iniciativas/nueva" className="text-sm text-indigo-700 hover:underline">Nueva</Link>
              </div>
              <ul className="space-y-3 text-sm">
                {alliance.initiatives.map((i) => (
                  <li key={i.id}>
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/iniciativas/${i.id}`} className="hover:underline">{i.name}</Link>
                      <RowActions
                        editHref={`/iniciativas/${i.id}/editar`}
                        deleteAction={deleteInitiative.bind(null, i.id, `/alianzas/${id}`)}
                        confirm={`¿Eliminar la iniciativa "${i.name}"? Se borran también sus hitos y compromisos.`}
                        label={i.name}
                      />
                    </div>
                    <ProgressBar value={i.progress} />
                  </li>
                ))}
                {alliance.initiatives.length === 0 && <li className="text-slate-500">Sin iniciativas.</li>}
              </ul>
            </section>
          </div>

          <ClientsSection allianceId={id} clients={alliance.clients} organizations={allOrgs} editingId={cliente} />

          <section className="card">
            <h2 className="mb-3 font-semibold">Compromisos</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Compromiso</th><th>Quién</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {alliance.commitments.map((c) => <CommitmentRow key={c.id} commitment={c} back={`/alianzas/${id}`} />)}
                  {alliance.commitments.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Sin compromisos.</td></tr>}
                </tbody>
              </table>
            </div>
            <form action={addCommitment.bind(null, id)} className="mt-3 grid gap-2 sm:grid-cols-4">
              <input name="description" required placeholder="Nuevo compromiso" className="input sm:col-span-4" />
              <select name="party" defaultValue="NOSOTROS" className="input">
                {Object.entries(COMMITMENT_PARTIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <OwnersPicker users={users} label="" placeholder="Responsable" />
              <input name="dueDate" type="date" className="input" />
              <button className="btn-secondary">Agregar</button>
            </form>
          </section>

          <section className="card">
            <h2 className="mb-3 font-semibold">Registrar interacción</h2>
            <form action={addInteraction.bind(null, id)} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="date" type="date" defaultValue={today} className="input" />
                <select name="type" defaultValue="REUNION" className="input">
                  {Object.entries(INTERACTION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <textarea name="summary" required rows={3} placeholder="¿Qué se habló?" className="input" />
              {contacts.length > 0 && (
                <div>
                  <span className="label">Participaron</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {contacts.map((c) => (
                      <label key={c.id} className="flex items-center gap-1 text-sm">
                        <input type="checkbox" name="contacts" value={c.id} />
                        {c.name} <span className="text-xs text-slate-400">({c.orgName})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <details className="rounded-md border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Acuerdos que salieron de esta interacción</summary>
                <div className="mt-3 space-y-2">
                  <textarea name="commitments" rows={3} placeholder="Un compromiso por línea" className="input" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select name="commitmentParty" defaultValue="NOSOTROS" className="input">
                      {Object.entries(COMMITMENT_PARTIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <OwnersPicker users={users} label="" name="commitmentOwnerIds" placeholder="Responsable" />
                    <input name="commitmentDueDate" type="date" className="input" />
                  </div>
                </div>
              </details>
              <button className="btn-primary">Guardar interacción</button>
            </form>
          </section>

          <section className="card">
            <h2 className="mb-3 font-semibold">Historial</h2>
            <ol className="space-y-4">
              {alliance.interactions.map((i) => (
                <li key={i.id} className="border-l-2 border-indigo-200 pl-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      {fmtDate(i.date)} · {INTERACTION_TYPES[i.type]}
                      {i.author && ` · registrado por ${i.author.name}`}
                    </p>
                    <RowActions
                      editHref={`/interacciones/${i.id}/editar`}
                      deleteAction={deleteInteraction.bind(null, i.id)}
                      confirm="¿Eliminar esta interacción? Los compromisos que salieron de ella se conservan."
                      label="interacción"
                      className="-mt-1"
                    />
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm">{i.summary}</p>
                  {i.contacts.length > 0 && <p className="mt-1 text-xs text-slate-500">Con: {i.contacts.map((c) => c.name).join(", ")}</p>}
                  {i.commitments.length > 0 && <p className="mt-1 text-xs text-amber-700">{i.commitments.length} compromiso(s) generado(s)</p>}
                </li>
              ))}
              {alliance.interactions.length === 0 && <li className="text-sm text-slate-500">Todavía no hay interacciones registradas.</li>}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
