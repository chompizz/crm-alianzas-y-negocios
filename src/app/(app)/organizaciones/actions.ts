"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { all, list, oneOf, str } from "@/lib/forms";
import { ORGANIZATION_TYPES } from "@/lib/labels";

function readOrganization(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre es obligatorio");
  return {
    name,
    type: oneOf(fd, "type", ORGANIZATION_TYPES, "EMPRESA"),
    sector: str(fd, "sector"),
    website: str(fd, "website"),
    description: str(fd, "description"),
    capabilities: list(fd, "capabilities"),
    tags: list(fd, "tags"),
    countryCodes: all(fd, "countries"),
  };
}

export async function createOrganization(fd: FormData) {
  await requireUser();
  const { countryCodes, ...data } = readOrganization(fd);
  const org = await db.organization.create({
    data: { ...data, countries: { connect: countryCodes.map((code) => ({ code })) } },
  });
  revalidatePath("/organizaciones");
  redirect(`/organizaciones/${org.id}`);
}

export async function updateOrganization(id: string, fd: FormData) {
  await requireUser();
  const { countryCodes, ...data } = readOrganization(fd);
  await db.organization.update({
    where: { id },
    data: { ...data, countries: { set: countryCodes.map((code) => ({ code })) } },
  });
  revalidatePath("/organizaciones");
  redirect(`/organizaciones/${id}`);
}

export async function deleteOrganization(id: string) {
  await requireUser();
  await db.organization.delete({ where: { id } });
  revalidatePath("/organizaciones");
  redirect("/organizaciones");
}
