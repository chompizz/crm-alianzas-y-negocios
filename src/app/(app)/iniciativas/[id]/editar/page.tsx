import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { updateInitiative } from "../../actions";
import { InitiativeForm } from "../../initiative-form";
import { initiativeFormOptions } from "../../options";

export default async function EditInitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [initiative, [users, alliances, organizations]] = await Promise.all([
    db.initiative.findUnique({
      where: { id },
      include: { alliances: { select: { id: true } }, organizations: { select: { id: true } } },
    }),
    initiativeFormOptions(),
  ]);
  if (!initiative) notFound();
  return (
    <>
      <PageHeader title={`Editar ${initiative.name}`} />
      <InitiativeForm
        action={updateInitiative.bind(null, id)}
        users={users}
        alliances={alliances}
        organizations={organizations}
        initiative={initiative}
        cancelHref={`/iniciativas/${id}`}
      />
    </>
  );
}
