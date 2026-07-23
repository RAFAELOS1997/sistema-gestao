import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackagePlus, Check, X, Search, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Gestão do comodato de UM terreiro (usada na página individual do parceiro).
// Itens deixados em dias de gira: "Vendido" registra a venda (canal terreiro,
// sem baixar estoque de novo); "Devolvido" repõe o estoque da loja.
export default function ConsignmentManager({ terreiroId }: { terreiroId: number }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [form, setForm] = useState({ productId: "", quantity: "1", unitPrice: "", notes: "" });
  const [productSearch, setProductSearch] = useState("");
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({});
  const [confirmingRequestId, setConfirmingRequestId] = useState<number | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const { data: consignments = [], isLoading } = trpc.terreiros.consignments.list.useQuery({
    terreiroId,
    includeSettled: showSettled,
  });
  const { data: products = [] } = trpc.products.list.useQuery({});
  const { data: pendingRequests = [] } = trpc.terreiros.consignmentRequests.pendingForTerreiro.useQuery({ terreiroId });

  const selectedProductId = form.productId ? Number(form.productId) : null;
  const { data: suggestedPrice } = trpc.terreiros.consignments.suggestedPrice.useQuery(
    { terreiroId, productId: selectedProductId ?? 0 },
    { enabled: !!selectedProductId }
  );

  const inStockProducts = useMemo(() => products.filter((p) => p.currentStock > 0), [products]);
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return inStockProducts;
    return inStockProducts.filter((p) => p.name.toLowerCase().includes(term));
  }, [inStockProducts, productSearch]);

  // Preenche o preço combinado com a sugestão (específico > plano > loja)
  // quando o produto muda — mas deixa o admin ajustar à vontade.
  useEffect(() => {
    if (suggestedPrice != null) {
      setForm((prev) => ({ ...prev, unitPrice: (suggestedPrice / 100).toFixed(2) }));
    }
  }, [suggestedPrice]);

  const invalidate = () => {
    utils.terreiros.consignments.list.invalidate();
    utils.terreiros.consignments.openCountByTerreiro.invalidate();
    utils.products.list.invalidate();
  };

  const createMutation = trpc.terreiros.consignments.create.useMutation({
    onSuccess: (result) => {
      toast.success("Itens registrados no comodato! O estoque da loja já foi baixado.");
      if (result.tierUpgraded && result.newTierName) {
        toast.success(`Plano do terreiro subiu pra ${result.newTierName} por causa do stand de comodato!`);
      }
      setIsDialogOpen(false);
      setForm({ productId: "", quantity: "1", unitPrice: "", notes: "" });
      setProductSearch("");
      invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const soldMutation = trpc.terreiros.consignments.markSold.useMutation({
    onSuccess: () => {
      toast.success("Venda registrada no Controle de Vendas (canal Terreiro)!");
      invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const returnedMutation = trpc.terreiros.consignments.markReturned.useMutation({
    onSuccess: () => {
      toast.success("Devolução registrada — estoque da loja reposto.");
      invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const confirmRequestMutation = trpc.terreiros.consignmentRequests.confirm.useMutation({
    onSuccess: (result) => {
      toast.success("Entrega confirmada! Comodato registrado e estoque baixado.");
      if (result.tierUpgraded && result.newTierName) {
        toast.success(`Plano do terreiro subiu pra ${result.newTierName} por causa do stand de comodato!`);
      }
      setConfirmingRequestId(null);
      setPriceDrafts({});
      invalidate();
      utils.terreiros.consignmentRequests.pendingForTerreiro.invalidate({ terreiroId });
      utils.terreiros.consignmentRequests.pendingCountByTerreiro.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const cancelRequestMutation = trpc.terreiros.consignmentRequests.cancel.useMutation({
    onSuccess: () => {
      toast.success("Solicitação cancelada");
      utils.terreiros.consignmentRequests.pendingForTerreiro.invalidate({ terreiroId });
      utils.terreiros.consignmentRequests.pendingCountByTerreiro.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const openConfirmDialog = async (request: any) => {
    setConfirmingRequestId(request.id);
    const drafts: Record<number, string> = {};
    for (const item of request.items) {
      try {
        const suggested = await utils.terreiros.consignments.suggestedPrice.fetch({ terreiroId, productId: item.productId });
        drafts[item.id] = suggested != null ? (suggested / 100).toFixed(2) : "";
      } catch {
        drafts[item.id] = "";
      }
    }
    setPriceDrafts(drafts);
  };

  const handleConfirmRequest = (request: any) => {
    const items = request.items.map((item: any) => {
      const raw = priceDrafts[item.id];
      const unitPrice = Math.round(Number((raw ?? "").replace(",", ".")) * 100);
      return { itemId: item.id, unitPrice };
    });
    if (items.some((i: any) => !i.unitPrice || i.unitPrice < 1)) {
      toast.error("Informe o preço combinado de todos os itens");
      return;
    }
    confirmRequestMutation.mutate({ id: request.id, items });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const productId = Number(form.productId);
    const quantity = Number(form.quantity);
    const unitPrice = Math.round(Number(form.unitPrice.replace(",", ".")) * 100);
    if (!productId) return void toast.error("Escolha o produto");
    if (!quantity || quantity < 1) return void toast.error("Quantidade inválida");
    if (!unitPrice || unitPrice < 1) return void toast.error("Preço combinado inválido");
    createMutation.mutate({ terreiroId, productId, quantity, unitPrice, notes: form.notes || undefined });
  };

  const remainingOf = (c: { quantity: number; quantitySold: number; quantityReturned: number }) =>
    c.quantity - c.quantitySold - c.quantityReturned;

  const settle = (id: number, remaining: number, kind: "sold" | "returned") => {
    const qty = Number(qtyDrafts[id] ?? remaining);
    if (!qty || qty < 1 || qty > remaining) return void toast.error(`Informe uma quantidade entre 1 e ${remaining}`);
    if (kind === "sold") soldMutation.mutate({ id, quantity: qty });
    else returnedMutation.mutate({ id, quantity: qty });
  };

  return (
    <div className="space-y-6">
      {pendingRequests.length > 0 && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle>Solicitações de Comodato Pendentes</CardTitle>
            <CardDescription>Esse terreiro pediu esses itens — confirme quando entregar (define o preço combinado na hora)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.map((request: any) => (
              <div key={request.id} className="p-3 bg-background rounded-lg border border-border">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Pedido #{request.id} · {new Date(request.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {request.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    {request.notes && <p className="text-xs text-muted-foreground mt-0.5">"{request.notes}"</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="h-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => openConfirmDialog(request)}>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Confirmar Entrega
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => cancelRequestMutation.mutate({ id: request.id })}
                      disabled={cancelRequestMutation.isPending}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmingRequestId !== null} onOpenChange={(open) => { if (!open) { setConfirmingRequestId(null); setPriceDrafts({}); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar entrega do comodato</DialogTitle>
            <DialogDescription>Defina o preço combinado de cada item — o estoque é baixado ao confirmar</DialogDescription>
          </DialogHeader>
          {(() => {
            const request = pendingRequests.find((r: any) => r.id === confirmingRequestId);
            if (!request) return null;
            return (
              <div className="space-y-3">
                {request.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-28"
                      placeholder="R$"
                      value={priceDrafts[item.id] ?? ""}
                      onChange={(e) => setPriceDrafts({ ...priceDrafts, [item.id]: e.target.value })}
                    />
                  </div>
                ))}
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => handleConfirmRequest(request)}
                  disabled={confirmRequestMutation.isPending}
                >
                  {confirmRequestMutation.isPending ? "Confirmando..." : "Confirmar entrega"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle>Comodato — itens deixados nesse terreiro</CardTitle>
          <CardDescription>
            Deixados em dia de gira, sem pagamento prévio: pagos se vendidos, devolvidos se não.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettled((v) => !v)}>
            {showSettled ? "Só pendentes" : "Ver histórico"}
          </Button>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setProductSearch("");
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PackagePlus className="w-4 h-4 mr-2" />
                Deixar itens
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Deixar itens no terreiro</DialogTitle>
                <DialogDescription>O estoque da loja é baixado na hora — volta se houver devolução</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Produto</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar produto..."
                      className="pl-9 h-10"
                    />
                  </div>
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto mt-2 pr-1">
                      {filteredProducts.map((p) => {
                        const selected = selectedProductId === p.id;
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setForm({ ...form, productId: String(p.id) })}
                            className={`w-full flex items-center gap-2 p-2 rounded border text-left transition-colors ${
                              selected ? "border-accent bg-accent/10" : "border-border bg-background hover:bg-accent/5"
                            }`}
                          >
                            <div className="w-10 h-10 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <PackageSearch className="w-4 h-4 text-muted-foreground opacity-40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground">Estoque: {p.currentStock}</p>
                            </div>
                            {selected && <Check className="w-4 h-4 text-accent shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="consignQty">Quantidade</Label>
                    <Input
                      id="consignQty"
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="consignPrice">Preço combinado (R$)</Label>
                    <Input
                      id="consignPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.unitPrice}
                      onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                      placeholder="Sugerido pelo plano"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="consignNotes">Observações (opcional)</Label>
                  <Input
                    id="consignNotes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Ex: gira de Pretos Velhos, levar de volta dia 20"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Registrando..." : "Registrar comodato"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : consignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {showSettled ? "Nenhum comodato registrado ainda" : "Nenhum item pendente nesse terreiro"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Deixado em</TableHead>
                <TableHead>Deixados</TableHead>
                <TableHead>Vendidos</TableHead>
                <TableHead>Devolvidos</TableHead>
                <TableHead>Pendentes</TableHead>
                <TableHead>Preço comb.</TableHead>
                <TableHead className="text-right">Acerto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consignments.map((c) => {
                const remaining = remainingOf(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.productName}
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.leftAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{c.quantity}</TableCell>
                    <TableCell className="text-green-400">{c.quantitySold}</TableCell>
                    <TableCell className="text-muted-foreground">{c.quantityReturned}</TableCell>
                    <TableCell className="font-semibold text-accent">{remaining}</TableCell>
                    <TableCell>R$ {(c.unitPrice / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {remaining > 0 ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Input
                            type="number"
                            min="1"
                            max={remaining}
                            className="w-16 h-8"
                            value={qtyDrafts[c.id] ?? String(remaining)}
                            onChange={(e) => setQtyDrafts({ ...qtyDrafts, [c.id]: e.target.value })}
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => settle(c.id, remaining, "sold")}
                            disabled={soldMutation.isPending || returnedMutation.isPending}
                          >
                            Vendido
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => settle(c.id, remaining, "returned")}
                            disabled={soldMutation.isPending || returnedMutation.isPending}
                          >
                            Devolvido
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Acertado</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
