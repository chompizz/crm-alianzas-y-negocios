import type { Prisma } from "@prisma/client";
import { CommitmentRow } from "@/components/commitment-row";
import { PageHeader } from "@/components/page-header";
import { db, INTERNAL_USERS } from "@/lib/db";
import { ownersSelect } from "@/lib/owners";
import { startOfTodayUtc } from "@/lib/format";
import { COMMITMENT_PARTIES } from "@/lib/labels";

export default async function CommitmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; resp?: string; parte?: string; pais?: string }>;
}) {
  const { vista = "pendientes", resp, parte, pais } = await searchParams;
  const where: Prisma.CommitmentWhereInput = {};
  if (vista === "pendientes") where.status = "PENDIENTE";
  if (vista === "vencidos") Object.assign(where, { status: "PENDIENTE", dueDate: { lt: startOfTodayUtc() } });
  if (resp) where.owners = { some: { id: resp } };
  if (parte === "NOSOTROS" || parte === "SOCIO") where.party = parte;
  if (pais) where.OR = [{ alliance: { countryCode: pais } }, { initiative: { alliances: { some: { countryCode: pais } } } }];

  const [commitments, users, countries] = await Promise.all([
    db.commitment.findMany({
      where,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: { ...ownersSelect, alliance: { select: { id: true, name: true } }, initiative: { select: { id: true, name: true } } },
    }),
    db.user.findMany({ where: INTERNAL_USERS, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.country.findMany({ where: { alliances: { some: {} } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Compromisos" subtitle="Lo que cada parte se comprometió a entregar" />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="vista" defaultValue={vista} className="input max-w-[12rem]">
          <option value="pendientes">Pendientes</option>
          <option value="vencidos">Vencidos</option>
          <option value="todos">Todos</option>
        </select>
        <select name="parte" defaultValue={parte ?? ""} className="input max-w-[12rem]">
          <option value="">Ambas partes</option>
          {Object.entries(COMMITMENT_PARTIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="resp" defaultValue={resp ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los responsables</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select name="pais" defaultValue={pais ?? ""} className="input max-w-[12rem]">
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Compromiso</th><th>Alianza / iniciativa</th><th>Quién</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {commitments.map((c) => <CommitmentRow key={c.id} commitment={c} showAlliance back={"/compromisos"} />)}
            {commitments.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No hay compromisos con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
