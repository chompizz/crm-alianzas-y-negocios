"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { all, oneOf, str } from "@/lib/forms";
import { parseDate } from "@/lib/format";
import {
  ALLIANCE_STAGES,
  ALLIANCE_TYPES,
  COMMITMENT_PARTIES,
  COMMITMENT_STATUSES,
  DIMENSIONS,
  HEALTH,
  INTERACTION_TYPES,
  PARTICIPANT_ROLES,
} from "@/lib/labels";

function readAlliance(fd: FormData) {
  const name = str(fd, "name");
  const countryCode = str(fd, "countryCode");
  if (!name || !countryCode) throw new Error("Nombre y país son obligatorios");
  const value = str(fd, "expectedValue");
  return {
    name,
    countryCode,
    type: oneOf(fd, "type", ALLIANCE_TYPES, "COMERCIAL"),
    dimension: oneOf(fd, "dimension", DIMENSIONS, "ESTRATEGIA"),
    stage: oneOf(fd, "stage", ALLIANCE_STAGES, "EXPLORACION"),
    health: oneOf(fd, "health", HEALTH, "VERDE"),
    objectives: str(fd, "objectives"),
    expectedValue: value ? value.replace(/[^\d.]/g, "") || null : null,
    startDate: parseDate(str(fd, "startDate")),
    renewalDate: parseDate(str(fd, "renewalDate")),
    ownerId: str(fd, "ownerId"),
  };
}

export async function createAlliance(fd: FormData) {
  await requireUser();
  const data = readAlliance(fd);
  const organizationIds = all(fd, "organizations");
  const alliance = await db.alliance.create({
    data: { ...data, participants: { create: organizationIds.map((organizationId) => ({ organizationId })) } },
  });
  revalidatePath("/alianzas");
  redirect(`/alianzas/${alliance.id}`);
}

export async function updateAlliance(id: string, fd: FormData) {
  await requireUser();
  await db.alliance.update({ where: { id }, data: readAlliance(fd) });
  revalidatePath("/alianzas");
  redirect(`/alianzas/${id}`);
}

export async function deleteAlliance(id: string) {
  await requireUser();
  await db.alliance.delete({ where: { id } });
  revalidatePath("/alianzas");
  redirect("/alianzas");
}

export async function moveAllianceStage(id: string, fd: FormData) {
  await requireUser();
  await db.alliance.update({ where: { id }, data: { stage: oneOf(fd, "stage", ALLIANCE_STAGES, "EXPLORACION") } });
  revalidatePath("/alianzas");
  revalidatePath(`/alianzas/${id}`);
}

export async function addParticipant(allianceId: string, fd: FormData) {
  await requireUser();
  const organizationId = str(fd, "organizationId");
  if (!organizationId) return;
  const roleType = oneOf(fd, "roleType", PARTICIPANT_ROLES, "SOCIO");
  await db.allianceParticipant.upsert({
    where: { allianceId_organizationId: { allianceId, organizationId } },
    update: { role: str(fd, "role"), roleType },
    create: { allianceId, organizationId, role: str(fd, "role"), roleType },
  });
  revalidatePath(`/alianzas/${allianceId}`);
}

export async function removeParticipant(allianceId: string, organizationId: string) {
  await requireUser();
  await db.allianceParticipant.delete({ where: { allianceId_organizationId: { allianceId, organizationId } } });
  revalidatePath(`/alianzas/${allianceId}`);
}

// Registra una interacción y, opcionalmente, los compromisos que salieron de ella
// (una línea por compromiso en el campo "commitments").
export async function addInteraction(allianceId: string, fd: FormData) {
  const user = await requireUser();
  const summary = str(fd, "summary");
  if (!summary) throw new Error("El resumen es obligatorio");
  const dueDate = parseDate(str(fd, "commitmentDueDate"));
  const party = oneOf(fd, "commitmentParty", COMMITMENT_PARTIES, "NOSOTROS");
  const commitmentLines = (str(fd, "commitments") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  await db.interaction.create({
    data: {
      allianceId,
      authorId: user.id,
      date: parseDate(str(fd, "date")) ?? new Date(),
      type: oneOf(fd, "type", INTERACTION_TYPES, "REUNION"),
      summary,
      contacts: { connect: all(fd, "contacts").map((id) => ({ id })) },
      commitments: {
        create: commitmentLines.map((description) => ({
          description,
          allianceId,
          party,
          dueDate,
          ownerId: party === "NOSOTROS" ? str(fd, "commitmentOwnerId") : null,
        })),
      },
    },
  });
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/compromisos");
}

export async function addCommitment(allianceId: string, fd: FormData) {
  await requireUser();
  const description = str(fd, "description");
  if (!description) return;
  const party = oneOf(fd, "party", COMMITMENT_PARTIES, "NOSOTROS");
  await db.commitment.create({
    data: {
      allianceId,
      description,
      party,
      dueDate: parseDate(str(fd, "dueDate")),
      ownerId: party === "NOSOTROS" ? str(fd, "ownerId") : null,
    },
  });
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/compromisos");
}

export async function setCommitmentStatus(id: string, fd: FormData) {
  await requireUser();
  const c = await db.commitment.update({
    where: { id },
    data: { status: oneOf(fd, "status", COMMITMENT_STATUSES, "PENDIENTE") },
  });
  if (c.allianceId) revalidatePath(`/alianzas/${c.allianceId}`);
  revalidatePath("/compromisos");
}

// Usada por el tablero kanban al arrastrar una tarjeta a otra etapa.
export async function setAllianceStage(id: string, stage: string) {
  await requireUser();
  if (!(stage in ALLIANCE_STAGES)) throw new Error("Etapa inválida");
  await db.alliance.update({ where: { id }, data: { stage: stage as keyof typeof ALLIANCE_STAGES } });
  revalidatePath("/alianzas");
  revalidatePath(`/alianzas/${id}`);
  revalidatePath("/");
}
