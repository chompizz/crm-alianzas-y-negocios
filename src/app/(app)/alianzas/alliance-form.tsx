import Link from "next/link";
import type { Alliance, Country, User } from "@prisma/client";
import { DimensionSelect } from "@/components/dimension-select";
import { OwnersPicker } from "@/components/owners-picker";
import { dateInput } from "@/lib/format";
import { ALLIANCE_STAGES, ALLIANCE_TYPES, HEALTH } from "@/lib/labels";

type OrgOption = { id: string; name: string; countries: { name: string }[] };

type Props = {
  action: (fd: FormData) => Promise<void>;
  countries: Country[];
  users: Pick<User, "id" | "name">[];
  alliance?: Alliance & { owners?: { id: string }[] };
  // Solo al crear: elegir organizaciones participantes de entrada.
  organizations?: OrgOption[];
  defaultCountry?: string;
  cancelHref: string;
};

export function AllianceForm({ action, countries, users, alliance, organizations, defaultCountry, cancelHref }: Props) {
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">Nombre *</span>
          <input name="name" required defaultValue={alliance?.name} className="input" placeholder="Ej.: Distribución solar Perú" />
        </label>
        <label>
          <span className="label">País *</span>
          <select name="countryCode" required defaultValue={alliance?.countryCode ?? defaultCountry ?? ""} className="input">
            <option value="" disabled>Elegir...</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Tipo</span>
          <select name="type" defaultValue={alliance?.type ?? "COMERCIAL"} className="input">
            {Object.entries(ALLIANCE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <DimensionSelect defaultValue={alliance?.dimension ?? "ESTRATEGIA"} />
        <label>
          <span className="label">Etapa</span>
          <select name="stage" defaultValue={alliance?.stage ?? "EXPLORACION"} className="input">
            {Object.entries(ALLIANCE_STAGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Salud</span>
          <select name="health" defaultValue={alliance?.health ?? "VERDE"} className="input">
            {Object.entries(HEALTH).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <OwnersPicker users={users} defaultValue={alliance?.owners?.map((o) => o.id)} />
        <label>
          <span className="label">Valor esperado (USD)</span>
          <input name="expectedValue" inputMode="decimal" defaultValue={alliance?.expectedValue?.toString() ?? ""} className="input" />
        </label>
        <label>
          <span className="label">Inicio</span>
          <input name="startDate" type="date" defaultValue={dateInput(alliance?.startDate)} className="input" />
        </label>
        <label>
          <span className="label">Renovación</span>
          <input name="renewalDate" type="date" defaultValue={dateInput(alliance?.renewalDate)} className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label">Objetivos</span>
        <textarea name="objectives" rows={3} defaultValue={alliance?.objectives ?? ""} className="input" />
      </label>
      {organizations && (
        <div>
          <span className="label">Organizaciones participantes</span>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-slate-300 bg-white p-2 sm:grid-cols-2">
            {organizations.map((o) => (
              <label key={o.id} className="flex items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
                <input type="checkbox" name="organizations" value={o.id} className="mt-1" />
                <span>
                  {o.name}
                  {o.countries.length > 0 && <span className="block text-xs text-slate-400">{o.countries.map((c) => c.name).join(", ")}</span>}
                </span>
              </label>
            ))}
            {organizations.length === 0 && <p className="text-sm text-slate-500">Primero cargá organizaciones.</p>}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn-primary">Guardar</button>
        <Link href={cancelHref} className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
