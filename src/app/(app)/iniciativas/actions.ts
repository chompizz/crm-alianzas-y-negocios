"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { all, oneOf, str } from "@/lib/forms";
import { parseDate } from "@/lib/format";
import { COMMITMENT_PARTIES } from "@/lib/labels";

function readInitiative(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre es obligatorio");
  return {
    name,
    objective: str(fd, "objective"),
    ownerId: str(fd, "ownerId"),
    allianceIds: all(fd, "alliances"),
    organizationIds: all(fd, "organizations"),
  };
}

export async function createInitiative(fd: FormData) {
  await requireUser();
  const { allianceIds, organizationIds, ...data } = readInitiative(fd);
  const initiative = await db.initiative.create({
    data: {
      ...data,
      alliances: { connect: allianceIds.map((id) => ({ id })) },
      organizations: { connect: organizationIds.map((id) => ({ id })) },
    },
  });
  revalidatePath("/iniciativas");
  redirect(`/iniciativas/${initiative.id}`);
}

export async function updateInitiative(id: string, fd: FormData) {
  await requireUser();
  const { allianceIds, organizationIds, ...data } = readInitiative(fd);
  await db.initiative.update({
    where: { id },
    data: {
      ...data,
      alliances: { set: allianceIds.map((aid) => ({ id: aid })) },
      organizations: { set: organizationIds.map((oid) => ({ id: oid })) },
    },
  });
  revalidatePath("/iniciativas");
  redirect(`/iniciativas/${id}`);
}

export async function deleteInitiative(id: string) {
  await requireUser();
  await db.initiative.delete({ where: { id } });
  revalidatePath("/iniciativas");
  redirect("/iniciativas");
}

// El avance de una iniciativa es el porcentaje de hitos cumplidos.
async function recomputeProgress(initiativeId: string) {
  const milestones = await db.milestone.findMany({ where: { initiativeId }, select: { done: true } });
  const progress = milestones.length ? Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100) : 0;
  await db.initiative.update({ where: { id: initiativeId }, data: { progress } });
}

export async function addMilestone(initiativeId: string, fd: FormData) {
  await requireUser();
  const title = str(fd, "title");
  if (!title) return;
  await db.milestone.create({ data: { initiativeId, title, dueDate: parseDate(str(fd, "dueDate")) } });
  await recomputeProgress(initiativeId);
  revalidatePath(`/iniciativas/${initiativeId}`);
  revalidatePath("/iniciativas");
}

export async function toggleMilestone(id: string) {
  await requireUser();
  const m = await db.milestone.findUniqueOrThrow({ where: { id } });
  await db.milestone.update({ where: { id }, data: { done: !m.done } });
  await recomputeProgress(m.initiativeId);
  revalidatePath(`/iniciativas/${m.initiativeId}`);
  revalidatePath("/iniciativas");
}

export async function deleteMilestone(id: string) {
  await requireUser();
  const m = await db.milestone.delete({ where: { id } });
  await recomputeProgress(m.initiativeId);
  revalidatePath(`/iniciativas/${m.initiativeId}`);
  revalidatePath("/iniciativas");
}

export async function addInitiativeCommitment(initiativeId: string, fd: FormData) {
  await requireUser();
  const description = str(fd, "description");
  if (!description) return;
  const party = oneOf(fd, "party", COMMITMENT_PARTIES, "NOSOTROS");
  await db.commitment.create({
    data: {
      initiativeId,
      description,
      party,
      dueDate: parseDate(str(fd, "dueDate")),
      ownerId: party === "NOSOTROS" ? str(fd, "ownerId") : null,
    },
  });
  revalidatePath(`/iniciativas/${initiativeId}`);
  revalidatePath("/compromisos");
}
