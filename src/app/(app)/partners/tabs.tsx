import Link from "next/link";

export function PartnerTabs({ active, pending }: { active: "registros" | "cuentas"; pending: number }) {
  const tab = (key: typeof active, href: string, label: React.ReactNode) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm ${active === key ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-4 flex gap-1">
      {tab("registros", "/partners", <>Registros {pending > 0 && <span className="chip ml-1 border-amber-400/40 bg-amber-500/10 text-amber-300">{pending}</span>}</>)}
      {tab("cuentas", "/partners/cuentas", "Cuentas")}
    </div>
  );
}
