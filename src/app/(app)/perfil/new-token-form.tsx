"use client";

import { useActionState, useState } from "react";
import { createToken, type NewTokenState } from "./actions";

export function NewTokenForm() {
  const [state, action, pending] = useActionState<NewTokenState, FormData>(createToken, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap gap-2">
        <input name="name" placeholder="Nombre (ej.: Claude de Ana)" className="input max-w-xs" />
        <button className="btn-primary" disabled={pending}>{pending ? "Generando..." : "Generar conector"}</button>
      </form>
      {state.url && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Copiá esta dirección ahora: no se vuelve a mostrar.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={state.url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigator.clipboard.writeText(state.url!).then(() => setCopied(true))}
            >
              {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-amber-900">
            En Claude: Configuración → Conectores → Agregar conector personalizado, y pegá esta dirección.
          </p>
        </div>
      )}
    </div>
  );
}
