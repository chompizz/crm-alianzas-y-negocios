import Link from "next/link";
import { notFound } from "next/navigation";
import { CommitmentRow } from "@/components/commitment-row";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { db } from "@/lib/db";
import { fmtDate, startOfTodayUtc } from "@/lib/format";
import { COMMITMENT_PARTIES, DIMENSIONS, HEALTH_DOT } from "@/lib/labels";
import { addInitiativeCommitment, addMilestone, deleteInitiative, deleteMilestone, toggleMilestone } from "../actions";

export default async function InitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [initiative, users] = await Promise.all([
    db.initiative.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true } },
        alliances: { include: { country: true }, orderBy: { name: "asc" } },
        organizations: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        milestones: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { title: "asc" }] },
        commitments: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { owner: { select: { name: true } } } },
      },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!initiative) notFound();
  const today = startOfTodayUtc();

  return (
    <>
      <PageHeader
        title={initiative.name}
        subtitle={`${DIMENSIONS[initiative.dimension]} · ${initiative.owner ? `Responsable: ${initiative.owner.name}` : "Sin responsable"}`}
        actions={
          <>
            <Link href={`/iniciativas/${id}/editar`} className="btn-secondary">Editar</Link>
            <form action={deleteInitiative.bind(null, id)}>
              <button className="btn-danger">Eliminar</button>
            </form>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <section className="card space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase text-slate-500">Avance</p>
              <ProgressBar value={initiative.progress} />
            </div>
            {initiative.objective && (
              <div>
                <p className="text-xs uppercase text-slate-500">Objetivo</p>
                <p className="whitespace-pre-line">{initiative.objective}</p>
              </div>
            )}
          </section>
          <section className="card text-sm">
            <h2 className="mb-2 font-semibold">Alianzas</h2>
            <ul className="space-y-1">
              {initiative.alliances.map((a) => (
                <li key={a.id}>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${HEALTH_DOT[a.health]}`} />
                  <Link href={`/alianzas/${a.id}`} className="text-indigo-700 hover:underline">{a.name}</Link>
                  <span className="ml-1 text-xs text-slate-500">{a.country.name}</span>
                </li>
              ))}
              {initiative.alliances.length === 0 && <li className="text-slate-500">Ninguna.</li>}
            </ul>
            <h2 className="mb-2 mt-4 font-semibold">Organizaciones</h2>
            <ul className="space-y-1">
              {initiative.organizations.map((o) => (
                <li key={o.id}><Link href={`/organizaciones/${o.id}`} className="text-indigo-700 hover:underline">{o.name}</Link></li>
              ))}
              {initiative.organizations.length === 0 && <li className="text-slate-500">Ninguna.</li>}
            </ul>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="mb-3 font-semibold">Hitos</h2>
            <ul className="divide-y divide-slate-100">
              {initiative.milestones.map((m) => {
                const late = !m.done && m.dueDate && m.dueDate < today;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <form action={toggleMilestone.bind(null, m.id)} className="flex items-center gap-2">
                      <button
                        aria-label={m.done ? "Marcar pendiente" : "Marcar cumplido"}
                        className={`flex h-5 w-5 items-center justify-center rounded border ${m.done ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300"}`}
                      >
                        {m.done && "✓"}
                      </button>
                      <span className={m.done ? "text-slate-400 line-through" : ""}>{m.title}</span>
                    </form>
                    <span className="flex items-center gap-3">
                      <span className={`text-xs ${late ? "font-medium text-red-600" : "text-slate-500"}`}>{fmtDate(m.dueDate)}{late && " (atrasado)"}</span>
                      <form action={deleteMilestone.bind(null, m.id)}>
                        <button className="text-xs text-slate-400 hover:text-red-600">Quitar</button>
                      </form>
                    </span>
                  </li>
                );
              })}
              {initiative.milestones.length === 0 && <li className="py-2 text-sm text-slate-500">Sin hitos. El avance se calcula con los hitos cumplidos.</li>}
            </ul>
            <form action={addMilestone.bind(null, id)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input name="title" required placeholder="Nuevo hito" className="input" />
              <input name="dueDate" type="date" className="input" />
              <button className="btn-secondary">Agregar</button>
            </form>
          </section>

          <section className="card">
            <h2 className="mb-3 font-semibold">Compromisos</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Compromiso</th><th>Quién</th><th>Fecha</th><th>Estado</th></tr></thead>
                <tbody>
                  {initiative.commitments.map((c) => <CommitmentRow key={c.id} commitment={c} />)}
                  {initiative.commitments.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-500">Sin compromisos.</td></tr>}
                </tbody>
              </table>
            </div>
            <form action={addInitiativeCommitment.bind(null, id)} className="mt-3 grid gap-2 sm:grid-cols-4">
              <input name="description" required placeholder="Nuevo compromiso" className="input sm:col-span-4" />
              <select name="party" defaultValue="NOSOTROS" className="input">
                {Object.entries(COMMITMENT_PARTIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select name="ownerId" defaultValue="" className="input">
                <option value="">Responsable</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input name="dueDate" type="date" className="input" />
              <button className="btn-secondary">Agregar</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
