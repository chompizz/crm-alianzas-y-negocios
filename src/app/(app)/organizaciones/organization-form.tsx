import Link from "next/link";
import type { Country, Organization } from "@prisma/client";
import { CountryPicker } from "@/components/country-picker";
import { ORGANIZATION_TYPES } from "@/lib/labels";

type Props = {
  action: (fd: FormData) => Promise<void>;
  countries: Country[];
  organization?: Organization & { countries: Country[] };
  cancelHref: string;
};

export function OrganizationForm({ action, countries, organization, cancelHref }: Props) {
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Nombre *</span>
          <input name="name" required defaultValue={organization?.name} className="input" />
        </label>
        <label>
          <span className="label">Tipo</span>
          <select name="type" defaultValue={organization?.type ?? "EMPRESA"} className="input">
            {Object.entries(ORGANIZATION_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Sector</span>
          <input name="sector" defaultValue={organization?.sector ?? ""} className="input" placeholder="Energía, salud, retail..." />
        </label>
        <label>
          <span className="label">Sitio web</span>
          <input name="website" defaultValue={organization?.website ?? ""} className="input" placeholder="https://" />
        </label>
      </div>
      <div>
        <span className="label">Países donde opera</span>
        <CountryPicker countries={countries} selected={organization?.countries.map((c) => c.code) ?? []} />
      </div>
      <label className="block">
        <span className="label">Capacidades (separadas por coma)</span>
        <input name="capabilities" defaultValue={organization?.capabilities.join(", ")} className="input" placeholder="distribución, software, financiamiento" />
      </label>
      <label className="block">
        <span className="label">Etiquetas (separadas por coma)</span>
        <input name="tags" defaultValue={organization?.tags.join(", ")} className="input" />
      </label>
      <label className="block">
        <span className="label">Descripción</span>
        <textarea name="description" rows={3} defaultValue={organization?.description ?? ""} className="input" />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary">Guardar</button>
        <Link href={cancelHref} className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
