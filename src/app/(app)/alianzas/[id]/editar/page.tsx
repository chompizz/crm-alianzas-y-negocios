import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { updateAlliance } from "../../actions";
import { AllianceForm } from "../../alliance-form";

export default async function EditAlliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [alliance, countries, users] = await Promise.all([
    db.alliance.findUnique({ where: { id }, include: { owners: { select: { id: true } } } }),
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!alliance) notFound();
  return (
    <>
      <PageHeader title={`Editar ${alliance.name}`} />
      <AllianceForm
        action={updateAlliance.bind(null, id)}
        countries={countries}
        users={users}
        alliance={alliance}
        cancelHref={`/alianzas/${id}`}
      />
    </>
  );
}
