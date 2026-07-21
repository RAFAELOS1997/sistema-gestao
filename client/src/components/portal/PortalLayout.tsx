import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { ForcePasswordChangeDialog } from "./ForcePasswordChangeDialog";

const NAV_ITEMS = [
  { label: "Produtos", path: "/parceiros/produtos" },
  { label: "Gerar Pedidos", path: "/parceiros/pedidos" },
  { label: "Comodato", path: "/parceiros/comodato" },
  { label: "Minha Conta", path: "/parceiros/conta" },
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
      <div className="h-1 bg-gradient-to-r from-[#c9a961]/20 via-[#c9a961] to-[#c9a961]/20" />
      <header className="border-b border-[#c9a961]/15 bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 h-16 sm:h-[4.5rem] max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img
              src="/logo.jpeg"
              alt="Toca da Pantera"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-cover shrink-0 ring-2 ring-[#c9a961]/40 shadow-md shadow-[#c9a961]/10"
            />
            <div className="min-w-0">
              <p className="font-bold tracking-tight text-[#c9a961] text-sm sm:text-base leading-none">Portal do Parceiro</p>
              <p className="text-xs text-muted-foreground truncate mt-1.5">{terreiro?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {terreiro?.logoUrl && (
              <img
                src={terreiro.logoUrl}
                alt={terreiro.name}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover ring-1 ring-border shrink-0"
              />
            )}
            {terreiro?.tierName && (
              <span className="px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium bg-[#c9a961]/15 text-[#c9a961] border border-[#c9a961]/30 whitespace-nowrap">
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
              className={`flex-1 sm:flex-none text-center px-3 py-3 sm:py-2.5 text-sm border-b-2 transition-colors ${
                location === item.path
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-3 sm:p-6">{children}</main>
      <ForcePasswordChangeDialog open={!!terreiro?.mustChangePassword} loggedInAsName={terreiro?.loggedInAsName ?? undefined} />
    </div>
  );
}
