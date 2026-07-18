import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Referências estáveis: um array/objeto literal como valor padrão de
// destructuring é recriado a cada render, e um efeito que dependa dele
// dispararia infinitamente (setState -> nova referência -> setState...).
const EMPTY_TIERS: { id: number; name: string; sortOrder: number }[] = [];
const EMPTY_PRICE_ROWS: { productId: number; name: string; category: string; currentStock: number; price: number | null }[] = [];

export default function PartnerTiers() {
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tierForm, setTierForm] = useState({ name: "", sortOrder: "0" });
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const { data: tiers = EMPTY_TIERS, isLoading: loadingTiers } = trpc.partnerTiers.list.useQuery();

  useEffect(() => {
    if (!selectedTierId && tiers.length > 0) setSelectedTierId(tiers[0].id);
  }, [tiers, selectedTierId]);

  const { data: priceRows = EMPTY_PRICE_ROWS, isLoading: loadingPrices } = trpc.partnerTiers.prices.list.useQuery(
    { tierId: selectedTierId ?? 0 },
    { enabled: !!selectedTierId }
  );

  useEffect(() => {
    const drafts: Record<number, string> = {};
    for (const row of priceRows) {
      drafts[row.productId] = row.price != null ? (row.price / 100).toFixed(2) : "";
    }
    setPriceDrafts(drafts);
  }, [priceRows]);

  const createTierMutation = trpc.partnerTiers.create.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Plano criado!");
      setIsDialogOpen(false);
      setTierForm({ name: "", sortOrder: "0" });
      utils.partnerTiers.list.invalidate();
    },
    onError: (error) => toast.error(`Erro ao criar plano: ${error.message}`),
  });

  const deleteTierMutation = trpc.partnerTiers.delete.useMutation({
    onSuccess: () => {
      toast.success("Plano excluído!");
      setSelectedTierId(null);
      utils.partnerTiers.list.invalidate();
    },
    onError: (error) => toast.error(`Erro ao excluir: ${error.message}`),
  });

  const setPriceMutation = trpc.partnerTiers.prices.setPrice.useMutation({
    onSuccess: () => {
      utils.partnerTiers.prices.list.invalidate({ tierId: selectedTierId ?? 0 });
    },
    onError: (error) => toast.error(`Erro ao salvar preço: ${error.message}`),
  });

  const removePriceMutation = trpc.partnerTiers.prices.removePrice.useMutation({
    onSuccess: () => {
      toast.success("Produto escondido desse plano novamente");
      utils.partnerTiers.prices.list.invalidate({ tierId: selectedTierId ?? 0 });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const handleCreateTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierForm.name) {
      toast.error("Dê um nome ao plano");
      return;
    }
    createTierMutation.mutate({ name: tierForm.name, sortOrder: Number(tierForm.sortOrder) || 0 });
  };

  const handleSavePrice = (productId: number) => {
    if (!selectedTierId) return;
    const raw = priceDrafts[productId];
    const value = Number(raw?.replace(",", "."));
    if (!raw || isNaN(value) || value <= 0) {
      toast.error("Informe um preço válido");
      return;
    }
    setPriceMutation.mutate({ tierId: selectedTierId, productId, price: Math.round(value * 100) });
  };

  const handleHideProduct = (productId: number) => {
    if (!selectedTierId) return;
    removePriceMutation.mutate({ tierId: selectedTierId, productId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Planos e Preços dos Parceiros</h1>
          <p className="text-muted-foreground">
            Cada plano tem seu preço por produto. Produto sem preço definido fica escondido pro terreiro daquele plano.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Plano</DialogTitle>
              <DialogDescription>Ex: Prata, Ouro, Diamante — quanto maior a ordem, mais alto o plano</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTier} className="space-y-4">
              <div>
                <Label htmlFor="tierName">Nome do plano</Label>
                <Input
                  id="tierName"
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                  placeholder="Ex: Ouro"
                />
              </div>
              <div>
                <Label htmlFor="tierOrder">Ordem (maior = plano mais alto)</Label>
                <Input
                  id="tierOrder"
                  type="number"
                  min="0"
                  value={tierForm.sortOrder}
                  onChange={(e) => setTierForm({ ...tierForm, sortOrder: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={createTierMutation.isPending}>
                {createTierMutation.isPending ? "Criando..." : "Criar Plano"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loadingTiers ? (
        <div className="text-center py-8 text-muted-foreground">Carregando planos...</div>
      ) : tiers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum plano criado ainda. Crie o primeiro (ex: "Prata") pra começar a liberar produtos pros terreiros.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {tiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedTierId(tier.id)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  selectedTierId === tier.id
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border text-muted-foreground hover:bg-accent/10"
                }`}
              >
                {tier.name}
              </button>
            ))}
            {selectedTierId && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-900/40"
                onClick={() => {
                  if (confirm("Excluir esse plano? Só é possível se nenhum terreiro estiver nele.")) {
                    deleteTierMutation.mutate({ id: selectedTierId });
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Preços do plano "{tiers.find((t) => t.id === selectedTierId)?.name}"</CardTitle>
              <CardDescription>Deixe o preço em branco e salve vazio pra esconder o produto desse plano</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPrices ? (
                <div className="text-center py-8 text-muted-foreground">Carregando produtos...</div>
              ) : priceRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum produto ativo cadastrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Preço nesse plano (R$)</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceRows.map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.category}</TableCell>
                        <TableCell className="text-muted-foreground">{row.currentStock}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28"
                            placeholder="Escondido"
                            value={priceDrafts[row.productId] ?? ""}
                            onChange={(e) => setPriceDrafts({ ...priceDrafts, [row.productId]: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" onClick={() => handleSavePrice(row.productId)} disabled={setPriceMutation.isPending}>
                            Salvar
                          </Button>
                          {row.price != null && (
                            <Button variant="outline" size="sm" onClick={() => handleHideProduct(row.productId)} disabled={removePriceMutation.isPending}>
                              Esconder
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
