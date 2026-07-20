import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Cor de destaque por plano, só pra dar uma pista visual de "sobe de nível" —
// puramente decorativo, não afeta nada da regra de negócio.
const TIER_ACCENTS: Record<string, string> = {
  Cobre: "text-orange-400 border-orange-900/40 bg-orange-950/20",
  Bronze: "text-amber-500 border-amber-900/40 bg-amber-950/20",
  Prata: "text-slate-300 border-slate-700/40 bg-slate-800/20",
  Ouro: "text-yellow-400 border-yellow-900/40 bg-yellow-950/20",
  Diamante: "text-cyan-300 border-cyan-900/40 bg-cyan-950/20",
};

const EMPTY_TIERS: { id: number; name: string; sortOrder: number; discountPercent: number }[] = [];

// Preço de exemplo só pra ilustrar o efeito do desconto na tela.
const EXAMPLE_PRICE_CENTS = 5000;

export default function PartnerTiers() {
  const utils = trpc.useUtils();
  const { data: tiers = EMPTY_TIERS, isLoading } = trpc.partnerTiers.list.useQuery();
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const tier of tiers) next[tier.id] = String(tier.discountPercent);
    setDrafts(next);
  }, [tiers]);

  const updateMutation = trpc.partnerTiers.updateDiscount.useMutation({
    onSuccess: () => {
      toast.success("Desconto do plano atualizado!");
      utils.partnerTiers.list.invalidate();
    },
    onError: (error) => toast.error(`Erro ao salvar: ${error.message}`),
  });

  const handleSave = (tierId: number) => {
    const raw = drafts[tierId];
    const value = Number(raw);
    if (raw === undefined || raw === "" || isNaN(value) || value < 0 || value > 99) {
      toast.error("Informe um desconto entre 0 e 99%");
      return;
    }
    updateMutation.mutate({ id: tierId, discountPercent: Math.round(value) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Award className="h-7 w-7 text-accent" />
          Planos de Parceria
        </h1>
        <p className="text-muted-foreground mt-1">
          5 planos fixos, cada um com um desconto sobre o preço de venda da loja. O preço do terreiro é
          calculado sozinho — cadastrar produto novo ou mudar o preço de venda já atualiza automaticamente
          em todos os planos, sem precisar mexer aqui.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando planos...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const draft = drafts[tier.id] ?? String(tier.discountPercent);
            const draftValue = Number(draft);
            const validDraft = !isNaN(draftValue) && draftValue >= 0 && draftValue <= 99;
            const previewPrice = validDraft
              ? Math.round(EXAMPLE_PRICE_CENTS * (1 - draftValue / 100))
              : null;
            const dirty = draft !== String(tier.discountPercent);
            const accent = TIER_ACCENTS[tier.name] ?? "text-accent border-accent/40 bg-accent/10";

            return (
              <Card key={tier.id} className={`bg-card border-border`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${accent}`}>
                      {tier.name}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Exemplo: produto de R$ {(EXAMPLE_PRICE_CENTS / 100).toFixed(2)} sai por{" "}
                    <span className="text-foreground font-medium">
                      {previewPrice !== null ? `R$ ${(previewPrice / 100).toFixed(2)}` : "—"}
                    </span>{" "}
                    nesse plano
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor={`discount-${tier.id}`} className="text-xs">Desconto sobre o preço de venda (%)</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="relative flex-1">
                        <Input
                          id={`discount-${tier.id}`}
                          type="number"
                          min="0"
                          max="99"
                          step="1"
                          className="h-10 pr-8"
                          value={draft}
                          onChange={(e) => setDrafts({ ...drafts, [tier.id]: e.target.value })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                      <Button
                        onClick={() => handleSave(tier.id)}
                        disabled={!dirty || !validDraft || updateMutation.isPending}
                        className="h-10 bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
          <p>
            <span className="text-foreground font-medium">Como funciona:</span> cada terreiro parceiro fica
            associado a um desses 5 planos (em "Terreiros Parceiros"). O preço que ele vê no Portal do
            Parceiro é sempre o preço de venda da loja com o desconto do plano dele aplicado na hora — não
            precisa configurar produto por produto.
          </p>
          <p>
            Se um terreiro específico negociar um preço diferente pra algum produto, dá pra sobrescrever só
            pra ele na página de detalhe do terreiro — isso continua funcionando normalmente e tem prioridade
            sobre o desconto do plano.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
