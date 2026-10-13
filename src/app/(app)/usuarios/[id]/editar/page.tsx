import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/labels";
import { updateUser } from "../../actions";

const ERRORS: Record<string, string> = {
  datos: "Completá nombre y email.",
  password: "La nueva contraseña debe tener al menos 8 caracteres.",
  email: "Ya existe otro usuario con ese email.",
};

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");
  const { id } = await params;
  const { error } = await searchParams;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  if (user.role === "PARTNER") redirect(`/partners/cuentas/${id}/editar`);
  const isMe = session.user.id === id;

  return (
    <>
      <PageHeader title={`Editar ${user.name}`} />
      <form action={updateUser.bind(null, id)} className="card max-w-lg space-y-3">
        {error && ERRORS[error] && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{ERRORS[error]}</p>}
        <label className="block"><span className="label">Nombre</span><input name="name" defaultValue={user.name} required className="input" /></label>
        <label className="block"><span className="label">Email</span><input name="email" type="email" defaultValue={user.email} required className="input" /></label>
        <label className="block">
          <span className="label">Rol</span>
          <select name="role" defaultValue={user.role} disabled={isMe} className="input">
            {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {isMe && <span className="mt-1 block text-xs text-slate-500">No podés quitarte el rol de administrador.</span>}
        </label>
        <label className="block">
          <span className="label">Nueva contraseña</span>
          <input name="password" type="password" minLength={8} placeholder="Dejala vacía para no cambiarla" className="input" autoComplete="new-password" />
        </label>
        <div className="flex gap-2 pt-2">
          <button className="btn-primary">Guardar</button>
          <Link href="/usuarios" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
