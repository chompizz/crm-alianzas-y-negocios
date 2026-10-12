import bcrypt from "bcryptjs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { User } from "@prisma/client";
import { z } from "zod";
import { userForToken } from "@/lib/api-tokens";
import { revenueByCountry } from "@/lib/country-revenue";
import { dimensionSummary } from "@/lib/dimension-summary";
import { db } from "@/lib/db";
import { parseDate, startOfTodayUtc } from "@/lib/format";
import {
  ALLIANCE_STAGES,
  ALLIANCE_TYPES,
  COMMITMENT_PARTIES,
  COMMITMENT_STATUSES,
  DIMENSION_DESCRIPTIONS,
  DIMENSIONS,
  HEALTH,
  INTERACTION_TYPES,
  ORGANIZATION_TYPES,
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

function buildServer(user: User) {
  const server = new McpServer(
    { name: "nexo", version: "1.0.0" },
    {
      instructions:
        "Nexo es el CRM interno de alianzas, estrategia y negocios del equipo. Cada alianza pertenece a un país; " +
        "una organización puede operar en varios países. Usá las herramientas de lectura antes de crear registros " +
        "para no duplicar, y confirmá con la persona antes de crear o modificar datos. Fechas en formato AAAA-MM-DD. " +
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
        include: { owner: { select: { name: true } }, alliances: { select: { name: true } } },
      });
      return json(
        initiatives.map((i) => ({
          id: i.id,
          nombre: i.name,
          dimension: DIMENSIONS[i.dimension],
          objetivo: i.objective,
          avance: i.progress,
          responsable: i.owner?.name ?? null,
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
        "Lo mismo que muestra el mapa del tablero: por cada país con alianzas abiertas, cantidad de alianzas, " +
        "facturación potencial (suma del valor esperado) y oportunidades abiertas ponderadas por probabilidad. Ordenado de mayor a menor.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      json(
        (await revenueByCountry()).map((r) => ({
          codigo: r.code,
          pais: r.name,
          alianzasAbiertas: r.alliances,
          facturacionPotencialUSD: r.potential,
          oportunidadesPonderadasUSD: Math.round(r.weightedOpportunities),
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
        contactos: o.contacts.map((c) => ({ id: c.id, nombre: c.name, cargo: c.position, email: c.email, pais: c.country?.name })),
        alianzas: o.participations.map((p) => ({
          id: p.allianceId,
          nombre: p.alliance.name,
          pais: p.alliance.country.name,
          rol: p.role,
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
          owner: { select: { name: true } },
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
          responsable: a.owner?.name ?? null,
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
          owner: { select: { name: true } },
          participants: { include: { organization: { select: { id: true, name: true } } } },
          interactions: { orderBy: { date: "desc" }, take: 10, include: { contacts: { select: { name: true } } } },
          commitments: { orderBy: { dueDate: "asc" }, include: { owner: { select: { name: true } } } },
          opportunities: true,
          initiatives: { select: { id: true, name: true, progress: true } },
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
        responsable: a.owner?.name ?? null,
        valorEsperadoUSD: a.expectedValue ? Number(a.expectedValue) : null,
        inicio: day(a.startDate),
        renovacion: day(a.renewalDate),
        participantes: a.participants.map((p) => ({ id: p.organization.id, nombre: p.organization.name, rol: p.role })),
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
          responsable: c.owner?.name ?? null,
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
      },
    },
    async ({ nombre, pais, tipo, etapa, dimension, objetivos, valorEsperadoUSD, organizaciones = [] }) => {
      const country = await resolveCountry(pais);
      if (!country) return fail(`No encontré el país "${pais}".`);
      const a = await db.alliance.create({
        data: {
          name: nombre,
          countryCode: country.code,
          type: tipo ?? "COMERCIAL",
          stage: etapa ?? "EXPLORACION",
          dimension: dimension ?? "ESTRATEGIA",
          objectives: objetivos,
          expectedValue: valorEsperadoUSD,
          ownerId: user.id,
          participants: { create: organizaciones.map((organizationId) => ({ organizationId })) },
        },
      });
      return json({ creada: true, id: a.id, nombre: a.name, pais: country.name });
    },
  );

  server.registerTool(
    "actualizar_alianza",
    {
      title: "Actualizar alianza",
      description: "Cambia la etapa, la salud, la dimensión, el valor esperado o los objetivos de una alianza.",
      inputSchema: {
        id: z.string(),
        etapa: z.enum(keys(ALLIANCE_STAGES)).optional(),
        salud: z.enum(keys(HEALTH)).optional(),
        dimension: dimension().optional(),
        valorEsperadoUSD: z.number().nonnegative().optional(),
        objetivos: z.string().optional(),
      },
    },
    async ({ id, etapa, salud, dimension, valorEsperadoUSD, objetivos }) => {
      const exists = await db.alliance.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return fail("No existe esa alianza.");
      const a = await db.alliance.update({
        where: { id },
        data: { stage: etapa, health: salud, dimension, expectedValue: valorEsperadoUSD, objectives: objetivos },
      });
      return json({
        actualizada: true,
        id: a.id,
        etapa: ALLIANCE_STAGES[a.stage],
        salud: HEALTH[a.health],
        dimension: DIMENSIONS[a.dimension],
        valorEsperadoUSD: a.expectedValue ? Number(a.expectedValue) : null,
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
            }),
          )
          .optional(),
      },
    },
    async ({ alianzaId, resumen, fecha, tipo, compromisos = [] }) => {
      const exists = await db.alliance.findUnique({ where: { id: alianzaId }, select: { id: true } });
      if (!exists) return fail("No existe esa alianza.");
      const interaction = await db.interaction.create({
        data: {
          allianceId: alianzaId,
          authorId: user.id,
          date: parseDate(fecha ?? null) ?? new Date(),
          type: tipo ?? "REUNION",
          summary: resumen,
          commitments: {
            create: compromisos.map((c) => ({
              allianceId: alianzaId,
              description: c.descripcion,
              party: c.parte ?? "NOSOTROS",
              ownerId: (c.parte ?? "NOSOTROS") === "NOSOTROS" ? user.id : null,
              dueDate: parseDate(c.fecha ?? null),
            })),
          },
        },
        include: { commitments: { select: { id: true, description: true } } },
      });
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
          ...(soloMios ? { ownerId: user.id } : {}),
          ...(country
            ? { OR: [{ alliance: { countryCode: country.code } }, { initiative: { alliances: { some: { countryCode: country.code } } } }] }
            : {}),
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        take: 100,
        include: { owner: { select: { name: true } }, alliance: { select: { id: true, name: true } }, initiative: { select: { id: true, name: true } } },
      });
      return json(
        commitments.map((c) => ({
          id: c.id,
          descripcion: c.description,
          alianza: c.alliance?.name ?? null,
          iniciativa: c.initiative?.name ?? null,
          parte: COMMITMENT_PARTIES[c.party],
          responsable: c.owner?.name ?? null,
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
      description: "Marca un compromiso como cumplido, cancelado o pendiente.",
      inputSchema: { id: z.string(), estado: z.enum(keys(COMMITMENT_STATUSES)) },
    },
    async ({ id, estado }) => {
      const exists = await db.commitment.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return fail("No existe ese compromiso.");
      const c = await db.commitment.update({ where: { id }, data: { status: estado } });
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
      const exists = await db.alliance.findUnique({ where: { id: alianzaId }, select: { id: true } });
      if (!exists) return fail("No existe esa alianza.");
      const o = await db.opportunity.create({
        data: { allianceId: alianzaId, title: titulo, description: descripcion, estimatedValue: valorEstimadoUSD, probability: probabilidad, dimension: dimension ?? "VENTAS" },
      });
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
