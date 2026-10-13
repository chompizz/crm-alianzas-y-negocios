"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { backPath, oneOf, ownerIds, str } from "@/lib/forms";
import { parseDate } from "@/lib/format";
import { COMMITMENT_PARTIES, COMMITMENT_STATUSES } from "@/lib/labels";
import { notify, notifyNewOwners } from "@/lib/notify";
import { setOwners } from "@/lib/owners";

function refresh(c: { allianceId: string | null; initiativeId: string | null }) {
  revalidatePath("/compromisos");
  revalidatePath("/");
  if (c.allianceId) revalidatePath(`/alianzas/${c.allianceId}`);
  if (c.initiativeId) revalidatePath(`/iniciativas/${c.initiativeId}`);
}

export async function updateCommitment(id: string, fd: FormData) {
  const user = await requireUser();
  const description = str(fd, "description");
  if (!description) throw new Error("La descripción es obligatoria");
  const party = oneOf(fd, "party", COMMITMENT_PARTIES, "NOSOTROS");
  const owners = party === "NOSOTROS" ? ownerIds(fd) : [];
  const prev = await db.commitment.findUniqueOrThrow({ where: { id }, select: { owners: { select: { id: true } } } });
  const before = prev.owners.map((o) => o.id);
  const c = await db.commitment.update({
    where: { id },
    data: {
      description,
      party,
      status: oneOf(fd, "status", COMMITMENT_STATUSES, "PENDIENTE"),
      dueDate: parseDate(str(fd, "dueDate")),
      owners: setOwners(owners),
    },
  });
  const back = backPath(str(fd, "back"), "/compromisos");
  await notify(user, { allianceId: c.allianceId, initiativeId: c.initiativeId, userIds: before }, `editó el compromiso "${c.description}"`, back);
  await notifyNewOwners(user, before, owners, `el compromiso "${c.description}"`, back);
  refresh(c);
  redirect(back);
}

export async function deleteCommitment(id: string, back?: string) {
  const user = await requireUser();
  const prev = await db.commitment.findUnique({ where: { id }, select: { description: true, allianceId: true, initiativeId: true } });
  if (!prev) return;
  await notify(user, { allianceId: prev.allianceId, initiativeId: prev.initiativeId, commitmentId: id }, `eliminó el compromiso "${prev.description}"`);
  await db.commitment.delete({ where: { id } });
  refresh(prev);
  if (back) redirect(backPath(back, "/compromisos"));
}
