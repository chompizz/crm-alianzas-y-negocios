import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ALLIANCE_STAGES,
  ALLIANCE_TYPES,
  DIMENSIONS,
  OFFERING_KINDS,
  ORGANIZATION_TYPES,
  PARTICIPANT_ROLES,
  RELATIONSHIP_LEVELS,
} from "@/lib/labels";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

// Carga masiva desde el chat: todo se referencia por nombre (no por id) para que
// Claude pueda pasar directo lo que la persona pegó o subió (texto, planilla, PDF).
export const importSchema = {
  organizaciones: z
    .array(
      z.object({
        nombre: z.string(),
        tipo: z.enum(keys(ORGANIZATION_TYPES)).optional(),
        sector: z.string().optional(),
        sitioWeb: z.string().optional(),
        descripcion: z.string().optional(),
        paises: z.array(z.string()).optional().describe("Códigos ISO o nombres"),
        capacidades: z.array(z.string()).optional(),
        grupo: z.string().optional().describe("Nombre de la casa matriz (puede venir en esta misma carga)"),
      }),
    )
    .optional(),
  contactos: z
    .array(
      z.object({
        nombre: z.string(),
        organizacion: z.string().describe("Nombre de la organización"),
        cargo: z.string().optional(),
        email: z.string().optional(),
        telefono: z.string().optional(),
        pais: z.string().optional(),
        relacion: z.enum(keys(RELATIONSHIP_LEVELS)).optional(),
        notas: z.string().optional(),
      }),
    )
    .optional(),
  catalogo: z
    .array(
      z.object({
        nombre: z.string(),
        tipo: z.enum(keys(OFFERING_KINDS)).optional().describe("Por defecto PRODUCTO"),
        descripcion: z.string().optional(),
        ofrecidoPor: z.array(z.string()).optional().describe("Nombres de organizaciones"),
      }),
    )
    .optional(),
  alianzas: z
    .array(
      z.object({
        nombre: z.string(),
        pais: z.string(),
        tipo: z.enum(keys(ALLIANCE_TYPES)).optional(),
        dimension: z.enum(keys(DIMENSIONS)).optional(),
        etapa: z.enum(keys(ALLIANCE_STAGES)).optional(),
        valorEsperadoUSD: z.number().nonnegative().optional(),
        objetivos: z.string().optional(),
        participantes: z
          .array(z.object({ organizacion: z.string(), rol: z.enum(keys(PARTICIPANT_ROLES)).optional(), detalle: z.string().optional() }))
          .optional(),
        productos: z.array(z.string()).optional().describe("Nombres de ítems del catálogo"),
      }),
    )
    .optional(),
  oportunidades: z
    .array(
      z.object({
        titulo: z.string(),
        alianza: z.string().describe("Nombre de la alianza"),
        valorEstimadoUSD: z.number().nonnegative().optional(),
        probabilidad: z.number().int().min(0).max(100).optional(),
        dimension: z.enum(keys(DIMENSIONS)).optional(),
        descripcion: z.string().optional(),
      }),
    )
    .optional(),
};

const importObject = z.object(importSchema);
export type ImportInput = z.infer<typeof importObject>;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

class Rollback extends Error {}

type Tx = Prisma.TransactionClient;

