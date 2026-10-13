"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { all, backPath, oneOf, ownerIds, str } from "@/lib/forms";
import { notify, notifyNewOwners } from "@/lib/notify";
import { connectOwners, setOwners } from "@/lib/owners";
import { parseDate } from "@/lib/format";
import { COMMITMENT_PARTIES, DIMENSIONS } from "@/lib/labels";

function readInitiative(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre es obligatorio");
  return {
    name,
    objective: str(fd, "objective"),
    dimension: oneOf(fd, "dimension", DIMENSIONS, "ESTRATEGIA"),
    ownerIds: ownerIds(fd),
    allianceIds: all(fd, "alliances"),
    organizationIds: all(fd, "organizations"),
  };
}

export async function createInitiative(fd: FormData) {
  const user = await requireUser();
  const { allianceIds, organizationIds, ownerIds: owners, ...data } = readInitiative(fd);
  const initiative = await db.initiative.create({
    data: {
      ...data,
      owners: connectOwners(owners),
      alliances: { connect: allianceIds.map((id) => ({ id })) },
      organizations: { connect: organizationIds.map((id) => ({ id })) },
    },
  });
  await notifyNewOwners(user, [], owners, `la iniciativa "${initiative.name}"`, `/iniciativas/${initiative.id}`);
  revalidatePath("/iniciativas");
  redirect(`/iniciativas/${initiative.id}`);
}

export async function updateInitiative(id: string, fd: FormData) {
  const user = await requireUser();
  const { allianceIds, organizationIds, ownerIds: owners, ...data } = readInitiative(fd);
  const prev = await db.initiative.findUnique({ where: { id }, select: { owners: { select: { id: true } } } });
  const before = prev?.owners.map((o) => o.id) ?? [];
  const initiative = await db.initiative.update({
    where: { id },
    data: {
      ...data,
      owners: setOwners(owners),
      alliances: { set: allianceIds.map((aid) => ({ id: aid })) },
      organizations: { set: organizationIds.map((oid) => ({ id: oid })) },
    },
  });
  await notify(user, { userIds: before }, `editó la iniciativa "${initiative.name}"`, `/iniciativas/${id}`);
  await notifyNewOwners(user, before, owners, `la iniciativa "${initiative.name}"`, `/iniciativas/${id}`);
  revalidatePath("/iniciativas");
  redirect(`/iniciativas/${id}`);
}

export async function deleteInitiative(id: string, back?: string) {
  const user = await requireUser();
  const i = await db.initiative.findUnique({ where: { id }, select: { name: true } });
  if (i) await notify(user, { initiativeId: id }, `eliminó la iniciativa "${i.name}"`);
  await db.initiative.delete({ where: { id } });
  revalidatePath("/iniciativas");
  redirect(backPath(back, "/iniciativas"));
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
  const user = await requireUser();
  const m = await db.milestone.findUniqueOrThrow({ where: { id }, include: { initiative: { select: { name: true } } } });
  await db.milestone.update({ where: { id }, data: { done: !m.done } });
  await notify(
    user,
    { initiativeId: m.initiativeId },
    `${m.done ? "reabrió" : "cumplió"} el hito "${m.title}" de "${m.initiative.name}"`,
    `/iniciativas/${m.initiativeId}`,
  );
  await recomputeProgress(m.initiativeId);
  revalidatePath(`/iniciativas/${m.initiativeId}`);
  revalidatePath("/iniciativas");
}

export async function updateMilestone(id: string, fd: FormData) {
  await requireUser();
  const title = str(fd, "title");
  if (!title) return;
  const m = await db.milestone.update({ where: { id }, data: { title, dueDate: parseDate(str(fd, "dueDate")) } });
  revalidatePath(`/iniciativas/${m.initiativeId}`);
  redirect(`/iniciativas/${m.initiativeId}#hitos`);
}

export async function deleteMilestone(id: string) {
  await requireUser();
  const m = await db.milestone.delete({ where: { id } });
  await recomputeProgress(m.initiativeId);
  revalidatePath(`/iniciativas/${m.initiativeId}`);
  revalidatePath("/iniciativas");
}

export async function addInitiativeCommitment(initiativeId: string, fd: FormData) {
  const user = await requireUser();
  const description = str(fd, "description");
  if (!description) return;
  const party = oneOf(fd, "party", COMMITMENT_PARTIES, "NOSOTROS");
  const c = await db.commitment.create({
    data: {
      initiativeId,
      description,
      party,
      dueDate: parseDate(str(fd, "dueDate")),
      owners: connectOwners(party === "NOSOTROS" ? ownerIds(fd) : []),
    },
    include: { initiative: { select: { name: true } } },
  });
  await notify(
    user,
    { initiativeId, commitmentId: c.id },
    `agregó el compromiso "${description}" en "${c.initiative?.name}"`,
    `/iniciativas/${initiativeId}`,
  );
  revalidatePath(`/iniciativas/${initiativeId}`);
  revalidatePath("/compromisos");
}
