import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, PackageSearch } from "lucide-react";
import { toast } from "sonner";

// Itens do "Pedido de venda #7335" (Atacado de Umbanda), conferidos direto do PDF
// que o Rafael enviou. Nome, preço unitário (em reais) e quantidade.
const INVOICE_ITEMS: { name: string; unitPrice: number; quantity: number }[] = [
  { name: "ADAGA PRETA TIPO PUNHAL", unitPrice: 29.00, quantity: 1 },
  { name: "ALFAZEMA HALLEY 1 LITRO", unitPrice: 15.99, quantity: 1 },
  { name: "ALFAZEMA HALLEY 250 ML", unitPrice: 6.99, quantity: 1 },
  { name: "ALFAZEMA NEWBEL 500 ML C/ BORRIFADOR", unitPrice: 9.39, quantity: 1 },
  { name: "ANIL WAGI OAGE OAGI WAJI ORIGINAL", unitPrice: 2.85, quantity: 4 },
  { name: "AZEITE DE DENDÊ 1 LITRO", unitPrice: 16.89, quantity: 1 },
  { name: "AZEITE DE DENDÊ 200 ML", unitPrice: 4.89, quantity: 2 },
  { name: "BENGALA BASTÃO ZÉ PILINTRA", unitPrice: 24.99, quantity: 1 },
  { name: "CACHIMBO MOD 15044 CURVO", unitPrice: 10.99, quantity: 1 },
  { name: "CAMISETA MALANDRO - GG", unitPrice: 29.99, quantity: 1 },
  { name: "CASTIÇAL DE ALUMÍNIO 1 DEFUMADOR", unitPrice: 3.85, quantity: 5 },
  { name: "CHAPÉU MALANDROS", unitPrice: 13.99, quantity: 2 },
  { name: "CINZEIRO GRAVADO - EXU - PRETO", unitPrice: 7.99, quantity: 1 },
  { name: "COITE COM BASE", unitPrice: 3.50, quantity: 5 },
  { name: "CORDONE ENCERADO PRETO", unitPrice: 14.99, quantity: 1 },
  { name: "ERVA CASCA DE JUREMA CARTELA COM 10 PACOTES", unitPrice: 21.99, quantity: 1 },
  { name: "FIRMA OPACA VERMELHO", unitPrice: 1.09, quantity: 3 },
  { name: "FIRMA RAJADA BRANCA/VERMELHA", unitPrice: 1.29, quantity: 3 },
  { name: "GUIA DE CRISTAL 8MM (VIDRO) 7 LINHAS 147 CONTAS", unitPrice: 22.99, quantity: 1 },
  { name: "GUIA DE CRISTAL 8MM (VIDRO) MARROM 147 CONTAS", unitPrice: 19.99, quantity: 1 },
  { name: "GUIA DE CRISTAL 8MM (VIDRO) VERDE 147 CONTAS", unitPrice: 19.99, quantity: 1 },
  { name: "GUIA DE MIÇANGUINHA VERMELHA", unitPrice: 2.05, quantity: 5 },
  { name: "GUIA ESPECIAL 7 CAVEIRAS PRETA", unitPrice: 29.00, quantity: 1 },
  { name: "GUIA ESPECIAL 7 CAVEIRAS PRETA E ROXA", unitPrice: 29.00, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M 7 LINHAS", unitPrice: 5.19, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M DOURADA", unitPrice: 4.79, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M LARANJA CRISTAL", unitPrice: 4.79, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M MARROM CRISTAL", unitPrice: 4.79, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M PRETO/ROXO CRISTAL", unitPrice: 4.99, quantity: 2 },
  { name: "GUIA MIÇANGA 1,40M ROSA E AZUL", unitPrice: 4.99, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M ROXO CRISTAL", unitPrice: 4.79, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M VERDE CRISTAL", unitPrice: 4.79, quantity: 1 },
  { name: "GUIA MIÇANGA 1,40M VERMELHO CRISTAL", unitPrice: 4.79, quantity: 1 },
  { name: "GUIA MIÇANGA BRANCA E PRETA 1,40M", unitPrice: 4.99, quantity: 5 },
  { name: "GUIA MIÇANGA BRANCA E VERMELHA 1,40 M", unitPrice: 4.99, quantity: 5 },
  { name: "GUIA MIÇANGA VERMELHA E PRETA 1,40 M", unitPrice: 4.99, quantity: 5 },
  { name: "GUIA OLHO DE BOI E COQUINHO", unitPrice: 16.00, quantity: 1 },
  { name: "KIT 7 PEDRAS DA SORTE", unitPrice: 3.99, quantity: 2 },
  { name: "KIT PEDRAS 7 CHAKRAS ROLADA", unitPrice: 5.99, quantity: 1 },
  { name: "OS CAMINHOS DE ZÉ PILINTRA (PLASTIFICADO)", unitPrice: 22.99, quantity: 1 },
  { name: "PEMBA AMARELA 6 UNIDADES", unitPrice: 4.99, quantity: 1 },
  { name: "PORTA INCENSO MADEIRA", unitPrice: 2.99, quantity: 3 },
  { name: "PULSEIRA 7 NÓS VERMELHA", unitPrice: 2.79, quantity: 5 },
  { name: "PULSEIRA EXÚ", unitPrice: 7.49, quantity: 1 },
  { name: "PULSEIRA MARIA NAVALHA", unitPrice: 7.49, quantity: 1 },
  { name: "PULSEIRA POMBA GIRA", unitPrice: 7.49, quantity: 1 },
  { name: "PULSEIRA YEMANJÁ", unitPrice: 7.49, quantity: 1 },
  { name: "PUNHAL CABO VERMELHO E PRETO 17 CM", unitPrice: 3.79, quantity: 4 },
  { name: "SINO DE ALUMÍNIO (SINETA) COM CABO DE MADEIRA", unitPrice: 9.00, quantity: 2 },
  { name: "SUPORTE 1 VELA PALITO ALUMÍNIO (PACOTE COM 12 UNIDADES)", unitPrice: 34.90, quantity: 2 },
  { name: "TAROT DA POMBA GIRA", unitPrice: 22.99, quantity: 1 },
  { name: "TERÇO EM MADEIRA 3 UNIDADES", unitPrice: 11.99, quantity: 1 },
  { name: "TIARA CIGANA COM MOEDAS", unitPrice: 13.80, quantity: 1 },
  { name: "TURÍBULO DE ALUMÍNIO MÉDIO", unitPrice: 9.99, quantity: 2 },
];

const centsToBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

export default function AuditPedido7335() {
  const utils = trpc.useUtils();
  const items = useMemo(
    () => INVOICE_ITEMS.map((i) => ({ ...i, unitPriceCents: Math.round(i.unitPrice * 100) })),
    []
  );

  const { data: audit, isLoading } = trpc.products.auditOrder.useQuery({
    items: items.map((i) => ({ name: i.name, unitPriceCents: i.unitPriceCents, quantity: i.quantity })),
  });

  const [selectedPrice, setSelectedPrice] = useState<Record<number, boolean>>({});
  const [selectedQty, setSelectedQty] = useState<Record<number, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  const applyMutation = trpc.products.applyOrderCorrections.useMutation();

  // Marca por padrão os itens com preço diferente (correção de custo é o pedido
  // principal); diferenças de quantidade ficam desmarcadas por afetar o estoque.
  if (audit && !initialized) {
    const priceDefaults: Record<number, boolean> = {};
    audit.forEach((row, idx) => {
      if (row.matched && row.currentCostPriceCents !== row.invoiceUnitPriceCents) {
        priceDefaults[idx] = true;
      }
    });
    setSelectedPrice(priceDefaults);
    setInitialized(true);
  }

  if (isLoading || !audit) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const unmatched = audit.filter((row) => !row.matched);
  const matched = audit.filter((row) => row.matched);
  const priceMismatches = matched.filter((row) => row.currentCostPriceCents !== row.invoiceUnitPriceCents);
  const qtyMismatches = matched.filter(
    (row) => row.purchaseQuantity !== null && row.purchaseQuantity !== row.invoiceQuantity
  );

  const handleApply = async () => {
    const corrections: {
      productId: number;
      newCostPriceCents: number;
      purchaseId: number | null;
      newPurchaseUnitPriceCents: number | null;
      purchaseQuantityForTotal: number | null;
      newPurchaseQuantity: number | null;
    }[] = [];

    audit.forEach((row, idx) => {
      if (!row.matched) return;
      if (!selectedPrice[idx] && !selectedQty[idx]) return;

      const productId = row.productId;
      const purchaseId = row.purchaseId;
      const invoiceUnitPriceCents = row.invoiceUnitPriceCents;
      const invoiceQuantity = row.invoiceQuantity;
      const purchaseQuantity = row.purchaseQuantity;
      const wantsQty = !!(selectedQty[idx] && purchaseId);

      let purchaseQuantityForTotal: number | null = null;
      if (purchaseId) {
        purchaseQuantityForTotal = wantsQty ? invoiceQuantity : (purchaseQuantity ?? invoiceQuantity);
      }

      corrections.push({
        productId,
        newCostPriceCents: invoiceUnitPriceCents,
        purchaseId,
        newPurchaseUnitPriceCents: purchaseId ? invoiceUnitPriceCents : null,
        purchaseQuantityForTotal,
        newPurchaseQuantity: wantsQty ? invoiceQuantity : null,
      });
    });

    if (corrections.length === 0) {
      toast.error("Nenhuma correção selecionada");
      return;
    }

    try {
      const result = await applyMutation.mutateAsync({ corrections });
      await utils.products.list.invalidate();
      await utils.purchases.list.invalidate();
      await utils.analytics.dashboard.invalidate();
      await utils.products.auditOrder.invalidate();
      setInitialized(false);
      toast.success(
        `Corrigido! ${result.productsUpdated} produto(s) e ${result.purchasesUpdated} compra(s) atualizados.`
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao aplicar correções");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Conferência do Pedido #7335</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compara os {items.length} itens da nota do fornecedor com o que está cadastrado no sistema.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Itens na nota</p>
            <p className="text-2xl font-bold text-foreground">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Não encontrados</p>
            <p className={`text-2xl font-bold ${unmatched.length > 0 ? "text-destructive" : "text-foreground"}`}>
              {unmatched.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Preço diferente</p>
            <p className={`text-2xl font-bold ${priceMismatches.length > 0 ? "text-yellow-500" : "text-foreground"}`}>
              {priceMismatches.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Quantidade diferente</p>
            <p className={`text-2xl font-bold ${qtyMismatches.length > 0 ? "text-yellow-500" : "text-foreground"}`}>
              {qtyMismatches.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {unmatched.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Itens da nota não encontrados no sistema
            </CardTitle>
            <CardDescription>
              Não achei produto com esse nome cadastrado — pode ter sido digitado diferente, ou nunca foi importado. Confira manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {unmatched.map((row, idx) => (
              <p key={idx} className="text-sm text-foreground">
                • {row.invoiceName} — {centsToBRL(row.invoiceUnitPriceCents)} x {row.invoiceQuantity}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-accent" />
            Itens encontrados — revise e aplique
          </CardTitle>
          <CardDescription>
            Marcado = será corrigido. Diferenças de preço já vêm marcadas; diferenças de quantidade ficam por sua conta (mexer na quantidade ajusta o estoque).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {matched.map((row, i) => {
            const idx = audit.indexOf(row);
            if (!row.matched) return null;
            const priceDiffers = row.currentCostPriceCents !== row.invoiceUnitPriceCents;
            const qtyDiffers = row.purchaseQuantity !== null && row.purchaseQuantity !== row.invoiceQuantity;
            if (!priceDiffers && !qtyDiffers) return null;
            return (
              <div key={i} className="p-3 bg-background rounded-lg border border-border space-y-2">
                <p className="font-medium text-foreground text-sm">{row.productName}</p>

                {priceDiffers && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!!selectedPrice[idx]}
                      onCheckedChange={(v) => setSelectedPrice((prev) => ({ ...prev, [idx]: !!v }))}
                    />
                    <span className="text-muted-foreground">Custo:</span>
                    <span className="text-destructive line-through">{centsToBRL(row.currentCostPriceCents)}</span>
                    <span className="text-foreground">→</span>
                    <span className="text-green-400 font-semibold">{centsToBRL(row.invoiceUnitPriceCents)}</span>
                  </label>
                )}

                {qtyDiffers && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!!selectedQty[idx]}
                      onCheckedChange={(v) => setSelectedQty((prev) => ({ ...prev, [idx]: !!v }))}
                    />
                    <span className="text-muted-foreground">Quantidade da compra:</span>
                    <span className="text-destructive line-through">{row.purchaseQuantity}</span>
                    <span className="text-foreground">→</span>
                    <span className="text-green-400 font-semibold">{row.invoiceQuantity}</span>
                    <span className="text-xs text-muted-foreground">(ajusta o estoque)</span>
                  </label>
                )}
              </div>
            );
          })}
          {priceMismatches.length === 0 && qtyMismatches.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma diferença de preço ou quantidade encontrada nos itens já cadastrados. 🎉
            </p>
          )}
        </CardContent>
      </Card>

      {(priceMismatches.length > 0 || qtyMismatches.length > 0) && (
        <Button
          onClick={handleApply}
          disabled={applyMutation.isPending}
          className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
        >
          {applyMutation.isPending ? "Aplicando..." : "Aplicar correções selecionadas"}
        </Button>
      )}
    </div>
  );
}
