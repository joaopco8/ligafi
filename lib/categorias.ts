import type { Categoria } from "./types";

export const categorias: Record<Categoria, { label: string; cor: string }> = {
  anuidade: { label: "Anuidade", cor: "#F5F0B0" },
  simposio: { label: "Simpósio", cor: "#6EE7A8" },
  material: { label: "Material", cor: "#7DD3FC" },
  palestrante: { label: "Palestrante", cor: "#C4B5FD" },
  coffee: { label: "Coffee break", cor: "#FDBA74" },
  outros: { label: "Outros", cor: "#94A3B8" },
};

export const ordemCategorias: Categoria[] = [
  "anuidade",
  "simposio",
  "material",
  "palestrante",
  "coffee",
  "outros",
];
