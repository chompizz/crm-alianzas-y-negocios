import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/row-actions";
import { db } from "@/lib/db";
import { PARTICIPANT_ROLES } from "@/lib/labels";
import { listPartners } from "@/lib/partners";
import { deletePartner } from "../actions";
import { PartnerTabs } from "../tabs";

const OK = { creado: "Partner creado.", guardado: "Cambios guardados." };

// ABM de partners: organizaciones que participan en alianzas y pueden tener acceso al portal.
export default async function PartnersListPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const [partners, pending] = await Promise.all([listPartners(), db.dealRegistration.count({ where: { status: "PENDIENTE" } })]);
  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Organizaciones que participan en las alianzas"
        actions={<Link href="/partners/listado/nuevo" className="btn-primary">Nuevo partner</Link>}
      />
      <PartnerTabs active="partners" pending={pending} />
      {ok && ok in OK && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{OK[ok as keyof typeof OK]}</p>}
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Partner</th><th>Países</th><th>Alianzas</th><th className="text-right">Cuentas</th><th className="text-right">Registros</th><th className="text-right">Oport. traídas</th><th></th></tr></thead>
          <tbody>
            {partners.map((p) => {
              const active = p.partnerAccounts.filter((a) => a.active).length;
              return (
                <tr key={p.id}>
                  <td><Link href={`/organizaciones/${p.id}`} className="font-medium text-indigo-700 hover:underline">{p.name}</Link></td>
                  <td className="text-sm">{p.countries.map((c) => c.name).join(", ")}</td>
                  <td className="text-sm">
                    {p.participations.map((x) => (
                      <span key={x.alliance.id} className="mr-1 inline-block">
                        <Link href={`/alianzas/${x.alliance.id}`} className="hover:underline">{x.alliance.name}</Link>
                        <span className="text-xs text-slate-500"> ({PARTICIPANT_ROLES[x.roleType]})</span>
                      </span>
                    ))}
                    {p.participations.length === 0 && <span className="text-xs text-amber-600">Sin alianzas: no ve nada en el portal</span>}
                  </td>
                  <td className="text-right">
                    <Link href="/partners/cuentas" className="hover:underline">{active}{p.partnerAccounts.length > active ? ` (+${p.partnerAccounts.length - active} desact.)` : ""}</Link>
                  </td>
                  <td className="text-right"><Link href={`/partners?estado=TODAS&partner=${p.id}`} className="hover:underline">{p._count.partnerRegistrations}</Link></td>
                  <td className="text-right">{p._count.partnerOpportunities}</td>
                  <td>
                    <RowActions
                      editHref={`/partners/listado/${p.id}/editar`}
                      deleteAction={deletePartner.bind(null, p.id)}
                      confirm={`¿Dar de baja a ${p.name} como partner? Sale de sus alianzas y se borran sus cuentas del portal. La organización, sus registros y las oportunidades que trajo se conservan.`}
                      label={p.name}
                    />
                  </td>
                </tr>
              );
            })}
            {partners.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Todavía no hay partners. Creá el primero con “Nuevo partner”.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
