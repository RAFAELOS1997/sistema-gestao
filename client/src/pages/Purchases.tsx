import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit2, Trash2, ShoppingCart, FileUp, Search, Package, Truck, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const CATEGORIES = ["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"] as const;
const CATEGORY_LABELS: Record<string, string> = {
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

interface PurchaseItem {
  id: string; // temp ID for UI
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: string; // em reais para input
  isNew: boolean; // se é produto novo
  category: string;
  salePrice: string; // preço de venda se novo
}

export default function Purchases() {
  // ─── State ──────────────────────────────────────────────────────────────
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [isEditPurchaseOpen, setIsEditPurchaseOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [editPurchaseForm, setEditPurchaseForm] = useState({
    quantity: "",
    unitPrice: "",
    totalPrice: "",
    supplier: "",
    purchaseDate: new Date().toISOString().split("T")[0],
  });

  // Painel Nova Compra
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [productSearch, setProductSearch] = useState("");

  // Novo Fornecedor inline
  const [newSupplierForm, setNewSupplierForm] = useState({ name: "", cnpj: "", phone: "" });

  // Novo Produto inline
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    category: "outros" as typeof CATEGORIES[number],
    costPrice: "",
    salePrice: "",
    minimumStock: "5",
  });

  // Import
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);

  // ─── Queries & Mutations ────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const productsQuery = trpc.products.list.useQuery();
  const suppliersQuery = trpc.suppliers.list.useQuery();
  const purchasesQuery = trpc.purchases.list.useQuery({ limit: 100 });

  const createBatchMutation = trpc.purchases.createBatch.useMutation({
    onSuccess: () => {
      utils.purchases.list.invalidate();
      utils.products.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
  });

  const createProductMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
    },
  });

  const createSupplierMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
    },
  });

  const importFromTextMutation = trpc.purchases.importFromText.useMutation();
  const importFromFileMutation = trpc.purchases.importFromFile.useMutation();
  const confirmImportMutation = trpc.purchases.confirmImport.useMutation({
    onSuccess: () => {
      utils.purchases.list.invalidate();
      utils.products.list.invalidate();
      utils.suppliers.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
  });

  const updatePurchaseMutation = trpc.purchases.update.useMutation({
    onSuccess: () => {
      utils.purchases.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
  });

  // ─── Computed ───────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!productsQuery.data) return [];
    if (!productSearch.trim()) return productsQuery.data;
    const search = productSearch.toLowerCase();
    return productsQuery.data.filter(
      (p) => p.name.toLowerCase().includes(search) || CATEGORY_LABELS[p.category]?.toLowerCase().includes(search)
    );
  }, [productsQuery.data, productSearch]);

  const purchaseTotal = useMemo(() => {
    return purchaseItems.reduce((sum, item) => {
      const price = parseFloat(item.unitPrice) || 0;
      return sum + price * item.quantity;
    }, 0);
  }, [purchaseItems]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const addProductToItems = (product: { id: number; name: string; category: string; costPrice: number }) => {
    const existing = purchaseItems.find((i) => i.productId === product.id);
    if (existing) {
      setPurchaseItems(
        purchaseItems.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      );
    } else {
      setPurchaseItems([
        ...purchaseItems,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: (product.costPrice / 100).toFixed(2),
          isNew: false,
          category: product.category,
          salePrice: "",
        },
      ]);
    }
    setProductSearch("");
  };

  const addNewProductToItems = () => {
    if (!newProductForm.name || !newProductForm.costPrice || !newProductForm.salePrice) {
      toast.error("Preencha nome, preço de custo e preço de venda");
      return;
    }
    setPurchaseItems([
      ...purchaseItems,
      {
        id: crypto.randomUUID(),
        productId: null,
        productName: newProductForm.name,
        quantity: 1,
        unitPrice: newProductForm.costPrice,
        isNew: true,
        category: newProductForm.category,
        salePrice: newProductForm.salePrice,
      },
    ]);
    setNewProductForm({ name: "", category: "outros", costPrice: "", salePrice: "", minimumStock: "5" });
    setShowNewProduct(false);
    toast.success("Produto adicionado à compra");
  };

  const removeItem = (id: string) => {
    setPurchaseItems(purchaseItems.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setPurchaseItems(purchaseItems.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierForm.name) {
      toast.error("Nome do fornecedor é obrigatório");
      return;
    }
    try {
      await createSupplierMutation.mutateAsync({
        name: newSupplierForm.name,
        cnpj: newSupplierForm.cnpj || undefined,
        phone: newSupplierForm.phone || undefined,
      });
      setSelectedSupplier(newSupplierForm.name);
      setNewSupplierForm({ name: "", cnpj: "", phone: "" });
      setShowNewSupplier(false);
      toast.success("Fornecedor cadastrado!");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao criar fornecedor");
    }
  };

  const handleFinalizePurchase = async () => {
    if (!selectedSupplier) {
      toast.error("Selecione um fornecedor");
      return;
    }
    if (purchaseItems.length === 0) {
      toast.error("Adicione ao menos um produto");
      return;
    }

    try {
      // Primeiro criar produtos novos
      const itemsWithIds: { productId: number; quantity: number; unitPrice: number; totalPrice: number }[] = [];

      for (const item of purchaseItems) {
        let productId = item.productId;

        if (item.isNew && !productId) {
          const costPrice = Math.round(parseFloat(item.unitPrice) * 100);
          const salePrice = Math.round(parseFloat(item.salePrice) * 100);
          const result = await createProductMutation.mutateAsync({
            name: item.productName,
            category: item.category as typeof CATEGORIES[number],
            costPrice,
            salePrice,
            currentStock: 0,
            minimumStock: parseInt(newProductForm.minimumStock) || 5,
          });
          productId = (result as any)[0]?.insertId || (result as any).insertId;
        }

        if (productId) {
          const unitPrice = Math.round(parseFloat(item.unitPrice) * 100);
          itemsWithIds.push({
            productId,
            quantity: item.quantity,
            unitPrice,
            totalPrice: unitPrice * item.quantity,
          });
        }
      }

      await createBatchMutation.mutateAsync({
        items: itemsWithIds,
        supplier: selectedSupplier,
        purchaseDate: new Date(purchaseDate),
      });

      toast.success(`Compra registrada! ${itemsWithIds.length} itens adicionados ao estoque.`);
      setPurchaseItems([]);
      setSelectedSupplier("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      setShowNewPurchase(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao registrar compra");
    }
  };

  // Import handlers
  const handleImport = async () => {
    if (!importText.trim() || importText.length < 10) {
      toast.error("Cole o texto da nota fiscal ou planilha (mínimo 10 caracteres)");
      return;
    }
    setIsImporting(true);
    try {
      const result = await importFromTextMutation.mutateAsync({
        text: importText,
        existingProducts: productsQuery.data?.map((p) => ({ id: p.id, name: p.name, category: p.category })),
        existingSuppliers: suppliersQuery.data?.map((s) => ({ id: s.id, name: s.name })),
      });
      setImportResult(result);
      toast.success(`${result.items.length} itens identificados!`);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao processar importação");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importResult) return;
    setIsConfirmingImport(true);
    try {
      const result = await confirmImportMutation.mutateAsync({
        supplier: importResult.supplier,
        items: importResult.items,
        purchaseDate: importResult.purchaseDate,
      });
      toast.success(
        `Importação concluída! ${result.registeredPurchases} compras registradas, ${result.createdProducts} produtos criados.`
      );
      setImportResult(null);
      setImportText("");
      setShowImport(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao confirmar importação");
    } finally {
      setIsConfirmingImport(false);
    }
  };

  // Edit purchase
  const handleEditPurchase = (purchase: any) => {
    setEditingPurchaseId(purchase.id);
    setEditPurchaseForm({
      quantity: purchase.quantity.toString(),
      unitPrice: (purchase.unitPrice / 100).toFixed(2),
      totalPrice: (purchase.totalPrice / 100).toFixed(2),
      supplier: purchase.supplier,
      purchaseDate: new Date(purchase.purchaseDate).toISOString().split("T")[0],
    });
    setIsEditPurchaseOpen(true);
  };

  const handleUpdatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchaseId) return;
    try {
      const quantity = parseInt(editPurchaseForm.quantity);
      const unitPrice = Math.round(parseFloat(editPurchaseForm.unitPrice) * 100);
      const totalPrice = Math.round(parseFloat(editPurchaseForm.totalPrice) * 100);
      await updatePurchaseMutation.mutateAsync({
        id: editingPurchaseId,
        quantity,
        unitPrice,
        totalPrice,
        supplier: editPurchaseForm.supplier,
        purchaseDate: new Date(editPurchaseForm.purchaseDate),
      });
      toast.success("Compra atualizada!");
      setIsEditPurchaseOpen(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao atualizar compra");
    }
  };

  const getProductName = (productId: number) => {
    return productsQuery.data?.find((p) => p.id === productId)?.name || `Produto #${productId}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent rounded-lg">
            <ShoppingCart className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Compras</h1>
        </div>
        <p className="text-muted-foreground">Registre compras manualmente ou importe de notas fiscais</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={() => setShowNewPurchase(true)}
          className="bg-accent text-accent-foreground hover:bg-accent/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Compra
        </Button>
        <Button
          onClick={() => setShowImport(true)}
          variant="outline"
          className="border-accent text-accent hover:bg-accent/10 flex items-center gap-2"
        >
          <FileUp className="w-4 h-4" />
          Importar Nota/Planilha
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAINEL NOVA COMPRA (Dialog fullscreen-like)
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showNewPurchase} onOpenChange={setShowNewPurchase}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-accent" />
              Nova Compra
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Adicione múltiplos produtos à mesma compra
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Fornecedor + Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Fornecedor *</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="bg-background border-border text-foreground flex-1">
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {suppliersQuery.data?.map((s) => (
                        <SelectItem key={s.id} value={s.name} className="text-foreground">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewSupplier(true)}
                    className="border-accent text-accent hover:bg-accent/10 shrink-0"
                    title="Novo Fornecedor"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-foreground">Data da Compra</Label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
            </div>

            <Separator className="border-border" />

            {/* Busca de Produto */}
            <div>
              <Label className="text-foreground">Adicionar Produto</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome ou categoria..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10 bg-background border-border text-foreground"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewProduct(true)}
                  className="border-accent text-accent hover:bg-accent/10 shrink-0"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Novo Produto
                </Button>
              </div>

              {/* Resultados da busca */}
              {productSearch.trim() && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-md bg-background">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.slice(0, 10).map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProductToItems(product)}
                        className="w-full text-left px-3 py-2 hover:bg-accent/10 flex items-center justify-between border-b border-border last:border-0 transition-colors"
                      >
                        <div>
                          <span className="text-foreground font-medium">{product.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs border-accent/30 text-accent">
                            {CATEGORY_LABELS[product.category]}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground text-sm">
                          R$ {(product.costPrice / 100).toFixed(2)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-muted-foreground">
                      Nenhum produto encontrado.{" "}
                      <button onClick={() => setShowNewProduct(true)} className="text-accent underline">
                        Cadastrar novo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Itens da Compra */}
            {purchaseItems.length > 0 && (
              <div>
                <Label className="text-foreground">Itens da Compra ({purchaseItems.length})</Label>

                {/* Cards no celular */}
                <div className="mt-2 md:hidden space-y-2 sm:space-y-3">
                  {purchaseItems.map((item) => (
                    <div key={item.id} className="p-3 bg-background rounded-lg border border-border space-y-1.5 sm:space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug break-words">{item.productName}</p>
                          {item.isNew && (
                            <Badge className="bg-green-600/20 text-green-400 text-xs shrink-0">NOVO</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="h-9 w-9 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-muted-foreground text-[10px]">Qtd</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                            className="bg-card border-border text-foreground h-9 mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-[10px]">Preço Unit. (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                            className="bg-card border-border text-foreground h-9 mt-0.5"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                        <span className="text-muted-foreground text-xs">Subtotal</span>
                        <span className="text-foreground font-medium">
                          R$ {((parseFloat(item.unitPrice) || 0) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabela no computador */}
                <div className="mt-2 border border-border rounded-md overflow-x-auto hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-accent">Produto</TableHead>
                        <TableHead className="text-accent w-24">Qtd</TableHead>
                        <TableHead className="text-accent w-32">Preço Unit. (R$)</TableHead>
                        <TableHead className="text-accent w-28 text-right">Subtotal</TableHead>
                        <TableHead className="text-accent w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseItems.map((item) => (
                        <TableRow key={item.id} className="border-border">
                          <TableCell className="text-foreground">
                            <div className="flex items-center gap-2">
                              {item.productName}
                              {item.isNew && (
                                <Badge className="bg-green-600/20 text-green-400 text-xs">NOVO</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                              className="w-20 bg-background border-border text-foreground h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                              className="w-28 bg-background border-border text-foreground h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right text-foreground font-medium">
                            R$ {((parseFloat(item.unitPrice) || 0) * item.quantity).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.id)}
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Total */}
                <div className="mt-3 flex justify-end">
                  <div className="bg-background border border-border rounded-lg px-4 py-2">
                    <span className="text-muted-foreground mr-2">Total da Compra:</span>
                    <span className="text-accent font-bold text-lg">R$ {purchaseTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Botão Finalizar */}
            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowNewPurchase(false)} className="border-border text-foreground">
                Cancelar
              </Button>
              <Button
                onClick={handleFinalizePurchase}
                disabled={createBatchMutation.isPending || purchaseItems.length === 0}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {createBatchMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Finalizar Compra ({purchaseItems.length} itens)
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG NOVO FORNECEDOR INLINE
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showNewSupplier} onOpenChange={setShowNewSupplier}>
        <DialogContent className="max-w-sm bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Truck className="w-5 h-5 text-accent" />
              Novo Fornecedor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Nome *</Label>
              <Input
                value={newSupplierForm.name}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                placeholder="Ex: Distribuidora Mística"
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">CNPJ</Label>
              <Input
                value={newSupplierForm.cnpj}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, cnpj: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Telefone</Label>
              <Input
                value={newSupplierForm.phone}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <Button
              onClick={handleCreateSupplier}
              disabled={createSupplierMutation.isPending}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {createSupplierMutation.isPending ? "Cadastrando..." : "Cadastrar Fornecedor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG NOVO PRODUTO INLINE
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
        <DialogContent className="max-w-sm bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-accent" />
              Novo Produto
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              O produto será criado e adicionado à compra
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Nome *</Label>
              <Input
                value={newProductForm.name}
                onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                placeholder="Ex: Vela 7 Dias Branca"
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Categoria *</Label>
              <Select
                value={newProductForm.category}
                onValueChange={(v) => setNewProductForm({ ...newProductForm, category: v as typeof CATEGORIES[number] })}
              >
                <SelectTrigger className="mt-1 bg-background border-border text-foreground">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Preço Custo (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProductForm.costPrice}
                  onChange={(e) => setNewProductForm({ ...newProductForm, costPrice: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground">Preço Venda (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProductForm.salePrice}
                  onChange={(e) => setNewProductForm({ ...newProductForm, salePrice: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
            </div>
            <Button
              onClick={addNewProductToItems}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Adicionar à Compra
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG IMPORTAÇÃO INTELIGENTE
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <FileUp className="w-5 h-5 text-accent" />
              Importar Compra
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Cole o texto da nota fiscal, cupom ou planilha. A IA vai identificar os produtos automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!importResult ? (
              <>
                {/* Upload de Arquivo */}
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors">
                  <FileUp className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-foreground font-medium mb-1">Enviar Arquivo</p>
                  <p className="text-muted-foreground text-sm mb-3">PDF, XML (NF-e), CSV, XLSX</p>
                  <input
                    type="file"
                    accept=".pdf,.xml,.csv,.xlsx,.xls,.txt"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsImporting(true);
                      try {
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const base64 = (reader.result as string).split(",")[1];
                          try {
                            const result = await importFromFileMutation.mutateAsync({
                              fileContent: base64,
                              fileName: file.name,
                              mimeType: file.type,
                              existingProducts: productsQuery.data?.map((p) => ({ id: p.id, name: p.name, category: p.category })),
                              existingSuppliers: suppliersQuery.data?.map((s) => ({ id: s.id, name: s.name })),
                            });
                            setImportResult(result);
                            toast.success(`${result.items.length} itens identificados do arquivo!`);
                          } catch (error: any) {
                            toast.error(error?.message ?? "Erro ao processar arquivo");
                          }
                          setIsImporting(false);
                        };
                        reader.readAsDataURL(file);
                      } catch {
                        toast.error("Erro ao ler arquivo");
                        setIsImporting(false);
                      }
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors text-sm font-medium"
                  >
                    <FileUp className="w-4 h-4" />
                    Selecionar Arquivo
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Separator className="flex-1 border-border" />
                  <span className="text-muted-foreground text-sm">ou cole o texto</span>
                  <Separator className="flex-1 border-border" />
                </div>

                {/* Texto Manual */}
                <div>
                  <Label className="text-foreground">Texto da Nota Fiscal / Planilha</Label>
                  <Textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`Cole aqui o conteúdo da nota fiscal, cupom ou planilha...\n\nExemplo:\nNota Fiscal #1234\nFornecedor: Distribuidora Mística\nCNPJ: 12.345.678/0001-90\n\n1x Vela 7 Dias Branca - R$ 3,50\n5x Incenso Sândalo - R$ 2,00\n10x Guia Oxum - R$ 15,00`}
                    className="mt-1 bg-background border-border text-foreground min-h-[150px] font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || importText.length < 10}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analisando com IA...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Analisar e Extrair Itens
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Resultado da importação */}
                <div className="space-y-4">
                  <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-3">
                    <p className="text-green-400 font-medium">Itens identificados com sucesso!</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Revise os dados abaixo antes de confirmar a importação.
                    </p>
                  </div>

                  {/* Fornecedor */}
                  <Card className="border-border bg-background">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-accent flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Fornecedor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground font-medium">{importResult.supplier.name}</p>
                      {importResult.supplier.cnpj && (
                        <p className="text-muted-foreground text-sm">CNPJ: {importResult.supplier.cnpj}</p>
                      )}
                      {importResult.supplier.existingId && (
                        <Badge className="mt-1 bg-blue-600/20 text-blue-400">Já cadastrado</Badge>
                      )}
                      {!importResult.supplier.existingId && (
                        <Badge className="mt-1 bg-green-600/20 text-green-400">Será cadastrado</Badge>
                      )}
                    </CardContent>
                  </Card>

                  {/* Itens */}
                  <Card className="border-border bg-background">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-accent flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Itens ({importResult.items.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Cards no celular */}
                      <div className="md:hidden space-y-2 sm:space-y-3">
                        {importResult.items.map((item: any, idx: number) => (
                          <div key={idx} className="p-3 bg-background rounded-lg border border-border space-y-1.5 sm:space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-foreground leading-snug break-words">{item.productName}</p>
                              {item.existingProductId ? (
                                <Badge className="bg-blue-600/20 text-blue-400 text-xs shrink-0">Existente</Badge>
                              ) : (
                                <Badge className="bg-green-600/20 text-green-400 text-xs shrink-0">Novo</Badge>
                              )}
                            </div>
                            <Badge variant="outline" className="border-accent/30 text-accent text-xs">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </Badge>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{item.quantity}x R$ {(item.unitPriceCents / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                              <span className="text-muted-foreground text-xs">Subtotal</span>
                              <span className="text-accent font-medium">
                                R$ {((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tabela no computador */}
                      <div className="overflow-x-auto hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border">
                              <TableHead className="text-accent">Produto</TableHead>
                              <TableHead className="text-accent">Categoria</TableHead>
                              <TableHead className="text-accent text-right">Qtd</TableHead>
                              <TableHead className="text-accent text-right">Preço Unit.</TableHead>
                              <TableHead className="text-accent text-right">Subtotal</TableHead>
                              <TableHead className="text-accent">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importResult.items.map((item: any, idx: number) => (
                              <TableRow key={idx} className="border-border">
                                <TableCell className="text-foreground font-medium">{item.productName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-accent/30 text-accent">
                                    {CATEGORY_LABELS[item.category] || item.category}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-foreground">{item.quantity}</TableCell>
                                <TableCell className="text-right text-foreground">
                                  R$ {(item.unitPriceCents / 100).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-accent font-medium">
                                  R$ {((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  {item.existingProductId ? (
                                    <Badge className="bg-blue-600/20 text-blue-400 text-xs">Existente</Badge>
                                  ) : (
                                    <Badge className="bg-green-600/20 text-green-400 text-xs">Novo</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {importResult.totalValue && (
                        <div className="mt-3 text-right">
                          <span className="text-muted-foreground">Total: </span>
                          <span className="text-accent font-bold">
                            R$ {(importResult.totalValue / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Ações */}
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setImportResult(null);
                      }}
                      className="border-border text-foreground"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Refazer Análise
                    </Button>
                    <Button
                      onClick={handleConfirmImport}
                      disabled={isConfirmingImport}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isConfirmingImport ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Confirmar Importação
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          TABELA DE HISTÓRICO DE COMPRAS
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Histórico de Compras</CardTitle>
          <CardDescription className="text-muted-foreground">Últimas 100 compras registradas</CardDescription>
        </CardHeader>
        <CardContent>
          {purchasesQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando compras...</div>
          ) : purchasesQuery.data && purchasesQuery.data.length > 0 ? (
            <>
            {/* Cards no celular */}
            <div className="md:hidden space-y-2 sm:space-y-3">
              {purchasesQuery.data.map((purchase) => (
                <div key={purchase.id} className="p-3 bg-background rounded-lg border border-border space-y-1.5 sm:space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug break-words">
                      {getProductName(purchase.productId)}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(purchase.purchaseDate).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{purchase.quantity}x R$ {(purchase.unitPrice / 100).toFixed(2)} · {purchase.supplier}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-accent font-semibold">R$ {(purchase.totalPrice / 100).toFixed(2)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditPurchase(purchase)}
                      className="h-9 border-accent/30 text-accent hover:bg-accent/10"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela no computador */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-accent">Produto</TableHead>
                    <TableHead className="text-accent text-right">Qtd</TableHead>
                    <TableHead className="text-accent text-right">Preço Unit.</TableHead>
                    <TableHead className="text-accent text-right">Total</TableHead>
                    <TableHead className="text-accent">Fornecedor</TableHead>
                    <TableHead className="text-accent">Data</TableHead>
                    <TableHead className="text-accent">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesQuery.data.map((purchase) => (
                    <TableRow key={purchase.id} className="border-border hover:bg-background/50">
                      <TableCell className="text-foreground font-medium">{getProductName(purchase.productId)}</TableCell>
                      <TableCell className="text-right text-foreground">{purchase.quantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        R$ {(purchase.unitPrice / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-accent font-semibold">
                        R$ {(purchase.totalPrice / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-foreground">{purchase.supplier}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(purchase.purchaseDate).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditPurchase(purchase)}
                          className="hover:bg-accent/10 hover:text-accent"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Nenhuma compra registrada ainda</div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG EDITAR COMPRA
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isEditPurchaseOpen} onOpenChange={setIsEditPurchaseOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Compra</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePurchase} className="space-y-4">
            <div>
              <Label className="text-foreground">Quantidade *</Label>
              <Input
                type="number"
                min="1"
                value={editPurchaseForm.quantity}
                onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, quantity: e.target.value })}
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Preço Unit. (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPurchaseForm.unitPrice}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, unitPrice: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground">Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPurchaseForm.totalPrice}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, totalPrice: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Fornecedor *</Label>
              <Input
                value={editPurchaseForm.supplier}
                onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, supplier: e.target.value })}
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Data da Compra</Label>
              <Input
                type="date"
                value={editPurchaseForm.purchaseDate}
                onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, purchaseDate: e.target.value })}
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <Button
              type="submit"
              disabled={updatePurchaseMutation.isPending}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {updatePurchaseMutation.isPending ? "Atualizando..." : "Atualizar Compra"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
