import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { dimensionSummary } from "@/lib/dimension-summary";
import { fmtUsdCompact } from "@/lib/format";
import { DIMENSION_DESCRIPTIONS, DIMENSION_STYLE, DIMENSIONS } from "@/lib/labels";

export default async function DimensionsPage() {
  const summary = await dimensionSummary();

  return (
    <>
      <PageHeader title="Dimensiones" subtitle="Gobernanza · Estrategia · Producto · Ventas" />
      <div className="grid gap-5 lg:grid-cols-2">
        {summary.map((d, i) => (
          <section key={d.dimension} id={d.dimension.toLowerCase()} className="card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="text-xl font-semibold">{DIMENSIONS[d.dimension]}</h2>
                <p className="mt-1 text-sm text-slate-500">{DIMENSION_DESCRIPTIONS[d.dimension]}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-xs ${DIMENSION_STYLE[d.dimension]}`}>
                {d.openAlliances + d.initiatives + d.openOpportunities} activos
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Alianzas" value={String(d.openAlliances)} hint={fmtUsdCompact(d.allianceValue)} href={`/alianzas?dim=${d.dimension}`} />
              <Metric label="Iniciativas" value={String(d.initiatives)} hint={`${d.avgProgress}% avance`} href={`/iniciativas?dim=${d.dimension}`} />
              <Metric label="Oportunidades" value={String(d.openOpportunities)} hint={fmtUsdCompact(d.weightedOpportunities)} href={`/oportunidades?dim=${d.dimension}`} />
              <Metric label="Compromisos" value={String(d.pendingCommitments)} hint="pendientes" />
            </dl>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label">Alianzas recientes</p>
                <ul className="space-y-1 text-sm">
                  {d.recentAlliances.map((a) => (
                    <li key={a.id} className="truncate">
                      <Link href={`/alianzas/${a.id}`} className="hover:text-indigo-700">{a.name}</Link>
                      <span className="ml-1 text-xs text-slate-500">{a.country}</span>
                    </li>
                  ))}
                  {d.recentAlliances.length === 0 && <li className="text-slate-500">Sin alianzas abiertas.</li>}
                </ul>
              </div>
              <div>
                <p className="label">Iniciativas</p>
                <ul className="space-y-2 text-sm">
                  {d.recentInitiatives.map((it) => (
                    <li key={it.id}>
                      <Link href={`/iniciativas/${it.id}`} className="block truncate hover:text-indigo-700">{it.name}</Link>
                      <ProgressBar value={it.progress} />
                    </li>
                  ))}
                  {d.recentInitiatives.length === 0 && <li className="text-slate-500">Sin iniciativas.</li>}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Metric({ label, value, hint, href }: { label: string; value: string; hint: string; href?: string }) {
  const body = (
    <>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="font-mono text-2xl font-semibold text-slate-900">{value}</dd>
      <dd className="text-xs text-slate-500">{hint}</dd>
    </>
  );
  const cls = "rounded-xl border border-slate-200 bg-slate-50/60 p-3";
  return href ? <Link href={href} className={`${cls} block transition hover:border-indigo-300`}>{body}</Link> : <div className={cls}>{body}</div>;
}
