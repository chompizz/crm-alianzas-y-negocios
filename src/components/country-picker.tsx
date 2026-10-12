import type { Country } from "@prisma/client";

// Selección de uno o varios países con casillas.
export function CountryPicker({ countries, selected, name = "countries" }: { countries: Country[]; selected: string[]; name?: string }) {
  return (
    <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-slate-300 bg-white p-2 sm:grid-cols-3">
      {countries.map((c) => (
        <label key={c.code} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
          <input type="checkbox" name={name} value={c.code} defaultChecked={selected.includes(c.code)} />
          {c.name}
        </label>
      ))}
    </div>
  );
}
