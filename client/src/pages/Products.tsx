import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Switch } from "@/components/ui/switch";
import { Edit2, Package, Plus, Trash2, Eye, EyeOff, Search, ImageDown } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { ZoomableImage } from "@/components/ZoomableImage";

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

type Category = typeof CATEGORIES[number];

const emptyForm = {
  name: "",
  category: "outros" as Category,
  costPrice: "",
  salePrice: "",
  currentStock: "",
  minimumStock: "",
  description: "",
};

export default function Products() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [pullingImages, setPullingImages] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState<
    { productId: number; productName: string; catalogName: string; imageUrl: string; score: number }[]
  >([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
  const [noCatalogEntry, setNoCatalogEntry] = useState<{ productId: number; productName: string }[]>([]);
  const [searchingSupplierSite, setSearchingSupplierSite] = useState(false);
  const [supplierSearchProgress, setSupplierSearchProgress] = useState("");

  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.products.list.useQuery({ includeInactive: showInactive });
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); utils.analytics.dashboard.invalidate(); utils.analytics.byCategory.invalidate(); },
  });
  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); utils.analytics.dashboard.invalidate(); utils.analytics.byCategory.invalidate(); },
  });
  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); utils.analytics.dashboard.invalidate(); utils.analytics.byCategory.invalidate(); },
  });
  const deactivateMutation = trpc.products.deactivate.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); utils.analytics.dashboard.invalidate(); utils.analytics.byCategory.invalidate(); },
  });
  const reactivateMutation = trpc.products.reactivate.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); utils.analytics.dashboard.invalidate(); utils.analytics.byCategory.invalidate(); },
  });
  const pullImagesMutation = trpc.products.pullImagesFromOracle.useMutation();
  const applySuggestionsMutation = trpc.products.applyImageSuggestions.useMutation();
  const pullFromSiteMutation = trpc.products.pullImagesFromSupplierSite.useMutation();

  const handlePullImages = async () => {
    setPullingImages(true);
    try {
      const result = await pullImagesMutation.mutateAsync();
      await utils.products.list.invalidate();
      setImageSuggestions(result.suggestions);
      setDismissedSuggestions(new Set());
      setNoCatalogEntry(result.noCatalogEntry);

      const parts: string[] = [];
      if (result.updated > 0) parts.push(`${result.updated} foto(s) atualizada(s) automaticamente`);
      if (result.suggestions.length > 0) parts.push(`${result.suggestions.length} sugestão(ões) pra você revisar abaixo`);
      if (result.catalogEntryMissingPhoto.length > 0) parts.push(`${result.catalogEntryMissingPhoto.length} produto(s) existem no Oráculo mas ainda sem foto lá (use "Buscar fotos faltando" no Oráculo)`);
      if (result.noCatalogEntry.length > 0) parts.push(`${result.noCatalogEntry.length} produto(s) não encontrados no Oráculo — dá pra tentar buscar direto no site do fornecedor abaixo`);

      if (parts.length === 0) toast.success("Todos os produtos já têm foto atualizada!");
      else toast.success(parts.join(". ") + ".");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao puxar fotos do Oráculo");
    } finally {
      setPullingImages(false);
    }
  };

  const handleSearchSupplierSite = async () => {
    if (noCatalogEntry.length === 0) return;
    setSearchingSupplierSite(true);
    const CHUNK = 10;
    let totalUpdated = 0;
    const allSuggestions: typeof imageSuggestions = [];
    const stillNotFound: { productId: number; productName: string }[] = [];
    try {
      for (let i = 0; i < noCatalogEntry.length; i += CHUNK) {
        const chunk = noCatalogEntry.slice(i, i + CHUNK);
        setSupplierSearchProgress(`${Math.min(i + CHUNK, noCatalogEntry.length)}/${noCatalogEntry.length}`);
        const result = await pullFromSiteMutation.mutateAsync({ productIds: chunk.map((c) => c.productId) });
        totalUpdated += result.updated;
        allSuggestions.push(...result.suggestions);
        for (const name of result.noResults) {
          const found = chunk.find((c) => c.productName === name);
          if (found) stillNotFound.push(found);
        }
      }
      await utils.products.list.invalidate();
      setImageSuggestions((prev) => [...prev, ...allSuggestions]);
      setNoCatalogEntry(stillNotFound);
      toast.success(
        `${totalUpdated} foto(s) encontrada(s) direto no site! ` +
        (allSuggestions.length > 0 ? `${allSuggestions.length} sugestão(ões) pra revisar. ` : "") +
        (stillNotFound.length > 0 ? `${stillNotFound.length} produto(s) não encontrados nem no site do fornecedor.` : "")
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao buscar no site do fornecedor");
    } finally {
      setSearchingSupplierSite(false);
      setSupplierSearchProgress("");
    }
  };

  const handleAcceptSuggestion = async (s: { productId: number; imageUrl: string }) => {
    try {
      await applySuggestionsMutation.mutateAsync({ items: [{ productId: s.productId, imageUrl: s.imageUrl }] });
      await utils.products.list.invalidate();
      setImageSuggestions((prev) => prev.filter((x) => x.productId !== s.productId));
      toast.success("Foto aplicada!");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao aplicar foto");
    }
  };

  // Cálculo de margem em tempo real (corrigido: parseFloat)
  const costPriceCents = Math.round(parseFloat(formData.costPrice || "0") * 100);
  const salePriceCents = Math.round(parseFloat(formData.salePrice || "0") * 100);
  const { data: marginData } = trpc.products.getMargin.useQuery(
    { costPrice: costPriceCents, salePrice: salePriceCents },
    { enabled: costPriceCents > 0 && salePriceCents > 0 }
  );

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setOpen(true);
  };

  const openEdit = (product: NonNullable<typeof products>[number]) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      category: product.category as Category,
      costPrice: (product.costPrice / 100).toFixed(2),
      salePrice: (product.salePrice / 100).toFixed(2),
      currentStock: product.currentStock.toString(),
      minimumStock: product.minimumStock.toString(),
      description: product.description ?? "",
    });
    setOpen(true);
  };

  const handleDelete = async (productId: number, productName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${productName}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: productId });
      toast.success("Produto excluído com sucesso!");
    } catch (error: any) {
      const errorMsg = error?.data?.zodError?.[0]?.message || error?.message || "Erro ao excluir produto";
      toast.error(errorMsg);
    }
  };

  const handleDeactivate = async (productId: number, productName: string) => {
    if (!confirm(`Tem certeza que deseja desativar o produto "${productName}"?`)) return;
    try {
      await deactivateMutation.mutateAsync({ id: productId });
      toast.success("Produto desativado com sucesso!");
    } catch (error: any) {
      const errorMsg = error?.data?.zodError?.[0]?.message || error?.message || "Erro ao desativar produto";
      toast.error(errorMsg);
    }
  };

  const handleReactivate = async (productId: number, productName: string) => {
    try {
      await reactivateMutation.mutateAsync({ id: productId });
      toast.success(`Produto "${productName}" reativado com sucesso!`);
    } catch (error: any) {
      const errorMsg = error?.data?.zodError?.[0]?.message || error?.message || "Erro ao reativar produto";
      toast.error(errorMsg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Bug fix: parseFloat preserva centavos
    const costPrice = Math.round(parseFloat(formData.costPrice) * 100);
    const salePrice = Math.round(parseFloat(formData.salePrice) * 100);
    const currentStock = parseInt(formData.currentStock);
    const minimumStock = parseInt(formData.minimumStock);

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, name: formData.name, category: formData.category, costPrice, salePrice, currentStock, minimumStock, description: formData.description });
        toast.success("Produto atualizado com sucesso!");
      } else {
        await createMutation.mutateAsync({ name: formData.name, category: formData.category, costPrice, salePrice, currentStock, minimumStock, description: formData.description });
        toast.success("Produto criado com sucesso!");
      }
      setOpen(false);
      setFormData(emptyForm);
      setEditingId(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar produto");
    }
  };

  const filteredProducts = useMemo(() => {
    let list = products ?? [];
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(term));
    }
    if (categoryFilter !== "todas") {
      list = list.filter((p) => p.category === categoryFilter);
    }
    return list;
  }, [products, search, categoryFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Produtos</h1>
          <p className="text-muted-foreground mt-1">Cadastre e gerencie seus produtos místicos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handlePullImages}
            disabled={pullingImages}
            className="border-accent/30 text-accent hover:bg-accent/10"
            title="Copia as fotos dos produtos equivalentes cadastrados n'O Oráculo"
          >
            <ImageDown className={`w-4 h-4 mr-2 ${pullingImages ? "animate-bounce" : ""}`} />
            {pullingImages ? "Puxando fotos..." : "Puxar fotos do Oráculo"}
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
              <DialogDescription>Preencha os dados do produto</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-foreground">Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Vela 7 Dias Branca"
                  className="bg-background border-border text-foreground mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-foreground">Categoria</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as Category })}>
                  <SelectTrigger className="bg-background border-border text-foreground mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Preço de Custo (R$)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0,00"
                    className="bg-background border-border text-foreground mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-foreground">Preço de Venda (R$)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    placeholder="0,00"
                    className="bg-background border-border text-foreground mt-1"
                    required
                  />
                </div>
              </div>

              {marginData !== undefined && salePriceCents > 0 && (
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Margem de Lucro</p>
                  <p className="text-lg font-bold text-accent">{marginData}%</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Estoque Atual</Label>
                  <Input
                    type="number" min="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    placeholder="0"
                    className="bg-background border-border text-foreground mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-foreground">Estoque Mínimo</Label>
                  <Input
                    type="number" min="0"
                    value={formData.minimumStock}
                    onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                    placeholder="5"
                    className="bg-background border-border text-foreground mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-foreground">Descrição (opcional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do produto"
                  className="bg-background border-border text-foreground mt-1"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : editingId ? "Atualizar Produto" : "Criar Produto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {imageSuggestions.filter((s) => !dismissedSuggestions.has(s.productId)).length > 0 && (
        <Card className="bg-card border-accent/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">Fotos parecidas pra revisar</CardTitle>
            <CardDescription>
              O nome no seu estoque não é idêntico ao do Oráculo, mas parece ser o mesmo produto. Confira antes de aplicar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {imageSuggestions
              .filter((s) => !dismissedSuggestions.has(s.productId))
              .map((s) => (
                <div key={s.productId} className="flex items-center gap-3 p-2 bg-background rounded-lg border border-border">
                  <ZoomableImage src={s.imageUrl} alt={s.catalogName} className="w-12 h-12 rounded border border-border shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground font-medium truncate">{s.productName}</p>
                    <p className="text-xs text-muted-foreground truncate">Parecido com: {s.catalogName}</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
                    onClick={() => handleAcceptSuggestion(s)}
                  >
                    Usar foto
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border shrink-0"
                    onClick={() => setDismissedSuggestions((prev) => new Set(prev).add(s.productId))}
                  >
                    Ignorar
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {noCatalogEntry.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">
              {noCatalogEntry.length} produto(s) sem foto e sem correspondência no Oráculo
            </CardTitle>
            <CardDescription>
              Esses produtos não estão (ou não batem pelo nome) no seu catálogo do Oráculo. Dá pra buscar a foto direto na busca do site do fornecedor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleSearchSupplierSite}
              disabled={searchingSupplierSite}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {searchingSupplierSite
                ? `Buscando no site do fornecedor... ${supplierSearchProgress}`
                : `Buscar direto no site do fornecedor (${noCatalogEntry.length})`}
            </Button>
            <p className="text-xs text-muted-foreground">
              {noCatalogEntry.slice(0, 8).map((p) => p.productName).join(", ")}
              {noCatalogEntry.length > 8 ? `, +${noCatalogEntry.length - 8} outro(s)` : ""}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="bg-background border-border text-foreground pl-9 h-11"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-background border-border text-foreground h-10 w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                className="data-[state=checked]:bg-accent"
              />
              <span className="text-sm text-muted-foreground">Mostrar inativos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-accent" />
            Produtos Cadastrados
          </CardTitle>
          <CardDescription>
            {filteredProducts.length === (products?.length ?? 0)
              ? `Total: ${products?.length ?? 0} produto(s)`
              : `${filteredProducts.length} de ${products?.length ?? 0} produto(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Package className="h-12 w-12 opacity-30" />
              {(products?.length ?? 0) === 0 ? (
                <>
                  <p>Nenhum produto cadastrado ainda.</p>
                  <Button variant="outline" onClick={openCreate} className="border-accent/30 text-accent hover:bg-accent/10">
                    Cadastrar primeiro produto
                  </Button>
                </>
              ) : (
                <p>Nenhum produto encontrado com esses filtros.</p>
              )}
            </div>
          ) : (
            <>
            {/* Lista em cards no celular */}
            <div className="md:hidden space-y-3">
              {filteredProducts.map((product) => {
                const margin = product.salePrice > 0
                  ? Math.round(((product.salePrice - product.costPrice) / product.salePrice) * 100)
                  : 0;
                const lowStock = product.currentStock <= product.minimumStock;
                return (
                  <div key={product.id} className="p-3 bg-background rounded-lg border border-border space-y-2">
                    <div className="flex items-start gap-2">
                      {product.imageUrl ? (
                        <ZoomableImage src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded shrink-0 border border-border" />
                      ) : (
                        <div className="w-12 h-12 rounded shrink-0 border border-border bg-card flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground opacity-40" />
                        </div>
                      )}
                      <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                        <p className="font-medium text-foreground text-sm leading-snug">{product.name}</p>
                        <Badge variant={product.isActive === 1 ? "default" : "secondary"} className={`shrink-0 text-[10px] ${product.isActive === 1 ? "bg-green-900/40 text-green-400 border-green-700" : "bg-red-900/40 text-red-400 border-red-700"}`}>
                          {product.isActive === 1 ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-accent/40 text-accent text-[10px]">
                        {CATEGORY_LABELS[product.category]}
                      </Badge>
                      <span className={`text-xs font-semibold ${lowStock ? "text-destructive" : "text-muted-foreground"}`}>
                        Estoque: {product.currentStock}{lowStock && " ⚠️"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Custo</p>
                        <p className="text-muted-foreground">R$ {(product.costPrice / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Venda</p>
                        <p className="text-foreground font-medium">R$ {(product.salePrice / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Margem</p>
                        <p className="text-accent font-bold">{margin}%</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(product)}
                        className="flex-1 h-9 border-accent/30 text-accent hover:bg-accent/10"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                      {product.isActive === 1 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeactivate(product.id, product.name)}
                          disabled={deactivateMutation.isPending}
                          className="h-9 w-9 p-0 border-border text-muted-foreground"
                          title="Desativar produto"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReactivate(product.id, product.name)}
                          disabled={reactivateMutation.isPending}
                          className="h-9 w-9 p-0 border-border text-green-400"
                          title="Reativar produto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(product.id, product.name)}
                        disabled={deleteMutation.isPending}
                        className="h-9 w-9 p-0 border-border text-red-400"
                        title="Excluir produto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela no computador */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-accent font-semibold w-14"></TableHead>
                    <TableHead className="text-accent font-semibold">Nome</TableHead>
                    <TableHead className="text-accent font-semibold">Categoria</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Custo</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Venda</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Margem</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Estoque</TableHead>
                    <TableHead className="text-accent font-semibold">Status</TableHead>
                    <TableHead className="text-accent font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const margin = product.salePrice > 0
                      ? Math.round(((product.salePrice - product.costPrice) / product.salePrice) * 100)
                      : 0;
                    const lowStock = product.currentStock <= product.minimumStock;
                    return (
                      <TableRow key={product.id} className="border-border hover:bg-background/50">
                        <TableCell>
                          {product.imageUrl ? (
                            <ZoomableImage src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded border border-border" />
                          ) : (
                            <div className="w-10 h-10 rounded border border-border bg-background flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground opacity-40" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-accent/40 text-accent">
                            {CATEGORY_LABELS[product.category]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          R$ {(product.costPrice / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          R$ {(product.salePrice / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-accent font-bold">{margin}%</TableCell>
                        <TableCell className="text-right">
                          <span className={lowStock ? "text-destructive font-bold" : "text-foreground"}>
                            {product.currentStock}
                            {lowStock && <span className="ml-1 text-xs">⚠️</span>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.isActive === 1 ? "default" : "secondary"} className={product.isActive === 1 ? "bg-green-900/40 text-green-400 border-green-700" : "bg-red-900/40 text-red-400 border-red-700"}>
                            {product.isActive === 1 ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(product)}
                            className="hover:bg-accent/10 hover:text-accent"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {product.isActive === 1 ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeactivate(product.id, product.name)}
                              disabled={deactivateMutation.isPending}
                              className="hover:bg-orange-950/30 hover:text-orange-400"
                              title="Desativar produto"
                            >
                              <EyeOff className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReactivate(product.id, product.name)}
                              disabled={reactivateMutation.isPending}
                              className="hover:bg-green-950/30 hover:text-green-400"
                              title="Reativar produto"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(product.id, product.name)}
                            disabled={deleteMutation.isPending}
                            className="hover:bg-red-950/30 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
