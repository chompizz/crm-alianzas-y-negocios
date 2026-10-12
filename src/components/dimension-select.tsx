import { DIMENSIONS } from "@/lib/labels";

export function DimensionSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <label>
      <span className="label">Dimensión</span>
      <select name="dimension" defaultValue={defaultValue} className="input">
        {Object.entries(DIMENSIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
