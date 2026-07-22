import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Loader2, Truck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function PaymentSettings() {
  const utils = trpc.useUtils();

  // ─── Formas de pagamento nativas ──────────────────────────────────────────
  const methodsQuery = trpc.paymentMethods.list.useQuery();
  const updateMethodMutation = trpc.paymentMethods.update.useMutation();
  const [labelDrafts, setLabelDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!methodsQuery.data) return;
    const next: Record<number, string> = {};
    for (const m of methodsQuery.data) next[m.id] = m.label;
    setLabelDrafts(next);
  }, [methodsQuery.data]);

  const handleToggleMethod = async (id: number, enabled: boolean) => {
    try {
      await updateMethodMutation.mutateAsync({ id, enabled });
      utils.paymentMethods.list.invalidate();
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao atualizar");
    }
  };

  const handleSaveLabel = async (id: number) => {
    const label = labelDrafts[id]?.trim();
    if (!label) {
      toast.error("O nome não pode ficar vazio");
      return;
    }
    try {
      await updateMethodMutation.mutateAsync({ id, label });
      toast.success("Nome atualizado!");
      utils.paymentMethods.list.invalidate();
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar");
    }
  };

  // ─── InfinitePay ───────────────────────────────────────────────────────────
  const infinitePayHandleQuery = trpc.infinitePay.getHandle.useQuery();
  const setInfinitePayHandleMutation = trpc.infinitePay.setHandle.useMutation();
  const [infinitePayHandle, setInfinitePayHandle] = useState("");

  useEffect(() => {
    if (infinitePayHandleQuery.data) setInfinitePayHandle(infinitePayHandleQuery.data.handle ?? "");
  }, [infinitePayHandleQuery.data]);

  const handleSaveInfinitePayHandle = async () => {
    try {
      await setInfinitePayHandleMutation.mutateAsync({ handle: infinitePayHandle.trim() || null });
      toast.success("InfiniteTag salva!");
      infinitePayHandleQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar");
    }
  };

  // ─── Frete (Fase 1 do plano de expansão nacional) ─────────────────────────
  const shippingConfigQuery = trpc.settings.getShippingConfig.useQuery();
  const updateShippingMutation = trpc.settings.updateShippingConfig.useMutation();
  const [shippingForm, setShippingForm] = useState({
    shippingLocalCity: "",
    shippingLocalState: "",
    shippingLocalReais: "0",
    shippingStateReais: "0",
    shippingNationalReais: "0",
  });

  useEffect(() => {
    if (!shippingConfigQuery.data) return;
    const c = shippingConfigQuery.data;
    setShippingForm({
      shippingLocalCity: c.shippingLocalCity,
      shippingLocalState: c.shippingLocalState,
      shippingLocalReais: (c.shippingLocalCents / 100).toFixed(2),
      shippingStateReais: (c.shippingStateCents / 100).toFixed(2),
      shippingNationalReais: (c.shippingNationalCents / 100).toFixed(2),
    });
  }, [shippingConfigQuery.data]);

  const handleSaveShipping = async () => {
    const toCents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100) || 0;
    try {
      await updateShippingMutation.mutateAsync({
        shippingLocalCity: shippingForm.shippingLocalCity.trim() || "Ribeirão Preto",
        shippingLocalState: shippingForm.shippingLocalState.trim().toUpperCase() || "SP",
        shippingLocalCents: toCents(shippingForm.shippingLocalReais),
        shippingStateCents: toCents(shippingForm.shippingStateReais),
        shippingNationalCents: toCents(shippingForm.shippingNationalReais),
      });
      toast.success("Frete atualizado!");
      shippingConfigQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Wallet className="h-7 w-7 text-accent" />
          Pagamentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Formas de pagamento aceitas na Loja e a integração com a InfinitePay, tudo num lugar só
        </p>
      </div>

      {/* Formas de pagamento nativas */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Formas de Pagamento</CardTitle>
          <CardDescription>
            Ative ou desative o que aparece na tela de Vendas. São fixas (não dá pra criar uma nova aqui),
            mas dá pra renomear e ligar/desligar cada uma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {methodsQuery.isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
          ) : (
            (methodsQuery.data ?? []).map((method) => (
              <div
                key={method.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-background rounded-lg border border-border"
              >
                <Switch
                  checked={!!method.enabled}
                  onCheckedChange={(checked) => handleToggleMethod(method.id, checked)}
                  className="data-[state=checked]:bg-accent shrink-0"
                />
                <div className="flex-1 flex gap-2">
                  <Input
                    value={labelDrafts[method.id] ?? method.label}
                    onChange={(e) => setLabelDrafts({ ...labelDrafts, [method.id]: e.target.value })}
                    className="bg-card border-border text-foreground h-9"
                    disabled={!method.enabled}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border h-9 shrink-0"
                    disabled={updateMethodMutation.isPending || labelDrafts[method.id] === method.label}
                    onClick={() => handleSaveLabel(method.id)}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* InfinitePay */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent" />
            InfinitePay
          </CardTitle>
          <CardDescription>
            Configure sua InfiniteTag pra poder cobrar por Pix/cartão com QR Code direto na tela de Vendas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="infinitepay-handle" className="text-foreground">
              InfiniteTag
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none">$</span>
              <Input
                id="infinitepay-handle"
                value={infinitePayHandle}
                onChange={(e) => setInfinitePayHandle(e.target.value.replace(/^\$/, ""))}
                className="bg-background border-border text-foreground pl-7"
                placeholder="toca-da-pantera"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              É o seu @ que aparece no canto superior esquerdo do app InfinitePay — não é senha nem chave secreta,
              é só o identificador público da sua conta usado pra gerar as cobranças.
            </p>
          </div>
          <Button
            onClick={handleSaveInfinitePayHandle}
            disabled={setInfinitePayHandleMutation.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
          >
            {setInfinitePayHandleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar InfiniteTag
          </Button>
        </CardContent>
      </Card>

      {/* Frete (Fase 1 do plano de expansão nacional) */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Truck className="h-5 w-5 text-accent" />
            Frete
          </CardTitle>
          <CardDescription>
            Valor fixo cobrado do cliente quando escolhe "Receber em casa" em Fazer Pedidos ou Pronta Entrega — sem
            integração nenhuma, é só uma tabela de 3 faixas. Deixe R$ 0,00 pra qualquer faixa que ainda não quiser cobrar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipping-local-city" className="text-foreground">Cidade da loja</Label>
              <Input
                id="shipping-local-city"
                value={shippingForm.shippingLocalCity}
                onChange={(e) => setShippingForm({ ...shippingForm, shippingLocalCity: e.target.value })}
                className="bg-background border-border text-foreground"
                placeholder="Ribeirão Preto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-local-state" className="text-foreground">Estado (UF)</Label>
              <Input
                id="shipping-local-state"
                value={shippingForm.shippingLocalState}
                onChange={(e) => setShippingForm({ ...shippingForm, shippingLocalState: e.target.value.toUpperCase().slice(0, 2) })}
                className="bg-background border-border text-foreground"
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipping-local-cents" className="text-foreground text-sm">
                Frete pra {shippingForm.shippingLocalCity || "sua cidade"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none text-sm">R$</span>
                <Input
                  id="shipping-local-cents"
                  value={shippingForm.shippingLocalReais}
                  onChange={(e) => setShippingForm({ ...shippingForm, shippingLocalReais: e.target.value })}
                  className="bg-background border-border text-foreground pl-9"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-state-cents" className="text-foreground text-sm">
                Frete pro resto de {shippingForm.shippingLocalState || "SP"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none text-sm">R$</span>
                <Input
                  id="shipping-state-cents"
                  value={shippingForm.shippingStateReais}
                  onChange={(e) => setShippingForm({ ...shippingForm, shippingStateReais: e.target.value })}
                  className="bg-background border-border text-foreground pl-9"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-national-cents" className="text-foreground text-sm">Frete pro resto do Brasil</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none text-sm">R$</span>
                <Input
                  id="shipping-national-cents"
                  value={shippingForm.shippingNationalReais}
                  onChange={(e) => setShippingForm({ ...shippingForm, shippingNationalReais: e.target.value })}
                  className="bg-background border-border text-foreground pl-9"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>
          <Button
            onClick={handleSaveShipping}
            disabled={updateShippingMutation.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
          >
            {updateShippingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar frete
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
