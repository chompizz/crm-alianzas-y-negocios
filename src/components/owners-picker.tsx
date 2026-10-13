"use client";

import { useState } from "react";

type Props = {
  users: { id: string; name: string }[];
  defaultValue?: string[];
  name?: string;
  // Sin etiqueta (label="") para formularios en línea; el primer select muestra el placeholder.
  label?: string;
  placeholder?: string;
};

// Responsables internos: un select por persona y un "+" para sumar otra.
export function OwnersPicker({ users, defaultValue = [], name = "ownerIds", label = "Responsables internos", placeholder = "Sin asignar" }: Props) {
  const [rows, setRows] = useState<{ key: number; value: string }[]>(() =>
    (defaultValue.length ? defaultValue : [""]).map((value, key) => ({ key, value })),
  );
  const [next, setNext] = useState(rows.length);
  const chosen = new Set(rows.map((r) => r.value).filter(Boolean));
  const canAdd = chosen.size < users.length && rows.every((r) => r.value);

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.key} className="flex gap-2">
            <select
              name={name}
              value={r.value}
              onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, value: e.target.value } : x)))}
              className="input"
              aria-label={`Responsable ${i + 1}`}
            >
              <option value="">{i === 0 ? placeholder : "Elegir..."}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} disabled={u.id !== r.value && chosen.has(u.id)}>
                  {u.name}
                </option>
              ))}
            </select>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                className="btn-secondary shrink-0 px-3"
                aria-label="Quitar responsable"
                title="Quitar"
              >
                ×
              </button>
            )}
            {i < rows.length - 1 ? (
              // Mantiene alineados los selects; el "+" va solo en la última fila.
              <span aria-hidden className="btn-secondary invisible shrink-0 px-3">+</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRows([...rows, { key: next, value: "" }]);
                  setNext(next + 1);
                }}
                disabled={!canAdd}
                className="btn-secondary shrink-0 px-3 disabled:opacity-40"
                aria-label="Agregar responsable"
                title="Agregar otro responsable"
              >
                +
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
