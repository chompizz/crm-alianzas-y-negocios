import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { updateOrganization } from "../../actions";
import { OrganizationForm } from "../../organization-form";

export default async function EditOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [organization, countries, groups] = await Promise.all([
    db.organization.findUnique({ where: { id }, include: { countries: true } }),
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!organization) notFound();
  return (
    <>
      <PageHeader title={`Editar ${organization.name}`} />
      <OrganizationForm
        action={updateOrganization.bind(null, id)}
        countries={countries}
        groups={groups}
        organization={organization}
        cancelHref={`/organizaciones/${id}`}
      />
    </>
  );
}
