import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { oneOf, str } from "@/lib/forms";
import { ROLES } from "@/lib/labels";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");
  return session.user;
}

async function createUser(fd: FormData) {
  "use server";
  await requireAdmin();
  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase();
  const password = str(fd, "password");
  if (!name || !email || !password || password.length < 8) throw new Error("Datos incompletos (la contraseña debe tener al menos 8 caracteres)");
  await db.user.create({
    data: { name, email, role: oneOf(fd, "role", ROLES, "MEMBER"), passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/usuarios");
}

async function deleteUser(id: string) {
  "use server";
  const me = await requireAdmin();
  if (me.id === id) throw new Error("No podés eliminar tu propio usuario");
  await db.user.delete({ where: { id } });
  revalidatePath("/usuarios");
}

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Personas del equipo con acceso a Nexo" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto p-0 lg:col-span-2">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{ROLES[u.role]}</td>
                  <td className="text-right">
                    {u.id !== me.id && (
                      <form action={deleteUser.bind(null, u.id)}>
                        <button className="text-xs text-red-600 hover:underline">Eliminar</button>
                      </form>
                    )}
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
