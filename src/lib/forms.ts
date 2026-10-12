// Helpers para leer FormData en server actions.
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function list(fd: FormData, key: string): string[] {
  const v = str(fd, key);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function all(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

export function oneOf<T extends string>(fd: FormData, key: string, options: Record<T, string>, fallback: T): T {
  const v = str(fd, key);
  return v && v in options ? (v as T) : fallback;
}
