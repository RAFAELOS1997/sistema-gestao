import { createContext, useContext, useMemo, useState } from "react";

export type CartSource = "catalogo" | "estoque";
type CartEntry = { source: CartSource; id: number; quantity: number };

const cartKey = (source: CartSource, id: number) => `${source}:${id}`;

type CartContextValue = {
  cart: Record<string, CartEntry>;
  itemCount: number;
  getQuantity: (source: CartSource, id: number) => number;
  setQuantity: (source: CartSource, id: number, quantity: number) => void;
  clear: () => void;
};

// Carrinho compartilhado entre a tela "Produtos" e a tela "Fazer Pedidos" do
// catálogo público — sem isso, um item marcado em Produtos sumia ao trocar
// de aba.
const PublicCartContext = createContext<CartContextValue | null>(null);

export function PublicCartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Record<string, CartEntry>>({});

  const value = useMemo<CartContextValue>(() => ({
    cart,
    itemCount: Object.values(cart).reduce((sum, e) => sum + e.quantity, 0),
    getQuantity: (source, id) => cart[cartKey(source, id)]?.quantity ?? 0,
    setQuantity: (source, id, quantity) => {
      setCart((prev) => {
        const next = { ...prev };
        const key = cartKey(source, id);
        if (quantity <= 0) delete next[key];
        else next[key] = { source, id, quantity };
        return next;
      });
    },
    clear: () => setCart({}),
  }), [cart]);

  return <PublicCartContext.Provider value={value}>{children}</PublicCartContext.Provider>;
}

export function usePublicCart() {
  const ctx = useContext(PublicCartContext);
  if (!ctx) throw new Error("usePublicCart precisa estar dentro de um PublicCartProvider");
  return ctx;
}
