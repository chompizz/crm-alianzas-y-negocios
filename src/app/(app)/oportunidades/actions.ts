"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { oneOf, str } from "@/lib/forms";
import { DIMENSIONS, OPPORTUNITY_STATUSES } from "@/lib/labels";
import { notify } from "@/lib/notify";

function readOpportunity(fd: FormData) {
  const title = str(fd, "title");
  const allianceId = str(fd, "allianceId");
  if (!title || !allianceId) throw new Error("Título y alianza son obligatorios");
  const value = str(fd, "estimatedValue");
  const prob = Number(str(fd, "probability"));
  return {
    title,
    allianceId,
    description: str(fd, "description"),
    estimatedValue: value ? value.replace(/[^\d.]/g, "") || null : null,
    probability: Number.isFinite(prob) && str(fd, "probability") ? Math.min(100, Math.max(0, Math.round(prob))) : null,
    status: oneOf(fd, "status", OPPORTUNITY_STATUSES, "ABIERTA"),
    dimension: oneOf(fd, "dimension", DIMENSIONS, "VENTAS"),
  };
}

function revalidate(allianceId: string) {
  revalidatePath("/oportunidades");
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/");
}

// "back" permite volver a la ficha de la alianza cuando se crea desde ahí.
export async function createOpportunity(fd: FormData) {
  const user = await requireUser();
  const data = readOpportunity(fd);
  const o = await db.opportunity.create({ data, include: { alliance: { select: { name: true } } } });
  await notify(user, { allianceId: o.allianceId }, `creó la oportunidad "${o.title}" en "${o.alliance.name}"`, "/oportunidades");
  revalidate(data.allianceId);
  redirect(str(fd, "back") === "alianza" ? `/alianzas/${data.allianceId}` : "/oportunidades");
}

export async function updateOpportunity(id: string, fd: FormData) {
  const user = await requireUser();
  const data = readOpportunity(fd);
  const o = await db.opportunity.update({ where: { id }, data, include: { alliance: { select: { name: true } } } });
  await notify(
    user,
    { allianceId: o.allianceId },
    `actualizó la oportunidad "${o.title}" de "${o.alliance.name}" (${OPPORTUNITY_STATUSES[o.status].toLowerCase()})`,
    "/oportunidades",
  );
  revalidate(data.allianceId);
  redirect("/oportunidades");
}

export async function deleteOpportunity(id: string) {
  const user = await requireUser();
  const o = await db.opportunity.delete({ where: { id } });
  await notify(user, { allianceId: o.allianceId }, `eliminó la oportunidad "${o.title}"`, `/alianzas/${o.allianceId}`);
  revalidate(o.allianceId);
  redirect("/oportunidades");
}
