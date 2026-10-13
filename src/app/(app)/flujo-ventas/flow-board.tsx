"use client";

import Link from "next/link";
import { useState } from "react";
import { CLIENT_STATUSES } from "@/lib/labels";
import { RowActions } from "@/components/row-actions";
import { removeClient } from "../alianzas/actions";
import { deleteInitiative } from "../iniciativas/actions";
import { deleteOpportunity } from "../oportunidades/actions";
import { initiativeToOpportunity, opportunityToClient } from "./actions";

type Card = { id: string; title: string; detail: string; meta: string; badge: string; href?: string; allianceId?: string };
type Initiative = Card & { allianceIds: string[] };
type Opportunity = Card & { value: string };
type Option = { id: string; name: string };
type Column = "INICIATIVAS" | "OPORTUNIDADES" | "CLIENTES";

const COLUMNS: { key: Column; title: string; hint: string; accent: string }[] = [
  { key: "INICIATIVAS", title: "Iniciativas", hint: "Arrastrá a Oportunidades", accent: "text-violet-300" },
  { key: "OPORTUNIDADES", title: "Oportunidades", hint: "Arrastrá a Clientes al ganarla", accent: "text-amber-300" },
  { key: "CLIENTES", title: "Clientes", hint: "Ganados y en curso", accent: "text-emerald-300" },
];

