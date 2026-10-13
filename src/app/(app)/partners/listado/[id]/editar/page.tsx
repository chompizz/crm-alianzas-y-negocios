import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { updatePartner } from "../../../actions";
import { PartnerForm } from "../../partner-form";

export default async function EditPartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [partner, alliances] = await Promise.all([
    db.organization.findUnique({
      where: { id },
      select: { name: true, participations: { where: { roleType: { not: "CLIENTE" } }, select: { allianceId: true, roleType: true } } },
    }),
    db.alliance.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, country: { select: { name: true } } } }),
  ]);
  if (!partner) notFound();
  return (
    <>
      <PageHeader title={`Editar ${partner.name}`} subtitle="Partners" />
      {error && <p className="mb-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <PartnerForm action={updatePartner.bind(null, id)} alliances={alliances} partner={partner} />
    </>
  );
}
