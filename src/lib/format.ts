const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const usdFmt = new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function fmtDate(d: Date | null | undefined) {
  return d ? dateFmt.format(d) : "";
}

export function fmtUsd(v: { toString(): string } | number | null | undefined) {
  return v == null ? "" : usdFmt.format(Number(v.toString()));
}

// Valor para <input type="date">.
export function dateInput(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function parseDate(v: string | null): Date | null {
  return v ? new Date(`${v}T00:00:00Z`) : null;
}

export function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const usdCompactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

// $250K, $1.2M: para etiquetas cortas (mapa).
export function fmtUsdCompact(v: number) {
  return `$${usdCompactFmt.format(v)}`;
}
