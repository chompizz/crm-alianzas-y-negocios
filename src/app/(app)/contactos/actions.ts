"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { oneOf, str } from "@/lib/forms";
import { RELATIONSHIP_LEVELS } from "@/lib/labels";

function readContact(fd: FormData) {
  const name = str(fd, "name");
  const organizationId = str(fd, "organizationId");
  if (!name || !organizationId) throw new Error("Nombre y organización son obligatorios");
  return {
    name,
    organizationId,
    position: str(fd, "position"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    countryCode: str(fd, "countryCode"),
    relationshipLevel: oneOf(fd, "relationshipLevel", RELATIONSHIP_LEVELS, "TIBIA"),
    notes: str(fd, "notes"),
  };
}

export async function createContact(fd: FormData) {
  await requireUser();
  const data = readContact(fd);
  await db.contact.create({ data });
  revalidatePath("/contactos");
  redirect(`/organizaciones/${data.organizationId}`);
}

export async function updateContact(id: string, fd: FormData) {
  await requireUser();
  const data = readContact(fd);
  await db.contact.update({ where: { id }, data });
  revalidatePath("/contactos");
  redirect(`/organizaciones/${data.organizationId}`);
}

export async function deleteContact(id: string) {
  await requireUser();
  const contact = await db.contact.delete({ where: { id } });
  revalidatePath("/contactos");
  redirect(`/organizaciones/${contact.organizationId}`);
}
