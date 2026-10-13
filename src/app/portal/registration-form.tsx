import Link from "next/link";
import type { DealRegistration } from "@prisma/client";

type Alliance = { id: string; name: string; countryCode: string; country: { name: string } };
type Country = { code: string; name: string };

// Formulario del partner para registrar (o corregir) una oportunidad de cliente.
export function RegistrationForm({
  action,
  alliances,
  countries,
  registration,
  submitLabel,
}: {
  action: (fd: FormData) => void | Promise<void>;
  alliances: Alliance[];
  countries: Country[];
  registration?: DealRegistration | null;
  submitLabel: string;
}) {
  const r = registration;
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Alianza</span>
          <select name="allianceId" required defaultValue={r?.allianceId ?? (alliances.length === 1 ? alliances[0].id : "")} className="input">
            <option value="" disabled>Elegí la alianza</option>
            {alliances.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.country.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Cliente</span>
          <input name="clientName" required defaultValue={r?.clientName} placeholder="Nombre de la empresa" className="input" />
        </label>
        <label className="block">
          <span className="label">País del cliente</span>
          <select name="clientCountryCode" defaultValue={r?.clientCountryCode ?? ""} className="input">
            <option value="">Sin especificar</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Contacto en el cliente</span>
          <input name="clientContact" defaultValue={r?.clientContact ?? ""} placeholder="Nombre y cargo" className="input" />
        </label>
        <label className="block">
          <span className="label">Email del contacto</span>
          <input name="clientEmail" type="email" defaultValue={r?.clientEmail ?? ""} className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Oportunidad</span>
          <input name="title" required defaultValue={r?.title} placeholder="Qué necesita el cliente" className="input" />
        </label>
        <label className="block">
          <span className="label">Valor estimado (USD)</span>
          <input name="estimatedValue" inputMode="decimal" defaultValue={r?.estimatedValue?.toString() ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Fecha estimada de cierre</span>
          <input name="expectedCloseDate" type="date" defaultValue={r?.expectedCloseDate?.toISOString().slice(0, 10) ?? ""} className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Notas</span>
          <textarea name="notes" rows={3} defaultValue={r?.notes ?? ""} className="input" />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary">{submitLabel}</button>
        <Link href="/portal" className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
