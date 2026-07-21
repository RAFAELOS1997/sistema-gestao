import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ZoomableImage } from "@/components/ZoomableImage";
import { trpc } from "@/lib/trpc";
import { Search, Plus, Minus, ChevronDown, ChevronUp, ShoppingCart, Package } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
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

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-900/30 text-amber-200",
  confirmado: "bg-blue-900/30 text-blue-200",
  entregue: "bg-green-900/30 text-green-200",
  cancelado: "bg-red-900/30 text-red-200",
};

export default function PortalGenerateOrder() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartExpanded, setCartExpanded] = useState(false);

  const utils = trpc.useUtils();
  const catalogQuery = trpc.portal.orderCatalog.list.useQuery();
  const minimumQuery = trpc.portal.orders.minimumCents.useQuery();
  const ordersQuery = trpc.portal.orders.list.useQuery();
  const items = catalogQuery.data ?? [];
  const minimumCents = minimumQuery.data ?? 15000;

  const createOrderMutation = trpc.portal.orders.create.useMutation({
    onSuccess: () => {
      toast.success("Pedido enviado! A Toca da Pantera vai confirmar em breve.");
      setCart({});
      setCartExpanded(false);
      utils.portal.orders.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category))), [items]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "todas" || p.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, category]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, quantity]) => {
        const item = items.find((i) => i.id === Number(id));
        if (!item || quantity <= 0) return null;
        return { ...item, quantity, total: item.price * quantity };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
  }, [cart, items]);

  const subtotal = cartItems.reduce((sum, i) => sum + i.total, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const missingForMinimum = Math.max(0, minimumCents - subtotal);

  const setQuantity = (id: number, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  };

  const handleSubmit = () => {
    if (cartItems.length === 0) {
      toast.error("Adicione ao menos um item ao pedido");
      return;
    }
    if (subtotal < minimumCents) {
      toast.error(`Pedido mínimo de R$ ${(minimumCents / 100).toFixed(2)}`);
      return;
    }
    createOrderMutation.mutate({
      items: cartItems.map((i) => ({ supplierCatalogId: i.id, quantity: i.quantity })),
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-24">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">Gerar Pedidos</h1>
        <p className="text-muted-foreground text-sm">
          Monte seu pedido com o preço do seu plano já aplicado. Pedido mínimo: R$ {(minimumCents / 100).toFixed(2)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="pl-9 h-10 text-base"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          <button
            onClick={() => setCategory("todas")}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition-colors shrink-0 ${
              category === "todas" ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition-colors shrink-0 ${
                category === cat ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>

      {catalogQuery.isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando produtos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum produto encontrado</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((item) => {
            const qty = cart[item.id] ?? 0;
            return (
              <div key={item.id} className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
                <div className="aspect-square bg-background flex items-center justify-center text-muted-foreground text-xs overflow-hidden">
                  {item.imageUrl ? (
                    <ZoomableImage src={item.imageUrl} alt={item.name} className="w-full h-full" />
                  ) : (
                    <span className="px-2 text-center">{(CATEGORY_LABELS[item.category] ?? item.category).toUpperCase()}</span>
                  )}
                </div>
                <div className="p-2.5 sm:p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground leading-snug line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] break-words">
                    {item.name}
                  </h3>
                  <p className="text-base sm:text-lg font-bold mt-1 text-accent">R$ {(item.price / 100).toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <button
                      onClick={() => setQuantity(item.id, qty - 1)}
                      disabled={qty === 0}
                      className="p-1.5 rounded bg-background border border-border text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-base font-bold text-foreground">{qty}</span>
                    <button
                      onClick={() => setQuantity(item.id, qty + 1)}
                      className="p-1.5 rounded bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Histórico de pedidos */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-accent" />
            Meus pedidos
          </h2>
          {ordersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (ordersQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido feito ainda</p>
          ) : (
            <div className="space-y-2">
              {(ordersQuery.data ?? []).map((order: any) => (
                <div key={order.id} className="p-3 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Pedido #{order.id} · {order.items.length} item(ns)
                    </p>
                    <span className={`px-2 py-1 rounded text-xs shrink-0 ${STATUS_COLORS[order.status] ?? ""}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-sm font-bold text-accent">R$ {(order.subtotal / 100).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carrinho fixado embaixo */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-3 sm:px-6 pb-3 sm:pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-6xl mx-auto">
            <Card className="border border-accent/30 bg-card shadow-xl">
              <button
                type="button"
                onClick={() => setCartExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-accent" />
                  <span className="text-sm text-foreground font-medium">{cartCount} item(ns)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-accent">R$ {(subtotal / 100).toFixed(2)}</span>
                  {cartExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
                </div>
              </button>

              {cartExpanded && (
                <CardContent className="space-y-3 pt-0 border-t border-border max-h-[50vh] overflow-y-auto">
                  <div className="space-y-2 pt-3">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded border border-border">
                        <p className="text-sm text-foreground flex-1 truncate">{item.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-accent/20 rounded">
                            <Minus className="w-3 h-3 text-accent" />
                          </button>
                          <span className="w-6 text-center text-sm text-foreground font-semibold">{item.quantity}</span>
                          <button onClick={() => setQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-accent/20 rounded">
                            <Plus className="w-3 h-3 text-accent" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-foreground w-20 text-right shrink-0">
                          R$ {(item.total / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}

              <div className="px-4 pb-4">
                {missingForMinimum > 0 ? (
                  <p className="text-xs text-amber-400 mb-2 text-center">
                    Faltam R$ {(missingForMinimum / 100).toFixed(2)} pra atingir o pedido mínimo de R$ {(minimumCents / 100).toFixed(2)}
                  </p>
                ) : null}
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={missingForMinimum > 0 || createOrderMutation.isPending}
                  onClick={handleSubmit}
                >
                  {createOrderMutation.isPending ? "Enviando..." : "Enviar Pedido"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
