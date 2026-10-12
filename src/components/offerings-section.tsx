import Link from "next/link";
import type { OfferingKind } from "@prisma/client";
import { assignOffering, unassignOffering } from "@/app/(app)/catalogo/actions";
import { OFFERING_KINDS, OFFERING_STYLE } from "@/lib/labels";

type Item = { id: string; name: string; kind: OfferingKind };

// Productos, servicios y otros asignados a una organización o alianza, con alta rápida.
export function OfferingsSection({
  target,
  targetId,
  assigned,
  available,
  title,
  hint,
}: {
  target: "organizacion" | "alianza";
  targetId: string;
  assigned: Item[];
  available: Item[];
  title: string;
  hint: string;
}) {
  return (
    <section className="card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href="/catalogo" className="text-xs text-indigo-700 hover:underline">Ver catálogo</Link>
      </div>
      <p className="mb-3 text-xs text-slate-500">{hint}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {assigned.map((o) => (
          <span key={o.id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${OFFERING_STYLE[o.kind]}`}>
            <Link href={`/catalogo/${o.id}`} className="hover:underline">{o.name}</Link>
            <span className="opacity-60">· {OFFERING_KINDS[o.kind]}</span>
            <form action={unassignOffering.bind(null, target, targetId, o.id)} className="inline">
              <button className="ml-1 opacity-60 hover:opacity-100" aria-label={`Quitar ${o.name}`}>×</button>
            </form>
          </span>
        ))}
        {assigned.length === 0 && <span className="text-sm text-slate-500">Nada asignado todavía.</span>}
      </div>
      <form action={assignOffering.bind(null, target, targetId)} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select name="offeringId" defaultValue="" className="input">
          <option value="">Elegir del catálogo...</option>
          {(Object.keys(OFFERING_KINDS) as OfferingKind[]).map((k) => {
            const items = available.filter((o) => o.kind === k);
            return items.length ? (
              <optgroup key={k} label={OFFERING_KINDS[k]}>
                {items.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
        <button className="btn-secondary">Asignar</button>
        <div className="flex gap-2 sm:col-span-2">
          <input name="newName" placeholder="…o crear uno nuevo" className="input" />
          <select name="kind" defaultValue="PRODUCTO" className="input max-w-[9rem]">
            {Object.entries(OFFERING_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </form>
    </section>
  );
}
