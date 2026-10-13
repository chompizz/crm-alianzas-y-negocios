import Link from "next/link";
import type { Dimension } from "@prisma/client";
import { DimensionBadge } from "@/components/dimension-badge";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { RowActions } from "@/components/row-actions";
import { db } from "@/lib/db";
import { ownerNames, ownersSelect } from "@/lib/owners";
import { fmtDate } from "@/lib/format";
import { DIMENSIONS } from "@/lib/labels";
import { deleteInitiative } from "./actions";

export default async function InitiativesPage({ searchParams }: { searchParams: Promise<{ dim?: string }> }) {
  const { dim } = await searchParams;
  const initiatives = await db.initiative.findMany({
    where: dim && dim in DIMENSIONS ? { dimension: dim as Dimension } : {},
    orderBy: { updatedAt: "desc" },
    include: {
      ...ownersSelect,
      alliances: { select: { name: true, country: { select: { name: true } } } },
      milestones: { where: { done: false }, orderBy: { dueDate: { sort: "asc", nulls: "last" } }, take: 1 },
    },
  });

  return (
    <>
      <PageHeader
        title="Iniciativas"
        subtitle="Proyectos estratégicos con hitos y varias partes"
        actions={<Link href="/iniciativas/nueva" className="btn-primary">Nueva iniciativa</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="dim" defaultValue={dim ?? ""} className="input max-w-[12rem]">
          <option value="">Todas las dimensiones</option>
          {Object.entries(DIMENSIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {initiatives.map((i) => {
          const next = i.milestones[0];
          const countries = [...new Set(i.alliances.map((a) => a.country.name))];
          return (
            <div key={i.id} className="card relative space-y-2 hover:border-indigo-200">
              <div className="flex items-start justify-between gap-2">
                {/* El enlace cubre toda la tarjeta; el lápiz y la X quedan por encima. */}
                <Link href={`/iniciativas/${i.id}`} className="font-medium text-slate-900 after:absolute after:inset-0">{i.name}</Link>
                <DimensionBadge dimension={i.dimension} />
              </div>
              {countries.length > 0 && <p className="text-xs text-slate-500">{countries.join(", ")}</p>}
              <ProgressBar value={i.progress} />
              <p className="text-xs text-slate-500">
                {next ? `Próximo hito: ${next.title}${next.dueDate ? ` (${fmtDate(next.dueDate)})` : ""}` : "Sin hitos pendientes"}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-slate-400">{ownerNames(i.owners, "Sin responsable")}</p>
                <RowActions
                  className="relative z-10"
                  editHref={`/iniciativas/${i.id}/editar`}
                  deleteAction={deleteInitiative.bind(null, i.id, "/iniciativas")}
                  confirm={`¿Eliminar la iniciativa "${i.name}"? Se borran también sus hitos y compromisos.`}
                  label={i.name}
                />
              </div>
            </div>
          );
        })}
        {initiatives.length === 0 && <p className="text-sm text-slate-500">Todavía no hay iniciativas.</p>}
      </div>
    </>
  );
}
