import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, DollarSign, Package, TrendingUp, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#d4af37", "#b8960f", "#8b7500", "#6b5a00", "#4a3a00"];

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

export default function Dashboard() {
  const { user } = useAuth();
  const [startDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [endDate] = useState(() => new Date());

  const { data: dashboardData, isLoading } = trpc.analytics.dashboard.useQuery({ startDate, endDate });
  const { data: categoryData } = trpc.analytics.byCategory.useQuery({ startDate, endDate });
  const { data: products } = trpc.products.list.useQuery();

  const lowStockProducts = (products ?? [])
    .filter((p) => p.currentStock <= p.minimumStock)
    .sort((a, b) => (a.currentStock - a.minimumStock) - (b.currentStock - b.minimumStock));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const categoryChartData = Object.entries(categoryData || {}).map(([name, data]: [string, any]) => ({
    name: CATEGORY_LABELS[name] ?? name,
    stock: (data as any).stock,
    investment: (data as any).investment,
  }));

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Bem-vindo, {user?.name?.split(" ")[0]}! 🐆
          </h1>
          <p className="text-muted-foreground mt-1">Visão geral do seu negócio místico</p>
        </div>
        <Badge variant="outline" className="border-accent/50 text-accent text-xs" style={{color: '#ffffff'}}>
          {monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:border-accent/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total em Estoque</CardTitle>
            <Package className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardData?.totalStock ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">unidades</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-accent/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas no Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardData?.salesCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">transações</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-accent/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro Bruto</CardTitle>
            <DollarSign className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent" style={{color: '#ffffff'}}>
              R$ {(((dashboardData?.totalProfit as number) ?? 0) / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{dashboardData?.profitMargin ?? 0}% de margem</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-accent/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investimento</CardTitle>
            <Zap className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              R$ {(((dashboardData?.totalInvestment as number) ?? 0) / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">em estoque</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de estoque baixo */}
      {lowStockProducts.length > 0 && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-foreground w-full">
            <strong>{lowStockProducts.length} produto(s)</strong> com estoque baixo. Considere fazer reposição:
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
              {lowStockProducts.slice(0, 9).map((p) => (
                <div key={p.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className={`shrink-0 font-semibold ${p.currentStock === 0 ? "text-destructive" : "text-yellow-500"}`}>
                    {p.currentStock === 0 ? "zerado" : `${p.currentStock} de ${p.minimumStock}`}
                  </span>
                </div>
              ))}
            </div>
            {lowStockProducts.length > 9 && (
              <p className="mt-1 text-xs text-muted-foreground">
                …e mais {lowStockProducts.length - 9} produto(s). Veja todos em Gestão de Produtos.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Estoque por Categoria</CardTitle>
            <CardDescription>Distribuição de unidades</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Nenhum produto cadastrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, stock }: any) => `${name}: ${stock}`}
                    outerRadius={90}
                    dataKey="stock"
                  >
                    {categoryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(12,12,12,0.95)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}
                    labelStyle={{ color: "#d4af37" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Investimento por Categoria</CardTitle>
            <CardDescription>Valor total em R$</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Nenhum produto cadastrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.1)" />
                  <XAxis dataKey="name" stroke="rgba(212,175,55,0.5)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="rgba(212,175,55,0.5)" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(12,12,12,0.95)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}
                    formatter={(value: number) => [`R$ ${(value / 100).toFixed(2)}`, "Investimento"]}
                  />
                  <Bar dataKey="investment" fill="#d4af37" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo Financeiro */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Resumo Financeiro</CardTitle>
          <CardDescription>
            Período: {monthStart.toLocaleDateString("pt-BR")} a {today.toLocaleDateString("pt-BR")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-background rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">Receita Total</p>
              <p className="text-2xl font-bold text-accent mt-2" style={{color: '#ffffff'}}>
                R$ {(((dashboardData?.totalRevenue as number) ?? 0) / 100).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-background rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">Custo Total</p>
              <p className="text-2xl font-bold text-foreground mt-2">
                R$ {(((dashboardData?.totalCost as number) ?? 0) / 100).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-background rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
              <p className="text-2xl font-bold text-accent mt-2" style={{color: '#ffffff'}}>
                R$ {(((dashboardData?.totalProfit as number) ?? 0) / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
