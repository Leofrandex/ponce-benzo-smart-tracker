export type Role = "merchandiser" | "vendedor" | "admin" | "colaborador";

// Único lugar donde un rol se traduce a texto visible.
export const ROLE_LABEL: Record<Role, string> = {
  merchandiser: "Mercaderista",
  vendedor: "Vendedor",
  admin: "Administrador",
  colaborador: "Colaborador",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as Role] ?? role;
}

// Configuración (asignaciones, catálogo) es solo para admins. La protección
// real es RLS; esto decide qué se muestra y a dónde se redirige.
export function canConfigure(role: string | null | undefined): boolean {
  return role === "admin";
}
