import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { fmtUsd } from "@/lib/format";
import { CLIENT_STATUSES } from "@/lib/labels";
import { FlowBoard } from "./flow-board";

export default async function SalesFlowPage() {
  const [initiatives, opportunities, clients, alliances, organizations] = await Promise.all([
    db.initiative.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        progress: true,
        alliances: { select: { id: true, name: true } },
        _count: { select: { opportunities: true } },
      },
    }),
    db.opportunity.findMany({
      where: { status: "ABIERTA" },
      orderBy: { updatedAt: "desc" },
      include: { alliance: { select: { name: true } }, initiative: { select: { name: true } } },
    }),
    db.allianceClient.findMany({
      where: { status: { not: "INACTIVO" } },
      orderBy: { updatedAt: "desc" },
      include: { organization: { select: { name: true } }, alliance: { select: { name: true } } },
    }),
    db.alliance.findMany({ where: { stage: { not: "CERRADA" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Flujo de ventas" subtitle="De la iniciativa al cliente" />
      <FlowBoard
        alliances={alliances}
        organizations={organizations}
        initiatives={initiatives.map((i) => ({
          id: i.id,
          title: i.name,
          detail: i.alliances.map((a) => a.name).join(", ") || "Sin alianza",
          meta: `${i.progress}% avance`,
          badge: i._count.opportunities ? `${i._count.opportunities} oport.` : "",
          allianceIds: i.alliances.map((a) => a.id),
        }))}
        opportunities={opportunities.map((o) => ({
          id: o.id,
          title: o.title,
          detail: o.alliance.name,
          meta: [fmtUsd(o.estimatedValue), o.probability != null ? `${o.probability}%` : ""].filter(Boolean).join(" · "),
          badge: o.initiative ? `de ${o.initiative.name}` : "",
          value: o.estimatedValue?.toString() ?? "",
        }))}
        clients={clients.map((c) => ({
          id: c.id,
          title: c.organization.name,
          detail: c.alliance.name,
          meta: fmtUsd(c.revenue),
          badge: CLIENT_STATUSES[c.status],
          href: `/alianzas/${c.allianceId}#clientes`,
        }))}
      />
    </>
  );
}
