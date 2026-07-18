import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Gestão do comodato de UM terreiro (usada na página individual do parceiro).
// Itens deixados em dias de gira: "Vendido" registra a venda (canal terreiro,
// sem baixar estoque de novo); "Devolvido" repõe o estoque da loja.
export default function ConsignmentManager({ terreiroId }: { terreiroId: number }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [form, setForm] = useState({ productId: "", quantity: "1", unitPrice: "", notes: "" });
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const { data: consignments = [], isLoading } = trpc.terreiros.consignments.list.useQuery({
    terreiroId,
    includeSettled: showSettled,
  });
  const { data: products = [] } = trpc.products.list.useQuery({});

  const selectedProductId = form.productId ? Number(form.productId) : null;
  const { data: suggestedPrice } = trpc.terreiros.consignments.suggestedPrice.useQuery(
    { terreiroId, productId: selectedProductId ?? 0 },
    { enabled: !!selectedProductId }
  );

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
    onSuccess: () => {
      toast.success("Itens registrados no comodato! O estoque da loja já foi baixado.");
      setIsDialogOpen(false);
      setForm({ productId: "", quantity: "1", unitPrice: "", notes: "" });
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PackagePlus className="w-4 h-4 mr-2" />
                Deixar itens
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deixar itens no terreiro</DialogTitle>
                <DialogDescription>O estoque da loja é baixado na hora — volta se houver devolução</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="consignProduct">Produto</Label>
                  <Select value={form.productId} onValueChange={(v) => v && setForm({ ...form, productId: v })}>
                    <SelectTrigger id="consignProduct">
                      <SelectValue placeholder="Escolha o produto">
                        {selectedProductId ? products.find((p) => p.id === selectedProductId)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products
                        .filter((p) => p.currentStock > 0)
                        .map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} (estoque: {p.currentStock})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
  );
}
