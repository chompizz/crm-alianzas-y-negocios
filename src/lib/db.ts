import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Usuarios del equipo interno (las cuentas de partner quedan fuera de responsables y listados).
export const INTERNAL_USERS = { role: { not: "PARTNER" } } as const;
