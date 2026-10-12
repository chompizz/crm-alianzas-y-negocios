import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nexo</h1>
          <p className="text-sm text-slate-500">Gestión de alianzas y negocios</p>
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
