import { Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SupplierCatalog from "./SupplierCatalog";
import CrystalsCatalog from "./CrystalsCatalog";

// O Oráculo é a visão de TODOS os fornecedores do catálogo — cada um em sua
// própria aba. Pra adicionar um fornecedor novo: crie um config (como o de
// CrystalsCatalog.tsx) e adicione uma TabsTrigger/TabsContent aqui.
export default function Oraculo() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
          <Sparkles className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">O Oráculo</h1>
          <p className="text-sm text-muted-foreground">
            Produtos, preços e estoque dos seus fornecedores, tudo num só lugar
          </p>
        </div>
      </div>

      <Tabs defaultValue="atacado-umbanda">
        <TabsList>
          <TabsTrigger value="atacado-umbanda">Fornecedor 1 — Atacado de Umbanda</TabsTrigger>
          <TabsTrigger value="cristais-curvelo">Fornecedor 2 — Cristais de Curvelo</TabsTrigger>
        </TabsList>
        <TabsContent value="atacado-umbanda">
          <SupplierCatalog hideHeader />
        </TabsContent>
        <TabsContent value="cristais-curvelo">
          <CrystalsCatalog hideHeader />
        </TabsContent>
      </Tabs>
    </div>
  );
}
