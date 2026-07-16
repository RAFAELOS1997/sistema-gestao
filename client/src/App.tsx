import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import OracleConsultation from "./pages/OracleConsultation";
import Products from "./pages/Products";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import SalesControl from "./pages/SalesControl";
import SettingsPage from "./pages/Settings";
import Suppliers from "./pages/Suppliers";
import { Users } from "./pages/Users";
import Receipts from "./pages/Receipts";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
      <Route path="/oracle">
        <DashboardLayout>
          <OracleConsultation />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
