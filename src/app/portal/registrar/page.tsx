import { requirePartner } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { partnerAlliances } from "@/lib/partners";
import { registerOpportunity } from "../actions";
import { RegistrationForm } from "../registration-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const partner = await requirePartner();
  const [alliances, countries] = await Promise.all([
    partnerAlliances(partner.organizationId),
    db.country.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Registrar oportunidad" subtitle="Queda pendiente hasta que el equipo la apruebe" />
      {error && <p className="mb-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {alliances.length === 0 ? (
        <p className="card max-w-3xl text-sm text-slate-500">Todavía no participás en ninguna alianza. Pedile al equipo que te sume para poder registrar oportunidades.</p>
      ) : (
        <RegistrationForm action={registerOpportunity} alliances={alliances} countries={countries} submitLabel="Registrar" />
      )}
    </>
  );
}
