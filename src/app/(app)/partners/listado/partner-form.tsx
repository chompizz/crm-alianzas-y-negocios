import Link from "next/link";
import type { Country, ParticipantRole } from "@prisma/client";
import { CountryPicker } from "@/components/country-picker";
import { PARTICIPANT_ROLES } from "@/lib/labels";

type Alliance = { id: string; name: string; country: { name: string } };

// Alta y modificación de un partner: organización y alianzas en las que participa (con su rol).
export function PartnerForm({
  action,
  alliances,
  countries,
  organizations,
  partner,
  showAccount,
}: {
  action: (fd: FormData) => void | Promise<void>;
  alliances: Alliance[];
  countries?: Country[];
  organizations?: { id: string; name: string }[];
  partner?: { name: string; participations: { allianceId: string; roleType: ParticipantRole }[] };
  showAccount?: boolean;
}) {
  const current = new Map(partner?.participations.map((p) => [p.allianceId, p.roleType]));
  return (
    <form action={action} className="card max-w-3xl space-y-5">
      {partner ? (
        <label className="block">
          <span className="label">Nombre</span>
          <input name="name" required defaultValue={partner.name} className="input" />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Organización existente</span>
            <select name="organizationId" defaultValue="" className="input">
              <option value="">— Nueva organización —</option>
              {organizations?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">O nombre de una nueva</span>
            <input name="newName" placeholder="Ej.: Xertica" className="input" />
          </label>
          {countries && (
            <div className="sm:col-span-2">
              <span className="label">Países (si es nueva)</span>
              <CountryPicker countries={countries} selected={[]} />
            </div>
          )}
        </div>
      )}

      <div>
        <span className="label">Alianzas en las que participa</span>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {alliances.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="alliances" value={a.id} defaultChecked={current.has(a.id)} />
                {a.name} <span className="text-slate-500">· {a.country.name}</span>
              </label>
              <select name={`role_${a.id}`} defaultValue={current.get(a.id) ?? "SOCIO"} className="input max-w-[14rem] py-1">
                {Object.entries(PARTICIPANT_ROLES)
                  .filter(([v]) => v !== "CLIENTE")
                  .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          {alliances.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Todavía no hay alianzas.</p>}
        </div>
        <p className="mt-1 text-xs text-slate-500">En el portal, el partner solo ve estas alianzas.</p>
      </div>

      {showAccount && (
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Primera cuenta de acceso al portal (opcional)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="label">Nombre</span><input name="accountName" className="input" /></label>
            <label className="block"><span className="label">Email</span><input name="accountEmail" type="email" className="input" /></label>
            <label className="block"><span className="label">Contraseña inicial</span><input name="accountPassword" type="password" minLength={8} autoComplete="new-password" className="input" /></label>
          </div>
        </fieldset>
      )}

      <div className="flex gap-2">
        <button className="btn-primary">{partner ? "Guardar" : "Crear partner"}</button>
        <Link href="/partners/listado" className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
