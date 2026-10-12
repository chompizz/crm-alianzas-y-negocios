import type { AllianceStage } from "@prisma/client";
import { startOfTodayUtc } from "@/lib/format";

// Campos que se completan solos al cambiar de etapa: al activarse, la alianza
// toma hoy como fecha de inicio si todavía no tenía una.
export function stageDefaults(stage: AllianceStage, current: { startDate: Date | null }) {
  return stage === "ACTIVA" && !current.startDate ? { startDate: startOfTodayUtc() } : {};
}
