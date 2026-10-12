import { PageHeader } from "@/components/page-header";
import { createInitiative } from "../actions";
import { InitiativeForm } from "../initiative-form";
import { initiativeFormOptions } from "../options";

export default async function NewInitiativePage() {
  const [users, alliances, organizations] = await initiativeFormOptions();
  return (
    <>
      <PageHeader title="Nueva iniciativa" />
      <InitiativeForm action={createInitiative} users={users} alliances={alliances} organizations={organizations} cancelHref="/iniciativas" />
    </>
  );
}
