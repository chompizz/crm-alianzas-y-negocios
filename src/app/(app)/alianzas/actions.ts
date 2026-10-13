"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { all, oneOf, ownerIds, str } from "@/lib/forms";
import { notify, notifyNewOwners } from "@/lib/notify";
import { connectOwners, setOwners } from "@/lib/owners";
import { stageDefaults } from "@/lib/alliance-stage";
import { parseDate } from "@/lib/format";
import {
  ALLIANCE_STAGES,
  ALLIANCE_TYPES,
  CLIENT_STATUSES,
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
  };
}

export async function createAlliance(fd: FormData) {
  const user = await requireUser();
  const data = readAlliance(fd);
  const organizationIds = all(fd, "organizations");
  const alliance = await db.alliance.create({
    data: {
      ...data,
      owners: connectOwners(ownerIds(fd)),
      participants: { create: organizationIds.map((organizationId) => ({ organizationId })) },
    },
  });
  await notifyNewOwners(user, [], ownerIds(fd), `la alianza "${alliance.name}"`, `/alianzas/${alliance.id}`);
  revalidatePath("/alianzas");
  redirect(`/alianzas/${alliance.id}`);
}

export async function updateAlliance(id: string, fd: FormData) {
  const user = await requireUser();
  const before = await ownersOf(id);
  const a = await db.alliance.update({ where: { id }, data: { ...readAlliance(fd), owners: setOwners(ownerIds(fd)) } });
  await notify(user, { userIds: before }, `editó la alianza "${a.name}"`, `/alianzas/${id}`);
  await notifyNewOwners(user, before, ownerIds(fd), `la alianza "${a.name}"`, `/alianzas/${id}`);
  revalidatePath("/alianzas");
  redirect(`/alianzas/${id}`);
}

export async function deleteAlliance(id: string) {
  const user = await requireUser();
  const a = await db.alliance.findUnique({ where: { id }, select: { name: true } });
  if (a) await notify(user, { allianceId: id }, `eliminó la alianza "${a.name}"`);
  await db.alliance.delete({ where: { id } });
  revalidatePath("/alianzas");
  redirect("/alianzas");
}

export async function moveAllianceStage(id: string, fd: FormData) {
  const user = await requireUser();
  const a = await db.alliance.update({ where: { id }, data: { stage: oneOf(fd, "stage", ALLIANCE_STAGES, "EXPLORACION") } });
  await notify(user, { allianceId: id }, `movió "${a.name}" a ${ALLIANCE_STAGES[a.stage]}`, `/alianzas/${id}`);
  revalidatePath("/alianzas");
  revalidatePath(`/alianzas/${id}`);
}

export async function addParticipant(allianceId: string, fd: FormData) {
  const user = await requireUser();
  const organizationId = str(fd, "organizationId");
  if (!organizationId) return;
  const roleType = oneOf(fd, "roleType", PARTICIPANT_ROLES, "SOCIO");
  const p = await db.allianceParticipant.upsert({
    where: { allianceId_organizationId: { allianceId, organizationId } },
    update: { role: str(fd, "role"), roleType },
    create: { allianceId, organizationId, role: str(fd, "role"), roleType },
    include: { organization: { select: { name: true } }, alliance: { select: { name: true } } },
  });
  await notify(user, { allianceId }, `sumó a ${p.organization.name} en "${p.alliance.name}"`, `/alianzas/${allianceId}`);
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

  const commitmentOwners = party === "NOSOTROS" ? ownerIds(fd, "commitmentOwnerIds") : [];
  const interaction = await db.interaction.create({
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
          owners: connectOwners(commitmentOwners),
        })),
      },
    },
    include: { alliance: { select: { name: true } } },
  });
  const extra = commitmentLines.length ? ` con ${commitmentLines.length} ${commitmentLines.length === 1 ? "compromiso" : "compromisos"}` : "";
  await notify(
    user,
    { allianceId, userIds: commitmentOwners },
    `registró una interacción en "${interaction.alliance?.name}"${extra}: ${summary.slice(0, 120)}`,
    `/alianzas/${allianceId}`,
  );
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/compromisos");
}

export async function addCommitment(allianceId: string, fd: FormData) {
  const user = await requireUser();
  const description = str(fd, "description");
  if (!description) return;
  const party = oneOf(fd, "party", COMMITMENT_PARTIES, "NOSOTROS");
  const c = await db.commitment.create({
    data: {
      allianceId,
      description,
      party,
      dueDate: parseDate(str(fd, "dueDate")),
      owners: connectOwners(party === "NOSOTROS" ? ownerIds(fd) : []),
    },
    include: { alliance: { select: { name: true } } },
  });
  await notify(user, { allianceId, commitmentId: c.id }, `agregó el compromiso "${description}" en "${c.alliance?.name}"`, `/alianzas/${allianceId}`);
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/compromisos");
}

