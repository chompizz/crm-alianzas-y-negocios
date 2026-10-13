import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { partnerAccount, partnerOrganizations } from "@/lib/partners";
import { updateAccount } from "../../../actions";

export default async function EditPartnerAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/partners/cuentas");
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const account = await partnerAccount(id).catch(() => null);
  if (!account) notFound();
  const organizations = await partnerOrganizations();

  return (
    <>
      <PageHeader title={`Editar cuenta de ${account.name}`} subtitle="Cuenta de partner" />
      {error && <p className="mb-4 max-w-xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form action={updateAccount.bind(null, account.id)} className="card max-w-xl space-y-4">
        <label className="block">
          <span className="label">Partner</span>
          <select name="organizationId" defaultValue={account.organizationId ?? ""} className="input">
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Nombre</span><input name="name" required defaultValue={account.name} className="input" /></label>
        <label className="block"><span className="label">Email</span><input name="email" type="email" required defaultValue={account.email} className="input" /></label>
        <label className="block">
          <span className="label">Nueva contraseña</span>
          <input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Dejala vacía para no cambiarla" className="input" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={account.active} /> Cuenta activa (puede entrar al portal)
        </label>
        <div className="flex gap-2">
          <button className="btn-primary">Guardar</button>
          <Link href="/partners/cuentas" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
