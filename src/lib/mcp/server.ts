import bcrypt from "bcryptjs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { User } from "@prisma/client";
import { z } from "zod";
import { stageDefaults } from "@/lib/alliance-stage";
import { userForToken } from "@/lib/api-tokens";
import { revenueByCountry } from "@/lib/country-revenue";
import { dimensionSummary } from "@/lib/dimension-summary";
import { importData, importSchema } from "@/lib/mcp/import";
import { convertInitiative, convertOpportunity, salesFlowSummary } from "@/lib/sales-flow";
import { db } from "@/lib/db";
import { notify, notifyNewOwners } from "@/lib/notify";
import { connectOwners, ownersSelect, setOwners } from "@/lib/owners";
import { parseDate, startOfTodayUtc } from "@/lib/format";
import {
  ALLIANCE_STAGES,
  ALLIANCE_TYPES,
  CLIENT_STATUSES,
  COMMITMENT_PARTIES,
  COMMITMENT_STATUSES,
  DIMENSION_DESCRIPTIONS,
  DIMENSIONS,
  HEALTH,
  INTERACTION_TYPES,
  OFFERING_KINDS,
  OPPORTUNITY_STATUSES,
  ORGANIZATION_TYPES,
  PARTICIPANT_ROLES,
  RELATIONSHIP_LEVELS,
  ROLES,
} from "@/lib/labels";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const dimension = () => z.enum(keys(DIMENSIONS)).describe("GOBERNANZA, ESTRATEGIA, PRODUCTO o VENTAS");

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

// Acepta código ISO ("PE") o nombre ("Perú", "peru").
async function resolveCountry(input: string) {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const countries = await db.country.findMany();
  return countries.find((c) => c.code === input.toUpperCase() || norm(c.name) === norm(input)) ?? null;
}

// Ids de usuario existentes, sin repetir; null si alguno no existe.
async function validUsers(ids: string[]) {
  const unique = [...new Set(ids)];
  const found = await db.user.count({ where: { id: { in: unique } } });
  return found === unique.length ? unique : null;
}