export async function setCommitmentStatus(id: string, fd: FormData) {
  const user = await requireUser();
  const c = await db.commitment.update({
    where: { id },
    data: { status: oneOf(fd, "status", COMMITMENT_STATUSES, "PENDIENTE") },
  });
  await notify(
    user,
    { allianceId: c.allianceId, initiativeId: c.initiativeId, commitmentId: c.id },
    `marcó "${c.description}" como ${COMMITMENT_STATUSES[c.status].toLowerCase()}`,
    c.allianceId ? `/alianzas/${c.allianceId}` : c.initiativeId ? `/iniciativas/${c.initiativeId}` : "/compromisos",
  );
  if (c.allianceId) revalidatePath(`/alianzas/${c.allianceId}`);
  revalidatePath("/compromisos");
}

// Usada por el tablero kanban al arrastrar una tarjeta a otra etapa.
export async function setAllianceStage(id: string, stage: string) {
  const user = await requireUser();
  if (!(stage in ALLIANCE_STAGES)) throw new Error("Etapa inválida");
  const next = stage as keyof typeof ALLIANCE_STAGES;
  const current = await db.alliance.findUnique({ where: { id }, select: { startDate: true } });
  if (!current) throw new Error("No existe esa alianza");
  const a = await db.alliance.update({ where: { id }, data: { stage: next, ...stageDefaults(next, current) } });
  await notify(user, { allianceId: id }, `movió "${a.name}" a ${ALLIANCE_STAGES[next]}`, `/alianzas/${id}`);
  revalidatePath("/alianzas");
  revalidatePath(`/alianzas/${id}`);
  revalidatePath("/");
}

// Edición rápida desde el tablero, después de soltar una tarjeta en otra etapa.
export async function quickUpdateAlliance(id: string, fd: FormData) {
  const user = await requireUser();
  const value = str(fd, "expectedValue");
  const before = await ownersOf(id);
  const a = await db.alliance.update({
    where: { id },
    data: {
      health: oneOf(fd, "health", HEALTH, "VERDE"),
      owners: setOwners(ownerIds(fd)),
      expectedValue: value ? value.replace(/[^\d.]/g, "") || null : null,
      startDate: parseDate(str(fd, "startDate")),
      renewalDate: parseDate(str(fd, "renewalDate")),
    },
  });
  await notify(user, { userIds: before }, `actualizó salud, valor y fechas de "${a.name}"`, `/alianzas/${id}`);
  await notifyNewOwners(user, before, ownerIds(fd), `la alianza "${a.name}"`, `/alianzas/${id}`);
  revalidatePath("/alianzas");
  revalidatePath(`/alianzas/${id}`);
  revalidatePath("/");
}

async function ownersOf(allianceId: string) {
  const a = await db.alliance.findUnique({ where: { id: allianceId }, select: { owners: { select: { id: true } } } });
  return a?.owners.map((o) => o.id) ?? [];
}

// Clientes de la alianza: se elige una organización existente o se crea una nueva por nombre
// (por defecto en el país de la alianza).
export async function addClient(allianceId: string, fd: FormData) {
  const user = await requireUser();
  let organizationId = str(fd, "organizationId");
  const newName = str(fd, "newName");
  if (!organizationId && newName) {
    const alliance = await db.alliance.findUniqueOrThrow({ where: { id: allianceId }, select: { countryCode: true } });
    const existing = await db.organization.findFirst({
      where: { name: { equals: newName, mode: "insensitive" } },
      select: { id: true },
    });
    organizationId =
      existing?.id ??
      (await db.organization.create({ data: { name: newName, countries: { connect: { code: alliance.countryCode } } } })).id;
  }
  if (!organizationId) return;
  const data = readClient(fd);
  const client = await db.allianceClient.upsert({
    where: { allianceId_organizationId: { allianceId, organizationId } },
    update: data,
    create: { allianceId, organizationId, ...data },
    include: { organization: { select: { name: true } }, alliance: { select: { name: true } } },
  });
  await notify(user, { allianceId }, `sumó a ${client.organization.name} como cliente de "${client.alliance.name}"`, `/alianzas/${allianceId}#clientes`);
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/clientes");
}

export async function updateClient(allianceId: string, clientId: string, fd: FormData) {
  const user = await requireUser();
  const client = await db.allianceClient.update({
    where: { id: clientId },
    data: readClient(fd),
    include: { organization: { select: { name: true } }, alliance: { select: { name: true } } },
  });
  await notify(user, { allianceId }, `actualizó el cliente ${client.organization.name} de "${client.alliance.name}"`, `/alianzas/${allianceId}#clientes`);
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/clientes");
  redirect(`/alianzas/${allianceId}#clientes`);
}

export async function removeClient(allianceId: string, clientId: string) {
  const user = await requireUser();
  const client = await db.allianceClient.delete({
    where: { id: clientId },
    include: { organization: { select: { name: true } }, alliance: { select: { name: true } } },
  });
  await notify(user, { allianceId }, `quitó a ${client.organization.name} de los clientes de "${client.alliance.name}"`, `/alianzas/${allianceId}#clientes`);
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/clientes");
}

function readClient(fd: FormData) {
  const revenue = str(fd, "revenue");
  return {
    status: oneOf(fd, "status", CLIENT_STATUSES, "PROSPECTO"),
    revenue: revenue ? revenue.replace(/[^\d.]/g, "") || null : null,
    since: parseDate(str(fd, "since")),
    notes: str(fd, "notes"),
  };
}
