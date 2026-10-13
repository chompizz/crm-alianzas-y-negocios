import { requirePartner } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { changePassword } from "../actions";

export default async function PortalAccount({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const partner = await requirePartner();
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={partner.organizationName} />
      <div className="card mb-4 max-w-md text-sm">
        <p className="font-medium text-slate-800">{partner.name}</p>
        <p className="text-slate-500">{partner.email}</p>
      </div>
      <form action={changePassword} className="card max-w-md space-y-4">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        {ok && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Contraseña actualizada.</p>}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block"><span className="label">Contraseña actual</span><input name="current" type="password" required className="input" /></label>
        <label className="block"><span className="label">Nueva contraseña</span><input name="password" type="password" required minLength={8} className="input" /></label>
        <label className="block"><span className="label">Repetir nueva contraseña</span><input name="confirm" type="password" required minLength={8} className="input" /></label>
        <button className="btn-primary">Guardar</button>
      </form>
    </>
  );
}
