import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import Link from "next/link";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { CountryRevenue } from "@/lib/country-revenue";
import { fmtUsdCompact } from "@/lib/format";

// ISO 3166 alfa-2 (como guarda Nexo) → numérico (como identifica world-atlas), y un punto donde anclar la etiqueta.
const COUNTRIES: Record<string, { id: string; at: [number, number] }> = {
  AR: { id: "032", at: [-64, -34] },
  BO: { id: "068", at: [-64.5, -16.5] },
  BR: { id: "076", at: [-52, -10] },
  CA: { id: "124", at: [-100, 57] },
  CL: { id: "152", at: [-71, -30] },
  CN: { id: "156", at: [103, 35] },
  CO: { id: "170", at: [-73.5, 4] },
  CR: { id: "188", at: [-84, 10] },
  CU: { id: "192", at: [-79, 21.7] },
  DE: { id: "276", at: [10.4, 51] },
  DO: { id: "214", at: [-70.5, 18.9] },
  EC: { id: "218", at: [-78.5, -1.5] },
  ES: { id: "724", at: [-3.7, 40.2] },
  FR: { id: "250", at: [2.4, 46.6] },
  GB: { id: "826", at: [-1.8, 53] },
  GT: { id: "320", at: [-90.3, 15.5] },
  HN: { id: "340", at: [-86.6, 14.8] },
  IT: { id: "380", at: [12.5, 42.8] },
  MX: { id: "484", at: [-102, 23.5] },
  NI: { id: "558", at: [-85, 12.9] },
  PA: { id: "591", at: [-80.1, 8.5] },
  PE: { id: "604", at: [-75, -9.5] },
  PR: { id: "630", at: [-66.5, 18.2] },
  PT: { id: "620", at: [-8.2, 39.6] },
  PY: { id: "600", at: [-58.4, -23.4] },
  SV: { id: "222", at: [-88.9, 13.7] },
  US: { id: "840", at: [-98, 39] },
  UY: { id: "858", at: [-56, -32.8] },
  VE: { id: "862", at: [-66.5, 7] },
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

const LABEL_H = 20;

// Ubica cada etiqueta a la derecha de su país y, si choca con otra ya ubicada, la corre hacia arriba o abajo.
function placeLabels(data: CountryRevenue[]) {
  const placed: { code: string; text: string; px: number; py: number; x: number; y: number; w: number }[] = [];
  const overlaps = (x: number, y: number, w: number) =>
    placed.some((o) => x < o.x + o.w + 4 && x + w + 4 > o.x && y < o.y + LABEL_H + 3 && y + LABEL_H + 3 > o.y);
  for (const r of data) {
    const c = COUNTRIES[r.code];
    const pt = c && projection(c.at);
    if (!pt) continue;
    const text = r.potential > 0 ? fmtUsdCompact(r.potential) : `${r.alliances} al.`;
    const w = text.length * 7.2 + 30;
    const x = Math.min(pt[0] + 14, W - w - 4);
    let y = pt[1] - 24;
    for (const dy of [0, 24, -24, 48, -48, 72, -72, 96, -96]) {
      if (!overlaps(x, pt[1] - 24 + dy, w)) {
        y = pt[1] - 24 + dy;
        break;
      }
    }
    placed.push({ code: r.code, text, px: pt[0], py: pt[1], x, y, w });
  }
  return placed;
}

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
                >
                  {r && <title>{`${r.name}: ${r.alliances} alianza(s), ${fmtUsdCompact(r.potential)}`}</title>}
                </path>
              );
            })}
          </g>
          <g fontFamily="var(--font-mono)">
            {placeLabels(data).map((l) => (
              <g key={l.code}>
                <line x1={l.px} y1={l.py} x2={l.x} y2={l.y + 10} stroke="#a78bfa" strokeOpacity="0.8" strokeWidth="1" />
                <circle cx={l.px} cy={l.py} r="3.5" fill="#a78bfa" filter="url(#glow)" />
                <g transform={`translate(${l.x},${l.y})`}>
                  <rect width={l.w} height={LABEL_H} rx="5" fill="#070b17" fillOpacity="0.88" stroke="#22d3ee" strokeOpacity="0.7" />
                  <text x="6" y="14" fontSize="11" fill="#8494b5">{l.code}</text>
                  <text x="24" y="14" fontSize="12" fontWeight="600" fill="#e0fbff">{l.text}</text>
                </g>
              </g>
            ))}
          </g>
        </svg>
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
