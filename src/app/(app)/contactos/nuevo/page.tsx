import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { createContact } from "../actions";
import { ContactForm } from "../contact-form";

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const [countries, organizations] = await Promise.all([
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Nuevo contacto" />
      <ContactForm
        action={createContact}
        countries={countries}
        organizations={organizations}
        defaultOrganizationId={org}
        cancelHref={org ? `/organizaciones/${org}` : "/contactos"}
      />
    </>
  );
}
