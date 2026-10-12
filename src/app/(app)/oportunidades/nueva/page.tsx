import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { createOpportunity } from "../actions";
import { OpportunityForm } from "../opportunity-form";

export default async function NewOpportunityPage({ searchParams }: { searchParams: Promise<{ alianza?: string }> }) {
  const { alianza } = await searchParams;
  const alliances = await db.alliance.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, country: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="Nueva oportunidad" />
      <OpportunityForm
        action={createOpportunity}
        alliances={alliances}
        defaultAllianceId={alianza}
        cancelHref={alianza ? `/alianzas/${alianza}` : "/oportunidades"}
      />
    </>
  );
}
