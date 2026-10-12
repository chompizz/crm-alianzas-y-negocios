import type { Dimension } from "@prisma/client";
import { DIMENSION_STYLE, DIMENSIONS } from "@/lib/labels";

export function DimensionBadge({ dimension }: { dimension: Dimension }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${DIMENSION_STYLE[dimension]}`}>
      {DIMENSIONS[dimension]}
    </span>
  );
}
