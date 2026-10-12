import { requireUser } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { revokeToken } from "./actions";
import { NewTokenForm } from "./new-token-form";

export default async function ProfilePage() {
  const user = await requireUser();
  const tokens = await db.apiToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader title="Mi perfil" subtitle={`${user.name ?? ""} · ${user.email ?? ""}`} />
      <section className="card max-w-3xl space-y-4">
        <div>
          <h2 className="font-semibold">Conectar con Claude</h2>
          <p className="mt-1 text-sm text-slate-600">
            Generá un conector para usar Nexo desde tu cuenta de Claude: consultar alianzas y compromisos, registrar
            reuniones o crear organizaciones conversando. Claude actúa con tu usuario, y podés revocar el acceso cuando quieras.
          </p>
        </div>
        <NewTokenForm />
        <table className="table">
          <thead><tr><th>Nombre</th><th>Inicio</th><th>Creado</th><th>Último uso</th><th></th></tr></thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className={t.revokedAt ? "text-slate-400" : ""}>
                <td>{t.name}</td>
                <td className="font-mono text-xs">{t.prefix}…</td>
                <td>{fmtDate(t.createdAt)}</td>
                <td>{t.lastUsedAt ? fmtDate(t.lastUsedAt) : "Nunca"}</td>
                <td className="text-right">
                  {t.revokedAt ? (
                    "Revocado"
                  ) : (
                    <form action={revokeToken.bind(null, t.id)}>
                      <button className="text-xs text-red-600 hover:underline">Revocar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {tokens.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Todavía no generaste conectores.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
