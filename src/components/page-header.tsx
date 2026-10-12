export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {subtitle && <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-indigo-700/80">{subtitle}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
