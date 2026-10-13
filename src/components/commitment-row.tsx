import Link from "next/link";
import type { Commitment } from "@prisma/client";
import { setCommitmentStatus } from "@/app/(app)/alianzas/actions";
import { deleteCommitment } from "@/app/(app)/compromisos/actions";
import { RowActions } from "@/components/row-actions";
import { fmtDate, startOfTodayUtc } from "@/lib/format";
import { COMMITMENT_PARTIES, COMMITMENT_STATUSES } from "@/lib/labels";
import { ownerNames } from "@/lib/owners";

type Props = {
  commitment: Commitment & {
    owners: { name: string }[];
    alliance?: { id: string; name: string } | null;
    initiative?: { id: string; name: string } | null;
  };
  showAlliance?: boolean;
  // Página a la que volver después de editar o eliminar.
  back: string;
};

export function CommitmentRow({ commitment: c, showAlliance, back }: Props) {
  const overdue = c.status === "PENDIENTE" && c.dueDate && c.dueDate < startOfTodayUtc();
  return (
    <tr>
      <td className={c.status !== "PENDIENTE" ? "text-slate-400 line-through" : ""}>{c.description}</td>
      {showAlliance && (
        <td>
          {c.alliance && <Link href={`/alianzas/${c.alliance.id}`} className="hover:underline">{c.alliance.name}</Link>}
          {c.initiative && <Link href={`/iniciativas/${c.initiative.id}`} className="hover:underline">{c.initiative.name}</Link>}
        </td>
      )}
      <td>{c.party === "SOCIO" ? COMMITMENT_PARTIES.SOCIO : ownerNames(c.owners, COMMITMENT_PARTIES.NOSOTROS)}</td>
      <td className={overdue ? "font-medium text-red-600" : ""}>
        {fmtDate(c.dueDate)}
        {overdue && " (vencido)"}
      </td>
      <td>
        <form action={setCommitmentStatus.bind(null, c.id)} className="flex gap-1">
          <select name="status" defaultValue={c.status} className="input py-1 text-xs">
            {Object.entries(COMMITMENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn-secondary px-2 py-1 text-xs">OK</button>
        </form>
      </td>
      <td>
        <RowActions
          editHref={`/compromisos/${c.id}/editar?volver=${encodeURIComponent(back)}`}
          deleteAction={deleteCommitment.bind(null, c.id, undefined)}
          confirm={`¿Eliminar el compromiso "${c.description}"?`}
          label="compromiso"
        />
      </td>
    </tr>
  );
}
