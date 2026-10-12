import Link from "next/link";
import type { Contact, Country, Organization } from "@prisma/client";
import { RELATIONSHIP_LEVELS } from "@/lib/labels";

type Props = {
  action: (fd: FormData) => Promise<void>;
  countries: Country[];
  organizations: Pick<Organization, "id" | "name">[];
  contact?: Contact;
  defaultOrganizationId?: string;
  cancelHref: string;
};

export function ContactForm({ action, countries, organizations, contact, defaultOrganizationId, cancelHref }: Props) {
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Nombre *</span>
          <input name="name" required defaultValue={contact?.name} className="input" />
        </label>
        <label>
          <span className="label">Organización *</span>
          <select name="organizationId" required defaultValue={contact?.organizationId ?? defaultOrganizationId ?? ""} className="input">
            <option value="" disabled>Elegir...</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Cargo</span>
          <input name="position" defaultValue={contact?.position ?? ""} className="input" />
        </label>
        <label>
          <span className="label">País</span>
          <select name="countryCode" defaultValue={contact?.countryCode ?? ""} className="input">
            <option value="">Sin país</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Email</span>
          <input name="email" type="email" defaultValue={contact?.email ?? ""} className="input" />
        </label>
        <label>
          <span className="label">Teléfono</span>
          <input name="phone" defaultValue={contact?.phone ?? ""} className="input" />
        </label>
        <label>
          <span className="label">Nivel de relación</span>
          <select name="relationshipLevel" defaultValue={contact?.relationshipLevel ?? "TIBIA"} className="input">
            {Object.entries(RELATIONSHIP_LEVELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Notas</span>
        <textarea name="notes" rows={3} defaultValue={contact?.notes ?? ""} className="input" />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary">Guardar</button>
        <Link href={cancelHref} className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
