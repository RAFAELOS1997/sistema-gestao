import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { RefreshCw, ExternalLink, Sparkles, Search, Clock, PackageSearch, PackagePlus, Check, Download, ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ZoomableImage } from "@/components/ZoomableImage";

export type SupplierCatalogSource = { path: string; category: string; label: string };

export type SupplierCatalogConfig = {
  supplierId: number;
  sourceKey: "atacado_umbanda" | "cristais_curvelo";
  title: string;
  subtitle: string;
  icon: LucideIcon;
  importSources: SupplierCatalogSource[];
};

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

// Fornecedor Atacado de Umbanda (supplierId 1). Categorias do site mapeadas
// para as categorias do sistema. IMPORTANTE: /diversos NÃO é um catálogo
// completo — a maioria dos produtos das categorias nomeadas não aparece lá
// (verificado no site real), então TODA categoria do menu do site precisa
// estar nesta lista. Produtos repetidos entre categorias são ignorados pelo
// slug, então sobreposição é inofensiva.
const ORACULO_IMPORT_SOURCES: SupplierCatalogSource[] = [
  { path: "guias", category: "guias", label: "Guias" },
  { path: "guia-micanguinha", category: "guias", label: "Guias miçanguinha" },
  { path: "guias-de-cristal", category: "guias", label: "Guias de cristal" },
  { path: "guias-de-micanga", category: "guias", label: "Guias de miçanga" },
  { path: "guias-especiais", category: "guias", label: "Guias especiais" },
  { path: "brajas", category: "guias", label: "Brajás" },
  { path: "pulseiras-23553907", category: "pulseiras", label: "Pulseiras" },
  { path: "pingentes", category: "pulseiras", label: "Pingentes" },
  { path: "vela-de-magia", category: "velas", label: "Velas de magia" },
  { path: "vela-de-magia-23881892", category: "velas", label: "Velas de magia (2)" },
  { path: "casticais-e-turibulos", category: "velas", label: "Castiçais e turíbulos" },
  { path: "incenso-box", category: "incensos", label: "Incenso box" },
  { path: "incenso-cascata", category: "incensos", label: "Incenso cascata" },
  { path: "nirvana", category: "incensos", label: "Incensos Nirvana" },
  { path: "satya", category: "incensos", label: "Incensos Satya" },
  { path: "vareta-carvao", category: "incensos", label: "Varetas de carvão" },
  { path: "vareta-noa-signos", category: "incensos", label: "Varetas Noa" },
  { path: "defumadores", category: "incensos", label: "Defumadores" },
  { path: "incensarios", category: "incensos", label: "Incensários" },
  { path: "banho-e-ervas", category: "ervas", label: "Banhos e ervas" },
  { path: "banho-liquido", category: "ervas", label: "Banho líquido" },
  { path: "ervas-seca", category: "ervas", label: "Ervas secas" },
  { path: "essencias", category: "ervas", label: "Essências" },
  { path: "alfazema", category: "ervas", label: "Alfazema" },
  { path: "mel-e-dende", category: "ervas", label: "Mel e dendê" },
  { path: "po-23003426", category: "ervas", label: "Pós rituais" },
  { path: "sabao-costa-22846208", category: "ervas", label: "Sabão da costa" },
  { path: "atrativos", category: "ervas", label: "Atrativos" },
  { path: "pemba-23133561", category: "ervas", label: "Pembas" },
  { path: "imagens", category: "imagens", label: "Imagens" },
  { path: "imagem-de-chumbo", category: "imagens", label: "Imagens de chumbo" },
  { path: "imagem-de-gesso", category: "imagens", label: "Imagens de gesso" },
  { path: "imagem-resina-10cm", category: "imagens", label: "Imagens resina 10cm" },
  { path: "imagem-resina-15-cm", category: "imagens", label: "Imagens resina 15cm" },
  { path: "imagem-resina-grande", category: "imagens", label: "Imagens resina grandes" },
  { path: "vudu", category: "imagens", label: "Vudu" },
  { path: "linha-egipcia", category: "imagens", label: "Linha egípcia" },
  { path: "africanos", category: "imagens", label: "Africanos" },
  { path: "indigenas-22873500", category: "imagens", label: "Indígenas" },
  { path: "baralhos-e-tarot", category: "livros", label: "Baralhos e tarô" },
  { path: "aya-mystic", category: "livros", label: "Aya Mystic" },
  { path: "pedras-23129627", category: "pedras", label: "Pedras" },
  { path: "agatas", category: "pedras", label: "Ágatas" },
  { path: "cristal-e-micangas", category: "pedras", label: "Cristais e miçangas" },
  { path: "corais-23003431", category: "pedras", label: "Corais" },
  { path: "buzios-22846182", category: "pedras", label: "Búzios" },
  { path: "ferro-e-chumbo", category: "ferramentas", label: "Ferro e chumbo" },
  { path: "facas", category: "ferramentas", label: "Facas" },
  { path: "punhais", category: "ferramentas", label: "Punhais" },
  { path: "bigornas", category: "ferramentas", label: "Bigornas" },
  { path: "bengalas", category: "ferramentas", label: "Bengalas" },
  { path: "alguidar", category: "ferramentas", label: "Alguidares" },
  { path: "gamelas", category: "ferramentas", label: "Gamelas" },
  { path: "quartinha-branca", category: "ferramentas", label: "Quartinhas" },
  { path: "tacas-23129994", category: "ferramentas", label: "Taças" },
  { path: "taca-de-vidro", category: "ferramentas", label: "Taças de vidro" },
  { path: "prato-de-louca", category: "ferramentas", label: "Pratos de louça" },
  { path: "colher-e-pilao", category: "ferramentas", label: "Colher e pilão" },
  { path: "peneiras-23289805", category: "ferramentas", label: "Peneiras" },
  { path: "cabacas-23289816", category: "ferramentas", label: "Cabaças" },
  { path: "ofertorios", category: "ferramentas", label: "Ofertórios" },
  { path: "abebe", category: "ferramentas", label: "Abebés" },
  { path: "roupas-23089187", category: "vestuario", label: "Roupas" },
  { path: "chapeus-22846189", category: "vestuario", label: "Chapéus" },
  { path: "cap-marinheiro", category: "vestuario", label: "Cap. marinheiro" },
  { path: "morim", category: "vestuario", label: "Morim" },
  { path: "paramentas", category: "vestuario", label: "Paramentas" },
  { path: "couro-22846197", category: "vestuario", label: "Couro" },
  { path: "box-25-unidades", category: "incensos", label: "Incenso box 25un" },
  { path: "nirvana-orixas", category: "incensos", label: "Nirvana Orixás" },
  { path: "nirvana-tarot", category: "incensos", label: "Nirvana Tarô" },
  { path: "farinhas-22846202", category: "ervas", label: "Farinhas" },
  { path: "favas-22846204", category: "ervas", label: "Favas" },
  { path: "efum", category: "ervas", label: "Efum" },
  { path: "contra-egum-23003405", category: "pulseiras", label: "Contra-egum" },
  { path: "ides-23003438", category: "pulseiras", label: "Idês" },
  { path: "firma-cristal-23088755", category: "pedras", label: "Firmas cristal" },
  { path: "firma-opaca-23088818", category: "pedras", label: "Firmas opacas" },
  { path: "firma-pitanga", category: "pedras", label: "Firmas pitanga" },
  { path: "firma-pitanga-rajada", category: "pedras", label: "Firmas pitanga rajada" },
  { path: "firmas-de-murano", category: "pedras", label: "Firmas de murano" },
  { path: "firmas-metal-23217633", category: "pedras", label: "Firmas de metal" },
  { path: "ogo", category: "ferramentas", label: "Ogós" },
  { path: "barcos", category: "ferramentas", label: "Barcos" },
  { path: "tabacaria", category: "outros", label: "Tabacaria" },
  { path: "cachimbos", category: "outros", label: "Cachimbos" },
  { path: "porta-cigarro", category: "outros", label: "Porta-cigarros" },
  { path: "cinzeiros", category: "outros", label: "Cinzeiros" },
  { path: "isqueiro-e-acendedor", category: "outros", label: "Isqueiros" },
  { path: "bebidas", category: "outros", label: "Bebidas" },
  { path: "figas", category: "outros", label: "Figas" },
  { path: "chaveiros", category: "outros", label: "Chaveiros" },
  { path: "enfeites", category: "outros", label: "Enfeites" },
  { path: "penas", category: "outros", label: "Penas" },
  { path: "acessorios", category: "outros", label: "Acessórios" },
  { path: "acessorios-ciganos", category: "outros", label: "Acessórios ciganos" },
  { path: "ofertas", category: "outros", label: "Ofertas" },
  { path: "diversos", category: "outros", label: "Demais produtos" },
];

