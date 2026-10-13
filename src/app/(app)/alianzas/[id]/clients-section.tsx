import Link from "next/link";
import type { AllianceClient, Organization } from "@prisma/client";
import { dateInput, fmtDate, fmtUsd } from "@/lib/format";
import { CLIENT_STATUS_STYLE, CLIENT_STATUSES } from "@/lib/labels";
import { addClient, removeClient, updateClient } from "../actions";

type Client = AllianceClient & { organization: Pick<Organization, "id" | "name"> };

// Clientes que atiende la alianza, con su estado y facturación anual estimada.
export function ClientsSection({
  allianceId,
  clients,
  organizations,
  editingId,
}: {
  allianceId: string;
  clients: Client[];
  organizations: { id: string; name: string }[];
  editingId?: string;
}) {
  const editing = clients.find((c) => c.id === editingId);
  const total = clients.filter((c) => c.status === "ACTIVO").reduce((s, c) => s + Number(c.revenue ?? 0), 0);
  const available = organizations.filter((o) => !clients.some((c) => c.organizationId === o.id));
  return (
    <section id="clientes" className="card scroll-mt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Clientes <span className="font-normal text-slate-400">({clients.length})</span></h2>
        <p className="text-xs text-slate-500">
          Facturación de clientes activos: <span className="font-mono font-semibold text-indigo-700">{fmtUsd(total) || "US$ 0"}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Cliente</th><th>Estado</th><th>Facturación anual</th><th>Desde</th><th /></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className={`align-top ${c.id === editingId ? "bg-indigo-50" : ""}`}>
                <td>
                  <Link href={`/organizaciones/${c.organizationId}`} className="font-medium text-indigo-700 hover:underline">{c.organization.name}</Link>
                  {c.notes && <p className="max-w-xs text-xs text-slate-500">{c.notes}</p>}
                </td>
                <td><span className={`rounded-full border px-2 py-0.5 text-xs ${CLIENT_STATUS_STYLE[c.status]}`}>{CLIENT_STATUSES[c.status]}</span></td>
                <td className="font-mono">{fmtUsd(c.revenue)}</td>
                <td>{fmtDate(c.since)}</td>
                <td className="text-right">
                  <Link href={`/alianzas/${allianceId}?cliente=${c.id}#clientes`} scroll={false} className="text-xs text-indigo-700 hover:underline">Editar</Link>
                  <form action={removeClient.bind(null, allianceId, c.id)} className="ml-3 inline">
                    <button className="text-xs text-slate-400 hover:text-red-600">Quitar</button>
                  </form>
                </td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Sin clientes todavía.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing ? (
        <form action={updateClient.bind(null, allianceId, editing.id)} className="mt-3 grid gap-2 rounded-lg border border-indigo-500/40 p-3 sm:grid-cols-6">
          <p className="text-sm font-medium sm:col-span-6">Editar {editing.organization.name}</p>
          <select name="status" defaultValue={editing.status} className="input sm:col-span-2">
            {Object.entries(CLIENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input name="revenue" inputMode="decimal" defaultValue={editing.revenue?.toString() ?? ""} placeholder="Facturación anual USD" className="input sm:col-span-2" />
          <input name="since" type="date" defaultValue={dateInput(editing.since)} className="input sm:col-span-2" />
          <input name="notes" defaultValue={editing.notes ?? ""} placeholder="Notas: qué compra, condiciones..." className="input sm:col-span-4" />
          <button className="btn-primary sm:col-span-1">Guardar</button>
          <Link href={`/alianzas/${allianceId}#clientes`} scroll={false} className="btn-secondary sm:col-span-1">Cancelar</Link>
        </form>
      ) : (
        <form action={addClient.bind(null, allianceId)} className="mt-3 grid gap-2 sm:grid-cols-6">
          <select name="organizationId" defaultValue="" className="input sm:col-span-3">
            <option value="">Elegir organización...</option>
            {available.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input name="newName" placeholder="...o nombre de un cliente nuevo" className="input sm:col-span-3" />
          <select name="status" defaultValue="PROSPECTO" className="input sm:col-span-2">
            {Object.entries(CLIENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input name="revenue" inputMode="decimal" placeholder="Facturación anual USD" className="input sm:col-span-2" />
          <button className="btn-secondary sm:col-span-2">Agregar cliente</button>
        </form>
      )}
    </section>
  );
}
