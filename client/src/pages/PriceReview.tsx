import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

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

const centsToInput = (cents: number) => (cents / 100).toFixed(2);
const inputToCents = (value: string) => Math.round(parseFloat(value || "0") * 100);

export default function PriceReview() {
  const [showAll, setShowAll] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.products.list.useQuery();
  const updateMutation = trpc.products.update.useMutation();

  const pending = useMemo(
    () => (products ?? []).filter((p) => p.salePrice === p.costPrice),
    [products]
  );
  const visible = showAll ? products ?? [] : pending;

  const setPrice = (id: number, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: value }));
  };

  const saveOne = async (id: number, fallbackCents: number) => {
    const raw = edits[id];
    const salePrice = raw !== undefined ? inputToCents(raw) : fallbackCents;
    if (!salePrice || salePrice <= 0) {
      toast.error("Informe um preço de venda válido");
      return;
    }
    setSavingId(id);
    try {
      await updateMutation.mutateAsync({ id, salePrice });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await utils.products.list.invalidate();
      toast.success("Preço salvo!");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar preço");
    } finally {
      setSavingId(null);
    }
  };

  const saveAll = async () => {
    const idsToSave = Object.keys(edits).map(Number).filter((id) => {
      const raw = edits[id];
      return raw !== undefined && inputToCents(raw) > 0;
    });
    if (idsToSave.length === 0) {
      toast.error("Nenhum preço novo para salvar");
      return;
    }
    setSavingAll(true);
    try {
      for (const id of idsToSave) {
        await updateMutation.mutateAsync({ id, salePrice: inputToCents(edits[id]) });
      }
      setEdits({});
      await utils.products.list.invalidate();
      toast.success(`${idsToSave.length} preço(s) salvo(s)!`);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar preços");
    } finally {
      setSavingAll(false);
    }
  };

  const applyMarkup = (id: number, costCents: number, multiplier: number) => {
    setPrice(id, ((costCents * multiplier) / 100).toFixed(2));
  };

  const editedCount = Object.keys(edits).filter((id) => edits[Number(id)] !== undefined && edits[Number(id)] !== "").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Revisão de Preços</h1>
          <p className="text-muted-foreground mt-1">
            Defina o preço de venda dos produtos recém-cadastrados
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
            <Label htmlFor="show-all" className="text-foreground cursor-pointer">
              Mostrar todos os produtos
            </Label>
          </div>
          <Button
            onClick={saveAll}
            disabled={editedCount === 0 || savingAll}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {savingAll ? "Salvando..." : `Salvar todas (${editedCount})`}
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-accent" />
            {showAll ? "Todos os produtos" : "Produtos aguardando revisão"}
          </CardTitle>
          <CardDescription>
            {showAll
              ? `Total: ${visible.length} produto(s)`
              : `${pending.length} produto(s) com preço de venda igual ao custo`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <ClipboardCheck className="h-12 w-12 opacity-30" />
              <p>Nenhum produto aguardando revisão de preço.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-accent font-semibold">Nome</TableHead>
                    <TableHead className="text-accent font-semibold">Categoria</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Custo</TableHead>
                    <TableHead className="text-accent font-semibold">Sugestões</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Preço de Venda</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Margem</TableHead>
                    <TableHead className="text-accent font-semibold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((product) => {
                    const editedValue = edits[product.id];
                    const currentSaleCents =
                      editedValue !== undefined ? inputToCents(editedValue) : product.salePrice;
                    const margin =
                      currentSaleCents > 0
                        ? Math.round(((currentSaleCents - product.costPrice) / currentSaleCents) * 100)
                        : 0;
                    const needsReview = product.salePrice === product.costPrice;
                    return (
                      <TableRow key={product.id} className="border-border hover:bg-background/50">
                        <TableCell className="font-medium text-foreground">
                          {product.name}
                          {needsReview && (
                            <Badge variant="outline" className="ml-2 border-yellow-700 text-yellow-400 text-xs">
                              revisar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-accent/40 text-accent">
                            {CATEGORY_LABELS[product.category] ?? product.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                          R$ {centsToInput(product.costPrice)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-accent/30 text-accent hover:bg-accent/10"
                              onClick={() => applyMarkup(product.id, product.costPrice, 1.5)}
                            >
                              +50%
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-accent/30 text-accent hover:bg-accent/10"
                              onClick={() => applyMarkup(product.id, product.costPrice, 2)}
                            >
                              x2
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-accent/30 text-accent hover:bg-accent/10"
                              onClick={() => applyMarkup(product.id, product.costPrice, 3)}
                            >
                              x3
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editedValue ?? centsToInput(product.salePrice)}
                            onChange={(e) => setPrice(product.id, e.target.value)}
                            className="bg-background border-border text-foreground w-28 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right text-accent font-bold">{margin}%</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => saveOne(product.id, product.salePrice)}
                            disabled={savingId === product.id || editedValue === undefined}
                            className="bg-accent text-accent-foreground hover:bg-accent/90"
                          >
                            {savingId === product.id ? "..." : "Salvar"}
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
