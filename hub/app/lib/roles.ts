export type Role = "merchandiser" | "vendedor" | "admin";

// Único lugar donde un rol se traduce a texto visible.
export const ROLE_LABEL: Record<Role, string> = {
  merchandiser: "Mercaderista",
  vendedor: "Vendedor",
  admin: "Administrador",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as Role] ?? role;
}