export async function importData(input: ImportInput, simulate: boolean) {
  const report = {
    simulacion: simulate,
    creados: [] as string[],
    actualizados: [] as string[],
    yaExistian: [] as string[],
    errores: [] as string[],
  };

  const run = async (tx: Tx) => {
    const countries = await tx.country.findMany();
    const country = (v: string) => countries.find((c) => c.code === v.toUpperCase() || norm(c.name) === norm(v)) ?? null;

    // Índices por nombre normalizado; se completan a medida que se crean registros.
    const orgs = new Map((await tx.organization.findMany({ select: { id: true, name: true } })).map((o) => [norm(o.name), o.id]));
    const offerings = new Map((await tx.offering.findMany({ select: { id: true, name: true } })).map((o) => [norm(o.name), o.id]));
    const alliances = new Map(
      (await tx.alliance.findMany({ select: { id: true, name: true, countryCode: true } })).map((a) => [norm(a.name), a]),
    );

    for (const o of input.organizaciones ?? []) {
      const codes = (o.paises ?? []).map((p) => country(p)?.code ?? null);
      (o.paises ?? []).forEach((p, i) => !codes[i] && report.errores.push(`Organización "${o.nombre}": país no reconocido "${p}"`));
      const connect = codes.filter((c): c is string => !!c).map((code) => ({ code }));
      const existing = orgs.get(norm(o.nombre));
      if (existing) {
        // Suma solo países y capacidades que todavía no tenía.
        const cur = await tx.organization.findUniqueOrThrow({
          where: { id: existing },
          select: { capabilities: true, countries: { select: { code: true } } },
        });
        const newCountries = connect.filter((c) => !cur.countries.some((x) => x.code === c.code));
        const newCaps = (o.capacidades ?? []).filter((c) => !cur.capabilities.some((x) => norm(x) === norm(c)));
        if (newCountries.length || newCaps.length) {
          await tx.organization.update({
            where: { id: existing },
            data: { countries: { connect: newCountries }, capabilities: [...cur.capabilities, ...newCaps] },
          });
          report.actualizados.push(`Organización: ${o.nombre}`);
        } else report.yaExistian.push(`Organización: ${o.nombre}`);
        continue;
      }
      const created = await tx.organization.create({
        data: {
          name: o.nombre.trim(),
          type: o.tipo ?? "EMPRESA",
          sector: o.sector,
          website: o.sitioWeb,
          description: o.descripcion,
          capabilities: o.capacidades ?? [],
          countries: { connect },
        },
      });
      orgs.set(norm(o.nombre), created.id);
      report.creados.push(`Organización: ${o.nombre}`);
    }

    // Grupos al final, por si la casa matriz viene en la misma carga.
    for (const o of input.organizaciones ?? []) {
      if (!o.grupo) continue;
      const parent = orgs.get(norm(o.grupo));
      const child = orgs.get(norm(o.nombre));
      if (!parent) report.errores.push(`Organización "${o.nombre}": no existe el grupo "${o.grupo}"`);
      else if (child && parent !== child) await tx.organization.update({ where: { id: child }, data: { parentId: parent } });
    }

    for (const c of input.contactos ?? []) {
      const organizationId = orgs.get(norm(c.organizacion));
      if (!organizationId) {
        report.errores.push(`Contacto "${c.nombre}": no existe la organización "${c.organizacion}"`);
        continue;
      }
      const email = c.email?.trim().toLowerCase();
      const dup = await tx.contact.findFirst({
        where: email
          ? { email: { equals: email, mode: "insensitive" } }
          : { organizationId, name: { equals: c.nombre.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (dup) {
        report.yaExistian.push(`Contacto: ${c.nombre}`);
        continue;
      }
      const cc = c.pais ? country(c.pais) : null;
      if (c.pais && !cc) report.errores.push(`Contacto "${c.nombre}": país no reconocido "${c.pais}" (se cargó sin país)`);
      await tx.contact.create({
        data: {
          name: c.nombre.trim(),
          organizationId,
          position: c.cargo,
          email,
          phone: c.telefono,
          notes: c.notas,
          relationshipLevel: c.relacion ?? "TIBIA",
          countryCode: cc?.code,
        },
      });
      report.creados.push(`Contacto: ${c.nombre}`);
    }

    for (const f of input.catalogo ?? []) {
      const offeredBy = (f.ofrecidoPor ?? []).flatMap((n) => {
        const id = orgs.get(norm(n));
        if (!id) report.errores.push(`Catálogo "${f.nombre}": no existe la organización "${n}"`);
        return id ? [{ id }] : [];
      });
      const existing = offerings.get(norm(f.nombre));
      if (existing) {
        const cur = await tx.offering.findUniqueOrThrow({ where: { id: existing }, select: { organizations: { select: { id: true } } } });
        const newOrgs = offeredBy.filter((o) => !cur.organizations.some((x) => x.id === o.id));
        if (newOrgs.length) {
          await tx.offering.update({ where: { id: existing }, data: { organizations: { connect: newOrgs } } });
          report.actualizados.push(`Catálogo: ${f.nombre}`);
        } else report.yaExistian.push(`Catálogo: ${f.nombre}`);
        continue;
      }
      const created = await tx.offering.create({
        data: { name: f.nombre.trim(), kind: f.tipo ?? "PRODUCTO", description: f.descripcion, organizations: { connect: offeredBy } },
      });
      offerings.set(norm(f.nombre), created.id);
      report.creados.push(`Catálogo: ${f.nombre}`);
    }

    for (const a of input.alianzas ?? []) {
      const cc = country(a.pais);
      if (!cc) {
        report.errores.push(`Alianza "${a.nombre}": país no reconocido "${a.pais}"`);
        continue;
      }
      let alliance = alliances.get(norm(a.nombre));
      if (alliance) report.yaExistian.push(`Alianza: ${a.nombre}`);
      else {
        const created = await tx.alliance.create({
          data: {
            name: a.nombre.trim(),
            countryCode: cc.code,
            type: a.tipo ?? "COMERCIAL",
            dimension: a.dimension ?? "ESTRATEGIA",
            stage: a.etapa ?? "EXPLORACION",
            expectedValue: a.valorEsperadoUSD,
            objectives: a.objetivos,
          },
        });
        alliance = { id: created.id, name: created.name, countryCode: created.countryCode };
        alliances.set(norm(a.nombre), alliance);
        report.creados.push(`Alianza: ${a.nombre} (${cc.name})`);
      }
      for (const p of a.participantes ?? []) {
        const organizationId = orgs.get(norm(p.organizacion));
        if (!organizationId) {
          report.errores.push(`Alianza "${a.nombre}": no existe la organización "${p.organizacion}"`);
          continue;
        }
        await tx.allianceParticipant.upsert({
          where: { allianceId_organizationId: { allianceId: alliance.id, organizationId } },
          update: { roleType: p.rol ?? "SOCIO", role: p.detalle },
          create: { allianceId: alliance.id, organizationId, roleType: p.rol ?? "SOCIO", role: p.detalle },
        });
      }
      const products = (a.productos ?? []).flatMap((n) => {
        const id = offerings.get(norm(n));
        if (!id) report.errores.push(`Alianza "${a.nombre}": no existe en el catálogo "${n}"`);
        return id ? [{ id }] : [];
      });
      if (products.length) await tx.alliance.update({ where: { id: alliance.id }, data: { offerings: { connect: products } } });
    }

    for (const o of input.oportunidades ?? []) {
      const alliance = alliances.get(norm(o.alianza));
      if (!alliance) {
        report.errores.push(`Oportunidad "${o.titulo}": no existe la alianza "${o.alianza}"`);
        continue;
      }
      const dup = await tx.opportunity.findFirst({
        where: { allianceId: alliance.id, title: { equals: o.titulo.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (dup) {
        report.yaExistian.push(`Oportunidad: ${o.titulo}`);
        continue;
      }
      await tx.opportunity.create({
        data: {
          allianceId: alliance.id,
          title: o.titulo.trim(),
          description: o.descripcion,
          estimatedValue: o.valorEstimadoUSD,
          probability: o.probabilidad,
          dimension: o.dimension ?? "VENTAS",
        },
      });
      report.creados.push(`Oportunidad: ${o.titulo} (${alliance.name})`);
    }

    // En simulación se deshace todo al final, así el reporte refleja exactamente lo que pasaría.
    if (simulate) throw new Rollback();
  };

  try {
    await db.$transaction(run, { timeout: 60_000, maxWait: 10_000 });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return report;
}
