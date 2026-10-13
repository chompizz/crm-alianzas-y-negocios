"use server";

import { redirect } from "next/navigation";
import { str } from "@/lib/forms";
import { addClient } from "../alianzas/actions";

// Alta desde la página Clientes: igual que desde la alianza, pero eligiendo la alianza en el formulario.
export async function createClient(fd: FormData) {
  const allianceId = str(fd, "allianceId");
  if (!allianceId) throw new Error("Elegí una alianza");
  if (!str(fd, "organizationId") && !str(fd, "newName")) throw new Error("Elegí o escribí el cliente");
  await addClient(allianceId, fd);
  redirect("/clientes?ok=1");
}
