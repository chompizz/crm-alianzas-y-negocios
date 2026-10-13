import Link from "next/link";
import { fmtUsdCompact } from "@/lib/format";
import type { SalesFlowSummary } from "@/lib/sales-flow";

// Diagrama de estados del flujo de ventas: Iniciativa → Oportunidad → Cliente, con la rama de
// oportunidades descartadas y la tasa de conversión en cada transición.
export function SalesFlowDiagram({ data }: { data: SalesFlowSummary }) {
  const { initiatives: i, opportunities: o, clients: c, rates } = data;
  const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
  return (
    <section className="card mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-indigo-700/80">Flujo de ventas</p>
          <h2 className="text-lg font-semibold">De la iniciativa al cliente</h2>
        </div>
        <Link href="/flujo-ventas" className="btn-secondary">Abrir flujo de ventas</Link>
      </div>

      <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <State
          href="/iniciativas"
          tone="border-violet-400/50"
          dot="bg-violet-400"
          title="Iniciativas"
          value={String(i.total)}
          lines={[`${i.pending} sin convertir`, `${i.converted} con oportunidad`]}
        />
        <Transition label="convierten" value={pct(rates.initiativeToOpportunity)} hint={`${o.fromInitiatives} oport. nacidas de iniciativas`} />
        <State
          href="/oportunidades"
          tone="border-amber-400/50"
          dot="bg-amber-400"
          title="Oportunidades abiertas"
          value={String(o.open)}
          lines={[`${fmtUsdCompact(o.openValue)} en juego`, `${fmtUsdCompact(o.weighted)} ponderado`]}
        />
        <Transition label="se ganan" value={pct(rates.winRate)} hint={`${o.won} ganadas · ${fmtUsdCompact(o.wonValue)}`} />
        <State
          href="/clientes"
          tone="border-emerald-400/50"
          dot="bg-emerald-400"
          title="Clientes activos"
          value={String(c.active)}
          lines={[`${fmtUsdCompact(c.revenue)} facturación anual`, `${c.prospects} prospectos · ${c.inactive} inactivos`]}
        />
      </div>

      {/* Rama de salida: oportunidades descartadas, debajo de Oportunidades. */}
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="hidden md:block" />
        <div className="hidden md:block md:w-28" />
        <div className="flex flex-col items-center">
          <span className="h-4 w-px bg-slate-300" aria-hidden />
          <Link href="/oportunidades?estado=DESCARTADA" className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-center text-sm text-slate-500 hover:border-indigo-300">
            <span className="font-mono font-semibold text-slate-700">{o.lost}</span> descartadas
          </Link>
        </div>
      </div>
    </section>
  );
}

function State({ href, tone, dot, title, value, lines }: { href: string; tone: string; dot: string; title: string; value: string; lines: string[] }) {
  return (
    <Link href={href} className={`block rounded-xl border bg-slate-50/60 p-4 transition hover:bg-slate-100 ${tone}`}>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {title}
      </p>
      <p className="mt-1 font-mono text-3xl font-semibold text-slate-900">{value}</p>
      {lines.map((l) => <p key={l} className="text-xs text-slate-500">{l}</p>)}
    </Link>
  );
}

function Transition({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 py-1 text-center md:w-28" title={hint}>
      <span className="font-mono text-lg font-semibold text-indigo-700">{value}</span>
      <svg viewBox="0 0 100 12" className="h-3 w-20 rotate-90 text-indigo-500 md:rotate-0" aria-hidden>
        <line x1="2" y1="6" x2="90" y2="6" stroke="currentColor" strokeWidth="2" />
        <path d="M88 1 L98 6 L88 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-[10px] text-slate-400">{hint}</span>
    </div>
  );
}
