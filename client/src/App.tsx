import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import PortalLayout from "./components/portal/PortalLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Partners from "./pages/Partners";
import PartnerDetail from "./pages/PartnerDetail";
import PartnerTiers from "./pages/PartnerTiers";
import PortalConsignments from "./pages/portal/PortalConsignments";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalProducts from "./pages/portal/PortalProducts";
import PortalGenerateOrder from "./pages/portal/PortalGenerateOrder";
import PartnerOrders from "./pages/PartnerOrders";
import PublicCatalogLayout from "./components/public/PublicCatalogLayout";
import PublicCatalogProducts from "./pages/public/PublicCatalogProducts";
import PublicGenerateOrder from "./pages/public/PublicGenerateOrder";
import PublicOrders from "./pages/PublicOrders";
import { PortalCartProvider } from "./contexts/PortalCartContext";
import { PublicCartProvider } from "./contexts/PublicCartContext";
import { ProntaEntregaCartProvider } from "./contexts/ProntaEntregaCartContext";
import PriceReview from "./pages/PriceReview";
import SupplierCatalog from "./pages/SupplierCatalog";
import AuditPedido7335 from "./pages/AuditPedido7335";
import Products from "./pages/Products";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import SalesControl from "./pages/SalesControl";
import SettingsPage from "./pages/Settings";
import PaymentSettings from "./pages/PaymentSettings";
import Suppliers from "./pages/Suppliers";
import { Users } from "./pages/Users";
import Receipts from "./pages/Receipts";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/products">
        <DashboardLayout>
          <Products />
        </DashboardLayout>
      </Route>
      <Route path="/price-review">
        <DashboardLayout>
          <PriceReview />
        </DashboardLayout>
      </Route>
      <Route path="/purchases">
        <DashboardLayout>
          <Purchases />
        </DashboardLayout>
      </Route>
      <Route path="/sales">
        <DashboardLayout>
          <Sales />
        </DashboardLayout>
      </Route>
      <Route path="/sales-control">
        <DashboardLayout>
          <SalesControl />
        </DashboardLayout>
      </Route>
      <Route path="/receipts">
        <DashboardLayout>
          <Receipts />
        </DashboardLayout>
      </Route>
      <Route path="/oraculo">
        <DashboardLayout>
          <SupplierCatalog />
        </DashboardLayout>
      </Route>
      <Route path="/conferencia-pedido-7335">
        <DashboardLayout>
          <AuditPedido7335 />
        </DashboardLayout>
      </Route>
      <Route path="/pagamentos">
        <DashboardLayout>
          <PaymentSettings />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <SettingsPage />
        </DashboardLayout>
      </Route>
      <Route path="/suppliers">
        <DashboardLayout>
          <Suppliers />
        </DashboardLayout>
      </Route>
      <Route path="/users">
        <DashboardLayout>
          <Users />
        </DashboardLayout>
      </Route>
      <Route path="/parceiros-terreiros">
        <DashboardLayout>
          <Partners />
        </DashboardLayout>
      </Route>
      <Route path="/parceiros-terreiros/:id">
        <DashboardLayout>
          <PartnerDetail />
        </DashboardLayout>
      </Route>
      <Route path="/planos-parceria">
        <DashboardLayout>
          <PartnerTiers />
        </DashboardLayout>
      </Route>
      <Route path="/pedidos-parceiros">
        <DashboardLayout>
          <PartnerOrders />
        </DashboardLayout>
      </Route>
      <Route path="/pedidos-site">
        <DashboardLayout>
          <PublicOrders />
        </DashboardLayout>
      </Route>

      {/* Catálogo Público — sem login, aberto pra qualquer visitante */}
      <Route path="/loja" component={() => <Redirect to="/loja/produtos" />} />
      <Route path="/loja/produtos">
        <PublicCatalogLayout>
          <PublicCatalogProducts />
        </PublicCatalogLayout>
      </Route>
      <Route path="/loja/pedidos">
        <PublicCatalogLayout>
          <PublicGenerateOrder />
        </PublicCatalogLayout>
      </Route>

      {/* Portal do Parceiro — login e área separados dos usuários do sistema */}
      <Route path="/parceiros" component={() => <Redirect to="/parceiros/produtos" />} />
      <Route path="/parceiros/login" component={PortalLogin} />
      <Route path="/parceiros/produtos">
        <PortalLayout>
          <PortalProducts />
        </PortalLayout>
      </Route>
      <Route path="/parceiros/pedidos">
        <PortalLayout>
          <PortalGenerateOrder />
        </PortalLayout>
      </Route>
      <Route path="/parceiros/comodato">
        <PortalLayout>
          <PortalConsignments />
        </PortalLayout>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <PortalCartProvider>
            <PublicCartProvider>
              <ProntaEntregaCartProvider>
                <Router />
              </ProntaEntregaCartProvider>
            </PublicCartProvider>
          </PortalCartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
