import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, TrendingUp, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import React from "react";

const CATEGORIES = ["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"] as const;
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

const COLORS = ["#d4af37", "#c9a227", "#bf9517", "#b58707", "#aa7a07"];

const CHANNEL_LABELS: Record<string, string> = {
  fisico: "Loja Física",
  instagram: "Instagram",
  terreiro: "Parceiro",
};

export default function SalesControl() {
  const [startDate, setStartDate] = React.useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("todos");
  const [selectedChannel, setSelectedChannel] = React.useState<string>("todos");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const productsQuery = trpc.products.list.useQuery();
  const salesQuery = trpc.sales.list.useQuery({ limit: 200 });

  // Filtrar vendas por período e categoria
  const filteredSales = React.useMemo(() => {
    if (!salesQuery.data) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return salesQuery.data.filter((sale) => {
      const saleDate = new Date(sale.saleDate);
      const dateMatch = saleDate >= start && saleDate <= end;
      if (!dateMatch) return false;

      // Filtro de canal
      if (selectedChannel !== "todos" && sale.channel !== selectedChannel) return false;

      // Filtro de categoria
      if (selectedCategory !== "todos") {
        const product = productsQuery.data?.find((p) => p.id === sale.productId);
        if (!product || product.category !== selectedCategory) return false;
      }

      return true;
    });
  }, [salesQuery.data, startDate, endDate, selectedCategory, selectedChannel, productsQuery.data]);

  // Calcular totais
  const totals = React.useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalPrice, 0);
    const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalQuantity = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const avgProfit = filteredSales.length > 0 ? totalProfit / filteredSales.length : 0;
    const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    return { totalRevenue, totalProfit, totalQuantity, avgProfit, profitMargin };
  }, [filteredSales]);

  // Dados para gráfico de vendas por categoria
  const categoryData = React.useMemo(() => {
    const data: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};

    filteredSales.forEach((sale) => {
      const product = productsQuery.data?.find((p) => p.id === sale.productId);
      if (product) {
        if (!data[product.category]) {
          data[product.category] = {
            name: CATEGORY_LABELS[product.category],
            quantity: 0,
            revenue: 0,
            profit: 0,
          };
        }
        data[product.category].quantity += sale.quantity;
        data[product.category].revenue += sale.totalPrice;
        data[product.category].profit += sale.profit;
      }
    });

    return Object.values(data);
  }, [filteredSales, productsQuery.data]);

  // Dados para gráfico de vendas por dia
  const dailyData = React.useMemo(() => {
    const data: Record<string, { date: string; revenue: number; profit: number; quantity: number }> = {};

    filteredSales.forEach((sale) => {
      const date = new Date(sale.saleDate).toLocaleDateString("pt-BR");
      if (!data[date]) {
        data[date] = { date, revenue: 0, profit: 0, quantity: 0 };
      }
      data[date].revenue += sale.totalPrice;
      data[date].profit += sale.profit;
      data[date].quantity += sale.quantity;
    });

    return Object.values(data).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredSales]);

  // Top produtos
  const topProducts = React.useMemo(() => {
    const productMap: Record<number, { name: string; quantity: number; revenue: number; profit: number }> = {};

    filteredSales.forEach((sale) => {
      const product = productsQuery.data?.find((p) => p.id === sale.productId);
      if (product) {
        if (!productMap[sale.productId]) {
          productMap[sale.productId] = {
            name: product.name,
            quantity: 0,
            revenue: 0,
            profit: 0,
          };
        }
        productMap[sale.productId].quantity += sale.quantity;
        productMap[sale.productId].revenue += sale.totalPrice;
        productMap[sale.productId].profit += sale.profit;
      }
    });

    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredSales, productsQuery.data]);

  const handleExportCSV = () => {
    const headers = ["Data", "Produto", "Quantidade", "Preço Unit.", "Total", "Lucro", "Canal"];
    const rows = filteredSales.map((sale) => {
      const product = productsQuery.data?.find((p) => p.id === sale.productId);
      return [
        new Date(sale.saleDate).toLocaleDateString("pt-BR"),
        product?.name || `Produto #${sale.productId}`,
        sale.quantity,
        `R$ ${(sale.unitPrice / 100).toFixed(2)}`,
        `R$ ${(sale.totalPrice / 100).toFixed(2)}`,
        `R$ ${(sale.profit / 100).toFixed(2)}`,
        sale.channel === "fisico" ? "Físico" : sale.channel === "terreiro" ? "Parceiro" : "Instagram",
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${startDate}-${endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent rounded-lg">
              <TrendingUp className="w-6 h-6 text-accent-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Controle de Vendas</h1>
          </div>
          <p className="text-muted-foreground">Análise detalhada de vendas, relatórios e performance</p>
        </div>
        <Button
          onClick={async () => {
            setIsRefreshing(true);
            try {
              await Promise.all([
                salesQuery.refetch(),
                productsQuery.refetch(),
              ]);
            } finally {
              setIsRefreshing(false);
            }
          }}
          disabled={isRefreshing}
          variant="outline"
          className="border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {/* Filters */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="startDate" className="text-foreground text-sm">
                Data Inicial
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-foreground text-sm">
                Data Final
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label htmlFor="category" className="text-foreground text-sm">
                Categoria
              </Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category" className="mt-1 bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="todos" className="text-foreground">
                    Todas
                  </SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-foreground">
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="channel" className="text-foreground text-sm">
                Canal
              </Label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger id="channel" className="mt-1 bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="todos" className="text-foreground">
                    Todos
                  </SelectItem>
                  {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-foreground">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end col-span-2 md:col-span-1">
              <Button onClick={handleExportCSV} variant="outline" className="w-full border-accent text-accent hover:bg-accent/10">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Receita Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">R$ {(totals.totalRevenue / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lucro Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">R$ {(totals.totalProfit / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Margem de Lucro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">{totals.profitMargin}%</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Itens Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">{totals.totalQuantity}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendas por Categoria */}
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Vendas por Categoria</CardTitle>
            <CardDescription className="text-muted-foreground">Quantidade e receita</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4af37" }} />
                  <Legend />
                  <Bar dataKey="quantity" fill="#d4af37" name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">Sem dados para o período</div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição de Lucro */}
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Distribuição de Lucro por Categoria</CardTitle>
            <CardDescription className="text-muted-foreground">Proporção de lucro</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#d4af37"
                    dataKey="profit"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4af37" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">Sem dados para o período</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vendas por Dia */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Vendas por Dia</CardTitle>
          <CardDescription className="text-muted-foreground">Evolução de receita e lucro</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4af37" }} />
                <Legend />
                <Bar dataKey="revenue" fill="#d4af37" name="Receita" />
                <Bar dataKey="profit" fill="#b58707" name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">Sem dados para o período</div>
          )}
        </CardContent>
      </Card>

      {/* Top Produtos */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Top 10 Produtos</CardTitle>
          <CardDescription className="text-muted-foreground">Produtos mais vendidos por receita</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-accent">Produto</TableHead>
                    <TableHead className="text-accent text-right">Quantidade</TableHead>
                    <TableHead className="text-accent text-right">Receita</TableHead>
                    <TableHead className="text-accent text-right">Lucro</TableHead>
                    <TableHead className="text-accent text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, index) => (
                    <TableRow key={index} className="border-border hover:bg-background/50">
                      <TableCell className="text-foreground font-medium">{product.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{product.quantity}</TableCell>
                      <TableCell className="text-right text-foreground">R$ {(product.revenue / 100).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-accent font-bold">R$ {(product.profit / 100).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-accent">
                        {product.revenue > 0 ? Math.round((product.profit / product.revenue) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Nenhuma venda no período</div>
          )}
        </CardContent>
      </Card>

      {/* Histórico Completo */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Histórico Completo de Vendas</CardTitle>
          <CardDescription className="text-muted-foreground">{filteredSales.length} vendas no período</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSales.length > 0 ? (
            <>
            {/* Cards no celular */}
            <div className="md:hidden space-y-2">
              {filteredSales.map((sale, index) => {
                const product = productsQuery.data?.find((p) => p.id === sale.productId);
                const margin = sale.totalPrice > 0 ? Math.round((sale.profit / sale.totalPrice) * 100) : 0;
                return (
                  <div key={index} className="p-3 bg-background rounded-lg border border-border space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {product?.name || `Produto #${sale.productId}`}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(sale.saleDate).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{sale.quantity}x R$ {(sale.unitPrice / 100).toFixed(2)} · {CHANNEL_LABELS[sale.channel] ?? sale.channel}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-semibold">R$ {(sale.totalPrice / 100).toFixed(2)}</span>
                      <span className="text-accent font-bold">Lucro R$ {(sale.profit / 100).toFixed(2)} ({margin}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela no computador */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-accent">Data</TableHead>
                    <TableHead className="text-accent">Produto</TableHead>
                    <TableHead className="text-accent">Canal</TableHead>
                    <TableHead className="text-accent text-right">Qtd</TableHead>
                    <TableHead className="text-accent text-right">Preço Unit.</TableHead>
                    <TableHead className="text-accent text-right">Total</TableHead>
                    <TableHead className="text-accent text-right">Lucro</TableHead>
                    <TableHead className="text-accent text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale, index) => {
                    const product = productsQuery.data?.find((p) => p.id === sale.productId);
                    const margin = sale.totalPrice > 0 ? Math.round((sale.profit / sale.totalPrice) * 100) : 0;
                    return (
                      <TableRow key={index} className="border-border hover:bg-background/50">
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(sale.saleDate).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-foreground">{product?.name || `Produto #${sale.productId}`}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{CHANNEL_LABELS[sale.channel] ?? sale.channel}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{sale.quantity}</TableCell>
                        <TableCell className="text-right text-muted-foreground">R$ {(sale.unitPrice / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-foreground">R$ {(sale.totalPrice / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-accent font-bold">R$ {(sale.profit / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-accent">{margin}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Nenhuma venda no período selecionado</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
