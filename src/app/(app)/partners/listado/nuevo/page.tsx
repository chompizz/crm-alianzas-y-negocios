import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { createPartner } from "../../actions";
import { PartnerForm } from "../partner-form";

export default async function NewPartnerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth();
  const [alliances, countries, organizations] = await Promise.all([
    db.alliance.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, country: { select: { name: true } } } }),
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Nuevo partner" subtitle="Partners" />
      {error && <p className="mb-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <PartnerForm
        action={createPartner}
        alliances={alliances}
        countries={countries}
        organizations={organizations}
        showAccount={session?.user?.role === "ADMIN"}
      />
    </>
  );
}
