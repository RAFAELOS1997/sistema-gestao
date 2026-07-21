import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { ZoomableImage } from "@/components/ZoomableImage";
import { trpc } from "@/lib/trpc";
import { Search, Plus, Minus, ShoppingCart } from "lucide-react";
import { usePortalCart } from "@/contexts/PortalCartContext";
import { CATEGORY_LABELS, categoryIcon } from "@/lib/categoryMeta";

export default function PortalProducts() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");
  const { getQuantity, setQuantity, itemCount } = usePortalCart();

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
    <div className="space-y-5 sm:space-y-6 pb-20">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">Produtos em Estoque</h1>
        <p className="text-muted-foreground text-sm">
          Confira o que está disponível, o preço do seu plano, e monte seu pedido direto aqui
          {!productsQuery.isLoading && products.length > 0 && (
            <span> — {filtered.length === products.length ? `${products.length} produto(s)` : `${filtered.length} de ${products.length} produto(s)`}</span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="pl-9 h-10 text-base"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          <button
            onClick={() => setCategory("todas")}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition-colors shrink-0 ${
              category === "todas" ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => {
            const Icon = categoryIcon(cat);
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition-colors shrink-0 flex items-center gap-1.5 ${
                  category === cat ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-accent/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            );
          })}
        </div>
      </div>

      {productsQuery.isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando produtos...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 px-4 text-muted-foreground text-sm max-w-md mx-auto">
          Ainda não há produtos liberados para o seu plano. Fale com a Toca da Pantera — assim que seu plano tiver
          preços definidos, os produtos aparecem aqui.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum produto encontrado</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((product) => {
            const qty = getQuantity("estoque", product.id);
            const CategoryIcon = categoryIcon(product.category);
            return (
              <div
                key={product.id}
                className="bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:shadow-lg hover:shadow-[#c9a961]/15 hover:border-[#c9a961]/40 hover:-translate-y-0.5"
              >
                <div className="aspect-square bg-background flex items-center justify-center text-muted-foreground text-xs overflow-hidden">
                  {product.imageUrl ? (
                    <ZoomableImage src={product.imageUrl} alt={product.name} className="w-full h-full" />
                  ) : (
                    <CategoryIcon className="w-8 h-8 text-accent/40" />
                  )}
                </div>
                <div className="p-2.5 sm:p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground leading-snug line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] break-words">
                    {product.name}
                  </h3>
                  <p className="text-[11px] sm:text-xs mt-1 text-muted-foreground">Em estoque: {product.currentStock}</p>
                  <p className="text-base sm:text-lg font-bold mt-1 text-accent">R$ {(product.salePrice / 100).toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <button
                      onClick={() => setQuantity("estoque", product.id, qty - 1)}
                      disabled={qty === 0}
                      className="p-1.5 rounded bg-background border border-border text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-base font-bold text-foreground">{qty}</span>
                    <button
                      onClick={() => setQuantity("estoque", product.id, qty + 1)}
                      disabled={qty >= product.currentStock}
                      className="p-1.5 rounded bg-accent text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {itemCount > 0 && (
        <Link href="/parceiros/pedidos">
          <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-80 z-30 bg-accent text-accent-foreground rounded-lg shadow-xl px-4 py-3 flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShoppingCart className="w-4 h-4" />
              {itemCount} item(ns) no pedido
            </span>
            <span className="text-sm font-semibold">Revisar e enviar →</span>
          </div>
        </Link>
      )}
    </div>
  );
}
