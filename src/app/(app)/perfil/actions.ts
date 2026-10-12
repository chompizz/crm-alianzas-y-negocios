"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/auth";
import { issueToken } from "@/lib/api-tokens";
import { db } from "@/lib/db";
import { str } from "@/lib/forms";

export type NewTokenState = { url?: string; error?: string };

export async function createToken(_prev: NewTokenState, fd: FormData): Promise<NewTokenState> {
  const user = await requireUser();
  const name = str(fd, "name") ?? "Claude";
  const token = await issueToken(user.id, name);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  revalidatePath("/perfil");
  return { url: `${proto}://${host}/api/mcp/${token}` };
}

export async function revokeToken(id: string) {
  const user = await requireUser();
  // Solo el dueño puede revocar su token.
  await db.apiToken.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/perfil");
}
