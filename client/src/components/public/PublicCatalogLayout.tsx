import { useLocation } from "wouter";
import { DecorativeDivider } from "@/components/DecorativeDivider";
import { MessageCircle } from "lucide-react";
import { WHATSAPP_LINK } from "@/lib/contact";

const NAV_ITEMS = [
  { label: "Pronta Entrega", path: "/loja/produtos" },
  { label: "Fazer Pedidos", path: "/loja/pedidos" },
  { label: "Seja Parceiro", path: "/parceria" },
];

export default function PublicCatalogLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/25 via-accent/5 to-transparent pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{ background: "radial-gradient(circle at 50% -10%, var(--accent) 0%, transparent 55%)" }}
        />
        <div className="relative max-w-5xl mx-auto px-4 pt-8 pb-6 sm:pt-12 sm:pb-8 flex flex-col items-center text-center">
          <img
            src="/logo.jpeg"
            alt="Toca da Pantera"
            className="h-24 w-24 sm:h-32 sm:w-32 rounded-2xl object-cover shadow-2xl shadow-accent/30 ring-4 ring-accent/40"
          />
          <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Toca da <span className="text-accent">Pantera</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-md">
            Artigos umbandistas e religiosos — confira nossos produtos e faça seu pedido direto pelo site
          </p>

          <nav className="mt-6 inline-flex gap-1 p-1 rounded-full bg-card border border-border shadow-lg">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`px-5 sm:px-6 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                  location === item.path
                    ? "bg-accent text-accent-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="relative max-w-xs mx-auto pb-4 sm:pb-5">
          <DecorativeDivider />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-3 sm:p-6">{children}</main>
      <footer className="border-t border-border mt-8">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col items-center gap-3 text-center">
          <DecorativeDivider className="max-w-xs" />
          <p className="text-sm text-muted-foreground">
            Toca da Pantera — artigos umbandistas e religiosos
          </p>
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
            Por enquanto entregamos só em Ribeirão Preto e região. Em breve vamos atender o Brasil todo!
          </p>
        </div>
      </footer>
    </div>
  );
}
