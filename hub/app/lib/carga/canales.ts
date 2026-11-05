export const CANALES = ["drogueria", "farmacia", "supermercado", "autoservicio", "mayorista", "otro"] as const;

export const CANAL_LABEL: Record<string, string> = {
  drogueria: "Droguería", farmacia: "Farmacia", supermercado: "Supermercado",
  autoservicio: "Autoservicio", mayorista: "Mayorista", otro: "Otro",
};
