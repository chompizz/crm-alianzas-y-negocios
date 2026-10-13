import Link from "next/link";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/row-actions";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { partnerOrganizations } from "@/lib/partners";
import { createAccount, deleteAccount, setAccountActive } from "../actions";
import { PartnerTabs } from "../tabs";

const OK = { creada: "Cuenta creada. Pasale al partner su email y la contraseña inicial por un canal seguro.", guardada: "Cambios guardados." };

// Cuentas de acceso al portal de partners. Las gestiona un administrador.
export default async function PartnerAccountsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const [accounts, organizations, pending] = await Promise.all([
    db.user.findMany({
      where: { role: "PARTNER" },
      orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
      include: { organization: { select: { id: true, name: true } }, _count: { select: { registrations: true } } },
    }),
    partnerOrganizations(),
    db.dealRegistration.count({ where: { status: "PENDIENTE" } }),
  ]);

  return (
    <>
      <PageHeader title="Partners" subtitle="Cuentas de acceso al portal de partners" />
      <PartnerTabs active="cuentas" pending={pending} />
      {ok && ok in OK && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{OK[ok as keyof typeof OK]}</p>}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="card mb-6 overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Partner</th><th>Persona</th><th>Email</th><th className="text-right">Registros</th><th>Alta</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {accounts.map((u) => (
              <tr key={u.id}>
                <td>{u.organization ? <Link href={`/organizaciones/${u.organization.id}`} className="hover:underline">{u.organization.name}</Link> : "—"}</td>
                <td className="font-medium">{u.name}</td>
                <td>{u.email}</td>
                <td className="text-right">{u._count.registrations}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>
                  {u.active ? (
                    <span className="chip border-emerald-400/40 bg-emerald-500/10 text-emerald-300">Activa</span>
                  ) : (
                    <span className="chip border-slate-300 bg-slate-100 text-slate-500">Desactivada</span>
                  )}
                </td>
                <td>
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-1">
                      <form action={setAccountActive.bind(null, u.id, !u.active)}>
                        <button className="text-xs text-slate-500 hover:text-slate-800">{u.active ? "Desactivar" : "Activar"}</button>
                      </form>
                      <RowActions
                        editHref={`/partners/cuentas/${u.id}/editar`}
                        deleteAction={deleteAccount.bind(null, u.id)}
                        confirm={`¿Eliminar la cuenta de ${u.name}? Sus registros se mantienen.`}
                        label={u.name}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Todavía no hay cuentas de partner.</td></tr>}
          </tbody>
        </table>
      </div>
      {isAdmin ? (
        <form action={createAccount} className="card max-w-3xl space-y-4">
          <h2 className="font-semibold">Nueva cuenta de partner</h2>
          <p className="text-sm text-slate-500">El partner solo verá las alianzas en las que participa su organización y las oportunidades que registre.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Partner</span>
              <select name="organizationId" required defaultValue="" className="input">
                <option value="" disabled>Elegí la organización</option>
                {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Nombre de la persona</span><input name="name" required className="input" /></label>
            <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
            <label className="block"><span className="label">Contraseña inicial</span><input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /></label>
          </div>
          <button className="btn-primary">Crear cuenta</button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Solo un administrador puede crear o cambiar cuentas de partner.</p>
      )}
    </>
  );
}
