import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { db } from "@/lib/db";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    // Los partners van directo a su portal.
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const account = email ? await db.user.findUnique({ where: { email }, select: { role: true } }) : null;
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: account?.role === "PARTNER" ? "/portal" : "/",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={login} className="card w-full max-w-sm space-y-4 p-8">
        <div>
          <h1 className="neon-text text-3xl font-bold tracking-[0.2em]">NEXO</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">Alianzas · Estrategia · Negocios</p>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Email o contraseña incorrectos.</p>}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input name="email" type="email" required className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Contraseña</span>
          <input name="password" type="password" required className="input mt-1" />
        </label>
        <button className="btn-primary w-full">Ingresar</button>
      </form>
    </main>
  );
}
