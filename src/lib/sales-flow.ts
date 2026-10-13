import type { ClientStatus, Dimension } from "@prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

type Actor = { id: string; name?: string | null };

// Flujo de ventas: iniciativa → oportunidad → cliente. La web y el MCP usan estas mismas funciones.

export async function convertInitiative(input: {
  initiativeId: string;
  allianceId: string;
  title?: string | null;
  value?: number | string | null;
  probability?: number | null;
  dimension?: Dimension;
}, actor?: Actor) {
  const initiative = await db.initiative.findUnique({ where: { id: input.initiativeId }, select: { id: true, name: true } });
  if (!initiative) throw new Error("No existe esa iniciativa");
  const alliance = await db.alliance.findUnique({ where: { id: input.allianceId }, select: { id: true, name: true } });
  if (!alliance) throw new Error("No existe esa alianza");
  const opp = await db.opportunity.create({
    data: {
      title: input.title?.trim() || initiative.name,
      allianceId: alliance.id,
      initiativeId: initiative.id,
      estimatedValue: input.value ?? null,
      probability: input.probability ?? null,
      dimension: input.dimension ?? "VENTAS",
    },
  });
  if (actor) {
    await notify(
      actor,
      { allianceId: alliance.id, initiativeId: initiative.id },
      `convirtió la iniciativa "${initiative.name}" en la oportunidad "${opp.title}" de "${alliance.name}"`,
      "/flujo-ventas",
    );
  }
  return opp;
}

// Marca la oportunidad como ganada y crea (o actualiza) el cliente en la alianza de la oportunidad.
export async function convertOpportunity(input: {
  opportunityId: string;
  organizationId?: string | null;
  newName?: string | null;
  status?: ClientStatus;
  revenue?: number | string | null;
  since?: Date | null;
}, actor?: Actor) {
  const opp = await db.opportunity.findUnique({
    where: { id: input.opportunityId },
    select: { id: true, title: true, allianceId: true, estimatedValue: true, alliance: { select: { countryCode: true, name: true } } },
  });
  if (!opp) throw new Error("No existe esa oportunidad");

  let organizationId = input.organizationId || null;
  // Si vino de un partner y no se eligió cliente, se usa el cliente que registró el partner.
  const name =
    input.newName?.trim() ||
    (!organizationId ? (await db.dealRegistration.findUnique({ where: { opportunityId: opp.id }, select: { clientName: true } }))?.clientName : null);
  if (!organizationId && name) {
    const existing = await db.organization.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    organizationId =
      existing?.id ?? (await db.organization.create({ data: { name, countries: { connect: { code: opp.alliance.countryCode } } } })).id;
  }
  if (!organizationId) throw new Error("Elegí o escribí el cliente");

  const data = {
    status: input.status ?? "ACTIVO",
    revenue: input.revenue ?? opp.estimatedValue,
    since: input.since ?? new Date(),
  };
  const client = await db.$transaction(async (tx) => {
    await tx.opportunity.update({ where: { id: opp.id }, data: { status: "GANADA" } });
    // Si la oportunidad ya estaba ligada a otro cliente, se libera para ligarla al nuevo.
    await tx.allianceClient.updateMany({ where: { opportunityId: opp.id }, data: { opportunityId: null } });
    return tx.allianceClient.upsert({
      where: { allianceId_organizationId: { allianceId: opp.allianceId, organizationId: organizationId! } },
      update: { ...data, opportunityId: opp.id },
      create: { allianceId: opp.allianceId, organizationId: organizationId!, opportunityId: opp.id, ...data },
      include: { organization: { select: { name: true } } },
    });
  });
  if (actor) {
    await notify(
      actor,
      { allianceId: opp.allianceId },
      `ganó "${opp.title}": ${client.organization.name} es cliente de "${opp.alliance.name}"`,
      `/alianzas/${opp.allianceId}#clientes`,
    );
  }
  return client;
}

export type SalesFlowSummary = Awaited<ReturnType<typeof salesFlowSummary>>;

export async function salesFlowSummary() {
  const [initiatives, converted, opps, clients] = await Promise.all([
    db.initiative.count(),
    db.initiative.count({ where: { opportunities: { some: {} } } }),
    db.opportunity.findMany({ select: { status: true, estimatedValue: true, probability: true, initiativeId: true } }),
    db.allianceClient.findMany({ select: { status: true, revenue: true, opportunityId: true } }),
  ]);
  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
  const open = opps.filter((o) => o.status === "ABIERTA");
  const won = opps.filter((o) => o.status === "GANADA");
  const lost = opps.filter((o) => o.status === "DESCARTADA");
  const active = clients.filter((c) => c.status === "ACTIVO");
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  return {
    initiatives: { total: initiatives, converted, pending: initiatives - converted },
    opportunities: {
      open: open.length,
      openValue: sum(open, (o) => Number(o.estimatedValue ?? 0)),
      weighted: sum(open, (o) => Number(o.estimatedValue ?? 0) * ((o.probability ?? 0) / 100)),
      won: won.length,
      wonValue: sum(won, (o) => Number(o.estimatedValue ?? 0)),
      lost: lost.length,
      fromInitiatives: opps.filter((o) => o.initiativeId).length,
    },
    clients: {
      total: clients.length,
      active: active.length,
      prospects: clients.filter((c) => c.status === "PROSPECTO").length,
      inactive: clients.filter((c) => c.status === "INACTIVO").length,
      revenue: sum(active, (c) => Number(c.revenue ?? 0)),
      fromOpportunities: clients.filter((c) => c.opportunityId).length,
    },
    rates: {
      // % de iniciativas que generaron al menos una oportunidad.
      initiativeToOpportunity: pct(converted, initiatives),
      // % de oportunidades cerradas que se ganaron.
      winRate: pct(won.length, won.length + lost.length),
      // % de clientes activos sobre el total de clientes.
      activeClients: pct(active.length, clients.length),
    },
  };
}
