// Etiquetas en español para los enums del modelo.
export const ORGANIZATION_TYPES = {
  EMPRESA: "Empresa",
  ONG: "ONG",
  GOBIERNO: "Gobierno",
  UNIVERSIDAD: "Universidad",
  FONDO: "Fondo / inversor",
  OTRO: "Otro",
} as const;

export const RELATIONSHIP_LEVELS = {
  FRIA: "Fría",
  TIBIA: "Tibia",
  CERCANA: "Cercana",
} as const;

export const ALLIANCE_TYPES = {
  COMERCIAL: "Comercial",
  TECNOLOGICA: "Tecnológica",
  INSTITUCIONAL: "Institucional",
  INVERSION: "Inversión",
  OTRA: "Otra",
} as const;

export const ALLIANCE_STAGES = {
  EXPLORACION: "Exploración",
  EVALUACION: "Evaluación",
  NEGOCIACION: "Negociación",
  ACTIVA: "Activa",
  EN_REVISION: "En revisión",
  CERRADA: "Cerrada",
} as const;

export const HEALTH = { VERDE: "Verde", AMARILLO: "Amarillo", ROJO: "Rojo" } as const;

export const ROLES = { ADMIN: "Administrador", MEMBER: "Miembro" } as const;

export const ROLE_LABELS = { ...ROLES, PARTNER: "Partner" } as const;

export const REGISTRATION_STATUSES = { PENDIENTE: "Pendientes", APROBADA: "Aprobadas", RECHAZADA: "Rechazadas" } as const;

export const INTERACTION_TYPES = {
  REUNION: "Reunión",
  LLAMADA: "Llamada",
  EMAIL: "Email",
  EVENTO: "Evento",
  NOTA: "Nota",
} as const;

export const COMMITMENT_PARTIES = { NOSOTROS: "Nosotros", SOCIO: "Socio" } as const;

export const COMMITMENT_STATUSES = { PENDIENTE: "Pendiente", CUMPLIDO: "Cumplido", CANCELADO: "Cancelado" } as const;

export const HEALTH_DOT = { VERDE: "bg-emerald-500", AMARILLO: "bg-amber-400", ROJO: "bg-red-500" } as const;

export const OPPORTUNITY_STATUSES = { ABIERTA: "Abierta", GANADA: "Ganada", DESCARTADA: "Descartada" } as const;

export const DIMENSIONS = {
  GOBERNANZA: "Gobernanza",
  ESTRATEGIA: "Estrategia",
  PRODUCTO: "Producto",
  VENTAS: "Ventas",
} as const;

export const DIMENSION_DESCRIPTIONS: Record<keyof typeof DIMENSIONS, string> = {
  GOBERNANZA: "Estructura societaria, socios, responsabilidades, acuerdos, alianzas y toma de decisiones.",
  ESTRATEGIA: "Posicionamiento, expansión, nuevas oportunidades, partnerships tecnológicos y prioridades de negocio.",
  PRODUCTO: "Desarrollo, funcionalidades, integraciones, tecnología, roadmap y evolución de las soluciones.",
  VENTAS: "Pipeline comercial, clientes, propuestas, negociaciones, canales y objetivos de facturación.",
};

export const DIMENSION_STYLE: Record<keyof typeof DIMENSIONS, string> = {
  GOBERNANZA: "border-violet-400/40 bg-violet-500/10 text-violet-300",
  ESTRATEGIA: "border-cyan-400/40 bg-cyan-500/10 text-cyan-300",
  PRODUCTO: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  VENTAS: "border-amber-400/40 bg-amber-500/10 text-amber-300",
};

export const PARTICIPANT_ROLES = {
  LIDER: "Líder",
  SOCIO: "Socio estratégico",
  PROVEEDOR: "Proveedor",
  CLIENTE: "Cliente",
  CANAL: "Canal / distribuidor",
  INTEGRADOR: "Integrador",
  FINANCIADOR: "Financiador",
  INSTITUCIONAL: "Institucional",
  OTRO: "Otro",
} as const;

export const OFFERING_KINDS = { PRODUCTO: "Producto", SERVICIO: "Servicio", OTRO: "Otro" } as const;

export const OFFERING_STYLE: Record<keyof typeof OFFERING_KINDS, string> = {
  PRODUCTO: "border-sky-400/40 bg-sky-500/10 text-sky-300",
  SERVICIO: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300",
  OTRO: "border-slate-300 bg-slate-100 text-slate-700",
};

export const CLIENT_STATUSES = { PROSPECTO: "Prospecto", ACTIVO: "Activo", INACTIVO: "Inactivo" } as const;

export const CLIENT_STATUS_STYLE: Record<keyof typeof CLIENT_STATUSES, string> = {
  PROSPECTO: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  ACTIVO: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  INACTIVO: "border-slate-300 bg-slate-100 text-slate-500",
};
