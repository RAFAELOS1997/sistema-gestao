import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";

const NAV_ITEMS = [
  { label: "Produtos", path: "/parceiros/produtos" },
  { label: "Gerar Pedidos", path: "/parceiros/pedidos" },
  { label: "Comodato", path: "/parceiros/comodato" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, terreiro, logout } = usePartnerAuth({ redirectOnUnauthenticated: true });
  const [location, setLocation] = useLocation();

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 h-14 sm:h-16 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/logo.jpeg" alt="Toca da Pantera" className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg object-cover shrink-0" />
            <div className="min-w-0">
              <p className="font-bold tracking-tight text-accent text-sm leading-none">Portal do Parceiro</p>
              <p className="text-xs text-muted-foreground truncate mt-1">{terreiro?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {terreiro?.tierName && (
              <span className="px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium bg-accent/20 text-accent border border-accent/30 whitespace-nowrap">
                <span className="hidden sm:inline">Plano </span>
                {terreiro.tierName}
              </span>
            )}
            <Button variant="outline" size="icon-sm" className="h-9 w-9 sm:h-9 sm:w-auto sm:px-3" onClick={logout} title="Sair">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-2 sm:px-6 flex gap-1 -mb-px">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex-1 sm:flex-none text-center px-3 py-3 sm:py-2 text-sm border-b-2 transition-colors ${
                location === item.path
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-3 sm:p-6">{children}</main>
    </div>
  );
}
