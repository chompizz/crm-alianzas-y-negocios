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
