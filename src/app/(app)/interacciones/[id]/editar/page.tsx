import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/format";
import { INTERACTION_TYPES } from "@/lib/labels";
import { updateInteraction } from "../../actions";

export default async function EditInteractionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = await db.interaction.findUnique({
    where: { id },
    include: {
      contacts: { select: { id: true } },
      alliance: {
        select: {
          name: true,
          participants: { select: { organization: { select: { name: true, contacts: { select: { id: true, name: true } } } } } },
        },
      },
    },
  });
  if (!i) notFound();
  const contacts = i.alliance?.participants.flatMap((p) => p.organization.contacts.map((c) => ({ ...c, orgName: p.organization.name }))) ?? [];
  const selected = new Set(i.contacts.map((c) => c.id));
  const back = i.allianceId ? `/alianzas/${i.allianceId}` : "/";
  return (
    <>
      <PageHeader title="Editar interacción" subtitle={i.alliance?.name} />
      <form action={updateInteraction.bind(null, id)} className="card max-w-2xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Fecha</span>
            <input name="date" type="date" defaultValue={dateInput(i.date)} className="input" />
          </label>
          <label>
            <span className="label">Tipo</span>
            <select name="type" defaultValue={i.type} className="input">
              {Object.entries(INTERACTION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="label">Resumen *</span>
          <textarea name="summary" required rows={5} defaultValue={i.summary} className="input" />
        </label>
        {contacts.length > 0 && (
          <div>
            <span className="label">Participaron</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="contacts" value={c.id} defaultChecked={selected.has(c.id)} />
                  {c.name} <span className="text-xs text-slate-400">({c.orgName})</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-primary">Guardar</button>
          <Link href={back} className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
