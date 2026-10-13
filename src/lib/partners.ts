import bcrypt from "bcryptjs";
import type { OpportunityStatus, ParticipantRole, RegistrationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

// Portal de partners: lógica compartida entre la web y el MCP.
// Un partner (organización) registra oportunidades de clientes en las alianzas en que participa;
// el equipo interno las aprueba (se crea una oportunidad normal) o las rechaza con un motivo.

type Actor = { id: string; name?: string | null };
export type PartnerActor = { id: string; name: string; organizationId: string; organizationName: string };

export type RegistrationInput = {
  allianceId: string;
  title: string;
  clientName: string;
  clientCountryCode?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
  estimatedValue?: string | number | null;
  expectedCloseDate?: Date | null;
  notes?: string | null;
};

const partnerLabel = (p: PartnerActor) => `${p.name} (${p.organizationName})`;

// Alianzas en las que participa la organización partner: lo único que ve en el portal.
export function partnerAlliances(organizationId: string) {
  return db.alliance.findMany({
    where: { participants: { some: { organizationId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, countryCode: true, country: { select: { name: true } } },
  });
}

// Organizaciones que pueden tener cuentas de partner: las que participan en alguna alianza.
export function partnerOrganizations() {
  return db.organization.findMany({
    where: partnerWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

function cleanValue(v: RegistrationInput["estimatedValue"]) {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[^\d.]/g, "");
  return s || null;
}

// Aviso interno: el cliente ya es cliente nuestro o lo registró otro partner.
export async function findConflict(clientName: string, partnerId: string, excludeId?: string) {
  const name = { equals: clientName.trim(), mode: "insensitive" as const };
  const [clients, others] = await Promise.all([
    db.allianceClient.findMany({ where: { organization: { name } }, select: { alliance: { select: { name: true } } } }),
    db.dealRegistration.findMany({
      where: { clientName: name, partnerId: { not: partnerId }, status: { not: "RECHAZADA" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { partner: { select: { name: true } }, createdAt: true },
    }),
  ]);
  const notes = [
    ...clients.map((c) => `Ya es cliente en "${c.alliance.name}"`),
    ...others.map((o) => `También lo registró ${o.partner.name} el ${o.createdAt.toISOString().slice(0, 10)}`),
  ];
  return notes.length ? notes.join(". ") : null;
}

async function checkAlliance(partner: PartnerActor, allianceId: string) {
  const ok = await db.allianceParticipant.findUnique({
    where: { allianceId_organizationId: { allianceId, organizationId: partner.organizationId } },
    select: { alliance: { select: { name: true } } },
  });
  if (!ok) throw new Error("Elegí una de tus alianzas");
  return ok.alliance.name;
}

function readInput(input: RegistrationInput) {
  const title = input.title?.trim();
  const clientName = input.clientName?.trim();
  if (!title || !clientName || !input.allianceId) throw new Error("Alianza, cliente y título son obligatorios");
  return {
    allianceId: input.allianceId,
    title,
    clientName,
    clientCountryCode: input.clientCountryCode || null,
    clientContact: input.clientContact?.trim() || null,
    clientEmail: input.clientEmail?.trim() || null,
    estimatedValue: cleanValue(input.estimatedValue),
    expectedCloseDate: input.expectedCloseDate ?? null,
    notes: input.notes?.trim() || null,
  };
}

export async function createRegistration(partner: PartnerActor, input: RegistrationInput) {
  const data = readInput(input);
  const allianceName = await checkAlliance(partner, data.allianceId);
  const conflict = await findConflict(data.clientName, partner.organizationId);
  const r = await db.dealRegistration.create({
    data: { ...data, conflict, partnerId: partner.organizationId, createdById: partner.id },
  });
  await notify(
    { id: partner.id, name: partnerLabel(partner) },
    { allianceId: data.allianceId },
    `registró la oportunidad "${r.title}" para ${r.clientName} en "${allianceName}" (pendiente de aprobación)`,
    `/partners/registros/${r.id}`,
  );
  return r;
}

// El partner solo puede tocar sus registros mientras están pendientes.
async function ownPending(partner: PartnerActor, id: string) {
  const r = await db.dealRegistration.findUnique({ where: { id } });
  if (!r || r.partnerId !== partner.organizationId) throw new Error("No existe ese registro");
  if (r.status !== "PENDIENTE") throw new Error("Solo se pueden cambiar los registros pendientes");
  return r;
}

export async function updateRegistration(partner: PartnerActor, id: string, input: RegistrationInput) {
  await ownPending(partner, id);
  const data = readInput(input);
  await checkAlliance(partner, data.allianceId);
  const conflict = await findConflict(data.clientName, partner.organizationId, id);
  return db.dealRegistration.update({ where: { id }, data: { ...data, conflict } });
}

export async function deleteOwnRegistration(partner: PartnerActor, id: string) {
  await ownPending(partner, id);
  await db.dealRegistration.delete({ where: { id } });
}

async function partnerUserIds(organizationId: string) {
  const users = await db.user.findMany({ where: { organizationId, role: "PARTNER", active: true }, select: { id: true } });
  return users.map((u) => u.id);
}

async function pending(id: string) {
  const r = await db.dealRegistration.findUnique({ where: { id }, include: { partner: { select: { name: true } } } });
  if (!r) throw new Error("No existe ese registro");
  if (r.status !== "PENDIENTE") throw new Error("Ese registro ya fue revisado");
  return r;
}

// Aprobar crea una oportunidad normal en la alianza, marcada con el partner que la trajo.
export async function approveRegistration(
  id: string,
  actor: Actor,
  adjust: { title?: string | null; estimatedValue?: string | number | null; probability?: number | null } = {},
) {
  const r = await pending(id);
  const title = adjust.title?.trim() || r.title;
  const fullTitle = title.toLowerCase().includes(r.clientName.toLowerCase()) ? title : `${title} · ${r.clientName}`;
  const description = [
    `Cliente: ${r.clientName}${r.clientCountryCode ? ` (${r.clientCountryCode})` : ""}`,
    r.clientContact || r.clientEmail ? `Contacto: ${[r.clientContact, r.clientEmail].filter(Boolean).join(" · ")}` : null,
    r.expectedCloseDate ? `Cierre esperado: ${r.expectedCloseDate.toISOString().slice(0, 10)}` : null,
    `Registrada por ${r.partner.name} desde el portal de partners.`,
    r.notes ? `Notas del partner: ${r.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const value = adjust.estimatedValue !== undefined && adjust.estimatedValue !== "" ? cleanValue(adjust.estimatedValue) : r.estimatedValue;
  const probability = adjust.probability != null ? Math.min(100, Math.max(0, Math.round(adjust.probability))) : null;

  const opportunity = await db.$transaction(async (tx) => {
    const o = await tx.opportunity.create({
      data: { title: fullTitle, description, estimatedValue: value, probability, allianceId: r.allianceId, partnerId: r.partnerId, dimension: "VENTAS" },
    });
    await tx.dealRegistration.update({
      where: { id },
      data: { status: "APROBADA", reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: null, opportunityId: o.id },
    });
    return o;
  });
  await notify(actor, { userIds: await partnerUserIds(r.partnerId) }, `aprobó tu registro "${r.title}" (${r.clientName})`, "/portal");
  await notify(actor, { allianceId: r.allianceId }, `aprobó la oportunidad "${fullTitle}" que trajo ${r.partner.name}`, "/oportunidades");
  return opportunity;
}

export async function rejectRegistration(id: string, actor: Actor, reason: string) {
  const motive = reason?.trim();
  if (!motive) throw new Error("Escribí el motivo del rechazo");
  const r = await pending(id);
  await db.dealRegistration.update({
    where: { id },
    data: { status: "RECHAZADA", rejectionReason: motive, reviewedById: actor.id, reviewedAt: new Date() },
  });
  await notify(actor, { userIds: await partnerUserIds(r.partnerId) }, `rechazó tu registro "${r.title}" (${r.clientName}): ${motive}`, "/portal");
}

// Lo que ve el partner de cada registro: el estado de la revisión y, si se aprobó, cómo va la oportunidad.
export function registrationStage(r: { status: RegistrationStatus; opportunity?: { status: OpportunityStatus } | null }) {
  if (r.status === "PENDIENTE") return { key: "PENDIENTE", label: "Pendiente de aprobación", style: "border-amber-400/40 bg-amber-500/10 text-amber-300" };
  if (r.status === "RECHAZADA") return { key: "RECHAZADA", label: "Rechazada", style: "border-red-400/40 bg-red-500/10 text-red-300" };
  if (r.opportunity?.status === "GANADA") return { key: "GANADA", label: "Ganada", style: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" };
  if (r.opportunity?.status === "DESCARTADA") return { key: "DESCARTADA", label: "Cerrada sin venta", style: "border-slate-300 bg-slate-100 text-slate-500" };
  return { key: "APROBADA", label: "Aprobada · en curso", style: "border-cyan-400/40 bg-cyan-500/10 text-cyan-300" };
}

// ---------- Cuentas de partner ----------

export type AccountInput = { organizationId?: string | null; name?: string | null; email?: string | null; password?: string | null; active?: boolean };

async function emailTaken(email: string, exceptId?: string) {
  const other = await db.user.findUnique({ where: { email } });
  return !!other && other.id !== exceptId;
}

export async function createPartnerAccount(input: AccountInput) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name || !email || !input.organizationId) throw new Error("Partner, nombre y email son obligatorios");
  if (!input.password || input.password.length < 8) throw new Error("La contraseña debe tener 8 caracteres o más");
  if (!(await db.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }))) throw new Error("No existe ese partner");
  if (await emailTaken(email)) throw new Error("Ya existe una cuenta con ese email");
  return db.user.create({
    data: { name, email, role: "PARTNER", organizationId: input.organizationId, passwordHash: await bcrypt.hash(input.password, 10) },
    include: { organization: { select: { name: true } } },
  });
}

export async function partnerAccount(id: string) {
  const u = await db.user.findUnique({ where: { id }, include: { organization: { select: { id: true, name: true } } } });
  if (!u || u.role !== "PARTNER") throw new Error("No existe esa cuenta de partner");
  return u;
}

export async function updatePartnerAccount(id: string, input: AccountInput) {
  await partnerAccount(id);
  const email = input.email?.trim().toLowerCase();
  if (email && (await emailTaken(email, id))) throw new Error("Ya existe otra cuenta con ese email");
  if (input.password && input.password.length < 8) throw new Error("La contraseña debe tener 8 caracteres o más");
  return db.user.update({
    where: { id },
    data: {
      name: input.name?.trim() || undefined,
      email: email || undefined,
      organizationId: input.organizationId || undefined,
      active: input.active,
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
    },
    include: { organization: { select: { name: true } } },
  });
}

export async function deletePartnerAccount(id: string) {
  await partnerAccount(id);
  await db.user.delete({ where: { id } });
}

// ---------- ABM de partners ----------
// Un partner es una organización que participa en alianzas (con un rol distinto de cliente) o tiene cuentas de portal.

export const partnerWhere = {
  OR: [{ participations: { some: { roleType: { not: "CLIENTE" as const } } } }, { partnerAccounts: { some: {} } }],
};

export function listPartners() {
  return db.organization.findMany({
    where: partnerWhere,
    orderBy: { name: "asc" },
    include: {
      countries: { select: { code: true, name: true } },
      participations: {
        where: { roleType: { not: "CLIENTE" } },
        include: { alliance: { select: { id: true, name: true } } },
        orderBy: { alliance: { name: "asc" } },
      },
      partnerAccounts: { select: { id: true, active: true } },
      _count: { select: { partnerRegistrations: true, partnerOpportunities: true } },
    },
  });
}

export type PartnerInput = {
  organizationId?: string | null;
  newName?: string | null;
  countries?: string[];
  alliances: { allianceId: string; roleType?: ParticipantRole | null }[];
};

// Alta (organización existente o nueva) y modificación: las alianzas pasadas reemplazan las del partner.
export async function savePartner(input: PartnerInput) {
  let organizationId = input.organizationId || null;
  const name = input.newName?.trim();
  if (!organizationId && name) {
    const existing = await db.organization.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    organizationId =
      existing?.id ??
      (
        await db.organization.create({
          data: { name, countries: input.countries?.length ? { connect: input.countries.map((code) => ({ code })) } : undefined },
        })
      ).id;
  }
  if (!organizationId) throw new Error("Elegí o escribí la organización");
  if (!input.alliances.length) throw new Error("Elegí al menos una alianza");
  const ids = input.alliances.map((a) => a.allianceId);
  if ((await db.alliance.count({ where: { id: { in: ids } } })) !== new Set(ids).size) throw new Error("Alguna alianza no existe");

  await db.$transaction([
    db.allianceParticipant.deleteMany({ where: { organizationId, roleType: { not: "CLIENTE" }, allianceId: { notIn: ids } } }),
    ...input.alliances.map((a) =>
      db.allianceParticipant.upsert({
        where: { allianceId_organizationId: { allianceId: a.allianceId, organizationId: organizationId! } },
        update: { roleType: a.roleType ?? "SOCIO" },
        create: { allianceId: a.allianceId, organizationId: organizationId!, roleType: a.roleType ?? "SOCIO" },
      }),
    ),
  ]);
  return db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true, name: true } });
}

// Baja: deja de ser partner (sale de las alianzas y se borran sus cuentas de portal).
// La organización, sus registros y las oportunidades que trajo se conservan.
export async function removePartner(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  if (!org) throw new Error("No existe ese partner");
  await db.$transaction([
    db.allianceParticipant.deleteMany({ where: { organizationId, roleType: { not: "CLIENTE" } } }),
    db.user.deleteMany({ where: { organizationId, role: "PARTNER" } }),
  ]);
  return org;
}
