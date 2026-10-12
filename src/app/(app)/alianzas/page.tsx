import Link from "next/link";
import type { AllianceType, Dimension, Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { dateInput, fmtUsd } from "@/lib/format";
import { ALLIANCE_TYPES, DIMENSIONS } from "@/lib/labels";
import { KanbanBoard } from "./kanban-board";

export default async function AlliancesPage({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string; tipo?: string; resp?: string; dim?: string }>;
}) {
  const { pais, tipo, resp, dim } = await searchParams;
  const where: Prisma.AllianceWhereInput = {};
  if (pais) where.countryCode = pais;
  if (tipo && tipo in ALLIANCE_TYPES) where.type = tipo as AllianceType;
  if (resp) where.ownerId = resp;
  if (dim && dim in DIMENSIONS) where.dimension = dim as Dimension;

  const [alliances, countries, users] = await Promise.all([
    db.alliance.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        country: true,
        owner: { select: { name: true } },
        participants: { include: { organization: { select: { name: true } } } },
        _count: { select: { commitments: { where: { status: "PENDIENTE" } } } },
      },
    }),
    db.country.findMany({ where: { alliances: { some: {} } }, orderBy: { name: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const newHref = pais ? `/alianzas/nueva?pais=${pais}` : "/alianzas/nueva";

  return (
    <>
      <PageHeader
        title="Alianzas"
        subtitle="Cada alianza pertenece a un país y avanza por etapas"
        actions={<Link href={newHref} className="btn-primary">Nueva alianza</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="pais" defaultValue={pais ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los tipos</option>
          {Object.entries(ALLIANCE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="dim" defaultValue={dim ?? ""} className="input max-w-[12rem]">
          <option value="">Todas las dimensiones</option>
          {Object.entries(DIMENSIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="resp" defaultValue={resp ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los responsables</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <KanbanBoard
        cards={alliances.map((a) => ({
          id: a.id,
          name: a.name,
          stage: a.stage,
          health: a.health,
          dimension: a.dimension,
          subtitle: `${a.country.name} · ${ALLIANCE_TYPES[a.type]}`,
          participants: a.participants.map((p) => p.organization.name).join(", "),
          owner: a.owner?.name ?? "Sin responsable",
          value: fmtUsd(a.expectedValue),
          pendingCommitments: a._count.commitments,
          ownerId: a.ownerId ?? "",
          expectedValue: a.expectedValue?.toString() ?? "",
          startDate: dateInput(a.startDate),
          renewalDate: dateInput(a.renewalDate),
        }))}
        users={users}
      />
    </>
  );
}
