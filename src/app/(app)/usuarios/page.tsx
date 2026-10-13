import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/labels";
import { createUser, deleteUser } from "./actions";
import { RowActions } from "@/components/row-actions";

const MESSAGES: Record<string, string> = {
  creado: "Usuario creado.",
  actualizado: "Usuario actualizado.",
  eliminado: "Usuario eliminado.",
};
const ERRORS: Record<string, string> = {
  datos: "Completá nombre, email y una contraseña de al menos 8 caracteres.",
  email: "Ya existe un usuario con ese email.",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");
  const me = session.user;
  const { ok, error } = await searchParams;
  const users = await db.user.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Personas del equipo con acceso a Nexo" />
      {ok && MESSAGES[ok] && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{MESSAGES[ok]}</p>}
      {error && ERRORS[error] && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{ERRORS[error]}</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto p-0 lg:col-span-2">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-slate-500">(vos)</span>}</td>
                  <td>{u.email}</td>
                  <td>{ROLES[u.role]}</td>
                  <td>
                    <RowActions
                      editHref={`/usuarios/${u.id}/editar`}
                      deleteAction={u.id !== me.id ? deleteUser.bind(null, u.id) : undefined}
                      confirm={`¿Eliminar a ${u.name}? Sus alianzas y compromisos quedarán sin responsable.`}
                      label={u.name}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createUser} className="card space-y-3">
          <h2 className="font-semibold">Nuevo usuario</h2>
          <label className="block"><span className="label">Nombre</span><input name="name" required className="input" /></label>
          <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
          <label className="block"><span className="label">Contraseña inicial</span><input name="password" type="password" minLength={8} required className="input" /></label>
          <label className="block">
            <span className="label">Rol</span>
            <select name="role" defaultValue="MEMBER" className="input">
              {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button className="btn-primary w-full">Crear usuario</button>
        </form>
      </div>
    </>
  );
}