const ORACULO_CONFIG: SupplierCatalogConfig = {
  supplierId: 1,
  sourceKey: "atacado_umbanda",
  title: "O Oráculo",
  subtitle: "Produtos, preços e estoque dos seus fornecedores, tudo num só lugar",
  icon: Sparkles,
  importSources: ORACULO_IMPORT_SOURCES,
};

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

export default function SupplierCatalog({ config, hideHeader }: { config?: SupplierCatalogConfig; hideHeader?: boolean }) {
  const cfg = config ?? ORACULO_CONFIG;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<string>("nome");
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<number, string>>({});

  const [backfilling, setBackfilling] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);

  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.supplierCatalog.list.useQuery({ supplierId: cfg.supplierId });
  const { data: myProducts } = trpc.products.list.useQuery();
  const refreshMutation = trpc.supplierCatalog.refresh.useMutation();
  const updatePriceMutation = trpc.supplierCatalog.updateSuggestedPrice.useMutation();
  const backfillImagesMutation = trpc.supplierCatalog.backfillImages.useMutation();
  const addToInventoryMutation = trpc.supplierCatalog.addToInventory.useMutation();
  const importSiteMutation = trpc.supplierCatalog.importFromSupplierSite.useMutation();

  const myProductNames = useMemo(
    () => new Set((myProducts ?? []).map((p) => p.name.trim().toLowerCase())),
    [myProducts]
  );

  const missingImagesCount = useMemo(
    () => (items ?? []).filter((item) => !item.imageUrl).length,
    [items]
  );

  // Contagem por categoria (aparece no dropdown, ajuda a ver o tamanho do catálogo)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items ?? []) counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(term));
    }
    if (category !== "todas") {
      list = list.filter((item) => item.category === category);
    }
    if (stockFilter === "disponivel") {
      list = list.filter((item) => item.stockStatus === "disponivel");
    } else if (stockFilter === "indisponivel") {
      list = list.filter((item) => item.stockStatus === "indisponivel");
    }
    const sorted = [...list];
    if (sortBy === "nome") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "preco-asc") sorted.sort((a, b) => a.price - b.price);
    if (sortBy === "preco-desc") sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "atualizado") sorted.sort((a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime());
    return sorted;
  }, [items, search, category, stockFilter, sortBy]);

  // Paginação: renderizar 900+ cards de uma vez trava o navegador (principalmente
  // no celular) — mostra em páginas de 24.
  const PAGE_SIZE = 24;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, stockFilter, sortBy]);
  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [pageCount, currentPage]);
  const pagedItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

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

  const handleBackfillImages = async () => {
    setBackfilling(true);
    try {
      const result = await backfillImagesMutation.mutateAsync();
      await utils.supplierCatalog.list.invalidate();
      if (result.updated > 0) {
        toast.success(
          result.remaining > 0
            ? `${result.updated} foto(s) encontrada(s)! Clique de novo para buscar as ${result.remaining} restantes.`
            : `${result.updated} foto(s) encontrada(s) no site do fornecedor!`
        );
      } else {
        toast.info("Nenhuma foto nova encontrada no site do fornecedor para esses produtos.");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao buscar fotos");
    } finally {
      setBackfilling(false);
    }
  };

  const handleImportAll = async () => {
    if (!confirm(
      `Isso vai buscar TODOS os produtos do site do fornecedor e adicionar os que ainda não estão em "${cfg.title}". Pode levar alguns minutos. Continuar?`
    )) return;

    setImporting(true);
    let totalInserted = 0;
    try {
      for (let i = 0; i < cfg.importSources.length; i++) {
        const source = cfg.importSources[i];
        setImportProgress(`${source.label} (${i + 1}/${cfg.importSources.length})`);
        let page: number | null = 1;
        while (page !== null) {
          const result: { found: number; inserted: number; nextPage: number | null } =
            await importSiteMutation.mutateAsync({
              supplierId: cfg.supplierId,
              sourceKey: cfg.sourceKey,
              categoryPath: source.path,
              myCategory: source.category as any,
              startPage: page,
            });
          totalInserted += result.inserted;
          page = result.nextPage;
        }
        if ((i + 1) % 10 === 0) await utils.supplierCatalog.list.invalidate();
      }
      await utils.supplierCatalog.list.invalidate();
      toast.success(
        totalInserted > 0
          ? `Importação concluída! ${totalInserted} produto(s) novo(s) adicionado(s).`
          : "Importação concluída! Nenhum produto novo — o catálogo já estava completo."
      );
    } catch (error: any) {
      await utils.supplierCatalog.list.invalidate();
      toast.error(
        `A importação parou no meio (${totalInserted} adicionados até agora). Clique de novo para continuar de onde parou. ${error?.message ?? ""}`
      );
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  };

  const handleAddToInventory = async (id: number) => {
    setAddingId(id);
    try {
      const result = await addToInventoryMutation.mutateAsync({ id });
      await utils.products.list.invalidate();
      toast.success(`"${result.name}" cadastrado nos seus produtos!`);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao cadastrar produto");
    } finally {
      setAddingId(null);
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
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <cfg.icon className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {cfg.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {cfg.subtitle}
            </p>
          </div>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="bg-background border-border text-foreground pl-9 h-11 text-base"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-background border-border text-foreground h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="todas">Todas as categorias ({(items ?? []).length})</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label} ({categoryCounts[value] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="bg-background border-border text-foreground h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="todos">Estoque: todos</SelectItem>
                <SelectItem value="disponivel">Só disponíveis</SelectItem>
                <SelectItem value="indisponivel">Só indisponíveis</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-background border-border text-foreground h-11 w-full col-span-2 sm:col-span-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="nome">Nome (A-Z)</SelectItem>
                <SelectItem value="preco-asc">Menor preço</SelectItem>
                <SelectItem value="preco-desc">Maior preço</SelectItem>
                <SelectItem value="atualizado">Atualizados recentemente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground font-medium">
          {filtered.length} produto(s) encontrado(s)
          {filtered.length > PAGE_SIZE &&
            ` · mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)}`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="border-accent/30 text-accent hover:bg-accent/10 h-9"
          disabled={importing || backfilling}
          onClick={handleImportAll}
        >
          <Download className={`w-3.5 h-3.5 mr-1.5 ${importing ? "animate-bounce" : ""}`} />
          {importing ? `Importando: ${importProgress}` : "Importar tudo do fornecedor"}
        </Button>
        {missingImagesCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-accent/30 text-accent hover:bg-accent/10 h-9"
            disabled={backfilling}
            onClick={handleBackfillImages}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${backfilling ? "animate-spin" : ""}`} />
            {backfilling
              ? "Buscando fotos..."
              : `Buscar ${missingImagesCount} foto(s) faltando`}
          </Button>
        )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <PackageSearch className="h-12 w-12 opacity-30" />
            <p>Nenhum produto encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {pagedItems.map((item) => {
            const stockInfo = STOCK_LABELS[item.stockStatus] ?? STOCK_LABELS.desconhecido;
            const editedValue = priceEdits[item.id];
            const alreadyMine = myProductNames.has(item.name.trim().toLowerCase());
            const margin =
              item.suggestedSalePrice && item.price
                ? Math.round(((item.suggestedSalePrice - item.price) / item.suggestedSalePrice) * 100)
                : null;
            return (
              <Card
                key={item.id}
                className="bg-card border-border overflow-hidden flex flex-col py-0 gap-0 transition-colors hover:border-accent/40"
              >
                <div className="relative aspect-square bg-background flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    <ZoomableImage src={item.imageUrl} alt={item.name} className="w-full h-full" />
                  ) : (
                    <PackageSearch className="h-10 w-10 text-muted-foreground opacity-30" />
                  )}
                  <Badge
                    variant="outline"
                    className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 backdrop-blur-sm ${stockInfo.className}`}
                  >
                    {stockInfo.label}
                  </Badge>
                </div>
                <CardHeader className="pb-1.5 pt-2.5 px-2.5 sm:px-3 gap-1">
                  <CardTitle className="text-xs sm:text-sm text-foreground leading-snug line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
                    {item.name}
                  </CardTitle>
                  <Badge variant="outline" className="border-accent/40 text-accent text-[10px] w-fit">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 pb-2.5 px-2.5 sm:px-3 flex-1 flex flex-col">
                  <div className="flex items-baseline justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Custo</span>
                    <span className="text-foreground font-medium">
                      {item.price > 0 ? centsToBRL(item.price) : "—"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-accent/10 border border-accent/20 p-2 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] sm:text-xs text-accent/80 font-medium">
                        Venda sugerida{margin !== null && ` · ${margin}%`}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedValue ?? (item.suggestedSalePrice ? (item.suggestedSalePrice / 100).toFixed(2) : "")}
                        onChange={(e) => setPriceEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="bg-background border-border text-foreground text-sm h-9 font-semibold"
                      />
                      <Button
                        size="sm"
                        className="h-9 px-3 bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
                        disabled={editedValue === undefined || updatePriceMutation.isPending}
                        onClick={() => handleSaveSuggested(item.id)}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>

                  <p className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(item.lastCheckedAt)}
                  </p>

                  <div className="mt-auto pt-1 space-y-1.5">
                  <Button
                    size="sm"
                    className={`w-full h-9 text-xs sm:text-sm ${
                      alreadyMine
                        ? "bg-green-900/30 text-green-400 border border-green-800 hover:bg-green-900/30 cursor-default"
                        : "bg-accent text-accent-foreground hover:bg-accent/90"
                    }`}
                    disabled={alreadyMine || addingId === item.id}
                    onClick={() => handleAddToInventory(item.id)}
                  >
                    {alreadyMine ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Já no estoque
                      </>
                    ) : addingId === item.id ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      <>
                        <PackagePlus className="w-3.5 h-3.5 mr-1" />
                        Cadastrar no estoque
                      </>
                    )}
                  </Button>
                  <div className="flex gap-1.5">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 border-accent/30 text-accent hover:bg-accent/10 px-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Ver no site</span>
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border h-9 w-9 p-0 shrink-0"
                      disabled={refreshingId === item.id}
                      onClick={() => handleRefresh(item.id)}
                      title="Atualizar preço e estoque no site do fornecedor"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === item.id ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-1 pb-2">
          <p className="text-xs text-muted-foreground">Página {currentPage} de {pageCount}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-border h-9"
              disabled={currentPage <= 1}
              onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-border h-9"
              disabled={currentPage >= pageCount}
              onClick={() => { setCurrentPage((p) => Math.min(pageCount, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