// Tablero del flujo de ventas: soltar una iniciativa en Oportunidades o una oportunidad en
// Clientes abre un cuadro para completar los datos de la conversión.
export function FlowBoard({
  initiatives,
  opportunities,
  clients,
  alliances,
  organizations,
}: {
  initiatives: Initiative[];
  opportunities: Opportunity[];
  clients: Card[];
  alliances: Option[];
  organizations: Option[];
}) {
  const [dragging, setDragging] = useState<{ from: Column; id: string } | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [dialog, setDialog] = useState<{ kind: "toOpp"; item: Initiative } | { kind: "toClient"; item: Opportunity } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = (to: Column) =>
    (dragging?.from === "INICIATIVAS" && to === "OPORTUNIDADES") || (dragging?.from === "OPORTUNIDADES" && to === "CLIENTES");

  function drop(to: Column) {
    const d = dragging;
    setOver(null);
    setDragging(null);
    if (!d || !valid(to) || d.from === to) return;
    if (d.from === "INICIATIVAS") setDialog({ kind: "toOpp", item: initiatives.find((i) => i.id === d.id)! });
    else setDialog({ kind: "toClient", item: opportunities.find((o) => o.id === d.id)! });
  }

  const items: Record<Column, Card[]> = { INICIATIVAS: initiatives, OPORTUNIDADES: opportunities, CLIENTES: clients };
  const hrefFor = (col: Column, c: Card) =>
    c.href ?? (col === "INICIATIVAS" ? `/iniciativas/${c.id}` : `/oportunidades/${c.id}/editar`);

  return (
    <>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col, i) => {
          const isTarget = dragging && valid(col.key);
          return (
            <section
              key={col.key}
              data-column={col.key}
              onDragOver={(e) => {
                if (!valid(col.key)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== col.key) setOver(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(col.key);
              }}
              className={`min-h-64 rounded-xl border p-3 transition ${
                over === col.key
                  ? "border-indigo-500 bg-indigo-50 shadow-[0_0_24px_-6px_rgb(34_211_238/0.7)]"
                  : isTarget
                    ? "border-dashed border-indigo-500/60 bg-slate-100"
                    : "border-transparent bg-slate-100"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className={`font-semibold ${col.accent}`}>
                  <span className="mr-2 font-mono text-xs text-slate-400">0{i + 1}</span>
                  {col.title}
                </h2>
                <span className="font-mono text-sm text-slate-400">{items[col.key].length}</span>
              </div>
              <p className="mb-3 px-1 text-xs text-slate-500">{col.hint}</p>
              <div className="space-y-2">
                {items[col.key].map((c) => (
                  <div key={c.id} className="relative">
                  <Link
                    href={hrefFor(col.key, c)}
                    draggable={col.key !== "CLIENTES"}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.id);
                      setDragging({ from: col.key, id: c.id });
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={`block rounded-lg border border-slate-200 bg-white p-3 pb-9 shadow-sm transition hover:border-indigo-300 ${
                      col.key !== "CLIENTES" ? "cursor-grab active:cursor-grabbing" : ""
                    } ${dragging?.id === c.id ? "opacity-40" : ""}`}
                  >
                    <p className="text-sm font-medium text-slate-900">{c.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{c.detail}</p>
                    <div className="mt-1.5 flex justify-between gap-2 text-xs">
                      <span className="font-mono text-slate-600">{c.meta}</span>
                      {c.badge && <span className="truncate text-slate-400">{c.badge}</span>}
                    </div>
                  </Link>
                  <CardActions col={col.key} card={c} />
                  </div>
                ))}
                {items[col.key].length === 0 && <p className="px-1 py-6 text-center text-sm text-slate-400">Vacío</p>}
              </div>
            </section>
          );
        })}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDialog(null)}>
          <form
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            action={async (fd) => {
              setError(null);
              try {
                if (dialog.kind === "toOpp") await initiativeToOpportunity(fd);
                else await opportunityToClient(fd);
                setDialog(null);
              } catch {
                setError("No se pudo completar el movimiento. Revisá los datos y probá de nuevo.");
                setDialog(null);
              }
            }}
            className="card w-full max-w-md space-y-3"
          >
            {dialog.kind === "toOpp" ? (
              <ToOpportunity item={dialog.item} alliances={alliances} />
            ) : (
              <ToClient item={dialog.item} organizations={organizations} />
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary">Cancelar</button>
              <button className="btn-primary">{dialog.kind === "toOpp" ? "Crear oportunidad" : "Convertir en cliente"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ToOpportunity({ item, alliances }: { item: Initiative; alliances: Option[] }) {
  const own = alliances.filter((a) => item.allianceIds.includes(a.id));
  const rest = alliances.filter((a) => !item.allianceIds.includes(a.id));
  return (
    <>
      <input type="hidden" name="initiativeId" value={item.id} />
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-indigo-600">Iniciativa → Oportunidad</p>
        <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
      </div>
      <label className="block">
        <span className="label">Título de la oportunidad</span>
        <input name="title" defaultValue={item.title} required className="input" />
      </label>
      <label className="block">
        <span className="label">Alianza</span>
        <select name="allianceId" required defaultValue={own[0]?.id ?? ""} className="input">
          <option value="" disabled>Elegir alianza...</option>
          {own.length > 0 && <optgroup label="De esta iniciativa">{own.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>}
          <optgroup label="Otras">{rest.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Valor estimado USD</span><input name="value" inputMode="decimal" className="input" /></label>
        <label><span className="label">Probabilidad %</span><input name="probability" type="number" min={0} max={100} className="input" /></label>
      </div>
    </>
  );
}

function ToClient({ item, organizations }: { item: Opportunity; organizations: Option[] }) {
  return (
    <>
      <input type="hidden" name="opportunityId" value={item.id} />
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-emerald-600">Oportunidad ganada → Cliente</p>
        <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
        <p className="text-xs text-slate-500">{item.detail}</p>
      </div>
      <label className="block">
        <span className="label">Cliente</span>
        <select name="organizationId" defaultValue="" className="input">
          <option value="">Elegir organización...</option>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <input name="newName" placeholder="...o nombre de un cliente nuevo" className="input" />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Estado</span>
          <select name="status" defaultValue="ACTIVO" className="input">
            {Object.entries(CLIENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label><span className="label">Facturación anual USD</span><input name="revenue" inputMode="decimal" defaultValue={item.value} className="input" /></label>
      </div>
      <label className="block">
        <span className="label">Cliente desde</span>
        <input name="since" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
      </label>
    </>
  );
}

// Lápiz y X de cada tarjeta, según la columna.
function CardActions({ col, card: c }: { col: Column; card: Card }) {
  const props =
    col === "INICIATIVAS"
      ? {
          editHref: `/iniciativas/${c.id}/editar`,
          deleteAction: deleteInitiative.bind(null, c.id, "/flujo-ventas"),
          confirm: `¿Eliminar la iniciativa "${c.title}"? Se borran también sus hitos y compromisos.`,
        }
      : col === "OPORTUNIDADES"
        ? {
            editHref: `/oportunidades/${c.id}/editar`,
            deleteAction: deleteOpportunity.bind(null, c.id, "/flujo-ventas"),
            confirm: `¿Eliminar la oportunidad "${c.title}"?`,
          }
        : {
            editHref: `/alianzas/${c.allianceId}?cliente=${c.id}#clientes`,
            deleteAction: removeClient.bind(null, c.allianceId!, c.id),
            confirm: `¿Quitar a ${c.title} de los clientes de ${c.detail}? La organización no se borra.`,
          };
  return <RowActions className="absolute bottom-1.5 right-1.5" label={c.title} {...props} />;
}
