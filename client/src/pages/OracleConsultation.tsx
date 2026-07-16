import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Target, Zap } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

type Category = "umbanda" | "candomble" | "quimbanda" | "catolicismo" | "geral";

interface OracleResult {
  topProducts: Array<{
    name: string;
    description: string;
    estimatedMargin: number;
  }>;
  overallMargin: number;
  opportunityScore: number;
  demandTrend: "Alta" | "Média" | "Baixa";
  marketInsights: string[];
}

export default function OracleConsultation() {
  const [selectedCategory, setSelectedCategory] = React.useState<Category>("geral");
  const [result, setResult] = React.useState<OracleResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const consultMutation = trpc.oracle.consult.useMutation();

  const handleConsult = async () => {
    setIsLoading(true);
    try {
      const analysis = await consultMutation.mutateAsync({
        category: selectedCategory,
      });
      setResult(analysis);
      toast.success("Análise do Oráculo concluída com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao consultar o Oráculo");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDemandColor = (trend: string) => {
    switch (trend) {
      case "Alta":
        return "bg-green-950 text-green-300";
      case "Média":
        return "bg-yellow-950 text-yellow-300";
      case "Baixa":
        return "bg-red-950 text-red-300";
      default:
        return "bg-gray-950 text-gray-300";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const categories = [
    { value: "umbanda" as Category, label: "🟣 Umbanda" },
    { value: "candomble" as Category, label: "🟡 Candomblé" },
    { value: "quimbanda" as Category, label: "🔴 Quimbanda" },
    { value: "catolicismo" as Category, label: "🔵 Catolicismo" },
    { value: "geral" as Category, label: "✨ Geral" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-600 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">O Oráculo</h1>
        </div>
        <p className="text-muted-foreground">Análise Inteligente de Mercado de Artigos Religiosos</p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        <Card className="border border-border shadow-lg bg-card mb-8">
          <CardHeader className="bg-card border-b border-border">
            <CardTitle className="text-foreground">Bem-vindo ao O Oráculo</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sistema inteligente de análise de mercado para artigos religiosos
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-foreground mb-6">
              O Oráculo é um módulo especializado que analisa o mercado de artigos religiosos em tempo real, fornecendo
              insights sobre os melhores produtos para revenda nas categorias:
            </p>

            {/* Categories Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-purple-950 rounded-lg border border-purple-700">
                <h3 className="font-bold text-purple-300 mb-1">🟣 Umbanda</h3>
                <p className="text-sm text-purple-400">Itens rituais e orixás</p>
              </div>
              <div className="p-4 bg-yellow-950 rounded-lg border border-yellow-700">
                <h3 className="font-bold text-yellow-300 mb-1">🟡 Candomblé</h3>
                <p className="text-sm text-yellow-400">Itens sagrados e guias</p>
              </div>
              <div className="p-4 bg-red-950 rounded-lg border border-red-700">
                <h3 className="font-bold text-red-300 mb-1">🔴 Quimbanda</h3>
                <p className="text-sm text-red-400">Talismãs e objetos</p>
              </div>
              <div className="p-4 bg-blue-950 rounded-lg border border-blue-700">
                <h3 className="font-bold text-blue-300 mb-1">🔵 Catolicismo</h3>
                <p className="text-sm text-blue-400">Santos e rosários</p>
              </div>
            </div>

            {/* Category Selection */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-3">Selecione uma categoria para análise:</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={selectedCategory === cat.value ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat.value)}
                    disabled={isLoading}
                    className={selectedCategory === cat.value ? "bg-accent text-accent-foreground" : ""}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Clique no botão abaixo para disparar uma análise de mercado e receber recomendações de produtos com
              melhor custo-benefício.
            </p>

            {/* Consultar Button */}
            <Button
              size="lg"
              onClick={handleConsult}
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Consultando..." : "Consultar o Oráculo"}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in-50 duration-500">
            {/* Main KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <Target className="w-5 h-5 text-accent" />
                    Score de Oportunidade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold ${getScoreColor(result.opportunityScore)}`}>
                    {result.opportunityScore}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Potencial de lucro</p>
                </CardContent>
              </Card>

              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent" />
                    Margem Geral
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-accent">{result.overallMargin}%</div>
                  <p className="text-sm text-muted-foreground mt-2">Lucro esperado</p>
                </CardContent>
              </Card>

              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    Tendência
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={`${getDemandColor(result.demandTrend)} text-base py-1 px-3`}>
                    {result.demandTrend}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">Demanda de mercado</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Products */}
            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Top 3 Produtos Recomendados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.topProducts.map((product, idx) => (
                    <div key={idx} className="p-4 bg-background rounded-lg border border-border">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-foreground">{idx + 1}. {product.name}</h4>
                        <Badge className="bg-accent text-accent-foreground">{product.estimatedMargin}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Market Insights */}
            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Insights de Mercado</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.marketInsights.map((insight, idx) => (
                    <li key={idx} className="flex gap-3 text-foreground">
                      <span className="text-accent font-bold">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Action Button */}
            <Button
              size="lg"
              onClick={() => setResult(null)}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Nova Consulta
            </Button>
          </div>
        )}

        {/* Info Cards */}
        {!result && (
          <div className="grid grid-cols-3 gap-4 mt-8">
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-foreground">📊 Score de Oportunidade</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Avaliação de 0-100 indicando o potencial de lucro de cada produto
              </CardContent>
            </Card>
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-foreground">💰 Margem Estimada</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Percentual de lucro esperado com base na análise de mercado
              </CardContent>
            </Card>
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-foreground">📈 Tendência de Demanda</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Indicação se a demanda está em alta, média ou baixa
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
