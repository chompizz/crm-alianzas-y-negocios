import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { RELATIONSHIP_LEVELS } from "@/lib/labels";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pais?: string }>;
}) {
  const { q, pais } = await searchParams;
  const where: Prisma.ContactWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
  if (pais) where.countryCode = pais;

  const [contacts, countries] = await Promise.all([
    db.contact.findMany({ where, orderBy: { name: "asc" }, include: { organization: true, country: true } }),
    db.country.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Contactos"
        subtitle="Personas de las organizaciones del ecosistema"
        actions={<Link href="/contactos/nuevo" className="btn-primary">Nuevo contacto</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o email" className="input max-w-xs" />
        <select name="pais" defaultValue={pais ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Nombre</th><th>Organización</th><th>Cargo</th><th>País</th><th>Relación</th><th>Email</th></tr></thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td><Link href={`/contactos/${c.id}/editar`} className="font-medium text-indigo-700 hover:underline">{c.name}</Link></td>
                <td><Link href={`/organizaciones/${c.organizationId}`} className="hover:underline">{c.organization.name}</Link></td>
                <td>{c.position}</td>
                <td>{c.country?.name}</td>
                <td>{RELATIONSHIP_LEVELS[c.relationshipLevel]}</td>
                <td>{c.email}</td>
              </tr>
            ))}
            {contacts.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No hay contactos con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
