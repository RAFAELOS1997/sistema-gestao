import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ZoomableImage } from "@/components/ZoomableImage";
import { trpc } from "@/lib/trpc";
import { Search } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  guias: "Guias",
  pulseiras: "Pulseiras",
  velas: "Velas",
  incensos: "Incensos",
  ervas: "Ervas",
  imagens: "Imagens",
  ferramentas: "Ferramentas",
  vestuario: "Vestuário",
  livros: "Livros",
  pedras: "Pedras",
  outros: "Outros",
};

export default function PortalProducts() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");

  const productsQuery = trpc.portal.products.list.useQuery();
  const products = productsQuery.data ?? [];

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "todas" || p.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Produtos em Estoque</h1>
        <p className="text-muted-foreground text-sm">Confira o que está disponível e o preço de venda</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setCategory("todas")}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap border transition-colors ${
              category === "todas" ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap border transition-colors ${
                category === cat ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>

      {productsQuery.isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando produtos...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground max-w-md mx-auto">
          Ainda não há produtos liberados para o seu plano. Fale com a Toca da Pantera — assim que seu plano tiver
          preços definidos, os produtos aparecem aqui.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <div key={product.id} className="p-3 bg-card border border-border rounded-lg">
              <div className="mb-2 h-24 bg-background rounded flex items-center justify-center text-muted-foreground text-sm overflow-hidden">
                {product.imageUrl ? (
                  <ZoomableImage src={product.imageUrl} alt={product.name} className="w-full h-full" />
                ) : (
                  (CATEGORY_LABELS[product.category] ?? product.category).toUpperCase()
                )}
              </div>
              <h3 className="font-semibold text-sm text-foreground leading-snug min-h-[2.5rem]">{product.name}</h3>
              <p className="text-xs mt-0.5 text-muted-foreground">Em estoque: {product.currentStock}</p>
              <p className="text-lg font-bold mt-1 text-accent">R$ {(product.salePrice / 100).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
