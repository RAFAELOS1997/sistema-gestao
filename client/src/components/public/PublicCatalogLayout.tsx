import { useState } from "react";
import { useLocation } from "wouter";
import { DecorativeDivider } from "@/components/DecorativeDivider";
import { MessageCircle, ShieldCheck, Truck, Menu, User } from "lucide-react";
import { WHATSAPP_LINK } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";

const NAV_ITEMS = [
  { label: "Início", path: "/loja/pedidos" },
  { label: "Pronta Entrega", path: "/loja/produtos" },
  { label: "Seja Parceiro", path: "/parceria" },
];

export default function PublicCatalogLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const meQuery = trpc.account.me.useQuery();
  const accountPath = meQuery.data ? "/conta" : "/conta/entrar";
  const accountLabel = meQuery.data ? "Minha Conta" : "Entrar";

  const goTo = (path: string) => {
    setLocation(path);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Barra de confiança */}
      <div className="bg-[#c9a961] text-[#1a1207]">
        <div className="max-w-6xl mx-auto px-4 h-8 flex items-center justify-center sm:justify-between text-[11px] sm:text-xs font-semibold">
          <div className="hidden sm:flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="w-3 h-3" /> Entrega própria em Ribeirão Preto
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" /> Pagamento seguro via InfinitePay
          </span>
        </div>
      </div>

      {/* Cabeçalho principal */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-[#c9a961]/20">
        <div className="max-w-6xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-3">
          <button onClick={() => goTo("/loja/pedidos")} className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
            <img
              src="/logo.jpeg"
              alt="Toca da Pantera"
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover ring-1 ring-[#c9a961]/40 shrink-0"
            />
            <span className="text-left min-w-0">
              <span className="block text-sm sm:text-lg font-extrabold leading-tight text-foreground truncate">
                Toca da <span className="text-[#c9a961]">Pantera</span>
              </span>
              <span className="hidden sm:block text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                Fé · Proteção · Espiritualidade
              </span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                className={`relative px-4 py-2 text-sm font-semibold transition-colors ${
                  location === item.path ? "text-[#c9a961]" : "text-foreground/80 hover:text-foreground"
                }`}
              >
                {item.label}
                {location === item.path && (
                  <span className="absolute left-4 right-4 -bottom-[1px] h-[2px] bg-[#c9a961] rounded-full" />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => goTo(accountPath)}
              className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-md text-foreground/80 hover:text-foreground transition-colors"
            >
              <User className="w-4 h-4" /> {accountLabel}
            </button>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden border-[#c9a961]/30">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <img src="/logo.jpeg" alt="" className="h-8 w-8 rounded-md object-cover ring-1 ring-[#c9a961]/40" />
                    Toca da Pantera
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-1 px-4">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => goTo(item.path)}
                      className={`text-left px-3 py-3 rounded-md text-sm font-semibold transition-colors ${
                        location === item.path ? "bg-[#c9a961]/15 text-[#c9a961]" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    onClick={() => goTo(accountPath)}
                    className="text-left px-3 py-3 rounded-md text-sm font-semibold text-foreground hover:bg-muted flex items-center gap-2 border-t border-border mt-1 pt-4"
                  >
                    <User className="w-4 h-4 text-accent" /> {accountLabel}
                  </button>
                  <a
                    href={WHATSAPP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="mt-2 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-md text-sm font-semibold bg-accent text-accent-foreground"
                  >
                    <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
                  </a>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-3 sm:p-6">{children}</main>
      <footer className="border-t border-[#c9a961]/20 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col items-center gap-3 text-center">
          <DecorativeDivider tone="gold" className="max-w-xs" />
          <p className="text-sm text-muted-foreground">
            Toca da Pantera — artigos umbandistas e religiosos
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#c9a961]" />
              Entrega própria em Ribeirão Preto
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#c9a961]" />
              Pagamento seguro via InfinitePay
            </span>
          </div>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <MessageCircle className="w-4 h-4" />
            Fale com a gente pelo WhatsApp
          </a>
          <p className="text-xs text-muted-foreground max-w-md">
            Por enquanto entregamos só em Ribeirão Preto (entrega própria). Retirada disponível pra qualquer cidade, mediante combinação.
          </p>
        </div>
      </footer>
    </div>
  );
}
