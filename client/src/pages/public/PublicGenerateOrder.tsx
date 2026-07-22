import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZoomableImage } from "@/components/ZoomableImage";
import { trpc } from "@/lib/trpc";
import { Search, Plus, Minus, ChevronDown, ChevronUp, ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { usePublicCart } from "@/contexts/PublicCartContext";
import { CATEGORY_LABELS, categoryIcon } from "@/lib/categoryMeta";
import { EntityShortcuts, EntityShortcut } from "@/components/EntityShortcuts";
import { ShippingMethodPicker, ShippingAddressForm, EMPTY_ADDRESS, isAddressComplete, ShippingMethod, ShippingAddress } from "@/components/public/ShippingFields";

type Source = "catalogo" | "estoque";

const cartKey = (source: Source, id: number) => `${source}:${id}`;

// Espelha computeShippingCents do servidor — só pra mostrar uma prévia antes
// de enviar; o valor cobrado de verdade é sempre recalculado lá.
function previewShippingCents(
  method: ShippingMethod,
  city: string,
  state: string,
  info: { localCity: string; localState: string; localCents: number; stateCents: number; nationalCents: number } | undefined
): number {
  if (method === "retirada" || !info) return 0;
  const normCity = city.trim().toLowerCase();
  const normState = state.trim().toUpperCase();
  if (normState && normState === info.localState.toUpperCase()) {
    if (normCity && normCity === info.localCity.trim().toLowerCase()) return info.localCents;
    return info.stateCents;
  }
  return info.nationalCents;
}

export default function PublicGenerateOrder() {
  const [source, setSource] = useState<Source>("catalogo");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");
  const [activeEntity, setActiveEntity] = useState<EntityShortcut | null>(null);
  const { cart, setQuantity, clear: clearCart } = usePublicCart();
  const [cartExpanded, setCartExpanded] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("retirada");
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [confirmedOrder, setConfirmedOrder] = useState<{ id: number; subtotal: number; shippingCents: number } | null>(null);

  const catalogQuery = trpc.publicStore.orderCatalog.catalog.useQuery();
  const stockQuery = trpc.publicStore.orderCatalog.stock.useQuery();
  const minimumQuery = trpc.publicStore.orders.minimumCents.useQuery();
  const shippingInfoQuery = trpc.publicStore.shipping.info.useQuery();
  const minimumCents = minimumQuery.data ?? 15000;
  const shippingCentsPreview = previewShippingCents(shippingMethod, address.city, address.state, shippingInfoQuery.data);

  const items = source === "catalogo" ? catalogQuery.data ?? [] : stockQuery.data ?? [];
  const isLoading = source === "catalogo" ? catalogQuery.isLoading : stockQuery.isLoading;
  const allItemsById = useMemo(() => {
    const map = new Map<string, { id: number; name: string; price: number }>();
    for (const i of catalogQuery.data ?? []) map.set(cartKey("catalogo", i.id), i);
    for (const i of stockQuery.data ?? []) map.set(cartKey("estoque", i.id), i);
    return map;
  }, [catalogQuery.data, stockQuery.data]);

  const createOrderMutation = trpc.publicStore.orders.create.useMutation({
    onSuccess: (result) => {
      setConfirmedOrder({ id: result.orderId, subtotal: result.subtotal, shippingCents: result.shippingCents });
      clearCart();
      setCartExpanded(false);
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
    return Object.values(cart)
      .map((entry) => {
        const item = allItemsById.get(cartKey(entry.source, entry.id));
        if (!item || entry.quantity <= 0) return null;
        return { ...entry, name: item.name, price: item.price, total: item.price * entry.quantity };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
  }, [cart, allItemsById]);

  const subtotal = cartItems.reduce((sum, i) => sum + i.total, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  // Mínimo vale só pros itens do fornecedor — estoque não tem restrição.
  const catalogSubtotal = cartItems.filter((i) => i.source === "catalogo").reduce((sum, i) => sum + i.total, 0);
  const missingForMinimum = catalogSubtotal > 0 ? Math.max(0, minimumCents - catalogSubtotal) : 0;

  const handleSubmit = () => {
    if (cartItems.length === 0) {
      toast.error("Adicione ao menos um item ao pedido");
      return;
    }
    if (missingForMinimum > 0) {
      toast.error(`Pedido mínimo de R$ ${(minimumCents / 100).toFixed(2)} nos itens do fornecedor`);
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Informe seu nome e telefone pra podermos confirmar o pedido");
      return;
    }
    if (shippingMethod === "envio" && !isAddressComplete(address)) {
      toast.error("Preencha o endereço de entrega completo (CEP, número, bairro, cidade e UF)");
      return;
    }
    createOrderMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cartItems.map((i) => ({ source: i.source, id: i.id, quantity: i.quantity })),
      shippingMethod,
      shippingAddress: shippingMethod === "envio" ? address : undefined,
    });
  };

  if (confirmedOrder) {
    const total = confirmedOrder.subtotal + confirmedOrder.shippingCents;
    return (
      <div className="max-w-md mx-auto py-10 text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Pedido enviado!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pedido #{confirmedOrder.id} — R$ {(total / 100).toFixed(2)}
            {confirmedOrder.shippingCents > 0 && (
              <span className="block text-xs mt-0.5">(inclui R$ {(confirmedOrder.shippingCents / 100).toFixed(2)} de frete)</span>
            )}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Vamos entrar em contato pelo telefone informado pra confirmar e combinar a entrega ou retirada.
        </p>
        <Button onClick={() => setConfirmedOrder(null)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          Fazer novo pedido
        </Button>
      </div>
    );
  }

  return (
    <div className="relative isolate">
      {/* Ambiente muda de cor conforme a entidade selecionada nos atalhos abaixo */}
      <div
        className="absolute -inset-x-4 -top-4 h-72 -z-10 pointer-events-none blur-3xl transition-opacity duration-700 rounded-3xl"
        style={{
          background: activeEntity
            ? `linear-gradient(135deg, ${activeEntity.colors[0]}40, ${activeEntity.colors[1]}25)`
            : "transparent",
          opacity: activeEntity ? 1 : 0,
        }}
      />
      <div className="space-y-5 sm:space-y-6 pb-24">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">Fazer Pedido</h1>
        <p className="text-muted-foreground text-sm">
          Monte seu pedido e a gente confirma com você por telefone. Pedido mínimo de R$ {(minimumCents / 100).toFixed(2)} só
          nos itens do fornecedor — itens do estoque não têm mínimo.
        </p>
      </div>

      <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
        Entregamos pra todo o Brasil pelos Correios — ou você pode retirar direto na loja, em Ribeirão Preto.
      </p>

      <EntityShortcuts
        activeName={activeEntity?.name ?? null}
        onSelect={(entity) => {
          setActiveEntity(entity);
          setSearch(entity?.searchTerm ?? "");
        }}
      />

      <div className="flex gap-2 border-b border-border">
        {([
          { key: "catalogo" as const, label: "Catálogo do Fornecedor" },
          { key: "estoque" as const, label: "Estoque da Loja" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setSource(tab.key); setCategory("todas"); }}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              source === tab.key ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
          {categories.map((cat) => {
            const Icon = categoryIcon(cat);
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition-colors shrink-0 flex items-center gap-1.5 ${
                  category === cat ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando produtos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum produto encontrado</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((item) => {
            const qty = cart[cartKey(source, item.id)]?.quantity ?? 0;
            const CategoryIcon = categoryIcon(item.category);
            return (
              <div
                key={item.id}
                className="bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:shadow-lg hover:shadow-[#c9a961]/15 hover:border-[#c9a961]/40 hover:-translate-y-0.5"
              >
                <div className="aspect-square bg-background flex items-center justify-center text-muted-foreground text-xs overflow-hidden">
                  {item.imageUrl ? (
                    <ZoomableImage src={item.imageUrl} alt={item.name} className="w-full h-full" />
                  ) : (
                    <CategoryIcon className="w-8 h-8 text-accent/40" />
                  )}
                </div>
                <div className="p-2.5 sm:p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground leading-snug line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] break-words">
                    {item.name}
                  </h3>
                  <p className="text-base sm:text-lg font-bold mt-1 text-accent">R$ {(item.price / 100).toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <button
                      onClick={() => setQuantity(source, item.id, qty - 1)}
                      disabled={qty === 0}
                      className="p-1.5 rounded bg-background border border-border text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-base font-bold text-foreground">{qty}</span>
                    <button
                      onClick={() => setQuantity(source, item.id, qty + 1)}
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
                      <div key={cartKey(item.source, item.id)} className="flex items-center justify-between gap-2 p-2 bg-background rounded border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.source === "estoque" ? "Estoque da loja" : "Fornecedor"}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setQuantity(item.source, item.id, item.quantity - 1)} className="p-1 hover:bg-accent/20 rounded">
                            <Minus className="w-3 h-3 text-accent" />
                          </button>
                          <span className="w-6 text-center text-sm text-foreground font-semibold">{item.quantity}</span>
                          <button onClick={() => setQuantity(item.source, item.id, item.quantity + 1)} className="p-1 hover:bg-accent/20 rounded">
                            <Plus className="w-3 h-3 text-accent" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-foreground w-20 text-right shrink-0">
                          R$ {(item.total / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label htmlFor="customerName" className="text-xs">Seu nome</Label>
                      <Input
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-9 mt-1"
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customerPhone" className="text-xs">Telefone (WhatsApp)</Label>
                      <Input
                        id="customerPhone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-9 mt-1"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border space-y-2">
                    <Label className="text-xs">Como você quer receber?</Label>
                    <ShippingMethodPicker method={shippingMethod} onChange={setShippingMethod} idPrefix="fp" />
                    {shippingMethod === "envio" && (
                      <ShippingAddressForm address={address} onChange={setAddress} idPrefix="fp" />
                    )}
                  </div>
                </CardContent>
              )}

              <div className="px-4 pb-4">
                {missingForMinimum > 0 ? (
                  <p className="text-xs text-amber-400 mb-2 text-center">
                    Faltam R$ {(missingForMinimum / 100).toFixed(2)} pra atingir o pedido mínimo de R$ {(minimumCents / 100).toFixed(2)} nos itens do fornecedor
                  </p>
                ) : shippingMethod === "envio" && shippingCentsPreview > 0 ? (
                  <p className="text-xs text-muted-foreground mb-2 text-center">
                    + R$ {(shippingCentsPreview / 100).toFixed(2)} de frete estimado
                  </p>
                ) : null}
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={missingForMinimum > 0 || createOrderMutation.isPending}
                  onClick={() => { setCartExpanded(true); handleSubmit(); }}
                >
                  {createOrderMutation.isPending ? "Enviando..." : "Enviar Pedido"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
