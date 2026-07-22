import { toast } from "sonner";

// Fase 4 do plano de expansão nacional: gera a lista de compra pronta pro
// fornecedor a partir de um pedido — só os itens que vêm do catálogo
// (source "catalogo"), pra colar direto no carrinho do site do fornecedor.
export function buildPurchaseListText(order: { id: number; items: { source: string; name: string; quantity: number }[] }): string {
  const catalogItems = order.items.filter((i) => i.source === "catalogo");
  if (catalogItems.length === 0) return "";
  const lines = catalogItems.map((i) => `${i.quantity}x ${i.name}`);
  return `Lista de compra — Pedido #${order.id}\n\n${lines.join("\n")}`;
}

export function copyPurchaseList(order: { id: number; items: { source: string; name: string; quantity: number }[] }) {
  const text = buildPurchaseListText(order);
  if (!text) {
    toast.error("Esse pedido não tem itens do fornecedor");
    return;
  }
  navigator.clipboard.writeText(text);
  toast.success("Lista de compra copiada!");
}
