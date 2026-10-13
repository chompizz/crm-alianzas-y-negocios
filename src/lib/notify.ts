import { headers } from "next/headers";
import { db } from "@/lib/db";

// Avisos por email a los responsables cuando otra persona cambia algo suyo.
// Los cambios se juntan por destinatario durante un rato y salen en un solo email.
// Se envían con Resend (RESEND_API_KEY y EMAIL_FROM); sin esas variables no se envía nada.

type Actor = { id: string; name?: string | null };
type Scope = { allianceId?: string | null; initiativeId?: string | null; commitmentId?: string | null; userIds?: string[] };
type Item = { text: string; href?: string };
type Pending = { name: string; items: Item[]; timer: ReturnType<typeof setTimeout> };

const DELAY_MS = Number(process.env.NOTIFY_DELAY_MS ?? 60_000);
const g = globalThis as unknown as { nexoNotifyQueue?: Map<string, Pending>; nexoNotifyWarned?: boolean };
const queue = (g.nexoNotifyQueue ??= new Map<string, Pending>());

const owned = { select: { owners: { select: { id: true } } } };

async function recipients(scope: Scope, actorId: string) {
  const ids = new Set(scope.userIds ?? []);
  const [alliance, initiative, commitment] = await Promise.all([
    scope.allianceId ? db.alliance.findUnique({ where: { id: scope.allianceId }, ...owned }) : null,
    scope.initiativeId ? db.initiative.findUnique({ where: { id: scope.initiativeId }, ...owned }) : null,
    scope.commitmentId ? db.commitment.findUnique({ where: { id: scope.commitmentId }, ...owned }) : null,
  ]);
  for (const r of [alliance, initiative, commitment]) r?.owners.forEach((o) => ids.add(o.id));
  ids.delete(actorId);
  if (!ids.size) return [];
  return db.user.findMany({ where: { id: { in: [...ids] }, emailNotifications: true }, select: { email: true, name: true } });
}

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return "";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

// Nunca hace fallar la acción que lo llama.
export async function notify(actor: Actor, scope: Scope, text: string, path?: string) {
  try {
    const to = await recipients(scope, actor.id);
    if (!to.length) return;
    const base = path ? await baseUrl() : "";
    const item = { text: `${actor.name ?? "Alguien"} ${text}`, href: base && path ? base + path : undefined };
    for (const u of to) enqueue(u.email, u.name, item);
  } catch (e) {
    console.error("[avisos] no se pudo preparar el aviso", e);
  }
}

// Avisa a quienes se sumaron como responsables (no a los que ya estaban).
export async function notifyNewOwners(actor: Actor, before: string[], after: string[], what: string, path?: string) {
  const added = after.filter((id) => !before.includes(id));
  if (added.length) await notify(actor, { userIds: added }, `te sumó como responsable de ${what}`, path);
}

function enqueue(email: string, name: string, item: Item) {
  const pending = queue.get(email);
  if (pending) {
    // Sin repetir el mismo aviso dos veces seguidas (p. ej. doble guardado).
    if (!pending.items.some((i) => i.text === item.text)) pending.items.push(item);
    return;
  }
  const timer = setTimeout(() => {
    const p = queue.get(email);
    queue.delete(email);
    if (p) void send(email, p.name, p.items);
  }, DELAY_MS);
  timer.unref?.();
  queue.set(email, { name, items: [item], timer });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function send(email: string, name: string, items: Item[]) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (!g.nexoNotifyWarned) console.info("[avisos] RESEND_API_KEY o EMAIL_FROM sin configurar: no se envían emails.");
    g.nexoNotifyWarned = true;
    console.info(`[avisos] sin enviar a ${email}: ${items.map((i) => i.text).join(" | ")}`);
    return;
  }
  const subject = items.length === 1 ? `Nexo: ${items[0].text}` : `Nexo: ${items.length} novedades`;
  const first = name.split(" ")[0];
  const text = [`Hola ${first}, hay novedades en Nexo:`, "", ...items.map((i) => `- ${i.text}${i.href ? ` (${i.href})` : ""}`), "", "Podés dejar de recibir estos avisos desde Mi perfil en Nexo."].join("\n");
  const html = `<p>Hola ${esc(first)}, hay novedades en Nexo:</p><ul>${items
    .map((i) => `<li>${i.href ? `<a href="${esc(i.href)}">${esc(i.text)}</a>` : esc(i.text)}</li>`)
    .join("")}</ul><p style="color:#64748b;font-size:12px">Podés dejar de recibir estos avisos desde Mi perfil en Nexo.</p>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: subject.slice(0, 150), text, html }),
    });
    if (!res.ok) console.error("[avisos] Resend respondió", res.status, await res.text());
  } catch (e) {
    console.error("[avisos] no se pudo enviar el email", e);
  }
}
