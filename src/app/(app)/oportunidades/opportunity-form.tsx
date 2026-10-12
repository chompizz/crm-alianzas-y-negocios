import Link from "next/link";
import type { Opportunity } from "@prisma/client";
import { DimensionSelect } from "@/components/dimension-select";
import { OPPORTUNITY_STATUSES } from "@/lib/labels";

type Props = {
  action: (fd: FormData) => Promise<void>;
  alliances: { id: string; name: string; country: { name: string } }[];
  opportunity?: Opportunity;
  defaultAllianceId?: string;
  cancelHref: string;
};

export function OpportunityForm({ action, alliances, opportunity, defaultAllianceId, cancelHref }: Props) {
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      {defaultAllianceId && <input type="hidden" name="back" value="alianza" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">Título *</span>
          <input name="title" required defaultValue={opportunity?.title} className="input" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Alianza *</span>
          <select name="allianceId" required defaultValue={opportunity?.allianceId ?? defaultAllianceId ?? ""} className="input">
            <option value="" disabled>Elegir...</option>
            {alliances.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.country.name})</option>)}
          </select>
        </label>
        <label>
          <span className="label">Valor estimado (USD)</span>
          <input name="estimatedValue" inputMode="decimal" defaultValue={opportunity?.estimatedValue?.toString() ?? ""} className="input" />
        </label>
        <label>
          <span className="label">Probabilidad (%)</span>
          <input name="probability" type="number" min={0} max={100} defaultValue={opportunity?.probability ?? ""} className="input" />
        </label>
        <label>
          <span className="label">Estado</span>
          <select name="status" defaultValue={opportunity?.status ?? "ABIERTA"} className="input">
            {Object.entries(OPPORTUNITY_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <DimensionSelect defaultValue={opportunity?.dimension ?? "VENTAS"} />
      </div>
      <label className="block">
        <span className="label">Descripción</span>
        <textarea name="description" rows={3} defaultValue={opportunity?.description ?? ""} className="input" />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary">Guardar</button>
        <Link href={cancelHref} className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
