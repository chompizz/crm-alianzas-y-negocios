import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { createAlliance } from "../actions";
import { AllianceForm } from "../alliance-form";

export default async function NewAlliancePage({ searchParams }: { searchParams: Promise<{ pais?: string }> }) {
  const { pais } = await searchParams;
  const [countries, users, organizations] = await Promise.all([
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, countries: { select: { name: true }, orderBy: { name: "asc" } } },
    }),
  ]);
  return (
    <>
      <PageHeader title="Nueva alianza" />
      <AllianceForm
        action={createAlliance}
        countries={countries}
        users={users}
        organizations={organizations}
        defaultCountry={pais}
        cancelHref="/alianzas"
      />
    </>
  );
}
