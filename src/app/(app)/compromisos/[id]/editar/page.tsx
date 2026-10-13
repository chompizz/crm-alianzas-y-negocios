import Link from "next/link";
import { notFound } from "next/navigation";
import { OwnersPicker } from "@/components/owners-picker";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/row-actions";
import { db, INTERNAL_USERS } from "@/lib/db";
import { backPath } from "@/lib/forms";
import { dateInput } from "@/lib/format";
import { COMMITMENT_PARTIES, COMMITMENT_STATUSES } from "@/lib/labels";
import { deleteCommitment, updateCommitment } from "../../actions";

export default async function EditCommitmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  const { id } = await params;
  const back = backPath((await searchParams).volver, "/compromisos");
  const [c, users] = await Promise.all([
    db.commitment.findUnique({
      where: { id },
      include: { owners: { select: { id: true } }, alliance: { select: { name: true } }, initiative: { select: { name: true } } },
    }),
    db.user.findMany({ where: INTERNAL_USERS, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!c) notFound();
  return (
    <>
      <PageHeader
        title="Editar compromiso"
        subtitle={c.alliance?.name ?? c.initiative?.name}
        actions={<DeleteButton action={deleteCommitment.bind(null, id, back)} confirm={`¿Eliminar el compromiso "${c.description}"?`} label="compromiso" variant="button" />}
      />
      <form action={updateCommitment.bind(null, id)} className="card max-w-2xl space-y-4">
        <input type="hidden" name="back" value={back} />
        <label className="block">
          <span className="label">Compromiso *</span>
          <textarea name="description" required rows={2} defaultValue={c.description} className="input" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Quién</span>
            <select name="party" defaultValue={c.party} className="input">
              {Object.entries(COMMITMENT_PARTIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Estado</span>
            <select name="status" defaultValue={c.status} className="input">
              {Object.entries(COMMITMENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Fecha límite</span>
            <input name="dueDate" type="date" defaultValue={dateInput(c.dueDate)} className="input" />
          </label>
          <OwnersPicker users={users} defaultValue={c.owners.map((o) => o.id)} />
        </div>
        <p className="text-xs text-slate-500">Los responsables internos aplican cuando el compromiso es nuestro.</p>
        <div className="flex gap-2">
          <button className="btn-primary">Guardar</button>
          <Link href={back} className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
