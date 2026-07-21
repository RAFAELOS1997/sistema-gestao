import { createContext, useContext, useMemo, useState } from "react";

type CartContextValue = {
  cart: Record<number, number>;
  itemCount: number;
  getQuantity: (productId: number) => number;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
};

// Carrinho da aba "Pronta Entrega" — separado do carrinho de "Fazer
// Pedidos" (PublicCartContext) de propósito: são fluxos diferentes (compra
// direta com pagamento na hora vs. pedido por encomenda sem pagamento), não
// devem se misturar.
const ProntaEntregaCartContext = createContext<CartContextValue | null>(null);

export function ProntaEntregaCartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Record<number, number>>({});

  const value = useMemo<CartContextValue>(() => ({
    cart,
    itemCount: Object.values(cart).reduce((sum, q) => sum + q, 0),
    getQuantity: (productId) => cart[productId] ?? 0,
    setQuantity: (productId, quantity) => {
      setCart((prev) => {
        const next = { ...prev };
        if (quantity <= 0) delete next[productId];
        else next[productId] = quantity;
        return next;
      });
    },
    clear: () => setCart({}),
  }), [cart]);

  return <ProntaEntregaCartContext.Provider value={value}>{children}</ProntaEntregaCartContext.Provider>;
}

export function useProntaEntregaCart() {
  const ctx = useContext(ProntaEntregaCartContext);
  if (!ctx) throw new Error("useProntaEntregaCart precisa estar dentro de um ProntaEntregaCartProvider");
  return ctx;
}
