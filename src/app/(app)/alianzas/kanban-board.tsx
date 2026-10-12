"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { AllianceStage, Dimension, Health } from "@prisma/client";
import { DimensionBadge } from "@/components/dimension-badge";
import { ALLIANCE_STAGES, HEALTH_DOT } from "@/lib/labels";
import { setAllianceStage } from "./actions";

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
};

export function KanbanBoard({ cards }: { cards: KanbanCard[] }) {
  const [optimistic, moveCard] = useOptimistic(cards, (state, move: { id: string; stage: AllianceStage }) =>
    state.map((c) => (c.id === move.id ? { ...c, stage: move.stage } : c)),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<AllianceStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  function drop(stage: AllianceStage) {
    const id = dragging;
    setOver(null);
    setDragging(null);
    const card = optimistic.find((c) => c.id === id);
    if (!id || !card || card.stage === stage) return;
    setError(null);
    startTransition(async () => {
      moveCard({ id, stage });
      try {
        await setAllianceStage(id, stage);
      } catch {
        setError(`No se pudo mover "${card.name}". Probá de nuevo.`);
      }
    });
  }

  return (
    <>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="mb-2 text-xs text-slate-500">Arrastrá una tarjeta a otra columna para cambiar su etapa.</p>
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
                  <Link
                    key={a.id}
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
                    className={`block cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 active:cursor-grabbing ${
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
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>{a.owner}</span>
                      <span>{a.value}</span>
                    </div>
                    {a.pendingCommitments > 0 && (
                      <p className="mt-1 text-xs text-amber-700">{a.pendingCommitments} compromiso(s) pendiente(s)</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
