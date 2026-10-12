"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { oneOf, str } from "@/lib/forms";
import { OPPORTUNITY_STATUSES } from "@/lib/labels";

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
  };
}

function revalidate(allianceId: string) {
  revalidatePath("/oportunidades");
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/");
}

// "back" permite volver a la ficha de la alianza cuando se crea desde ahí.
export async function createOpportunity(fd: FormData) {
  await requireUser();
  const data = readOpportunity(fd);
  await db.opportunity.create({ data });
  revalidate(data.allianceId);
  redirect(str(fd, "back") === "alianza" ? `/alianzas/${data.allianceId}` : "/oportunidades");
}

export async function updateOpportunity(id: string, fd: FormData) {
  await requireUser();
  const data = readOpportunity(fd);
  await db.opportunity.update({ where: { id }, data });
  revalidate(data.allianceId);
  redirect("/oportunidades");
}

export async function deleteOpportunity(id: string) {
  await requireUser();
  const o = await db.opportunity.delete({ where: { id } });
  revalidate(o.allianceId);
  redirect("/oportunidades");
}
