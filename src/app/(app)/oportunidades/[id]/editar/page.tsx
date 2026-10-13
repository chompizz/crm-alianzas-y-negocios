import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/row-actions";
import { db } from "@/lib/db";
import { deleteOpportunity, updateOpportunity } from "../../actions";
import { OpportunityForm } from "../../opportunity-form";

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opportunity, alliances] = await Promise.all([
    db.opportunity.findUnique({ where: { id } }),
    db.alliance.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, country: { select: { name: true } } } }),
  ]);
  if (!opportunity) notFound();
  return (
    <>
      <PageHeader
        title={opportunity.title}
        actions={
          <DeleteButton action={deleteOpportunity.bind(null, id, "/oportunidades")} confirm={`¿Eliminar la oportunidad "${opportunity.title}"?`} label="oportunidad" variant="button" />
        }
      />
      <OpportunityForm action={updateOpportunity.bind(null, id)} alliances={alliances} opportunity={opportunity} cancelHref="/oportunidades" />
    </>
  );
}
