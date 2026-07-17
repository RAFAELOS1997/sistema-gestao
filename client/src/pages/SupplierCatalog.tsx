import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { RefreshCw, ExternalLink, Store, Search } from "lucide-react";
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

const STOCK_LABELS: Record<string, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-green-900/40 text-green-400 border-green-700" },
  indisponivel: { label: "Indisponível", className: "bg-red-900/40 text-red-400 border-red-700" },
  desconhecido: { label: "Não verificado", className: "bg-gray-800/60 text-gray-400 border-gray-600" },
};

const centsToBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

const timeAgo = (dateStr: string | Date) => {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD}d`;
};

export default function SupplierCatalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<string>("nome");
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.supplierCatalog.list.useQuery({});
  const refreshMutation = trpc.supplierCatalog.refresh.useMutation();
  const updatePriceMutation = trpc.supplierCatalog.updateSuggestedPrice.useMutation();

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(term));
    }
    if (category !== "todas") {
      list = list.filter((item) => item.category === category);
    }
    const sorted = [...list];
    if (sortBy === "nome") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "preco-asc") sorted.sort((a, b) => a.price - b.price);
    if (sortBy === "preco-desc") sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "atualizado") sorted.sort((a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime());
    return sorted;
  }, [items, search, category, sortBy]);

  const handleRefresh = async (id: number) => {
    setRefreshingId(id);
    try {
      await refreshMutation.mutateAsync({ id });
      await utils.supplierCatalog.list.invalidate();
      toast.success("Produto atualizado com o site do fornecedor!");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao atualizar produto");
    } finally {
      setRefreshingId(null);
    }
  };

  const handleSaveSuggested = async (id: number) => {
    const raw = priceEdits[id];
    if (raw === undefined) return;
    const cents = Math.round(parseFloat(raw || "0") * 100);
    if (!cents || cents <= 0) {
      toast.error("Informe um preço válido");
      return;
    }
    try {
      await updatePriceMutation.mutateAsync({ id, suggestedSalePrice: cents });
      setPriceEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await utils.supplierCatalog.list.invalidate();
      toast.success("Preço sugerido salvo!");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar preço sugerido");
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
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Store className="h-7 w-7 text-accent" />
          Catálogo de Fornecedores
        </h1>
        <p className="text-muted-foreground mt-1">
          Consulte produtos, preços e estoque direto do site dos seus fornecedores
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="bg-background border-border text-foreground pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="bg-background border-border text-foreground w-full md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="bg-background border-border text-foreground w-full md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="nome">Ordenar por nome</SelectItem>
              <SelectItem value="preco-asc">Menor preço</SelectItem>
              <SelectItem value="preco-desc">Maior preço</SelectItem>
              <SelectItem value="atualizado">Atualizados recentemente</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{filtered.length} produto(s) encontrado(s)</p>

      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
            <Store className="h-12 w-12 opacity-30" />
            <p>Nenhum produto encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const stockInfo = STOCK_LABELS[item.stockStatus] ?? STOCK_LABELS.desconhecido;
            const editedValue = priceEdits[item.id];
            const margin =
              item.suggestedSalePrice && item.price
                ? Math.round(((item.suggestedSalePrice - item.price) / item.suggestedSalePrice) * 100)
                : null;
            return (
              <Card key={item.id} className="bg-card border-border overflow-hidden flex flex-col">
                <div className="aspect-square bg-background flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Store className="h-10 w-10 text-muted-foreground opacity-30" />
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-foreground leading-tight line-clamp-2 min-h-[2.5rem]">
                    {item.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-accent/40 text-accent text-xs">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${stockInfo.className}`}>
                      {stockInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 flex-1 flex flex-col">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Custo (atacado)</span>
                    <span className="text-foreground font-medium">{centsToBRL(item.price)}</span>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground">Sugestão de venda {margin !== null && `(${margin}% margem)`}</span>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedValue ?? (item.suggestedSalePrice ? (item.suggestedSalePrice / 100).toFixed(2) : "")}
                        onChange={(e) => setPriceEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="bg-background border-border text-foreground text-sm h-8"
                      />
                      <Button
                        size="sm"
                        className="h-8 px-2 bg-accent text-accent-foreground hover:bg-accent/90"
                        disabled={editedValue === undefined || updatePriceMutation.isPending}
                        onClick={() => handleSaveSuggested(item.id)}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Verificado {timeAgo(item.lastCheckedAt)}
                  </p>

                  <div className="flex gap-2 mt-auto pt-2">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full border-accent/30 text-accent hover:bg-accent/10">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Ver no site
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border"
                      disabled={refreshingId === item.id}
                      onClick={() => handleRefresh(item.id)}
                      title="Atualizar preço e estoque no site do fornecedor"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === item.id ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
