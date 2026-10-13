import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = z
          .object({ email: z.string().trim().email(), password: z.string().min(1) })
          .safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});

// Usuario interno activo (las cuentas de partner no pueden usar las acciones internas).
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, active: true } });
  if (!user || !user.active || user.role === "PARTNER") throw new Error("No autorizado");
  return user as { id: string; name: string; email: string; role: string };
}

// Cuenta de partner activa, con la organización partner a la que pertenece.
export async function requirePartner() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true, organizationId: true, organization: { select: { id: true, name: true } } },
  });
  if (!user || !user.active || user.role !== "PARTNER" || !user.organization) throw new Error("No autorizado");
  return { id: user.id, name: user.name, email: user.email, organizationId: user.organization.id, organizationName: user.organization.name };
}
