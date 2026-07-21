import { CircleDot, Flame, Wind, Leaf, Sparkles, Wrench, Shirt, BookOpen, Gem, Link, Package, LucideIcon } from "lucide-react";

// Rótulos e ícone de cada categoria — usados no Portal do Parceiro e no
// catálogo público, pra dar uma identidade visual mais rica (remete a
// contas/guias, velas, ervas, pedras...) sem depender de fotos.
export const CATEGORY_LABELS: Record<string, string> = {
  guias: "Guias",
  pulseiras: "Pulseiras",
  velas: "Velas",
  incensos: "Incensos",
  ervas: "Ervas",
  imagens: "Imagens",
  ferramentas: "Ferramentas",
  vestuario: "Vestuário",
  livros: "Livros",
  pedras: "Pedras",
  outros: "Outros",
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  guias: CircleDot,
  pulseiras: Link,
  velas: Flame,
  incensos: Wind,
  ervas: Leaf,
  imagens: Sparkles,
  ferramentas: Wrench,
  vestuario: Shirt,
  livros: BookOpen,
  pedras: Gem,
  outros: Package,
};

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? Package;
}
