import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, X, Plus, Minus, Search, EyeOff, Eye, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ReceiptModal } from "@/components/ReceiptModal";

interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
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

export default function Sales() {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("todos");
  const [hideOutOfStock, setHideOutOfStock] = React.useState(true);
  const [discountPercent, setDiscountPercent] = React.useState("0");
  const [paymentMethod, setPaymentMethod] = React.useState("dinheiro");
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

  // Calcular totais do carrinho
  const cartTotals = React.useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const discount = Math.round(subtotal * (parseFloat(discountPercent) / 100));
    const total = subtotal - discount;
    return { subtotal, discount, total };
  }, [cart, discountPercent]);

  // Adicionar produto ao carrinho
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
          total: product.salePrice,
        },
      ];
    });
    toast.success(`${product.name} adicionado ao carrinho`);
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

    try {
      // Registrar cada item do carrinho como uma venda separada
      for (const item of cart) {
        await createSaleMutation.mutateAsync({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          channel: "fisico",
          saleDate: new Date(),
        });
      }

      const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
      const discount = Math.round(subtotal * (parseFloat(discountPercent) / 100));
      const total = subtotal - discount;

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
      setDiscountPercent("0");
      setPaymentMethod("dinheiro");
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
        <p className="text-muted-foreground">Interface ágil de vendas - Clique nos produtos para adicionar ao carrinho</p>
      </div>

      {/* Main Layout: Products Grid + Cart Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
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
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {productsQuery.isLoading ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">Carregando produtos...</div>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const outOfStock = product.currentStock <= 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`p-4 bg-card border rounded-lg transition-all text-left group ${
                      outOfStock
                        ? "border-border/50 opacity-50 cursor-not-allowed"
                        : "border-border hover:border-accent hover:bg-background"
                    }`}
                  >
                    <div className="mb-2 h-24 bg-background rounded flex items-center justify-center text-muted-foreground text-sm relative">
                      {product.category.toUpperCase()}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-background/80 rounded flex items-center justify-center">
                          <span className="text-xs font-bold text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            SEM ESTOQUE
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className={`font-semibold text-sm truncate ${outOfStock ? "text-muted-foreground" : "text-foreground group-hover:text-accent"}`}>{product.name}</h3>
                    <p className={`text-xs mt-1 ${outOfStock ? "text-destructive" : "text-muted-foreground"}`}>
                      Estoque: {product.currentStock}
                    </p>
                    <p className={`text-lg font-bold mt-2 ${outOfStock ? "text-muted-foreground" : "text-accent"}`}>R$ {(product.salePrice / 100).toFixed(2)}</p>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum produto encontrado</div>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="lg:col-span-1">
          <Card className="border border-border bg-card sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground">Carrinho</CardTitle>
              <CardDescription className="text-muted-foreground">{cart.length} item(ns)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cart Items */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <div key={item.productId} className="p-2 bg-background rounded border border-border">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-foreground truncate flex-1">{item.name}</p>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
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
                        <p className="text-sm font-semibold text-accent">R$ {(item.total / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-muted-foreground text-sm">Carrinho vazio</p>
                )}
              </div>

              {/* Discount */}
              {cart.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <Label htmlFor="discount" className="text-foreground text-xs">
                    Desconto (%)
                  </Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="mt-1 bg-background border-border text-foreground text-sm"
                  />
                </div>
              )}

              {/* Payment Method */}
              {cart.length > 0 && (
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
                      <SelectItem value="cartao" className="text-foreground">
                        Cartão
                      </SelectItem>
                      <SelectItem value="pix" className="text-foreground">
                        PIX
                      </SelectItem>
                      <SelectItem value="cheque" className="text-foreground">
                        Cheque
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes / Observações */}
              {cart.length > 0 && (
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
              )}

              {/* Totals */}
              {cart.length > 0 && (
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
              )}

              {/* Finalize Button */}
              <Button
                onClick={handleFinalizeSale}
                disabled={cart.length === 0 || createSaleMutation.isPending || createReceiptMutation.isPending}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base py-6"
              >
                {createSaleMutation.isPending || createReceiptMutation.isPending ? "Processando..." : "Finalizar Venda"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
