import Link from "next/link";
import type { Initiative, User } from "@prisma/client";
import { DimensionSelect } from "@/components/dimension-select";
import { OwnersPicker } from "@/components/owners-picker";

type Props = {
  action: (fd: FormData) => Promise<void>;
  users: Pick<User, "id" | "name">[];
  alliances: { id: string; name: string; country: { name: string } }[];
  organizations: { id: string; name: string }[];
  initiative?: Initiative & { alliances: { id: string }[]; organizations: { id: string }[]; owners: { id: string }[] };
  cancelHref: string;
};

export function InitiativeForm({ action, users, alliances, organizations, initiative, cancelHref }: Props) {
  const selectedAlliances = initiative?.alliances.map((a) => a.id) ?? [];
  const selectedOrgs = initiative?.organizations.map((o) => o.id) ?? [];
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">Nombre *</span>
          <input name="name" required defaultValue={initiative?.name} className="input" />
        </label>
        <DimensionSelect defaultValue={initiative?.dimension ?? "ESTRATEGIA"} />
        <OwnersPicker users={users} defaultValue={initiative?.owners.map((o) => o.id)} />
      </div>
      <label className="block">
        <span className="label">Objetivo estratégico</span>
        <textarea name="objective" rows={3} defaultValue={initiative?.objective ?? ""} className="input" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="label">Alianzas que la impulsan</span>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
            {alliances.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="alliances" value={a.id} defaultChecked={selectedAlliances.includes(a.id)} />
                {a.name} <span className="text-xs text-slate-400">({a.country.name})</span>
              </label>
            ))}
            {alliances.length === 0 && <p className="text-sm text-slate-500">Sin alianzas cargadas.</p>}
          </div>
        </div>
        <div>
          <span className="label">Organizaciones involucradas</span>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
            {organizations.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="organizations" value={o.id} defaultChecked={selectedOrgs.includes(o.id)} />
                {o.name}
              </label>
            ))}
            {organizations.length === 0 && <p className="text-sm text-slate-500">Sin organizaciones cargadas.</p>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary">Guardar</button>
        <Link href={cancelHref} className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
