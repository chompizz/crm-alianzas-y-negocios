"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartner } from "@/auth";
import { db } from "@/lib/db";
import { parseDate } from "@/lib/format";
import { str } from "@/lib/forms";
import { createRegistration, deleteOwnRegistration, updateRegistration, type RegistrationInput } from "@/lib/partners";

function readForm(fd: FormData): RegistrationInput {
  return {
    allianceId: str(fd, "allianceId") ?? "",
    title: str(fd, "title") ?? "",
    clientName: str(fd, "clientName") ?? "",
    clientCountryCode: str(fd, "clientCountryCode"),
    clientContact: str(fd, "clientContact"),
    clientEmail: str(fd, "clientEmail"),
    estimatedValue: str(fd, "estimatedValue"),
    expectedCloseDate: parseDate(str(fd, "expectedCloseDate")),
    notes: str(fd, "notes"),
  };
}

const message = (e: unknown) => encodeURIComponent(e instanceof Error ? e.message : "No se pudo guardar");

export async function registerOpportunity(fd: FormData) {
  const partner = await requirePartner();
  try {
    await createRegistration(partner, readForm(fd));
  } catch (e) {
    redirect(`/portal/registrar?error=${message(e)}`);
  }
  revalidatePath("/portal");
  redirect("/portal?ok=registrada");
}

export async function editRegistration(id: string, fd: FormData) {
  const partner = await requirePartner();
  try {
    await updateRegistration(partner, id, readForm(fd));
  } catch (e) {
    redirect(`/portal/registros/${id}/editar?error=${message(e)}`);
  }
  revalidatePath("/portal");
  redirect("/portal?ok=guardada");
}

export async function removeRegistration(id: string) {
  const partner = await requirePartner();
  await deleteOwnRegistration(partner, id);
  revalidatePath("/portal");
}

export async function changePassword(fd: FormData) {
  const partner = await requirePartner();
  const current = str(fd, "current") ?? "";
  const next = str(fd, "password") ?? "";
  const user = await db.user.findUniqueOrThrow({ where: { id: partner.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(current, user.passwordHash))) redirect(`/portal/cuenta?error=${encodeURIComponent("La contraseña actual no es correcta")}`);
  if (next.length < 8) redirect(`/portal/cuenta?error=${encodeURIComponent("La nueva contraseña debe tener 8 caracteres o más")}`);
  if (next !== str(fd, "confirm")) redirect(`/portal/cuenta?error=${encodeURIComponent("Las contraseñas nuevas no coinciden")}`);
  await db.user.update({ where: { id: partner.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  redirect("/portal/cuenta?ok=1");
}
