"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { oneOf, str } from "@/lib/forms";
import { ROLES } from "@/lib/labels";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");
  return session.user;
}

async function emailTaken(email: string, exceptId?: string) {
  const other = await db.user.findUnique({ where: { email } });
  return !!other && other.id !== exceptId;
}

export async function createUser(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase();
  const password = str(fd, "password");
  if (!name || !email || !password || password.length < 8) redirect("/usuarios?error=datos");
  if (await emailTaken(email)) redirect("/usuarios?error=email");
  await db.user.create({
    data: { name, email, role: oneOf(fd, "role", ROLES, "MEMBER"), passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/usuarios");
  redirect("/usuarios?ok=creado");
}

export async function updateUser(id: string, fd: FormData) {
  const me = await requireAdmin();
  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase();
  const password = str(fd, "password");
  const back = `/usuarios/${id}/editar`;
  if (!name || !email) redirect(`${back}?error=datos`);
  if (password && password.length < 8) redirect(`${back}?error=password`);
  if (await emailTaken(email, id)) redirect(`${back}?error=email`);
  // Un admin no puede quitarse su propio rol: evita quedarse sin administradores.
  const role = me.id === id ? "ADMIN" : oneOf(fd, "role", ROLES, "MEMBER");
  await db.user.update({
    where: { id },
    data: { name, email, role, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
  });
  revalidatePath("/usuarios");
  redirect("/usuarios?ok=actualizado");
}

export async function deleteUser(id: string) {
  const me = await requireAdmin();
  if (me.id === id) redirect("/usuarios");
  // Las alianzas, iniciativas, compromisos e interacciones del usuario quedan sin responsable; no se borran.
  await db.user.delete({ where: { id } });
  revalidatePath("/usuarios");
  redirect("/usuarios?ok=eliminado");
}
