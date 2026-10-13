"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { str } from "@/lib/forms";
import {
  approveRegistration,
  createPartnerAccount,
  deletePartnerAccount,
  rejectRegistration,
  updatePartnerAccount,
} from "@/lib/partners";

const message = (e: unknown) => encodeURIComponent(e instanceof Error ? e.message : "No se pudo guardar");

function revalidate() {
  revalidatePath("/partners");
  revalidatePath("/oportunidades");
  revalidatePath("/");
}

// ---------- Bandeja de registros (cualquier persona del equipo) ----------

export async function approve(id: string, fd: FormData) {
  const user = await requireUser();
  const prob = str(fd, "probability");
  try {
    await approveRegistration(id, user, {
      title: str(fd, "title"),
      estimatedValue: str(fd, "estimatedValue"),
      probability: prob ? Number(prob) : null,
    });
  } catch (e) {
    redirect(`/partners/registros/${id}?error=${message(e)}`);
  }
  revalidate();
  redirect("/partners?ok=aprobada");
}

export async function reject(id: string, fd: FormData) {
  const user = await requireUser();
  try {
    await rejectRegistration(id, user, str(fd, "reason") ?? "");
  } catch (e) {
    redirect(`/partners/registros/${id}?error=${message(e)}`);
  }
  revalidate();
  redirect("/partners?ok=rechazada");
}

export async function deleteRegistration(id: string) {
  await requireUser();
  await db.dealRegistration.delete({ where: { id } });
  revalidatePath("/partners");
}

// ---------- Cuentas de partner (solo administradores) ----------

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/partners/cuentas");
  return user;
}

export async function createAccount(fd: FormData) {
  await requireAdmin();
  try {
    await createPartnerAccount({
      organizationId: str(fd, "organizationId"),
      name: str(fd, "name"),
      email: str(fd, "email"),
      password: str(fd, "password"),
    });
  } catch (e) {
    redirect(`/partners/cuentas?error=${message(e)}`);
  }
  revalidatePath("/partners/cuentas");
  redirect("/partners/cuentas?ok=creada");
}

export async function updateAccount(id: string, fd: FormData) {
  await requireAdmin();
  try {
    await updatePartnerAccount(id, {
      organizationId: str(fd, "organizationId"),
      name: str(fd, "name"),
      email: str(fd, "email"),
      password: str(fd, "password"),
      active: fd.get("active") === "on",
    });
  } catch (e) {
    redirect(`/partners/cuentas/${id}/editar?error=${message(e)}`);
  }
  revalidatePath("/partners/cuentas");
  redirect("/partners/cuentas?ok=guardada");
}

export async function setAccountActive(id: string, active: boolean) {
  await requireAdmin();
  await updatePartnerAccount(id, { active });
  revalidatePath("/partners/cuentas");
}

export async function deleteAccount(id: string) {
  await requireAdmin();
  await deletePartnerAccount(id);
  revalidatePath("/partners/cuentas");
}
