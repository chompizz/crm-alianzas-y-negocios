import { db, INTERNAL_USERS } from "@/lib/db";

export function initiativeFormOptions() {
  return Promise.all([
    db.user.findMany({ where: INTERNAL_USERS, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.alliance.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, country: { select: { name: true } } } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
}
