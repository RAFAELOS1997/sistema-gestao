import { Gem } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import SupplierCatalog, { SupplierCatalogConfig } from "./SupplierCatalog";

// Fornecedor Cristais de Curvelo (cristaisdecurvelo.com.br) — cobre só a
// seção "Atacado" do site, que é onde os produtos já vêm com preço de
// revenda aplicado (o resto do catálogo é preço de varejo, não serve pra
// comprar pra revenda).
const CRYSTALS_IMPORT_SOURCES = [
  { path: "atacado", category: "pedras", label: "Atacado" },
];

export default function CrystalsCatalog() {
  const { data: supplierId, isLoading } = trpc.supplierCatalog.crystalsSupplierId.useQuery();

  if (isLoading || !supplierId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const config: SupplierCatalogConfig = {
    supplierId,
    sourceKey: "cristais_curvelo",
    title: "Sabedoria dos Cristais",
    subtitle: "Catálogo de atacado da Cristais de Curvelo — pedras, cristais e acessórios",
    icon: Gem,
    importSources: CRYSTALS_IMPORT_SOURCES,
  };

  return <SupplierCatalog config={config} />;
}
