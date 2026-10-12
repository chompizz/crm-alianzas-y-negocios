import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import Link from "next/link";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { CountryRevenue } from "@/lib/country-revenue";
import { fmtUsdCompact } from "@/lib/format";
import { MapHover } from "./map-hover";

// ISO 3166 alfa-2 (como guarda Nexo) → numérico (como identifica world-atlas).
const COUNTRIES: Record<string, { id: string }> = {
  AR: { id: "032" },
  BO: { id: "068" },
  BR: { id: "076" },
  CA: { id: "124" },
  CL: { id: "152" },
  CN: { id: "156" },
  CO: { id: "170" },
  CR: { id: "188" },
  CU: { id: "192" },
  DE: { id: "276" },
  DO: { id: "214" },
  EC: { id: "218" },
  ES: { id: "724" },
  FR: { id: "250" },
  GB: { id: "826" },
  GT: { id: "320" },
  HN: { id: "340" },
  IT: { id: "380" },
  MX: { id: "484" },
  NI: { id: "558" },
  PA: { id: "591" },
  PE: { id: "604" },
  PR: { id: "630" },
  PT: { id: "620" },
  PY: { id: "600" },
  SV: { id: "222" },
  US: { id: "840" },
  UY: { id: "858" },
  VE: { id: "862" },
};

const W = 960;
const H = 470;

const topology = world as unknown as Topology<{ countries: GeometryCollection }>;
const land = (feature(topology, topology.objects.countries) as FeatureCollection<Geometry>).features.filter(
  (f) => f.id !== "010", // sin Antártida
);
const projection = geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: "FeatureCollection", features: land });
const path = geoPath(projection);
const shapes = land.map((f: Feature<Geometry>) => ({ id: String(f.id), d: path(f) ?? "" }));

// Datos que muestra el tooltip al pasar el mouse por un país.
const hoverData = (r: CountryRevenue) => ({
  "data-code": r.code,
  "data-name": r.name,
  "data-alliances": `${r.alliances} ${r.alliances === 1 ? "alianza abierta" : "alianzas abiertas"}`,
  "data-potential": fmtUsdCompact(r.potential),
  "data-weighted": fmtUsdCompact(r.weightedOpportunities),
});

export function AllianceMap({ data }: { data: CountryRevenue[] }) {
  const byId = new Map(data.filter((r) => COUNTRIES[r.code]).map((r) => [COUNTRIES[r.code].id, r]));
  const max = Math.max(1, ...data.map((r) => r.potential));
  // Intensidad por facturación potencial (raíz para que los países chicos no desaparezcan).
  const intensity = (r: CountryRevenue) => (r.potential > 0 ? 0.35 + 0.6 * Math.sqrt(r.potential / max) : 0.3);
  const total = data.reduce((s, r) => s + r.potential, 0);

  return (
    <section className="card relative mb-6 overflow-hidden p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-indigo-700/80">Mapa de alianzas</p>
          <h2 className="text-lg font-semibold">Facturación potencial por país</h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold text-indigo-700">{fmtUsdCompact(total)}</p>
          <p className="text-xs text-slate-500">{data.reduce((s, r) => s + r.alliances, 0)} alianzas abiertas en {data.length} países</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1fr_17rem]">
        <MapHover>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Mapa de alianzas por país">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g>
            {shapes.map((s) => {
              const r = byId.get(s.id);
              return (
                <path
                  key={s.id}
                  d={s.d}
                  fill={r ? `rgb(34 211 238 / ${intensity(r)})` : "#111a2e"}
                  stroke={r ? "#67e8f9" : "#1f2b48"}
                  strokeWidth={r ? 0.9 : 0.5}
                  filter={r ? "url(#glow)" : undefined}
                  className={r ? "map-country" : undefined}
                  {...(r ? hoverData(r) : {})}
                />
              );
            })}
          </g>
        </svg>
        </MapHover>
        <ol className="max-h-[470px] overflow-y-auto border-t border-slate-200 px-5 py-3 text-sm lg:border-l lg:border-t-0">
          {data.map((r, i) => (
            <li key={r.code} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
              <Link href={`/alianzas?pais=${r.code}`} className="min-w-0 hover:text-indigo-700">
                <span className="mr-2 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-medium">{r.name}</span>
                <span className="block pl-7 text-xs text-slate-500">{r.alliances} {r.alliances === 1 ? "alianza" : "alianzas"}</span>
              </Link>
              <span className="font-mono font-semibold text-indigo-700">{fmtUsdCompact(r.potential)}</span>
            </li>
          ))}
          {data.length === 0 && <li className="py-6 text-center text-slate-500">Cuando cargues alianzas, los países se iluminan acá.</li>}
        </ol>
      </div>
    </section>
  );
}
