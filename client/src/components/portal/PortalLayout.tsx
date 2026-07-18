import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";

const NAV_ITEMS = [
  { label: "Produtos", path: "/parceiros/produtos" },
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
        <div className="flex items-center justify-between px-4 sm:px-6 h-16 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.jpeg" alt="Toca da Pantera" className="h-10 w-10 rounded-lg object-cover shrink-0" />
            <div className="min-w-0">
              <p className="font-bold tracking-tight text-accent text-sm leading-none">Portal do Parceiro</p>
              <p className="text-xs text-muted-foreground truncate mt-1">{terreiro?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {terreiro?.tierName && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/20 text-accent border border-accent/30">
                Plano {terreiro.tierName}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 -mb-px">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${
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
      <main className="max-w-6xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
