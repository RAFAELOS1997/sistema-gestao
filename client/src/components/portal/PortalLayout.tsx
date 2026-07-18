import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, terreiro, logout } = usePartnerAuth({ redirectOnUnauthenticated: true });

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
          <Button variant="outline" size="sm" onClick={logout} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
