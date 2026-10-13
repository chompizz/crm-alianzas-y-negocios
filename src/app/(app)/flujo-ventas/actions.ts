"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { oneOf, str } from "@/lib/forms";
import { parseDate } from "@/lib/format";
import { CLIENT_STATUSES } from "@/lib/labels";
import { convertInitiative, convertOpportunity } from "@/lib/sales-flow";

const money = (v: string | null) => (v ? v.replace(/[^\d.]/g, "") || null : null);

function refresh() {
  for (const p of ["/flujo-ventas", "/", "/oportunidades", "/clientes", "/iniciativas"]) revalidatePath(p);
}

export async function initiativeToOpportunity(fd: FormData) {
  const user = await requireUser();
  const probability = str(fd, "probability");
  await convertInitiative({
    initiativeId: str(fd, "initiativeId")!,
    allianceId: str(fd, "allianceId")!,
    title: str(fd, "title"),
    value: money(str(fd, "value")),
    probability: probability ? Math.max(0, Math.min(100, Number(probability))) : null,
  }, user);
  refresh();
}

export async function opportunityToClient(fd: FormData) {
  const user = await requireUser();
  await convertOpportunity({
    opportunityId: str(fd, "opportunityId")!,
    organizationId: str(fd, "organizationId"),
    newName: str(fd, "newName"),
    status: oneOf(fd, "status", CLIENT_STATUSES, "ACTIVO"),
    revenue: money(str(fd, "revenue")),
    since: parseDate(str(fd, "since")),
  }, user);
  refresh();
}
