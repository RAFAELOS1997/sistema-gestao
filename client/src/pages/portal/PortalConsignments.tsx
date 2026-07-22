import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PackagePlus, Minus, Plus, Package, ArrowLeft } from "lucide-react";
import { ComodatoContract } from "@/components/portal/ComodatoContract";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Aguardando entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-900/40 text-amber-300 border-amber-700",
  entregue: "bg-green-900/40 text-green-400 border-green-700",
  cancelado: "bg-red-900/40 text-red-400 border-red-700",
};

// Visão do terreiro: itens que a Toca da Pantera deixou com ele (comodato),
// e um jeito de pedir novos itens direto do estoque da loja — o admin
// confirma na entrega, é aí que vira comodato de verdade.
export default function PortalConsignments() {
  const [showSettled, setShowSettled] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<"pick" | "contract">("pick");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const utils = trpc.useUtils();
  const meQuery = trpc.portal.me.useQuery();
  const consignmentsQuery = trpc.portal.consignments.list.useQuery({ includeSettled: showSettled });
  const consignments = consignmentsQuery.data ?? [];

  const stockQuery = trpc.portal.products.list.useQuery();
  const stock = stockQuery.data ?? [];

  const requestsQuery = trpc.portal.consignmentRequests.list.useQuery();
  const requests = requestsQuery.data ?? [];

  const resetRequestForm = () => {
    setCart({});
    setNotes("");
    setTermsAccepted(false);
    setDialogStep("pick");
  };

  const createRequestMutation = trpc.portal.consignmentRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Pedido enviado! A Toca da Pantera vai confirmar a entrega.");
      resetRequestForm();
      setIsRequestOpen(false);
      utils.portal.consignmentRequests.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, quantity]) => {
        const item = stock.find((p) => p.id === Number(id));
        if (!item || quantity <= 0) return null;
        return { id: Number(id), name: item.name, quantity };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
  }, [cart, stock]);

  const setQuantity = (productId: number, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  };

  const handleGoToContract = () => {
    if (cartItems.length === 0) {
      toast.error("Escolha ao menos um item");
      return;
    }
    setDialogStep("contract");
  };

  const handleSubmitRequest = () => {
    if (!termsAccepted) {
      toast.error("É preciso aceitar os termos do contrato de comodato");
      return;
    }
    createRequestMutation.mutate({
      items: cartItems.map((i) => ({ productId: i.id, quantity: i.quantity })),
      notes: notes.trim() || undefined,
      termsAccepted: true,
    });
  };

  const totalPending = consignments.reduce(
    (sum, c) => sum + (c.quantity - c.quantitySold - c.quantityReturned),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Itens em Comodato</h1>
          <p className="text-muted-foreground text-sm">
            Itens que a Toca da Pantera deixou com o seu terreiro — pagos só se vendidos, devolvidos se não.
            {totalPending > 0 && <span> {totalPending} item(ns) pendente(s) de acerto.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setShowSettled((v) => !v)}>
            {showSettled ? "Só pendentes" : "Ver histórico"}
          </Button>
          <Dialog
            open={isRequestOpen}
            onOpenChange={(open) => {
              setIsRequestOpen(open);
              if (!open) resetRequestForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 bg-accent text-accent-foreground hover:bg-accent/90">
                <PackagePlus className="w-4 h-4 mr-2" />
                Solicitar Produtos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              {dialogStep === "pick" ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Solicitar produtos em comodato</DialogTitle>
                    <DialogDescription>
                      Escolha itens do estoque da loja — a Toca da Pantera confirma e entrega no seu terreiro.
                      O estoque só é reservado quando a entrega é confirmada.
                    </DialogDescription>
                  </DialogHeader>

                  {stockQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Carregando produtos...</p>
                  ) : stock.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto disponível no momento.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {stock.map((product) => {
                        const qty = cart[product.id] ?? 0;
                        return (
                          <div key={product.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded border border-border">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground truncate">{product.name}</p>
                              <p className="text-[11px] text-muted-foreground">Estoque: {product.currentStock}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setQuantity(product.id, qty - 1)}
                                disabled={qty === 0}
                                className="p-1.5 rounded bg-background border border-border text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/10"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold text-foreground">{qty}</span>
                              <button
                                type="button"
                                onClick={() => setQuantity(product.id, qty + 1)}
                                disabled={qty >= product.currentStock}
                                className="p-1.5 rounded bg-accent text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="requestNotes" className="text-xs">Observações (opcional)</Label>
                    <Textarea
                      id="requestNotes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: precisa pra gira desse sábado"
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={cartItems.length === 0}
                    onClick={handleGoToContract}
                  >
                    {`Continuar${cartItems.length > 0 ? ` (${cartItems.reduce((s, i) => s + i.quantity, 0)} item(ns))` : ""}`}
                  </Button>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Contrato de Comodato</DialogTitle>
                    <DialogDescription>Leia e aceite os termos antes de enviar o pedido.</DialogDescription>
                  </DialogHeader>

                  <ComodatoContract
                    terreiroName={meQuery.data?.name ?? "Terreiro"}
                    items={cartItems.map((i) => ({ name: i.name, quantity: i.quantity }))}
                    accepted={termsAccepted}
                    onAcceptedChange={setTermsAccepted}
                  />

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogStep("pick")}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                    <Button
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                      disabled={!termsAccepted || createRequestMutation.isPending}
                      onClick={handleSubmitRequest}
                    >
                      {createRequestMutation.isPending ? "Enviando..." : "Aceitar e enviar pedido"}
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Meus pedidos de comodato */}
      {requests.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-accent" />
              Meus pedidos de comodato
            </h2>
            <div className="space-y-2">
              {requests.map((r: any) => (
                <div key={r.id} className="p-3 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Pedido #{r.id} · {r.items.length} item(ns)
                    </p>
                    <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[r.status] ?? ""}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {consignmentsQuery.isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>
      ) : consignments.length === 0 ? (
        <div className="text-center py-12 px-4 text-muted-foreground text-sm">
          {showSettled ? "Nenhum comodato registrado ainda." : "Nenhum item pendente no momento."}
        </div>
      ) : (
        <>
          {/* Celular: cards empilhados, sem tabela pra não estourar a largura da tela */}
          <div className="grid gap-3 sm:hidden">
            {consignments.map((c) => {
              const pending = c.quantity - c.quantitySold - c.quantityReturned;
              return (
                <div key={c.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm text-foreground break-words">{c.productName}</p>
                    {c.notes && <p className="text-xs text-muted-foreground mt-0.5 break-words">{c.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Deixado em {new Date(c.leftAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center border-t border-border pt-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Deixados</p>
                      <p className="text-sm font-medium text-foreground">{c.quantity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vendidos</p>
                      <p className="text-sm font-medium text-green-400">{c.quantitySold}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Devolvidos</p>
                      <p className="text-sm font-medium text-muted-foreground">{c.quantityReturned}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pendentes</p>
                      <p className="text-sm font-semibold text-accent">{pending}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground border-t border-border pt-2">
                    Preço combinado: <span className="text-foreground font-medium">R$ {(c.unitPrice / 100).toFixed(2)}</span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Telas maiores: tabela completa */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Deixado em</TableHead>
                  <TableHead>Deixados</TableHead>
                  <TableHead>Vendidos</TableHead>
                  <TableHead>Devolvidos</TableHead>
                  <TableHead>Pendentes</TableHead>
                  <TableHead>Preço combinado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consignments.map((c) => (
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
                    <TableCell className="font-semibold text-accent">
                      {c.quantity - c.quantitySold - c.quantityReturned}
                    </TableCell>
                    <TableCell>R$ {(c.unitPrice / 100).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
