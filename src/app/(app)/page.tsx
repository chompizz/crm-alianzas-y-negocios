import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const [organizations, contacts, byCountry] = await Promise.all([
    db.organization.count(),
    db.contact.count(),
    db.country.findMany({
      where: { organizations: { some: {} } },
      select: { code: true, name: true, _count: { select: { organizations: true } } },
    }),
  ]);
  const orgCountryCounts = await db.organization.findMany({ select: { _count: { select: { countries: true } } } });
  const multiCountry = orgCountryCounts.filter((o) => o._count.countries > 1).length;
  byCountry.sort((a, b) => b._count.organizations - a._count.organizations);

  return (
    <>
      <PageHeader title="Tablero" subtitle="Resumen del ecosistema" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Organizaciones" value={organizations} href="/organizaciones" />
        <Stat label="Organizaciones multipaís" value={multiCountry} href="/organizaciones" />
        <Stat label="Contactos" value={contacts} href="/contactos" />
      </div>
      <section className="card">
        <h2 className="mb-3 font-semibold">Organizaciones por país</h2>
        {byCountry.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay organizaciones. <Link href="/organizaciones/nueva" className="text-indigo-700 hover:underline">Crear la primera</Link>.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {byCountry.map((c) => (
              <li key={c.code} className="flex justify-between py-2 text-sm">
                <Link href={`/organizaciones?pais=${c.code}`} className="hover:underline">{c.name}</Link>
                <span className="font-medium">{c._count.organizations}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-6 text-xs text-slate-400">Alianzas, oportunidades, iniciativas y compromisos se suman en las próximas etapas.</p>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card block hover:border-indigo-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Link>
  );
}
