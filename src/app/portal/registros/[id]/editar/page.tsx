import { notFound } from "next/navigation";
import { requirePartner } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { partnerAlliances } from "@/lib/partners";
import { editRegistration } from "../../../actions";
import { RegistrationForm } from "../../../registration-form";

export default async function EditRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const partner = await requirePartner();
  const registration = await db.dealRegistration.findFirst({ where: { id, partnerId: partner.organizationId, status: "PENDIENTE" } });
  if (!registration) notFound();
  const [alliances, countries] = await Promise.all([
    partnerAlliances(partner.organizationId),
    db.country.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Editar registro" subtitle="Se puede cambiar mientras esté pendiente" />
      {error && <p className="mb-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <RegistrationForm
        action={editRegistration.bind(null, registration.id)}
        alliances={alliances}
        countries={countries}
        registration={registration}
        submitLabel="Guardar"
      />
    </>
  );
}
