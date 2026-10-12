import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export default async function InitiativesPage() {
  const initiatives = await db.initiative.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { name: true } },
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {initiatives.map((i) => {
          const next = i.milestones[0];
          const countries = [...new Set(i.alliances.map((a) => a.country.name))];
          return (
            <Link key={i.id} href={`/iniciativas/${i.id}`} className="card block space-y-2 hover:border-indigo-200">
              <p className="font-medium text-slate-900">{i.name}</p>
              {countries.length > 0 && <p className="text-xs text-slate-500">{countries.join(", ")}</p>}
              <ProgressBar value={i.progress} />
              <p className="text-xs text-slate-500">
                {next ? `Próximo hito: ${next.title}${next.dueDate ? ` (${fmtDate(next.dueDate)})` : ""}` : "Sin hitos pendientes"}
              </p>
              <p className="text-xs text-slate-400">{i.owner?.name ?? "Sin responsable"}</p>
            </Link>
          );
        })}
        {initiatives.length === 0 && <p className="text-sm text-slate-500">Todavía no hay iniciativas.</p>}
      </div>
    </>
  );
}
