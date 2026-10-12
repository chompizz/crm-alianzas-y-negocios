import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
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
          <form action={deleteOpportunity.bind(null, id)}>
            <button className="btn-danger">Eliminar</button>
          </form>
        }
      />
      <OpportunityForm action={updateOpportunity.bind(null, id)} alliances={alliances} opportunity={opportunity} cancelHref="/oportunidades" />
    </>
  );
}
