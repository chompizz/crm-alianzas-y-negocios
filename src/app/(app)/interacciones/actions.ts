"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { all, oneOf, str } from "@/lib/forms";
import { parseDate } from "@/lib/format";
import { INTERACTION_TYPES } from "@/lib/labels";
import { notify } from "@/lib/notify";

export async function updateInteraction(id: string, fd: FormData) {
  const user = await requireUser();
  const summary = str(fd, "summary");
  if (!summary) throw new Error("El resumen es obligatorio");
  const i = await db.interaction.update({
    where: { id },
    data: {
      summary,
      type: oneOf(fd, "type", INTERACTION_TYPES, "REUNION"),
      date: parseDate(str(fd, "date")) ?? undefined,
      contacts: { set: all(fd, "contacts").map((cid) => ({ id: cid })) },
    },
    include: { alliance: { select: { name: true } } },
  });
  const back = i.allianceId ? `/alianzas/${i.allianceId}` : "/";
  if (i.allianceId) await notify(user, { allianceId: i.allianceId }, `editó una interacción de "${i.alliance?.name}"`, back);
  revalidatePath(back);
  redirect(back);
}

export async function deleteInteraction(id: string) {
  const user = await requireUser();
  const i = await db.interaction.findUnique({ where: { id }, include: { alliance: { select: { name: true } } } });
  if (!i) return;
  // Los compromisos que salieron de la interacción se conservan.
  await db.interaction.delete({ where: { id } });
  if (i.allianceId) {
    await notify(user, { allianceId: i.allianceId }, `eliminó una interacción de "${i.alliance?.name}"`, `/alianzas/${i.allianceId}`);
    revalidatePath(`/alianzas/${i.allianceId}`);
  }
}
