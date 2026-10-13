// Varios responsables internos por alianza, iniciativa o compromiso.
export const ownersSelect = { owners: { select: { id: true, name: true }, orderBy: { name: "asc" as const } } };

export function ownerNames(owners: { name: string }[] | undefined, empty = "Sin responsable") {
  return owners && owners.length ? owners.map((o) => o.name).join(", ") : empty;
}

export const connectOwners = (ids: string[]) => ({ connect: ids.map((id) => ({ id })) });
export const setOwners = (ids: string[]) => ({ set: ids.map((id) => ({ id })) });
