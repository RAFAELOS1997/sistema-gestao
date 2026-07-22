import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZoomableImage } from "@/components/ZoomableImage";
import { trpc } from "@/lib/trpc";
import { Search, Plus, Minus, ShoppingCart, ChevronDown, ChevronUp, QrCode, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useProntaEntregaCart } from "@/contexts/ProntaEntregaCartContext";
import { QRCodeSVG } from "qrcode.react";
import { CATEGORY_LABELS, categoryIcon } from "@/lib/categoryMeta";
import { ShippingMethodPicker, ShippingAddressForm, EMPTY_ADDRESS, isAddressComplete, ShippingMethod, ShippingAddress } from "@/components/public/ShippingFields";
import { CouponField } from "@/components/public/CouponField";

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

export default function PublicCatalogProducts() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");
  const { cart, getQuantity, setQuantity, clear: clearCart, itemCount } = useProntaEntregaCart();
  const [cartExpanded, setCartExpanded] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("retirada");
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [couponCode, setCouponCode] = useState("");
  const [charge, setCharge] = useState<{ orderNsu: string; checkoutUrl: string; total: number } | null>(null);
  const [paid, setPaid] = useState(false);

  const utils = trpc.useUtils();
  const productsQuery = trpc.publicStore.products.list.useQuery();
  const products = productsQuery.data ?? [];
  const shippingInfoQuery = trpc.publicStore.shipping.info.useQuery();
  const shippingCentsPreview = previewShippingCents(shippingMethod, address.city, address.state, shippingInfoQuery.data);

  const checkoutMutation = trpc.publicStore.prontaEntrega.checkout.useMutation({
    onSuccess: (result) => setCharge({ orderNsu: result.orderNsu, checkoutUrl: result.checkoutUrl, total: result.subtotal + result.shippingCents }),
    onError: (error) => toast.error(error.message),
  });

  const statusQuery = trpc.publicStore.prontaEntrega.checkStatus.useQuery(
    { orderNsu: charge?.orderNsu ?? "" },
    { enabled: !!charge, refetchInterval: 4000 }
  );

  useEffect(() => {
    if (statusQuery.data?.status === "paid" && charge && !paid) {
      setPaid(true);
      clearCart();
      setCartExpanded(false);
      // Estoque acabou de baixar de verdade no servidor — atualiza os
      // números na tela pra não mostrar quantidade desatualizada.
      utils.publicStore.products.list.invalidate();
      utils.publicStore.orderCatalog.stock.invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data?.status]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "todas" || p.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, quantity]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product || quantity <= 0) return null;
        return { id: Number(id), name: product.name, price: product.price, quantity, total: product.price * quantity };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
  }, [cart, products]);

  const subtotal = cartItems.reduce((sum, i) => sum + i.total, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Adicione ao menos um item ao carrinho");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Informe seu nome e telefone");
      return;
    }
    if (shippingMethod === "envio" && !isAddressComplete(address)) {
      toast.error("Preencha o endereço de entrega completo (CEP, número, bairro, cidade e UF)");
      return;
    }
    checkoutMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cartItems.map((i) => ({ productId: i.id, quantity: i.quantity })),
      shippingMethod,
      shippingAddress: shippingMethod === "envio" ? address : undefined,
      couponCode: couponCode.trim() || undefined,
    });
  };

  const closeDialog = () => {
    setCharge(null);
    setPaid(false);
  };

  return (
    <div className="relative isolate">
      <div className="space-y-5 sm:space-y-6 pb-24">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">Pronta Entrega</h1>
        <p className="text-muted-foreground text-sm">
          Compre agora e pague na hora pelo InfinitePay
          {!productsQuery.isLoading && products.length > 0 && (
            <span> — {filtered.length === products.length ? `${products.length} produto(s)` : `${filtered.length} de ${products.length} produto(s)`}</span>
          )}
        </p>
      </div>

      <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
        Entregamos pra todo o Brasil pelos Correios — ou você pode retirar direto na loja, em Ribeirão Preto.
      </p>

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

      {productsQuery.isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando produtos...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 px-4 text-muted-foreground text-sm max-w-md mx-auto">
          Nenhum produto disponível no momento.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum produto encontrado</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((product) => {
            const qty = getQuantity(product.id);
            const CategoryIcon = categoryIcon(product.category);
            return (
              <div
                key={product.id}
                className="bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:shadow-lg hover:shadow-[#c9a961]/15 hover:border-[#c9a961]/40 hover:-translate-y-0.5"
              >
                <div className="aspect-square bg-background flex items-center justify-center text-muted-foreground text-xs overflow-hidden relative">
                  {product.imageUrl ? (
                    <ZoomableImage src={product.imageUrl} alt={product.name} className="w-full h-full" />
                  ) : (
                    <CategoryIcon className="w-8 h-8 text-accent/40" />
                  )}
                </div>
                <div className="p-2.5 sm:p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground leading-snug line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] break-words">
                    {product.name}
                  </h3>
                  <p className="text-base sm:text-lg font-bold mt-1 text-accent">R$ {(product.price / 100).toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <button
                      onClick={() => setQuantity(product.id, qty - 1)}
                      disabled={qty === 0}
                      className="p-1.5 rounded bg-background border border-border text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-base font-bold text-foreground">{qty}</span>
                    <button
                      onClick={() => setQuantity(product.id, qty + 1)}
                      disabled={qty >= product.currentStock}
                      className="p-1.5 rounded bg-accent text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
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

      {/* Carrinho + checkout fixado embaixo */}
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
                  <span className="text-sm text-foreground font-medium">{itemCount} item(ns)</span>
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
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label htmlFor="pe-customerName" className="text-xs">Seu nome</Label>
                      <Input
                        id="pe-customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-9 mt-1"
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pe-customerPhone" className="text-xs">Telefone (WhatsApp)</Label>
                      <Input
                        id="pe-customerPhone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-9 mt-1"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border space-y-2">
                    <Label className="text-xs">Como você quer receber?</Label>
                    <ShippingMethodPicker method={shippingMethod} onChange={setShippingMethod} idPrefix="pe" />
                    {shippingMethod === "envio" && (
                      <ShippingAddressForm address={address} onChange={setAddress} idPrefix="pe" />
                    )}
                  </div>

                  <div className="pt-2 border-t border-border">
                    <CouponField code={couponCode} onChange={setCouponCode} idPrefix="pe" />
                  </div>
                </CardContent>
              )}

              <div className="px-4 pb-4">
                {shippingMethod === "envio" && shippingCentsPreview > 0 && (
                  <p className="text-xs text-muted-foreground mb-2 text-center">
                    Total com frete: R$ {((subtotal + shippingCentsPreview) / 100).toFixed(2)}
                  </p>
                )}
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={checkoutMutation.isPending}
                  onClick={() => { setCartExpanded(true); handleCheckout(); }}
                >
                  {checkoutMutation.isPending ? "Gerando cobrança..." : "Finalizar com InfinitePay"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Cobrança InfinitePay: QR Code + aguardando pagamento */}
      <Dialog open={!!charge} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <QrCode className="w-5 h-5 text-accent" />
              Pagamento
            </DialogTitle>
            <DialogDescription>
              R$ {((charge?.total ?? subtotal) / 100).toFixed(2)} — escaneie o QR Code com a câmera do celular ou abra o link
            </DialogDescription>
          </DialogHeader>

          {charge && (
            <div className="flex flex-col items-center gap-4 py-2">
              {paid ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <CheckCircle2 className="w-16 h-16 text-green-500" />
                  <p className="text-foreground font-semibold">Pagamento confirmado!</p>
                  <p className="text-sm text-muted-foreground text-center">
                    Recebemos seu pedido. Vamos combinar a entrega ou retirada pelo telefone informado.
                  </p>
                  <Button onClick={closeDialog} className="bg-accent text-accent-foreground hover:bg-accent/90 mt-2">
                    Fechar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="bg-white p-3 rounded-lg">
                    <QRCodeSVG value={charge.checkoutUrl} size={224} />
                  </div>
                  <a
                    href={charge.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir link do pagamento
                  </a>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aguardando pagamento...
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      className="flex-1 border-border"
                      onClick={() => statusQuery.refetch()}
                      disabled={statusQuery.isFetching}
                    >
                      {statusQuery.isFetching ? "Verificando..." : "Já paguei — verificar"}
                    </Button>
                    <Button variant="outline" className="border-destructive/40 text-destructive" onClick={closeDialog}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
