import type { NextAuthConfig } from "next-auth";

// Configuración apta para el middleware (sin base de datos ni bcrypt).
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // Los partners solo entran al portal; el equipo interno no usa el portal.
    authorized({ auth, request }) {
      if (!auth?.user) return false;
      const path = request.nextUrl.pathname;
      const inPortal = path === "/portal" || path.startsWith("/portal/");
      const isPartner = (auth.user as { role?: string }).role === "PARTNER";
      if (isPartner && !inPortal) return Response.redirect(new URL("/portal", request.nextUrl));
      if (!isPartner && inPortal) return Response.redirect(new URL("/", request.nextUrl));
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
