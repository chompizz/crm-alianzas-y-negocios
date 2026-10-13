import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const PREFIX = "nexo_";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueToken(userId: string, name: string) {
  const token = PREFIX + randomBytes(24).toString("base64url");
  await db.apiToken.create({
    data: { userId, name, tokenHash: hashToken(token), prefix: token.slice(0, PREFIX.length + 6) },
  });
  return token;
}

// Devuelve el usuario dueño de un token vigente, o null.
export async function userForToken(token: string | null | undefined) {
  if (!token || !token.startsWith(PREFIX)) return null;
  const record = await db.apiToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!record || record.revokedAt || !record.user.active || record.user.role === "PARTNER") return null;
  await db.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return record.user;
}
