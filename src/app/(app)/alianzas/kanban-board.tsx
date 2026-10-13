"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { AllianceStage, Dimension, Health } from "@prisma/client";
import { DimensionBadge } from "@/components/dimension-badge";
import { OwnersPicker } from "@/components/owners-picker";
import { RowActions } from "@/components/row-actions";
import { ALLIANCE_STAGES, HEALTH, HEALTH_DOT } from "@/lib/labels";
import { deleteAlliance, quickUpdateAlliance, setAllianceStage } from "./actions";

export type KanbanCard = {
  id: string;
  name: string;
  stage: AllianceStage;
  health: Health;
  dimension: Dimension;
  subtitle: string;
  participants: string;
  owner: string;
  value: string;
  pendingCommitments: number;
  clients: number;
  // Valores crudos para la edición rápida.
  ownerIds: string[];
  expectedValue: string;
  startDate: string;
  renewalDate: string;
};

type User = { id: string; name: string };

const today = () => new Date().toISOString().slice(0, 10);

export function KanbanBoard({ cards, users }: { cards: KanbanCard[]; users: User[] }) {
  const [optimistic, moveCard] = useOptimistic(cards, (state, move: { id: string; stage: AllianceStage }) =>
    state.map((c) => (c.id === move.id ? { ...c, stage: move.stage } : c)),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<AllianceStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<KanbanCard | null>(null);

  function drop(stage: AllianceStage) {
    const id = dragging;
    setOver(null);
    setDragging(null);
    const card = optimistic.find((c) => c.id === id);
    if (!id || !card || card.stage === stage) return;
    setError(null);
    // Al activarse toma hoy como inicio si no tenía (igual que en el servidor).
    const moved = { ...card, stage, startDate: stage === "ACTIVA" && !card.startDate ? today() : card.startDate };
    startTransition(async () => {
      moveCard({ id, stage });
      try {
        await setAllianceStage(id, stage);
        setEditing(moved);
      } catch {
        setError(`No se pudo mover "${card.name}". Probá de nuevo.`);
      }
    });
  }

  return (
    <>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="mb-2 text-xs text-slate-500">
        Arrastrá una tarjeta a otra columna para cambiar su etapa; después podés ajustar sus datos.
      </p>
      {editing && <QuickEdit card={editing} users={users} onClose={() => setEditing(null)} />}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {(Object.keys(ALLIANCE_STAGES) as AllianceStage[]).map((stage) => {
          const items = optimistic.filter((c) => c.stage === stage);
          const isOver = over === stage && dragging !== null;
          return (
            <section
              key={stage}
              data-stage={stage}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== stage) setOver(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(stage);
              }}
              className={`min-h-40 w-64 shrink-0 rounded-xl border p-2 transition ${
                isOver ? "border-indigo-500 bg-indigo-50 shadow-[0_0_24px_-6px_rgb(34_211_238/0.7)]" : "border-transparent bg-slate-100"
              }`}
            >
              <h2 className="flex justify-between px-2 py-1 text-sm font-semibold text-slate-600">
                {ALLIANCE_STAGES[stage]}
                <span className="font-normal text-slate-400">{items.length}</span>
              </h2>
              <div className="mt-1 space-y-2">
                {items.map((a) => (
                  <div key={a.id} className="relative">
                  <Link
                    href={`/alianzas/${a.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", a.id);
                      setDragging(a.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={`block cursor-grab rounded-lg border border-slate-200 bg-white p-3 pb-9 shadow-sm transition hover:border-indigo-300 active:cursor-grabbing ${
                      dragging === a.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{a.name}</p>
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_DOT[a.health]}`} title={`Salud: ${a.health.toLowerCase()}`} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{a.subtitle}</p>
                    <div className="mt-1.5"><DimensionBadge dimension={a.dimension} /></div>
                    {a.participants && <p className="mt-1 truncate text-xs text-slate-600">{a.participants}</p>}
                    <div className="mt-2 flex justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate" title={a.owner}>{a.owner}</span>
                      <span className="shrink-0">{a.value}</span>
                    </div>
                    {a.clients > 0 && (
                      <p className="mt-1 text-xs text-emerald-700">{a.clients} {a.clients === 1 ? "cliente" : "clientes"}</p>
                    )}
                    {a.pendingCommitments > 0 && (
                      <p className="mt-1 text-xs text-amber-700">{a.pendingCommitments} compromiso(s) pendiente(s)</p>
                    )}
                  </Link>
                  <RowActions
                    className="absolute bottom-1.5 right-1.5"
                    editHref={`/alianzas/${a.id}/editar`}
                    deleteAction={deleteAlliance.bind(null, a.id)}
                    confirm={`¿Eliminar la alianza "${a.name}"? Se borran también sus participantes, clientes, oportunidades y compromisos.`}
                    label={a.name}
                  />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function QuickEdit({ card, users, onClose }: { card: KanbanCard; users: User[]; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-label={`Actualizar ${card.name}`}
        onClick={(e) => e.stopPropagation()}
        action={async (fd) => {
          setSaving(true);
          try {
            await quickUpdateAlliance(card.id, fd);
            onClose();
          } finally {
            setSaving(false);
          }
        }}
        className="card w-full max-w-md space-y-3"
      >
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-indigo-600">Movida a {ALLIANCE_STAGES[card.stage]}</p>
          <h2 className="mt-1 text-lg font-semibold">{card.name}</h2>
          <p className="text-xs text-slate-500">Revisá los datos para esta etapa.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Salud</span>
            <select name="health" defaultValue={card.health} className="input">
              {Object.entries(HEALTH).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Valor esperado (USD)</span>
            <input name="expectedValue" inputMode="decimal" defaultValue={card.expectedValue} placeholder="0" className="input" />
          </label>
          <div className="sm:col-span-2">
            <OwnersPicker users={users} defaultValue={card.ownerIds} />
          </div>
          <label>
            <span className="label">Inicio</span>
            <input name="startDate" type="date" defaultValue={card.startDate} className="input" />
          </label>
          <label>
            <span className="label">Renovación</span>
            <input name="renewalDate" type="date" defaultValue={card.renewalDate} className="input" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Link href={`/alianzas/${card.id}`} className="text-sm text-indigo-700 hover:underline">Abrir ficha completa</Link>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Omitir</button>
            <button disabled={saving} className="btn-primary">{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