function buildServer(user: User) {
  const server = new McpServer(
    { name: "nexo", version: "1.0.0" },
    {
      instructions:
        "Nexo es el CRM interno de alianzas, estrategia y negocios del equipo. Cada alianza pertenece a un país; " +
        "una organización puede operar en varios países y pertenecer a un grupo (casa matriz con filiales). Cada organización participa en una alianza con un rol " +
        "(líder, socio, proveedor, cliente, canal, integrador, financiador, institucional u otro). El catálogo guarda productos, servicios y otros, " +
        "que se asignan a organizaciones (lo que ofrecen) y a alianzas (lo que se vende o entrega). Cada alianza puede tener muchos clientes, " +
        "con estado (prospecto, activo, inactivo) y facturación anual. El flujo de ventas va de iniciativa a oportunidad y de oportunidad ganada a cliente " +
        "(convertir_iniciativa_en_oportunidad, convertir_oportunidad_en_cliente, resumen_flujo_ventas). " +
        "Alianzas, iniciativas y compromisos pueden tener varios responsables internos (asignar_responsables); cuando alguien cambia algo, " +
        "los demás responsables reciben un aviso por email (configurar_avisos para activarlo o desactivarlo). Usá las herramientas de lectura antes de crear registros " +
        "para no duplicar, y confirmá con la persona antes de crear o modificar datos. Fechas en formato AAAA-MM-DD. " +
        "Para cargar información que la persona pega o sube (texto, notas de reunión, planillas, PDF), extraé los datos y usá importar_datos: " +
        "primero con simular=true para mostrarle qué se va a crear, y después de su confirmación con simular=false. " +
        "El trabajo se organiza en cuatro dimensiones: Gobernanza, Estrategia, Producto y Ventas; alianzas, iniciativas y oportunidades pertenecen a una.",
    },
  );

  server.registerTool(
    "listar_paises",
    { title: "Listar países", description: "Países disponibles con su código ISO.", annotations: { readOnlyHint: true } },
    async () => json(await db.country.findMany({ orderBy: { name: "asc" } })),
  );

  server.registerTool(
    "resumen_portafolio",
    {
      title: "Resumen del portafolio",
      description: "Alianzas abiertas por país y etapa, valor esperado, compromisos vencidos y oportunidades abiertas.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const today = startOfTodayUtc();
      const [alliances, overdue, opportunities] = await Promise.all([
        db.alliance.findMany({ where: { stage: { not: "CERRADA" } }, include: { country: true } }),
        db.commitment.count({ where: { status: "PENDIENTE", dueDate: { lt: today } } }),
        db.opportunity.findMany({ where: { status: "ABIERTA" }, select: { estimatedValue: true, probability: true } }),
      ]);
      const byCountry: Record<string, Record<string, number>> = {};
      for (const a of alliances) {
        byCountry[a.country.name] ??= {};
        byCountry[a.country.name][ALLIANCE_STAGES[a.stage]] = (byCountry[a.country.name][ALLIANCE_STAGES[a.stage]] ?? 0) + 1;
      }
      return json({
        alianzasAbiertas: alliances.length,
        valorEsperadoUSD: alliances.reduce((s, a) => s + Number(a.expectedValue ?? 0), 0),
        alianzasEnRojo: alliances.filter((a) => a.health === "ROJO").map((a) => a.name),
        porPaisYEtapa: byCountry,
        compromisosVencidos: overdue,
        oportunidadesAbiertas: opportunities.length,
        valorPonderadoOportunidadesUSD: opportunities.reduce((s, o) => s + Number(o.estimatedValue ?? 0) * ((o.probability ?? 0) / 100), 0),
      });
    },
  );

  server.registerTool(
    "resumen_dimensiones",
    {
      title: "Resumen por dimensión",
      description:
        "Estado de las cuatro dimensiones (Gobernanza, Estrategia, Producto, Ventas): alianzas abiertas y su valor, " +
        "iniciativas y su avance promedio, oportunidades abiertas ponderadas y compromisos pendientes.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      json(
        (await dimensionSummary()).map((d) => ({
          dimension: DIMENSIONS[d.dimension],
          incluye: DIMENSION_DESCRIPTIONS[d.dimension],
          alianzasAbiertas: d.openAlliances,
          valorEsperadoAlianzasUSD: d.allianceValue,
          iniciativas: d.initiatives,
          avancePromedioIniciativas: d.avgProgress,
          oportunidadesAbiertas: d.openOpportunities,
          oportunidadesPonderadasUSD: Math.round(d.weightedOpportunities),
          compromisosPendientes: d.pendingCommitments,
          alianzasRecientes: d.recentAlliances.map((a) => `${a.name} (${a.country})`),
          iniciativasRecientes: d.recentInitiatives.map((i) => `${i.name} (${i.progress}%)`),
        })),
      ),
  );

  server.registerTool(
    "listar_iniciativas",
    {
      title: "Listar iniciativas",
      description: "Iniciativas con su dimensión, avance, responsable y alianzas que las impulsan. Filtro opcional por dimensión.",
      inputSchema: { dimension: dimension().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ dimension }) => {
      const initiatives = await db.initiative.findMany({
        where: dimension ? { dimension } : {},
        orderBy: { updatedAt: "desc" },
        include: { ...ownersSelect, alliances: { select: { name: true } } },
      });
      return json(
        initiatives.map((i) => ({
          id: i.id,
          nombre: i.name,
          dimension: DIMENSIONS[i.dimension],
          objetivo: i.objective,
          avance: i.progress,
          responsables: i.owners.map((o) => o.name),
          alianzas: i.alliances.map((a) => a.name),
        })),
      );
    },
  );

  server.registerTool(
    "facturacion_por_pais",
    {
      title: "Facturación potencial por país",
      description:
        "Lo mismo que muestra el mapa del tablero: por cada país, las oportunidades abiertas de sus alianzas consolidadas: " +
        "cantidad, facturación potencial (suma del valor estimado) y valor ponderado por probabilidad. Ordenado de mayor a menor.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      json(
        (await revenueByCountry()).map((r) => ({
          codigo: r.code,
          pais: r.name,
          oportunidadesAbiertas: r.opportunities,
          alianzasConOportunidades: r.alliances,
          facturacionPotencialUSD: r.potential,
          valorPonderadoUSD: Math.round(r.weightedOpportunities),
        })),
      ),
  );

  server.registerTool(
    "buscar_organizaciones",
    {
      title: "Buscar organizaciones",
      description: "Busca organizaciones del ecosistema por nombre y/o país.",
      inputSchema: { texto: z.string().optional(), pais: z.string().optional().describe("Código ISO o nombre") },
      annotations: { readOnlyHint: true },
    },
    async ({ texto, pais }) => {
      const country = pais ? await resolveCountry(pais) : null;
      if (pais && !country) return fail(`No encontré el país "${pais}". Usá listar_paises.`);
      const orgs = await db.organization.findMany({
        where: {
          ...(texto ? { name: { contains: texto, mode: "insensitive" } } : {}),
          ...(country ? { countries: { some: { code: country.code } } } : {}),
        },
        orderBy: { name: "asc" },
        take: 50,
        include: { countries: true, _count: { select: { contacts: true, participations: true } } },
      });
      return json(
        orgs.map((o) => ({
          id: o.id,
          nombre: o.name,
          tipo: ORGANIZATION_TYPES[o.type],
          sector: o.sector,
          paises: o.countries.map((c) => c.name),
          contactos: o._count.contacts,
          alianzas: o._count.participations,
        })),
      );
    },
  );

  server.registerTool(
    "ver_organizacion",
    {
      title: "Ver organización",
      description: "Ficha de una organización con contactos y alianzas en las que participa.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const o = await db.organization.findUnique({
        where: { id },
        include: {
          countries: true,
          contacts: { include: { country: true } },
          participations: { include: { alliance: { include: { country: true } } } },
          parent: { select: { id: true, name: true } },
          subsidiaries: { select: { id: true, name: true } },
          offerings: true,
          clientOf: { include: { alliance: { select: { id: true, name: true } } } },
        },
      });
      if (!o) return fail("No existe esa organización.");
      return json({
        id: o.id,
        nombre: o.name,
        tipo: ORGANIZATION_TYPES[o.type],
        sector: o.sector,
        sitioWeb: o.website,
        descripcion: o.description,
        capacidades: o.capabilities,
        paises: o.countries.map((c) => c.name),
        grupo: o.parent ? { id: o.parent.id, nombre: o.parent.name } : null,
        filiales: o.subsidiaries.map((f) => ({ id: f.id, nombre: f.name })),
        ofertas: o.offerings.map((f) => ({ id: f.id, nombre: f.name, tipo: OFFERING_KINDS[f.kind] })),
        clienteDe: o.clientOf.map((c) => ({
          alianzaId: c.allianceId,
          alianza: c.alliance.name,
          estado: CLIENT_STATUSES[c.status],
          facturacionAnualUSD: c.revenue ? Number(c.revenue) : null,
        })),
        contactos: o.contacts.map((c) => ({ id: c.id, nombre: c.name, cargo: c.position, email: c.email, pais: c.country?.name })),
        alianzas: o.participations.map((p) => ({
          id: p.allianceId,
          nombre: p.alliance.name,
          pais: p.alliance.country.name,
          rol: PARTICIPANT_ROLES[p.roleType],
          detalleRol: p.role,
          etapa: ALLIANCE_STAGES[p.alliance.stage],
        })),
      });
    },
  );

  server.registerTool(
    "crear_organizacion",
    {
      title: "Crear organización",
      description: "Crea una organización. Antes, buscala con buscar_organizaciones para no duplicarla.",
      inputSchema: {
        nombre: z.string(),
        tipo: z.enum(keys(ORGANIZATION_TYPES)).optional(),
        sector: z.string().optional(),
        paises: z.array(z.string()).optional().describe("Códigos ISO o nombres"),
        capacidades: z.array(z.string()).optional(),
        descripcion: z.string().optional(),
      },
    },
    async ({ nombre, tipo, sector, paises = [], capacidades = [], descripcion }) => {
      const countries = await Promise.all(paises.map(resolveCountry));
      const missing = paises.filter((_, i) => !countries.at(i));
      if (missing.length) return fail(`Países no reconocidos: ${missing.join(", ")}.`);
      const org = await db.organization.create({
        data: {
          name: nombre,
          type: tipo ?? "EMPRESA",
          sector,
          description: descripcion,
          capabilities: capacidades,
          countries: { connect: countries.map((c) => ({ code: c!.code })) },
        },
      });
      return json({ creada: true, id: org.id, nombre: org.name });
    },
  );

  server.registerTool(
    "listar_alianzas",
    {
      title: "Listar alianzas",
      description: "Alianzas filtradas por país, etapa, dimensión o texto.",
      inputSchema: {
        pais: z.string().optional(),
        dimension: dimension().optional(),
        etapa: z.enum(keys(ALLIANCE_STAGES)).optional(),
        texto: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pais, etapa, texto, dimension }) => {
      const country = pais ? await resolveCountry(pais) : null;
      if (pais && !country) return fail(`No encontré el país "${pais}".`);
      const alliances = await db.alliance.findMany({
        where: {
          ...(country ? { countryCode: country.code } : {}),
          ...(etapa ? { stage: etapa } : {}),
          ...(dimension ? { dimension } : {}),
          ...(texto ? { name: { contains: texto, mode: "insensitive" } } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          country: true,
          ...ownersSelect,
          participants: { include: { organization: { select: { name: true } } } },
        },
      });
      return json(
        alliances.map((a) => ({
          id: a.id,
          nombre: a.name,
          pais: a.country.name,
          tipo: ALLIANCE_TYPES[a.type],
          dimension: DIMENSIONS[a.dimension],
          etapa: ALLIANCE_STAGES[a.stage],
          salud: HEALTH[a.health],
          responsables: a.owners.map((o) => o.name),
          valorEsperadoUSD: a.expectedValue ? Number(a.expectedValue) : null,
          participantes: a.participants.map((p) => p.organization.name),
        })),
      );
    },
  );

  server.registerTool(
    "ver_alianza",
    {
      title: "Ver alianza",
      description: "Detalle de una alianza: participantes, últimas interacciones, compromisos, oportunidades e iniciativas.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const a = await db.alliance.findUnique({
        where: { id },
        include: {
          country: true,
          ...ownersSelect,
          participants: { include: { organization: { select: { id: true, name: true } } } },
          interactions: { orderBy: { date: "desc" }, take: 10, include: { contacts: { select: { name: true } } } },
          commitments: { orderBy: { dueDate: "asc" }, include: ownersSelect },
          opportunities: true,
          initiatives: { select: { id: true, name: true, progress: true } },
          offerings: true,
          clients: { include: { organization: { select: { id: true, name: true } } } },
        },
      });
      if (!a) return fail("No existe esa alianza.");
      return json({
        id: a.id,
        nombre: a.name,
        pais: a.country.name,
        tipo: ALLIANCE_TYPES[a.type],
        dimension: DIMENSIONS[a.dimension],
        etapa: ALLIANCE_STAGES[a.stage],
        salud: HEALTH[a.health],
        objetivos: a.objectives,
        responsables: a.owners.map((o) => o.name),
        valorEsperadoUSD: a.expectedValue ? Number(a.expectedValue) : null,
        inicio: day(a.startDate),
        renovacion: day(a.renewalDate),
        participantes: a.participants.map((p) => ({
          id: p.organization.id,
          nombre: p.organization.name,
          rol: PARTICIPANT_ROLES[p.roleType],
          detalleRol: p.role,
        })),
        ofertas: a.offerings.map((f) => ({ id: f.id, nombre: f.name, tipo: OFFERING_KINDS[f.kind] })),
        clientes: a.clients.map((c) => ({
          id: c.id,
          organizacionId: c.organization.id,
          nombre: c.organization.name,
          estado: CLIENT_STATUSES[c.status],
          facturacionAnualUSD: c.revenue ? Number(c.revenue) : null,
          desde: day(c.since),
          notas: c.notes,
        })),
        ultimasInteracciones: a.interactions.map((i) => ({
          fecha: day(i.date),
          tipo: INTERACTION_TYPES[i.type],
          resumen: i.summary,
          con: i.contacts.map((c) => c.name),
        })),
        compromisos: a.commitments.map((c) => ({
          id: c.id,
          descripcion: c.description,
          parte: COMMITMENT_PARTIES[c.party],
          responsables: c.owners.map((o) => o.name),
          fecha: day(c.dueDate),
          estado: COMMITMENT_STATUSES[c.status],
        })),
        oportunidades: a.opportunities.map((o) => ({
          id: o.id,
          titulo: o.title,
          valorUSD: o.estimatedValue ? Number(o.estimatedValue) : null,
          probabilidad: o.probability,
          estado: o.status,
          dimension: DIMENSIONS[o.dimension],
        })),
        iniciativas: a.initiatives.map((i) => ({ id: i.id, nombre: i.name, avance: i.progress })),
      });
    },
  );

  server.registerTool(
    "crear_alianza",
    {
      title: "Crear alianza",
      description: "Crea una alianza en un país, opcionalmente con organizaciones participantes (por id).",
      inputSchema: {
        nombre: z.string(),
        pais: z.string().describe("Código ISO o nombre"),
        tipo: z.enum(keys(ALLIANCE_TYPES)).optional(),
        etapa: z.enum(keys(ALLIANCE_STAGES)).optional(),
        dimension: dimension().optional(),
        objetivos: z.string().optional(),
        valorEsperadoUSD: z.number().nonnegative().optional(),
        organizaciones: z.array(z.string()).optional().describe("Ids de organizaciones participantes"),
        responsables: z.array(z.string()).optional().describe("Ids de usuario (listar_usuarios); por defecto quien usa el conector"),
      },
    },
    async ({ nombre, pais, tipo, etapa, dimension, objetivos, valorEsperadoUSD, organizaciones = [], responsables }) => {
      const country = await resolveCountry(pais);
      if (!country) return fail(`No encontré el país "${pais}".`);
      const owners = responsables ? await validUsers(responsables) : [user.id];
      if (!owners) return fail("Algún responsable no existe (ver listar_usuarios).");
      const a = await db.alliance.create({
        data: {
          name: nombre,
          countryCode: country.code,
          type: tipo ?? "COMERCIAL",
          stage: etapa ?? "EXPLORACION",
          dimension: dimension ?? "ESTRATEGIA",
          objectives: objetivos,
          expectedValue: valorEsperadoUSD,
          owners: connectOwners(owners),
          participants: { create: organizaciones.map((organizationId) => ({ organizationId })) },
        },
      });
      await notifyNewOwners(user, [], owners, `la alianza "${a.name}"`, `/alianzas/${a.id}`);
      return json({ creada: true, id: a.id, nombre: a.name, pais: country.name });
    },
  );

  server.registerTool(
    "actualizar_alianza",
    {
      title: "Actualizar alianza",
      description:
        "Cambia la etapa, la salud, la dimensión, el valor esperado, los responsables, las fechas o los objetivos de una alianza. " +
        "Al pasar a ACTIVA, si no tenía fecha de inicio toma la de hoy.",
      inputSchema: {
        id: z.string(),
        etapa: z.enum(keys(ALLIANCE_STAGES)).optional(),
        salud: z.enum(keys(HEALTH)).optional(),
        dimension: dimension().optional(),
        valorEsperadoUSD: z.number().nonnegative().optional(),
        objetivos: z.string().optional(),
        responsables: z
          .array(z.string())
          .optional()
          .describe("Ids de usuario (listar_usuarios); reemplaza la lista completa, [] la vacía. Para sumar o quitar uno usá asignar_responsables"),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("AAAA-MM-DD; null para borrarla"),
        renovacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("AAAA-MM-DD; null para borrarla"),
      },
    },
    async ({ id, etapa, salud, dimension, valorEsperadoUSD, objetivos, responsables, inicio, renovacion }) => {
      const current = await db.alliance.findUnique({ where: { id }, select: { startDate: true, owners: { select: { id: true } } } });
      if (!current) return fail("No existe esa alianza.");
      const before = current.owners.map((o) => o.id);
      const owners = responsables ? await validUsers(responsables) : undefined;
      if (owners === null) return fail("Algún responsable no existe (ver listar_usuarios).");
      const date = (v: string | null | undefined) => (v === undefined ? undefined : parseDate(v));
      const startDate = date(inicio);
      const a = await db.alliance.update({
        where: { id },
        data: {
          ...(etapa ? stageDefaults(etapa, { startDate: startDate === undefined ? current.startDate : startDate }) : {}),
          stage: etapa,
          health: salud,
          dimension,
          expectedValue: valorEsperadoUSD,
          objectives: objetivos,
          ...(owners ? { owners: setOwners(owners) } : {}),
          ...(startDate !== undefined ? { startDate } : {}),
          renewalDate: date(renovacion),
        },
        include: ownersSelect,
      });
      await notify(user, { userIds: before }, `actualizó la alianza "${a.name}" desde Claude`, `/alianzas/${id}`);
      if (owners) await notifyNewOwners(user, before, owners, `la alianza "${a.name}"`, `/alianzas/${id}`);
      return json({
        actualizada: true,
        id: a.id,
        etapa: ALLIANCE_STAGES[a.stage],
        salud: HEALTH[a.health],
        dimension: DIMENSIONS[a.dimension],
        valorEsperadoUSD: a.expectedValue ? Number(a.expectedValue) : null,
        responsables: a.owners.map((o) => o.name),
        inicio: day(a.startDate),
        renovacion: day(a.renewalDate),
      });
    },
  );

  server.registerTool(
    "registrar_interaccion",
    {
      title: "Registrar interacción",
      description: "Registra una reunión, llamada o nota en una alianza, con los compromisos que salieron de ella.",
      inputSchema: {
        alianzaId: z.string(),
        resumen: z.string(),
        fecha: z.string().optional().describe("AAAA-MM-DD; por defecto hoy"),
        tipo: z.enum(keys(INTERACTION_TYPES)).optional(),
        compromisos: z
          .array(
            z.object({
              descripcion: z.string(),
              parte: z.enum(keys(COMMITMENT_PARTIES)).optional().describe("NOSOTROS o SOCIO"),
              fecha: z.string().optional().describe("Fecha límite AAAA-MM-DD"),
              responsables: z.array(z.string()).optional().describe("Ids de usuario; por defecto quien usa el conector (solo si la parte es NOSOTROS)"),
            }),
          )
          .optional(),
      },
    },
    async ({ alianzaId, resumen, fecha, tipo, compromisos = [] }) => {
      const exists = await db.alliance.findUnique({ where: { id: alianzaId }, select: { id: true, name: true } });
      if (!exists) return fail("No existe esa alianza.");
      const owners: string[][] = [];
      for (const c of compromisos) {
        const ids = (c.parte ?? "NOSOTROS") !== "NOSOTROS" ? [] : c.responsables ? await validUsers(c.responsables) : [user.id];
        if (!ids) return fail(`Algún responsable de "${c.descripcion}" no existe (ver listar_usuarios).`);
        owners.push(ids);
      }
      const interaction = await db.interaction.create({
        data: {
          allianceId: alianzaId,
          authorId: user.id,
          date: parseDate(fecha ?? null) ?? new Date(),
          type: tipo ?? "REUNION",
          summary: resumen,
          commitments: {
            create: compromisos.map((c, i) => ({
              allianceId: alianzaId,
              description: c.descripcion,
              party: c.parte ?? "NOSOTROS",
              owners: connectOwners(owners[i]),
              dueDate: parseDate(c.fecha ?? null),
            })),
          },
        },
        include: { commitments: { select: { id: true, description: true } } },
      });
      const extra = compromisos.length ? ` con ${compromisos.length} ${compromisos.length === 1 ? "compromiso" : "compromisos"}` : "";
      await notify(
        user,
        { allianceId: alianzaId, userIds: owners.flat() },
        `registró una interacción en "${exists.name}"${extra}: ${resumen.slice(0, 120)}`,
        `/alianzas/${alianzaId}`,
      );
      return json({ registrada: true, id: interaction.id, compromisosCreados: interaction.commitments });
    },
  );

  server.registerTool(
    "listar_compromisos",
    {
      title: "Listar compromisos",
      description: "Compromisos pendientes, vencidos o todos; opcionalmente por país.",
      inputSchema: {
        vista: z.enum(["pendientes", "vencidos", "todos"]).optional(),
        pais: z.string().optional(),
        soloMios: z.boolean().optional().describe("Solo los asignados a quien usa el conector"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ vista = "pendientes", pais, soloMios }) => {
      const country = pais ? await resolveCountry(pais) : null;
      if (pais && !country) return fail(`No encontré el país "${pais}".`);
      const commitments = await db.commitment.findMany({
        where: {
          ...(vista !== "todos" ? { status: "PENDIENTE" as const } : {}),
          ...(vista === "vencidos" ? { dueDate: { lt: startOfTodayUtc() } } : {}),
          ...(soloMios ? { owners: { some: { id: user.id } } } : {}),
          ...(country
            ? { OR: [{ alliance: { countryCode: country.code } }, { initiative: { alliances: { some: { countryCode: country.code } } } }] }
            : {}),
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        take: 100,
        include: { ...ownersSelect, alliance: { select: { id: true, name: true } }, initiative: { select: { id: true, name: true } } },
      });
      return json(
        commitments.map((c) => ({
          id: c.id,
          descripcion: c.description,
          alianza: c.alliance?.name ?? null,
          iniciativa: c.initiative?.name ?? null,
          parte: COMMITMENT_PARTIES[c.party],
          responsables: c.owners.map((o) => o.name),
          fecha: day(c.dueDate),
          estado: COMMITMENT_STATUSES[c.status],
        })),
      );
    },
  );

  server.registerTool(
    "actualizar_compromiso",
    {
      title: "Actualizar compromiso",
      description:
        "Cambia el estado (cumplido, cancelado o pendiente), la descripción, la parte o la fecha límite de un compromiso. " +
        "Para sus responsables usá asignar_responsables.",
      inputSchema: {
        id: z.string(),
        estado: z.enum(keys(COMMITMENT_STATUSES)).optional(),
        descripcion: z.string().optional(),
        parte: z.enum(keys(COMMITMENT_PARTIES)).optional().describe("NOSOTROS o SOCIO"),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("AAAA-MM-DD; null para borrarla"),
      },
    },
    async ({ id, estado, descripcion, parte, fecha }) => {
      const exists = await db.commitment.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return fail("No existe ese compromiso.");
      const c = await db.commitment.update({
        where: { id },
        data: {
          status: estado,
          description: descripcion,
          party: parte,
          ...(fecha !== undefined ? { dueDate: parseDate(fecha) } : {}),
          ...(parte === "SOCIO" ? { owners: { set: [] } } : {}),
        },
      });
      await notify(
        user,
        { allianceId: c.allianceId, initiativeId: c.initiativeId, commitmentId: c.id },
        estado && !descripcion && !parte && fecha === undefined
          ? `marcó "${c.description}" como ${COMMITMENT_STATUSES[c.status].toLowerCase()}`
          : `editó el compromiso "${c.description}"`,
        c.allianceId ? `/alianzas/${c.allianceId}` : c.initiativeId ? `/iniciativas/${c.initiativeId}` : "/compromisos",
      );
      return json({ actualizado: true, id: c.id, estado: COMMITMENT_STATUSES[c.status] });
    },
  );

  server.registerTool(
    "crear_oportunidad",
    {
      title: "Crear oportunidad",
      description: "Crea una oportunidad de negocio en una alianza.",
      inputSchema: {
        alianzaId: z.string(),
        titulo: z.string(),
        descripcion: z.string().optional(),
        valorEstimadoUSD: z.number().nonnegative().optional(),
        probabilidad: z.number().int().min(0).max(100).optional(),
        dimension: dimension().optional().describe("Por defecto VENTAS"),
      },
    },
    async ({ alianzaId, titulo, descripcion, valorEstimadoUSD, probabilidad, dimension }) => {
      const exists = await db.alliance.findUnique({ where: { id: alianzaId }, select: { id: true, name: true } });
      if (!exists) return fail("No existe esa alianza.");
      const o = await db.opportunity.create({
        data: { allianceId: alianzaId, title: titulo, description: descripcion, estimatedValue: valorEstimadoUSD, probability: probabilidad, dimension: dimension ?? "VENTAS" },
      });
      await notify(user, { allianceId: alianzaId }, `creó la oportunidad "${o.title}" en "${exists.name}"`, "/oportunidades");
      return json({ creada: true, id: o.id, titulo: o.title });
    },
  );

  server.registerTool(
    "listar_usuarios",
    {
      title: "Listar usuarios",
      description: "Personas del equipo con acceso a Nexo (id, nombre, email, rol). Sirve para asignar responsables.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      json(
        (await db.user.findMany({ orderBy: { name: "asc" } })).map((u) => ({ id: u.id, nombre: u.name, email: u.email, rol: ROLES[u.role] })),
      ),
  );

  const soloAdmin = () => (user.role === "ADMIN" ? null : fail("Solo un administrador puede gestionar usuarios."));
  const rol = z.enum(keys(ROLES));

  server.registerTool(
    "crear_usuario",
    {
      title: "Crear usuario (admin)",
      description: "Da de alta a una persona del equipo. Solo administradores. La contraseña inicial debe tener 8 caracteres o más.",
      inputSchema: { nombre: z.string(), email: z.string().email(), contrasenaInicial: z.string().min(8), rol: rol.optional() },
    },
    async ({ nombre, email, contrasenaInicial, rol }) => {
      const denied = soloAdmin();
      if (denied) return denied;
      const mail = email.trim().toLowerCase();
      if (await db.user.findUnique({ where: { email: mail } })) return fail("Ya existe un usuario con ese email.");
      const u = await db.user.create({
        data: { name: nombre, email: mail, role: rol ?? "MEMBER", passwordHash: await bcrypt.hash(contrasenaInicial, 10) },
      });
      return json({ creado: true, id: u.id, email: u.email, rol: ROLES[u.role] });
    },
  );

  server.registerTool(
    "actualizar_usuario",
    {
      title: "Actualizar usuario (admin)",
      description: "Cambia nombre, email, rol o contraseña de un usuario. Solo administradores; un admin no puede quitarse su propio rol.",
      inputSchema: {
        usuarioId: z.string(),
        nombre: z.string().optional(),
        email: z.string().email().optional(),
        rol: rol.optional(),
        nuevaContrasena: z.string().min(8).optional(),
      },
    },
    async ({ usuarioId, nombre, email, rol, nuevaContrasena }) => {
      const denied = soloAdmin();
      if (denied) return denied;
      if (!(await db.user.findUnique({ where: { id: usuarioId } }))) return fail("No existe ese usuario.");
      if (usuarioId === user.id && rol && rol !== "ADMIN") return fail("No podés quitarte tu propio rol de administrador.");
      const mail = email?.trim().toLowerCase();
      if (mail) {
        const other = await db.user.findUnique({ where: { email: mail } });
        if (other && other.id !== usuarioId) return fail("Ya existe otro usuario con ese email.");
      }
      const u = await db.user.update({
        where: { id: usuarioId },
        data: {
          name: nombre,
          email: mail,
          role: rol,
          ...(nuevaContrasena ? { passwordHash: await bcrypt.hash(nuevaContrasena, 10) } : {}),
        },
      });
      return json({ actualizado: true, id: u.id, nombre: u.name, email: u.email, rol: ROLES[u.role] });
    },
  );

  server.registerTool(
    "eliminar_usuario",
    {
      title: "Eliminar usuario (admin)",
      description: "Da de baja a un usuario. Sus alianzas, iniciativas y compromisos quedan sin responsable. Solo administradores.",
      inputSchema: { usuarioId: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ usuarioId }) => {
      const denied = soloAdmin();
      if (denied) return denied;
      if (usuarioId === user.id) return fail("No podés eliminar tu propio usuario.");
      if (!(await db.user.findUnique({ where: { id: usuarioId } }))) return fail("No existe ese usuario.");
      await db.user.delete({ where: { id: usuarioId } });
      return json({ eliminado: true, id: usuarioId });
    },
  );

  server.registerTool(
    "agregar_participante",
    {
      title: "Agregar participante a una alianza",
      description: "Suma una organización a una alianza con su rol, o actualiza el rol si ya participa.",
      inputSchema: {
        alianzaId: z.string(),
        organizacionId: z.string(),
        rol: z.enum(keys(PARTICIPANT_ROLES)).optional().describe("Por defecto SOCIO"),
        detalle: z.string().optional().describe("Detalle libre del rol, p. ej. 'aporta la tecnología'"),
      },
    },
    async ({ alianzaId, organizacionId, rol, detalle }) => {
      const [a, o] = await Promise.all([
        db.alliance.findUnique({ where: { id: alianzaId }, select: { id: true } }),
        db.organization.findUnique({ where: { id: organizacionId }, select: { id: true } }),
      ]);
      if (!a) return fail("No existe esa alianza.");
      if (!o) return fail("No existe esa organización.");
      const roleType = rol ?? "SOCIO";
      await db.allianceParticipant.upsert({
        where: { allianceId_organizationId: { allianceId: alianzaId, organizationId: organizacionId } },
        update: { roleType, role: detalle },
        create: { allianceId: alianzaId, organizationId: organizacionId, roleType, role: detalle },
      });
      return json({ ok: true, rol: PARTICIPANT_ROLES[roleType], detalle: detalle ?? null });
    },
  );

  server.registerTool(
    "quitar_participante",
    {
      title: "Quitar participante de una alianza",
      description: "Saca una organización de una alianza.",
      inputSchema: { alianzaId: z.string(), organizacionId: z.string() },
    },
    async ({ alianzaId, organizacionId }) => {
      const r = await db.allianceParticipant.deleteMany({ where: { allianceId: alianzaId, organizationId: organizacionId } });
      return r.count ? json({ ok: true }) : fail("Esa organización no participa en esa alianza.");
    },
  );

  server.registerTool(
    "asignar_grupo",
    {
      title: "Asignar grupo a una organización",
      description: "Marca una organización como filial de otra (su casa matriz). Pasá grupoId null para dejarla independiente.",
      inputSchema: { organizacionId: z.string(), grupoId: z.string().nullable() },
    },
    async ({ organizacionId, grupoId }) => {
      const o = await db.organization.findUnique({ where: { id: organizacionId }, select: { id: true } });
      if (!o) return fail("No existe esa organización.");
      if (grupoId) {
        // Evita ciclos: el grupo no puede ser la misma organización ni una de sus filiales.
        let current: string | null = grupoId;
        for (let i = 0; current && i < 50; i++) {
          if (current === organizacionId) return fail("Ese grupo es la misma organización o una de sus filiales.");
          const next: { parentId: string | null } | null = await db.organization.findUnique({
            where: { id: current },
            select: { parentId: true },
          });
          if (!next && i === 0) return fail("No existe la organización grupo.");
          current = next?.parentId ?? null;
        }
      }
      const updated = await db.organization.update({
        where: { id: organizacionId },
        data: { parentId: grupoId },
        include: { parent: { select: { name: true } } },
      });
      return json({ ok: true, organizacion: updated.name, grupo: updated.parent?.name ?? null });
    },
  );

  server.registerTool(
    "listar_catalogo",
    {
      title: "Listar catálogo",
      description: "Productos, servicios y otros del catálogo, con las organizaciones y alianzas a las que están asignados.",
      inputSchema: {
        tipo: z.enum(keys(OFFERING_KINDS)).optional(),
        texto: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ tipo, texto }) => {
      const items = await db.offering.findMany({
        where: {
          ...(tipo ? { kind: tipo } : {}),
          ...(texto ? { name: { contains: texto, mode: "insensitive" } } : {}),
        },
        orderBy: { name: "asc" },
        include: {
          organizations: { select: { id: true, name: true } },
          alliances: { select: { id: true, name: true } },
        },
      });
      return json(
        items.map((f) => ({
          id: f.id,
          nombre: f.name,
          tipo: OFFERING_KINDS[f.kind],
          descripcion: f.description,
          organizaciones: f.organizations.map((o) => ({ id: o.id, nombre: o.name })),
          alianzas: f.alliances.map((a) => ({ id: a.id, nombre: a.name })),
        })),
      );
    },
  );

  server.registerTool(
    "crear_oferta",
    {
      title: "Crear producto, servicio u otro",
      description: "Agrega un ítem al catálogo y, opcionalmente, lo asigna a organizaciones y alianzas. Revisá listar_catalogo antes para no duplicar.",
      inputSchema: {
        nombre: z.string(),
        tipo: z.enum(keys(OFFERING_KINDS)).describe("PRODUCTO, SERVICIO u OTRO"),
        descripcion: z.string().optional(),
        organizacionIds: z.array(z.string()).optional(),
        alianzaIds: z.array(z.string()).optional(),
      },
    },
    async ({ nombre, tipo, descripcion, organizacionIds = [], alianzaIds = [] }) => {
      const f = await db.offering.create({
        data: {
          name: nombre.trim(),
          kind: tipo,
          description: descripcion,
          organizations: { connect: organizacionIds.map((id) => ({ id })) },
          alliances: { connect: alianzaIds.map((id) => ({ id })) },
        },
      });
      return json({ creada: true, id: f.id, nombre: f.name, tipo: OFFERING_KINDS[f.kind] });
    },
  );

  server.registerTool(
    "asignar_oferta",
    {
      title: "Asignar o quitar un producto/servicio",
      description: "Asigna un ítem del catálogo a una organización o a una alianza (indicá una de las dos). Con quitar=true lo desasigna.",
      inputSchema: {
        ofertaId: z.string(),
        organizacionId: z.string().optional(),
        alianzaId: z.string().optional(),
        quitar: z.boolean().optional(),
      },
    },
    async ({ ofertaId, organizacionId, alianzaId, quitar }) => {
      if (!organizacionId === !alianzaId) return fail("Indicá organizacionId o alianzaId (uno solo).");
      const f = await db.offering.findUnique({ where: { id: ofertaId }, select: { id: true } });
      if (!f) return fail("No existe ese ítem del catálogo.");
      const op = quitar ? "disconnect" : "connect";
      try {
        if (organizacionId) {
          await db.organization.update({ where: { id: organizacionId }, data: { offerings: { [op]: { id: ofertaId } } } });
        } else {
          await db.alliance.update({ where: { id: alianzaId! }, data: { offerings: { [op]: { id: ofertaId } } } });
        }
      } catch {
        return fail(organizacionId ? "No existe esa organización." : "No existe esa alianza.");
      }
      return json({ ok: true, accion: quitar ? "quitada" : "asignada" });
    },
  );

  server.registerTool(
    "importar_datos",
    {
      title: "Importar datos en bloque",
      description:
        "Carga de una vez organizaciones, contactos, catálogo, alianzas (con participantes y productos) y oportunidades a partir de lo que la persona " +
        "pegó o subió al chat. Todo se referencia por nombre; lo que ya existe no se duplica (las organizaciones suman países y capacidades). " +
        "Usá simular=true primero para mostrar el resultado sin guardar nada, y repetí con simular=false cuando la persona confirme.",
      inputSchema: {
        simular: z.boolean().describe("true: solo muestra qué pasaría, sin guardar"),
        ...importSchema,
      },
    },
    async ({ simular, ...data }) => {
      const total = Object.values(data).reduce((n, list) => n + (list?.length ?? 0), 0);
      if (!total) return fail("No hay nada para importar.");
      if (total > 500) return fail("Máximo 500 registros por carga; dividila en partes.");
      return json(await importData(data, simular));
    },
  );

  server.registerTool(
    "crear_contacto",
    {
      title: "Crear contacto",
      description: "Agrega una persona de contacto a una organización.",
      inputSchema: {
        organizacionId: z.string(),
        nombre: z.string(),
        cargo: z.string().optional(),
        email: z.string().email().optional(),
        telefono: z.string().optional(),
        pais: z.string().optional().describe("Código ISO o nombre"),
        relacion: z.enum(keys(RELATIONSHIP_LEVELS)).optional().describe("FRIA, TIBIA o CERCANA"),
        notas: z.string().optional(),
      },
    },
    async ({ organizacionId, nombre, cargo, email, telefono, pais, relacion, notas }) => {
      const org = await db.organization.findUnique({ where: { id: organizacionId }, select: { id: true } });
      if (!org) return fail("No existe esa organización.");
      const country = pais ? await resolveCountry(pais) : null;
      if (pais && !country) return fail(`No encontré el país "${pais}".`);
      const c = await db.contact.create({
        data: {
          organizationId: organizacionId,
          name: nombre,
          position: cargo,
          email: email?.toLowerCase(),
          phone: telefono,
          notes: notas,
          relationshipLevel: relacion ?? "TIBIA",
          countryCode: country?.code,
        },
      });
      return json({ creado: true, id: c.id, nombre: c.name });
    },
  );

  server.registerTool(
    "actualizar_organizacion",
    {
      title: "Actualizar organización",
      description: "Cambia datos de una organización. Los países y capacidades que pases reemplazan a los actuales.",
      inputSchema: {
        id: z.string(),
        nombre: z.string().optional(),
        tipo: z.enum(keys(ORGANIZATION_TYPES)).optional(),
        sector: z.string().optional(),
        sitioWeb: z.string().optional(),
        descripcion: z.string().optional(),
        paises: z.array(z.string()).optional().describe("Códigos ISO o nombres"),
        capacidades: z.array(z.string()).optional(),
      },
    },
    async ({ id, nombre, tipo, sector, sitioWeb, descripcion, paises, capacidades }) => {
      const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
      if (!org) return fail("No existe esa organización.");
      let countries: { code: string }[] | undefined;
      if (paises) {
        const found = await Promise.all(paises.map(resolveCountry));
        const missing = paises.filter((_, i) => !found[i]);
        if (missing.length) return fail(`Países no reconocidos: ${missing.join(", ")}.`);
        countries = found.map((c) => ({ code: c!.code }));
      }
      const o = await db.organization.update({
        where: { id },
        data: {
          name: nombre,
          type: tipo,
          sector,
          website: sitioWeb,
          description: descripcion,
          capabilities: capacidades,
          ...(countries ? { countries: { set: countries } } : {}),
        },
        include: { countries: true },
      });
      return json({ actualizada: true, id: o.id, nombre: o.name, paises: o.countries.map((c) => c.name) });
    },
  );

  server.registerTool(
    "listar_clientes",
    {
      title: "Listar clientes",
      description: "Clientes de las alianzas, con estado y facturación anual. Filtrá por alianza, país o estado.",
      inputSchema: {
        alianzaId: z.string().optional(),
        pais: z.string().optional(),
        estado: z.enum(keys(CLIENT_STATUSES)).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ alianzaId, pais, estado }) => {
      const country = pais ? await resolveCountry(pais) : null;
      if (pais && !country) return fail(`No encontré el país "${pais}".`);
      const clients = await db.allianceClient.findMany({
        where: {
          ...(alianzaId ? { allianceId: alianzaId } : {}),
          ...(estado ? { status: estado } : {}),
          ...(country ? { alliance: { countryCode: country.code } } : {}),
        },
        include: {
          organization: { select: { id: true, name: true } },
          alliance: { select: { id: true, name: true, country: { select: { name: true } } } },
        },
        orderBy: { organization: { name: "asc" } },
      });
      return json(
        clients.map((c) => ({
          id: c.id,
          cliente: c.organization.name,
          organizacionId: c.organization.id,
          alianza: c.alliance.name,
          alianzaId: c.alliance.id,
          pais: c.alliance.country.name,
          estado: CLIENT_STATUSES[c.status],
          facturacionAnualUSD: c.revenue ? Number(c.revenue) : null,
          desde: day(c.since),
        })),
      );
    },
  );

  server.registerTool(
    "agregar_cliente",
    {
      title: "Agregar o actualizar cliente de una alianza",
      description:
        "Suma un cliente a una alianza (o actualiza su estado y facturación si ya lo era). Pasá organizacionId de una organización existente, " +
        "o nombreNuevo para crearla en el país de la alianza.",
      inputSchema: {
        alianzaId: z.string(),
        organizacionId: z.string().optional(),
        nombreNuevo: z.string().optional(),
        estado: z.enum(keys(CLIENT_STATUSES)).optional().describe("PROSPECTO (por defecto), ACTIVO o INACTIVO"),
        facturacionAnualUSD: z.number().nonnegative().optional(),
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD"),
        notas: z.string().optional(),
      },
    },
    async ({ alianzaId, organizacionId, nombreNuevo, estado, facturacionAnualUSD, desde, notas }) => {
      const alliance = await db.alliance.findUnique({ where: { id: alianzaId }, select: { countryCode: true, name: true } });
      if (!alliance) return fail("No existe esa alianza.");
      if (!organizacionId === !nombreNuevo) return fail("Indicá organizacionId o nombreNuevo (uno solo).");
      let orgId = organizacionId;
      if (orgId && !(await db.organization.findUnique({ where: { id: orgId }, select: { id: true } }))) {
        return fail("No existe esa organización.");
      }
      if (nombreNuevo) {
        const existing = await db.organization.findFirst({
          where: { name: { equals: nombreNuevo.trim(), mode: "insensitive" } },
          select: { id: true },
        });
        orgId =
          existing?.id ??
          (await db.organization.create({
            data: { name: nombreNuevo.trim(), countries: { connect: { code: alliance.countryCode } } },
          })).id;
      }
      const data = {
        ...(estado ? { status: estado } : {}),
        ...(facturacionAnualUSD !== undefined ? { revenue: facturacionAnualUSD } : {}),
        ...(desde ? { since: parseDate(desde) } : {}),
        ...(notas !== undefined ? { notes: notas } : {}),
      };
      const c = await db.allianceClient.upsert({
        where: { allianceId_organizationId: { allianceId: alianzaId, organizationId: orgId! } },
        update: data,
        create: { allianceId: alianzaId, organizationId: orgId!, ...data },
        include: { organization: { select: { name: true } } },
      });
      await notify(
        user,
        { allianceId: alianzaId },
        `sumó o actualizó a ${c.organization.name} como cliente de "${alliance.name}"`,
        `/alianzas/${alianzaId}#clientes`,
      );
      return json({
        ok: true,
        id: c.id,
        cliente: c.organization.name,
        estado: CLIENT_STATUSES[c.status],
        facturacionAnualUSD: c.revenue ? Number(c.revenue) : null,
      });
    },
  );

  server.registerTool(
    "quitar_cliente",
    {
      title: "Quitar cliente de una alianza",
      description: "Saca un cliente de una alianza (la organización sigue existiendo).",
      inputSchema: { alianzaId: z.string(), organizacionId: z.string() },
    },
    async ({ alianzaId, organizacionId }) => {
      const client = await db.allianceClient.findUnique({
        where: { allianceId_organizationId: { allianceId: alianzaId, organizationId: organizacionId } },
        include: { organization: { select: { name: true } }, alliance: { select: { name: true } } },
      });
      if (!client) return fail("Esa organización no es cliente de esa alianza.");
      await db.allianceClient.delete({ where: { id: client.id } });
      await notify(
        user,
        { allianceId: alianzaId },
        `quitó a ${client.organization.name} de los clientes de "${client.alliance.name}"`,
        `/alianzas/${alianzaId}#clientes`,
      );
      return json({ ok: true });
    },
  );

  server.registerTool(
    "resumen_flujo_ventas",
    {
      title: "Resumen del flujo de ventas",
      description: "Métricas de iniciativa → oportunidad → cliente: cantidades, valores y tasas de conversión.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const f = await salesFlowSummary();
      return json({
        iniciativas: { total: f.initiatives.total, conOportunidad: f.initiatives.converted, sinConvertir: f.initiatives.pending },
        oportunidades: {
          abiertas: f.opportunities.open,
          valorAbiertoUSD: f.opportunities.openValue,
          valorPonderadoUSD: Math.round(f.opportunities.weighted),
          ganadas: f.opportunities.won,
          valorGanadoUSD: f.opportunities.wonValue,
          descartadas: f.opportunities.lost,
          nacidasDeIniciativas: f.opportunities.fromInitiatives,
        },
        clientes: {
          total: f.clients.total,
          activos: f.clients.active,
          prospectos: f.clients.prospects,
          inactivos: f.clients.inactive,
          facturacionAnualActivosUSD: f.clients.revenue,
          nacidosDeOportunidades: f.clients.fromOpportunities,
        },
        tasas: {
          iniciativaAOportunidadPct: f.rates.initiativeToOpportunity,
          oportunidadesGanadasPct: f.rates.winRate,
          clientesActivosPct: f.rates.activeClients,
        },
      });
    },
  );

  server.registerTool(
    "convertir_iniciativa_en_oportunidad",
    {
      title: "Convertir iniciativa en oportunidad",
      description: "Crea una oportunidad a partir de una iniciativa, en la alianza indicada, y deja registrado de qué iniciativa nació.",
      inputSchema: {
        iniciativaId: z.string(),
        alianzaId: z.string(),
        titulo: z.string().optional().describe("Por defecto, el nombre de la iniciativa"),
        valorEstimadoUSD: z.number().nonnegative().optional(),
        probabilidad: z.number().int().min(0).max(100).optional(),
        dimension: dimension().optional().describe("Por defecto VENTAS"),
      },
    },
    async ({ iniciativaId, alianzaId, titulo, valorEstimadoUSD, probabilidad, dimension }) => {
      try {
        const o = await convertInitiative({
          initiativeId: iniciativaId,
          allianceId: alianzaId,
          title: titulo,
          value: valorEstimadoUSD,
          probability: probabilidad,
          dimension,
        }, user);
        return json({ creada: true, oportunidadId: o.id, titulo: o.title });
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "convertir_oportunidad_en_cliente",
    {
      title: "Convertir oportunidad en cliente",
      description:
        "Marca la oportunidad como ganada y suma el cliente a su alianza. Pasá organizacionId de una organización existente " +
        "o nombreNuevo para crearla. La facturación anual toma por defecto el valor estimado de la oportunidad.",
      inputSchema: {
        oportunidadId: z.string(),
        organizacionId: z.string().optional(),
        nombreNuevo: z.string().optional(),
        estado: z.enum(keys(CLIENT_STATUSES)).optional().describe("Por defecto ACTIVO"),
        facturacionAnualUSD: z.number().nonnegative().optional(),
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD; por defecto hoy"),
      },
    },
    async ({ oportunidadId, organizacionId, nombreNuevo, estado, facturacionAnualUSD, desde }) => {
      if (!organizacionId === !nombreNuevo) return fail("Indicá organizacionId o nombreNuevo (uno solo).");
      if (organizacionId && !(await db.organization.findUnique({ where: { id: organizacionId }, select: { id: true } }))) {
        return fail("No existe esa organización.");
      }
      try {
        const c = await convertOpportunity({
          opportunityId: oportunidadId,
          organizationId: organizacionId,
          newName: nombreNuevo,
          status: estado,
          revenue: facturacionAnualUSD,
          since: desde ? parseDate(desde) : null,
        }, user);
        return json({
          ok: true,
          clienteId: c.id,
          cliente: c.organization.name,
          estado: CLIENT_STATUSES[c.status],
          facturacionAnualUSD: c.revenue ? Number(c.revenue) : null,
        });
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "asignar_responsables",
    {
      title: "Asignar responsables internos",
      description:
        "Suma, quita o reemplaza los responsables internos de una alianza, iniciativa o compromiso (pueden ser varios). " +
        "Los ids de usuario salen de listar_usuarios.",
      inputSchema: {
        tipo: z.enum(["alianza", "iniciativa", "compromiso"]),
        id: z.string(),
        responsables: z.array(z.string()).describe("Ids de usuario"),
        modo: z.enum(["agregar", "quitar", "reemplazar"]).optional().describe("Por defecto agregar"),
      },
    },
    async ({ tipo, id, responsables, modo = "agregar" }) => {
      const ids = await validUsers(responsables);
      if (!ids) return fail("Algún responsable no existe (ver listar_usuarios).");
      const owners =
        modo === "reemplazar" ? setOwners(ids) : modo === "quitar" ? { disconnect: ids.map((u) => ({ id: u })) } : connectOwners(ids);
      const args = { where: { id }, data: { owners }, select: { id: true, ...ownersSelect } };
      const prev = { where: { id }, select: { owners: { select: { id: true } } } };
      const before =
        (tipo === "alianza"
          ? await db.alliance.findUnique(prev)
          : tipo === "iniciativa"
            ? await db.initiative.findUnique(prev)
            : await db.commitment.findUnique(prev)
        )?.owners.map((o) => o.id) ?? [];
      try {
        const r =
          tipo === "alianza"
            ? await db.alliance.update(args)
            : tipo === "iniciativa"
              ? await db.initiative.update(args)
              : await db.commitment.update(args);
        const path = tipo === "alianza" ? `/alianzas/${id}` : tipo === "iniciativa" ? `/iniciativas/${id}` : "/compromisos";
        await notifyNewOwners(user, before, r.owners.map((o) => o.id), `${tipo === "compromiso" ? "un compromiso" : `una ${tipo}`}`, path);
        return json({ actualizado: true, tipo, id: r.id, responsables: r.owners.map((o) => o.name) });
      } catch {
        return fail(`No encontré ${tipo === "compromiso" ? "ese compromiso" : `esa ${tipo}`}.`);
      }
    },
  );

  server.registerTool(
    "configurar_avisos",
    {
      title: "Avisos por email",
      description:
        "Consulta o cambia si quien usa el conector recibe emails cuando otra persona cambia algo de lo que es responsable " +
        "(alianzas, iniciativas, compromisos, clientes y oportunidades de sus alianzas).",
      inputSchema: { activar: z.boolean().optional().describe("true para recibirlos, false para dejar de recibirlos; vacío para consultar") },
    },
    async ({ activar }) => {
      const u =
        activar === undefined
          ? await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailNotifications: true, email: true } })
          : await db.user.update({ where: { id: user.id }, data: { emailNotifications: activar }, select: { emailNotifications: true, email: true } });
      return json({ avisosPorEmail: u.emailNotifications, email: u.email });
    },
  );

  server.registerTool(
    "actualizar_oportunidad",
    {
      title: "Actualizar oportunidad",
      description: "Cambia el título, la descripción, el valor, la probabilidad, el estado, la dimensión o la alianza de una oportunidad.",
      inputSchema: {
        id: z.string(),
        titulo: z.string().optional(),
        descripcion: z.string().nullable().optional(),
        valorEstimadoUSD: z.number().nonnegative().nullable().optional(),
        probabilidad: z.number().int().min(0).max(100).nullable().optional(),
        estado: z.enum(keys(OPPORTUNITY_STATUSES)).optional(),
        dimension: dimension().optional(),
        alianzaId: z.string().optional(),
      },
    },
    async ({ id, titulo, descripcion, valorEstimadoUSD, probabilidad, estado, dimension, alianzaId }) => {
      if (!(await db.opportunity.findUnique({ where: { id }, select: { id: true } }))) return fail("No existe esa oportunidad.");
      if (alianzaId && !(await db.alliance.findUnique({ where: { id: alianzaId }, select: { id: true } }))) return fail("No existe esa alianza.");
      const o = await db.opportunity.update({
        where: { id },
        data: {
          title: titulo,
          description: descripcion,
          estimatedValue: valorEstimadoUSD,
          probability: probabilidad,
          status: estado,
          dimension,
          allianceId: alianzaId,
        },
        include: { alliance: { select: { name: true } } },
      });
      await notify(user, { allianceId: o.allianceId }, `actualizó la oportunidad "${o.title}" de "${o.alliance.name}" desde Claude`, "/oportunidades");
      return json({
        actualizada: true,
        id: o.id,
        titulo: o.title,
        estado: OPPORTUNITY_STATUSES[o.status],
        valorEstimadoUSD: o.estimatedValue ? Number(o.estimatedValue) : null,
        probabilidad: o.probability,
      });
    },
  );

  server.registerTool(
    "actualizar_iniciativa",
    {
      title: "Actualizar iniciativa",
      description:
        "Cambia el nombre, el objetivo o la dimensión de una iniciativa, o reemplaza las alianzas y organizaciones que la impulsan. " +
        "Para sus responsables usá asignar_responsables.",
      inputSchema: {
        id: z.string(),
        nombre: z.string().optional(),
        objetivo: z.string().nullable().optional(),
        dimension: dimension().optional(),
        alianzas: z.array(z.string()).optional().describe("Ids de alianzas; reemplaza la lista"),
        organizaciones: z.array(z.string()).optional().describe("Ids de organizaciones; reemplaza la lista"),
      },
    },
    async ({ id, nombre, objetivo, dimension, alianzas, organizaciones }) => {
      if (!(await db.initiative.findUnique({ where: { id }, select: { id: true } }))) return fail("No existe esa iniciativa.");
      try {
        const i = await db.initiative.update({
          where: { id },
          data: {
            name: nombre,
            objective: objetivo,
            dimension,
            ...(alianzas ? { alliances: { set: alianzas.map((a) => ({ id: a })) } } : {}),
            ...(organizaciones ? { organizations: { set: organizaciones.map((o) => ({ id: o })) } } : {}),
          },
          include: { alliances: { select: { name: true } }, organizations: { select: { name: true } } },
        });
        await notify(user, { initiativeId: id }, `actualizó la iniciativa "${i.name}" desde Claude`, `/iniciativas/${id}`);
        return json({
          actualizada: true,
          id: i.id,
          nombre: i.name,
          dimension: DIMENSIONS[i.dimension],
          alianzas: i.alliances.map((a) => a.name),
          organizaciones: i.organizations.map((o) => o.name),
        });
      } catch {
        return fail("Alguna alianza u organización no existe.");
      }
    },
  );

  server.registerTool(
    "eliminar_registro",
    {
      title: "Eliminar registro",
      description:
        "Elimina una alianza, iniciativa, oportunidad, organización, contacto, ítem del catálogo, compromiso, interacción o hito. " +
        "Es definitivo: confirmá siempre con la persona antes, diciéndole qué se borra en cascada " +
        "(una alianza borra sus participantes, clientes, oportunidades y compromisos; una iniciativa sus hitos y compromisos; " +
        "una organización sus contactos, participaciones y clientes). Para sacar un cliente o participante de una alianza usá quitar_cliente o quitar_participante.",
      inputSchema: {
        tipo: z.enum(["alianza", "iniciativa", "oportunidad", "organizacion", "contacto", "oferta", "compromiso", "interaccion", "hito"]),
        id: z.string(),
      },
      annotations: { destructiveHint: true },
    },
    async ({ tipo, id }) => {
      const where = { where: { id } };
      try {
        switch (tipo) {
          case "alianza": {
            const a = await db.alliance.findUniqueOrThrow({ ...where, select: { name: true } });
            await notify(user, { allianceId: id }, `eliminó la alianza "${a.name}" desde Claude`);
            await db.alliance.delete(where);
            return json({ eliminado: true, tipo, nombre: a.name });
          }
          case "iniciativa": {
            const i = await db.initiative.findUniqueOrThrow({ ...where, select: { name: true } });
            await notify(user, { initiativeId: id }, `eliminó la iniciativa "${i.name}" desde Claude`);
            await db.initiative.delete(where);
            return json({ eliminado: true, tipo, nombre: i.name });
          }
          case "oportunidad": {
            const o = await db.opportunity.findUniqueOrThrow({ ...where, select: { title: true, allianceId: true } });
            await notify(user, { allianceId: o.allianceId }, `eliminó la oportunidad "${o.title}" desde Claude`, `/alianzas/${o.allianceId}`);
            await db.opportunity.delete(where);
            return json({ eliminado: true, tipo, nombre: o.title });
          }
          case "compromiso": {
            const c = await db.commitment.findUniqueOrThrow({ ...where, select: { description: true, allianceId: true, initiativeId: true } });
            await notify(user, { allianceId: c.allianceId, initiativeId: c.initiativeId, commitmentId: id }, `eliminó el compromiso "${c.description}" desde Claude`);
            await db.commitment.delete(where);
            return json({ eliminado: true, tipo, nombre: c.description });
          }
          case "interaccion": {
            const i = await db.interaction.findUniqueOrThrow({ ...where, select: { allianceId: true, alliance: { select: { name: true } } } });
            if (i.allianceId) await notify(user, { allianceId: i.allianceId }, `eliminó una interacción de "${i.alliance?.name}" desde Claude`, `/alianzas/${i.allianceId}`);
            await db.interaction.delete(where);
            return json({ eliminado: true, tipo });
          }
          case "hito": {
            const m = await db.milestone.delete({ ...where, select: { title: true, initiativeId: true } });
            const all = await db.milestone.findMany({ where: { initiativeId: m.initiativeId }, select: { done: true } });
            const progress = all.length ? Math.round((all.filter((x) => x.done).length / all.length) * 100) : 0;
            await db.initiative.update({ where: { id: m.initiativeId }, data: { progress } });
            return json({ eliminado: true, tipo, nombre: m.title });
          }
          case "organizacion":
            return json({ eliminado: true, tipo, nombre: (await db.organization.delete({ ...where, select: { name: true } })).name });
          case "contacto":
            return json({ eliminado: true, tipo, nombre: (await db.contact.delete({ ...where, select: { name: true } })).name });
          case "oferta":
            return json({ eliminado: true, tipo, nombre: (await db.offering.delete({ ...where, select: { name: true } })).name });
        }
      } catch {
        return fail(`No encontré ${tipo === "organizacion" ? "esa organización" : tipo === "interaccion" ? "esa interacción" : `ese registro (${tipo})`}.`);
      }
    },
  );

  return server;
}

// Atiende una petición MCP (Streamable HTTP, sin sesión) autenticada con un token personal.
export async function handleMcpRequest(req: Request, token: string | null) {
  const user = await userForToken(token);
  if (!user) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Token inválido o revocado" }, id: null },
      { status: 401 },
    );
  }
  const server = buildServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
