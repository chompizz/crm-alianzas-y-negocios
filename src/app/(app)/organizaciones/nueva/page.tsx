import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { createOrganization } from "../actions";
import { OrganizationForm } from "../organization-form";

export default async function NewOrganizationPage() {
  const countries = await db.country.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Nueva organización" />
      <OrganizationForm action={createOrganization} countries={countries} cancelHref="/organizaciones" />
    </>
  );
}
