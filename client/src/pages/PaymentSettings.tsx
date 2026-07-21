import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Loader2, Wallet } from "lucide-react";
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
    </div>
  );
}
