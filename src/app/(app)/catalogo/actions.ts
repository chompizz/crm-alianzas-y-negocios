"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { all, oneOf, str } from "@/lib/forms";
import { OFFERING_KINDS } from "@/lib/labels";

type Target = "organizacion" | "alianza";
const path = (target: Target, id: string) => (target === "organizacion" ? `/organizaciones/${id}` : `/alianzas/${id}`);

function readOffering(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre es obligatorio");
  return { name, kind: oneOf(fd, "kind", OFFERING_KINDS, "PRODUCTO"), description: str(fd, "description") };
}

export async function createOffering(fd: FormData) {
  await requireUser();
  const o = await db.offering.create({ data: readOffering(fd) });
  revalidatePath("/catalogo");
  redirect(`/catalogo/${o.id}`);
}

export async function updateOffering(id: string, fd: FormData) {
  await requireUser();
  await db.offering.update({
    where: { id },
    data: {
      ...readOffering(fd),
      organizations: { set: all(fd, "organizations").map((oid) => ({ id: oid })) },
      alliances: { set: all(fd, "alliances").map((aid) => ({ id: aid })) },
    },
  });
  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function deleteOffering(id: string) {
  await requireUser();
  await db.offering.delete({ where: { id } });
  revalidatePath("/catalogo");
  redirect("/catalogo");
}

// Asigna un ítem existente o, si se escribe un nombre nuevo, lo crea y lo asigna.
export async function assignOffering(target: Target, targetId: string, fd: FormData) {
  await requireUser();
  const relation = target === "organizacion" ? { organizations: { connect: { id: targetId } } } : { alliances: { connect: { id: targetId } } };
  const existing = str(fd, "offeringId");
  const newName = str(fd, "newName");
  if (existing) {
    await db.offering.update({ where: { id: existing }, data: relation });
  } else if (newName) {
    await db.offering.create({ data: { name: newName, kind: oneOf(fd, "kind", OFFERING_KINDS, "PRODUCTO"), ...relation } });
  }
  revalidatePath(path(target, targetId));
  revalidatePath("/catalogo");
}

export async function unassignOffering(target: Target, targetId: string, offeringId: string) {
  await requireUser();
  await db.offering.update({
    where: { id: offeringId },
    data: target === "organizacion" ? { organizations: { disconnect: { id: targetId } } } : { alliances: { disconnect: { id: targetId } } },
  });
  revalidatePath(path(target, targetId));
  revalidatePath("/catalogo");
}
