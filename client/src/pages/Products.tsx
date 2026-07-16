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
import { Edit2, Package, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

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

  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.products.list.useQuery();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Produtos</h1>
          <p className="text-muted-foreground mt-1">Cadastre e gerencie seus produtos místicos</p>
        </div>
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

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-accent" />
            Produtos Cadastrados
          </CardTitle>
          <CardDescription>Total: {products?.length ?? 0} produto(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {products?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Package className="h-12 w-12 opacity-30" />
              <p>Nenhum produto cadastrado ainda.</p>
              <Button variant="outline" onClick={openCreate} className="border-accent/30 text-accent hover:bg-accent/10">
                Cadastrar primeiro produto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
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
                  {products?.map((product) => {
                    const margin = product.salePrice > 0
                      ? Math.round(((product.salePrice - product.costPrice) / product.salePrice) * 100)
                      : 0;
                    const lowStock = product.currentStock <= product.minimumStock;
                    return (
                      <TableRow key={product.id} className="border-border hover:bg-background/50">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
