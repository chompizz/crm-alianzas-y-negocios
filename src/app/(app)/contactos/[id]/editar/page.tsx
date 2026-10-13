import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/row-actions";
import { db } from "@/lib/db";
import { deleteContact, updateContact } from "../../actions";
import { ContactForm } from "../../contact-form";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, countries, organizations] = await Promise.all([
    db.contact.findUnique({ where: { id } }),
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!contact) notFound();
  return (
    <>
      <PageHeader
        title={contact.name}
        actions={
          <DeleteButton action={deleteContact.bind(null, id, undefined)} confirm={`¿Eliminar a ${contact.name}?`} label="contacto" variant="button" />
        }
      />
      <ContactForm
        action={updateContact.bind(null, id)}
        countries={countries}
        organizations={organizations}
        contact={contact}
        cancelHref={`/organizaciones/${contact.organizationId}`}
      />
    </>
  );
}
