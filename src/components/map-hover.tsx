"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Tip = { x: number; y: number; code: string; name: string; alliances: string; potential: string; weighted: string };

// Tooltip del mapa: lee los datos de los elementos con data-code (países y etiquetas)
// y al hacer clic lleva a las alianzas de ese país.
export function MapHover({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [tip, setTip] = useState<Tip | null>(null);

  function target(e: React.MouseEvent) {
    return (e.target as Element).closest<SVGElement>("[data-code]");
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseMove={(e) => {
        const el = target(e);
        const box = ref.current?.getBoundingClientRect();
        if (!el || !box) return setTip(null);
        const d = el.dataset;
        setTip({
          x: e.clientX - box.left,
          y: e.clientY - box.top,
          code: d.code!,
          name: d.name!,
          alliances: d.alliances!,
          potential: d.potential!,
          weighted: d.weighted!,
        });
      }}
      onMouseLeave={() => setTip(null)}
      onClick={(e) => {
        const el = target(e);
        if (el) router.push(`/alianzas?pais=${el.dataset.code}`);
      }}
    >
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-56 rounded-lg border border-indigo-500/60 bg-[#070b17]/95 px-3 py-2 text-xs shadow-[0_0_24px_-6px_rgb(34_211_238/0.7)]"
          style={{
            left: Math.min(tip.x + 16, (ref.current?.clientWidth ?? 0) - 232),
            top: Math.max(tip.y - 80, 4),
          }}
        >
          <p className="flex items-center justify-between font-semibold text-slate-900">
            {tip.name}
            <span className="font-mono text-[10px] text-slate-400">{tip.code}</span>
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-indigo-700">{tip.potential}</p>
          <p className="text-slate-500">facturación potencial</p>
          <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 text-slate-600">
            <span>{tip.alliances}</span>
            <span>Oport. pond. {tip.weighted}</span>
          </div>
        </div>
      )}
    </div>
  );
}
