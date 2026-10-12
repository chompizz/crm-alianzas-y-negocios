import Link from "next/link";
import type { AllianceStage, AllianceType, Dimension, Prisma } from "@prisma/client";
import { DimensionBadge } from "@/components/dimension-badge";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { fmtUsd } from "@/lib/format";
import { ALLIANCE_STAGES, ALLIANCE_TYPES, DIMENSIONS, HEALTH_DOT } from "@/lib/labels";

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

  const stages = Object.keys(ALLIANCE_STAGES) as AllianceStage[];
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
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const items = alliances.filter((a) => a.stage === stage);
          return (
            <section key={stage} className="w-64 shrink-0 rounded-xl bg-slate-100 p-2">
              <h2 className="flex justify-between px-2 py-1 text-sm font-semibold text-slate-600">
                {ALLIANCE_STAGES[stage]}
                <span className="font-normal text-slate-400">{items.length}</span>
              </h2>
              <div className="mt-1 space-y-2">
                {items.map((a) => (
                  <Link key={a.id} href={`/alianzas/${a.id}`} className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-indigo-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{a.name}</p>
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_DOT[a.health]}`} title={`Salud: ${a.health.toLowerCase()}`} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{a.country.name} · {ALLIANCE_TYPES[a.type]}</p>
                    <div className="mt-1.5"><DimensionBadge dimension={a.dimension} /></div>
                    {a.participants.length > 0 && (
                      <p className="mt-1 truncate text-xs text-slate-600">{a.participants.map((p) => p.organization.name).join(", ")}</p>
                    )}
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>{a.owner?.name ?? "Sin responsable"}</span>
                      <span>{fmtUsd(a.expectedValue)}</span>
                    </div>
                    {a._count.commitments > 0 && (
                      <p className="mt-1 text-xs text-amber-700">{a._count.commitments} compromiso(s) pendiente(s)</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
