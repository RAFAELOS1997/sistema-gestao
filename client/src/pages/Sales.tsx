import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingCart, X, Plus, Minus, Search, EyeOff, Eye, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ReceiptModal } from "@/components/ReceiptModal";
import { ZoomableImage } from "@/components/ZoomableImage";

interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  listPrice: number; // preço de tabela, para mostrar quando o preço foi negociado
  priceInput: string; // texto digitado no campo de preço (evita o campo "brigar" com a digitação)
  total: number;
}

const CATEGORIES = ["todos", "guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  todos: "Todos",
  guias: "Guias",
  pulseiras: "Pulseiras",
  velas: "Velas e Castiçais",
  incensos: "Incensos e Defumadores",
  ervas: "Ervas e Banhos",
  imagens: "Imagens",
  ferramentas: "Ferramentas e Metais",
  vestuario: "Vestuário",
  livros: "Livros e Tarô",
  pedras: "Pedras e Cristais",
  outros: "Outros",
};

const PAGE_SIZE = 10;

export default function Sales() {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [cartExpanded, setCartExpanded] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("todos");
  const [hideOutOfStock, setHideOutOfStock] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [discountValue, setDiscountValue] = React.useState("0");
  const [discountMode, setDiscountMode] = React.useState<"percent" | "reais">("percent");
  const [paymentMethod, setPaymentMethod] = React.useState("dinheiro");
  const [receivedAmount, setReceivedAmount] = React.useState("");
  const [channel, setChannel] = React.useState<"fisico" | "instagram">("fisico");
  const [notes, setNotes] = React.useState("");
  const [showReceipt, setShowReceipt] = React.useState(false);
  const [lastSaleData, setLastSaleData] = React.useState<{
    items: CartItem[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    notes: string;
    receiptNumber: number;
  } | null>(null);

  const productsQuery = trpc.products.list.useQuery();
  const createSaleMutation = trpc.sales.create.useMutation();
  const createReceiptMutation = trpc.receipts.create.useMutation();

  // Filtrar produtos
  const filteredProducts = React.useMemo(() => {
    if (!productsQuery.data) return [];
    return productsQuery.data.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "todos" || p.category === selectedCategory;
      const matchesStock = !hideOutOfStock || p.currentStock > 0;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [productsQuery.data, searchTerm, selectedCategory, hideOutOfStock]);

  // Paginação (10 por página)
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, hideOutOfStock]);
  React.useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [pageCount, currentPage]);
  const pagedProducts = React.useMemo(
    () => filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredProducts, currentPage]
  );

  // Calcular totais do carrinho
  const cartTotals = React.useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const raw = parseFloat(discountValue.replace(",", ".")) || 0;
    const discount = discountMode === "percent"
      ? Math.round(subtotal * (raw / 100))
      : Math.min(Math.round(raw * 100), subtotal);
    const total = subtotal - discount;
    return { subtotal, discount, total };
  }, [cart, discountValue, discountMode]);

  // Troco (pagamento em dinheiro)
  const receivedCents = Math.round((parseFloat(receivedAmount.replace(",", ".")) || 0) * 100);
  const changeCents = receivedCents - cartTotals.total;

  const getCartQuantity = (productId: number) =>
    cart.find((item) => item.productId === productId)?.quantity ?? 0;

  // Adicionar produto ao carrinho (ou +1 se já estiver nele)
  const addToCart = (product: any) => {
    if (product.currentStock <= 0) {
      toast.error(`${product.name} está sem estoque!`);
      return;
    }

    const existingItem = cart.find((item) => item.productId === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty >= product.currentStock) {
      toast.error(`Estoque insuficiente! Disponível: ${product.currentStock}`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: item.unitPrice * (item.quantity + 1),
              }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
          listPrice: product.salePrice,
          priceInput: (product.salePrice / 100).toFixed(2),
          total: product.salePrice,
        },
      ];
    });
  };

  // Atualizar quantidade
  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    // Verificar estoque disponível
    const product = productsQuery.data?.find((p) => p.id === productId);
    if (product && quantity > product.currentStock) {
      toast.error(`Estoque insuficiente! Disponível: ${product.currentStock}`);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity,
              total: item.unitPrice * quantity,
            }
          : item
      )
    );
  };

  // Alterar preço unitário (preço negociado no balcão)
  const updateUnitPrice = (productId: number, priceReais: string) => {
    const cents = Math.round((parseFloat(priceReais.replace(",", ".")) || 0) * 100);
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, priceInput: priceReais, unitPrice: cents, total: cents * item.quantity }
          : item
      )
    );
  };

  // Remover do carrinho
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Finalizar venda
  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }
    if (cart.some((item) => item.unitPrice <= 0)) {
      toast.error("Tem item com preço zerado no carrinho. Ajuste o preço antes de finalizar.");
      return;
    }

    try {
      // Registrar cada item do carrinho como uma venda separada
      for (const item of cart) {
        await createSaleMutation.mutateAsync({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          channel,
          saleDate: new Date(),
        });
      }

      const { subtotal, discount, total } = cartTotals;

      // Criar recibo no banco com numeração sequencial
      const receiptResult = await createReceiptMutation.mutateAsync({
        subtotal,
        discount,
        total,
        paymentMethod,
        notes: notes || undefined,
        items: JSON.stringify(cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        }))),
      });

      setLastSaleData({
        items: cart,
        subtotal,
        discount,
        total,
        paymentMethod,
        notes,
        receiptNumber: receiptResult.receiptNumber,
      });

      setCart([]);
      setCartExpanded(false);
      setDiscountValue("0");
      setDiscountMode("percent");
      setPaymentMethod("dinheiro");
      setReceivedAmount("");
      setChannel("fisico");
      setNotes("");
      setShowReceipt(true);
      toast.success("Venda finalizada com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao finalizar venda");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent rounded-lg">
            <ShoppingCart className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Vendas</h1>
        </div>
        <p className="text-muted-foreground">Use o + e - em cada produto pra montar o carrinho</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 relative min-w-[180px]">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background border-border text-foreground"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40 bg-background border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="text-foreground">
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            checked={hideOutOfStock}
            onCheckedChange={setHideOutOfStock}
            className="data-[state=checked]:bg-accent"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {hideOutOfStock ? <EyeOff className="w-3 h-3 inline mr-1" /> : <Eye className="w-3 h-3 inline mr-1" />}
            Sem estoque
          </span>
        </div>
        <div className="flex rounded-md border border-border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title="Ver em grade"
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            title="Ver em lista"
            className={`p-2 transition-colors ${viewMode === "list" ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products */}
      {productsQuery.isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando produtos...</div>
      ) : pagedProducts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {pagedProducts.map((product) => {
            const outOfStock = product.currentStock <= 0;
            const qty = getCartQuantity(product.id);
            return (
              <div
                key={product.id}
                className={`p-3 bg-card border rounded-lg ${outOfStock ? "border-border/50 opacity-60" : "border-border"}`}
              >
                <div className="mb-2 h-24 bg-background rounded flex items-center justify-center text-muted-foreground text-sm relative overflow-hidden">
                  {product.imageUrl ? (
                    <ZoomableImage src={product.imageUrl} alt={product.name} className="w-full h-full" />
                  ) : (
                    product.category.toUpperCase()
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-background/80 rounded flex items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        SEM ESTOQUE
                      </span>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-sm text-foreground leading-snug min-h-[2.5rem]">{product.name}</h3>
                <p className={`text-xs mt-0.5 ${outOfStock ? "text-destructive" : "text-muted-foreground"}`}>
                  Estoque: {product.currentStock}
                </p>
                <p className="text-lg font-bold mt-1 text-accent">R$ {(product.salePrice / 100).toFixed(2)}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <button
                    onClick={() => updateQuantity(product.id, qty - 1)}
                    disabled={qty === 0}
                    className="p-1.5 rounded bg-background border border-border text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-base font-bold text-foreground">{qty}</span>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={outOfStock || qty >= product.currentStock}
                    className="p-1.5 rounded bg-accent text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {pagedProducts.map((product) => {
            const outOfStock = product.currentStock <= 0;
            const qty = getCartQuantity(product.id);
            return (
              <div
                key={product.id}
                className={`p-3 bg-card border rounded-lg flex items-center gap-3 ${outOfStock ? "border-border/50 opacity-60" : "border-border"}`}
              >
                <div className="h-14 w-14 shrink-0 bg-background rounded flex items-center justify-center text-muted-foreground text-[10px] relative overflow-hidden">
                  {product.imageUrl ? (
                    <ZoomableImage src={product.imageUrl} alt={product.name} className="w-full h-full" />
                  ) : (
                    product.category.slice(0, 4).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground leading-snug">{product.name}</h3>
                  <p className={`text-xs ${outOfStock ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {outOfStock ? "Sem estoque" : `Estoque: ${product.currentStock}`}
                  </p>
                </div>
                <p className="text-base font-bold text-accent shrink-0 w-24 text-right">
                  R$ {(product.salePrice / 100).toFixed(2)}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => updateQuantity(product.id, qty - 1)}
                    disabled={qty === 0}
                    className="p-1.5 rounded bg-background border border-border text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-5 text-center text-base font-bold text-foreground">{qty}</span>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={outOfStock || qty >= product.currentStock}
                    className="p-1.5 rounded bg-accent text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {filteredProducts.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {pageCount} · {filteredProducts.length} produto(s)
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-border"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-border"
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Carrinho fixado embaixo */}
      {cart.length > 0 && (
        <div className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
          <Card className="border border-accent/30 bg-card shadow-xl">
            <button
              type="button"
              onClick={() => setCartExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-accent" />
                <span className="text-sm text-foreground font-medium">{cart.length} item(ns)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-accent">R$ {(cartTotals.total / 100).toFixed(2)}</span>
                {cartExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {cartExpanded && (
              <CardContent className="space-y-4 pt-0 border-t border-border max-h-[65vh] overflow-y-auto">
                {/* Cart Items */}
                <div className="space-y-2 pt-3">
                  {cart.map((item) => (
                    <div key={item.productId} className="p-2 bg-background rounded border border-border">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-foreground flex-1">{item.name}</p>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="p-1 hover:bg-accent/20 rounded transition-colors"
                          >
                            <Minus className="w-3 h-3 text-accent" />
                          </button>
                          <span className="w-6 text-center text-sm text-foreground font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="p-1 hover:bg-accent/20 rounded transition-colors"
                          >
                            <Plus className="w-3 h-3 text-accent" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs text-muted-foreground shrink-0">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.priceInput}
                            onChange={(e) => updateUnitPrice(item.productId, e.target.value)}
                            className="h-7 w-20 px-1.5 text-sm text-right bg-card border-border text-foreground"
                            title="Preço unitário (dá pra ajustar se negociou)"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        {item.unitPrice !== item.listPrice ? (
                          <span className="text-[10px] text-muted-foreground line-through">
                            tabela R$ {(item.listPrice / 100).toFixed(2)}
                          </span>
                        ) : <span />}
                        <p className="text-sm font-semibold text-accent">R$ {(item.total / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Discount */}
                <div className="pt-2 border-t border-border">
                  <Label htmlFor="discount" className="text-foreground text-xs">
                    Desconto
                  </Label>
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      step={discountMode === "percent" ? "0.5" : "0.01"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="bg-background border-border text-foreground text-sm"
                    />
                    <div className="flex rounded-md border border-border overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setDiscountMode("percent")}
                        className={`px-2.5 text-sm font-semibold transition-colors ${discountMode === "percent" ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"}`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountMode("reais")}
                        className={`px-2 text-sm font-semibold transition-colors ${discountMode === "reais" ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"}`}
                      >
                        R$
                      </button>
                    </div>
                  </div>
                </div>

                {/* Canal da venda */}
                <div className="pt-2 border-t border-border">
                  <Label className="text-foreground text-xs">Canal da Venda</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={channel === "fisico" ? "default" : "outline"}
                      className={channel === "fisico"
                        ? "bg-accent text-accent-foreground hover:bg-accent/90"
                        : "border-border text-muted-foreground"}
                      onClick={() => setChannel("fisico")}
                    >
                      Loja Física
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={channel === "instagram" ? "default" : "outline"}
                      className={channel === "instagram"
                        ? "bg-accent text-accent-foreground hover:bg-accent/90"
                        : "border-border text-muted-foreground"}
                      onClick={() => setChannel("instagram")}
                    >
                      Instagram
                    </Button>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="pt-2 border-t border-border">
                  <Label htmlFor="payment" className="text-foreground text-xs">
                    Forma de Pagamento
                  </Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment" className="mt-1 bg-background border-border text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="dinheiro" className="text-foreground">
                        Dinheiro
                      </SelectItem>
                      <SelectItem value="pix" className="text-foreground">
                        PIX
                      </SelectItem>
                      <SelectItem value="debito" className="text-foreground">
                        Cartão de Débito
                      </SelectItem>
                      <SelectItem value="credito" className="text-foreground">
                        Cartão de Crédito
                      </SelectItem>
                      <SelectItem value="cheque" className="text-foreground">
                        Cheque
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Troco (dinheiro) */}
                {paymentMethod === "dinheiro" && (
                  <div className="pt-2 border-t border-border">
                    <Label htmlFor="received" className="text-foreground text-xs">
                      Valor Recebido (R$)
                    </Label>
                    <Input
                      id="received"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={`Total: ${(cartTotals.total / 100).toFixed(2)}`}
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      className="mt-1 bg-background border-border text-foreground text-sm"
                    />
                    {receivedAmount !== "" && (
                      <p className={`mt-1.5 text-sm font-bold ${changeCents >= 0 ? "text-green-400" : "text-destructive"}`}>
                        {changeCents >= 0
                          ? `Troco: R$ ${(changeCents / 100).toFixed(2)}`
                          : `Falta: R$ ${(Math.abs(changeCents) / 100).toFixed(2)}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Notes / Observações */}
                <div className="pt-2 border-t border-border">
                  <Label htmlFor="notes" className="text-foreground text-xs">
                    Observações
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Ex: Nome do cliente, pedido especial..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 bg-background border-border text-foreground text-sm resize-none"
                    rows={2}
                  />
                </div>

                {/* Totals */}
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="text-foreground font-semibold">R$ {(cartTotals.subtotal / 100).toFixed(2)}</span>
                  </div>
                  {cartTotals.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Desconto:</span>
                      <span className="text-destructive font-semibold">-R$ {(cartTotals.discount / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span className="text-foreground">Total:</span>
                    <span className="text-accent">R$ {(cartTotals.total / 100).toFixed(2)}</span>
                  </div>
                </div>

                {/* Finalize Button */}
                <Button
                  onClick={handleFinalizeSale}
                  disabled={createSaleMutation.isPending || createReceiptMutation.isPending}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base py-6"
                >
                  {createSaleMutation.isPending || createReceiptMutation.isPending ? "Processando..." : "Finalizar Venda"}
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Receipt Modal */}
      {lastSaleData && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          items={lastSaleData.items}
          subtotal={lastSaleData.subtotal}
          discount={lastSaleData.discount}
          total={lastSaleData.total}
          paymentMethod={lastSaleData.paymentMethod}
          notes={lastSaleData.notes}
          receiptNumber={lastSaleData.receiptNumber}
        />
      )}
    </div>
  );
}
