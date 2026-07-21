import { useLocation } from "wouter";

const NAV_ITEMS = [
  { label: "Produtos", path: "/loja/produtos" },
  { label: "Fazer Pedidos", path: "/loja/pedidos" },
];

export default function PublicCatalogLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 h-14 sm:h-16 max-w-6xl mx-auto">
          <img src="/logo.jpeg" alt="Toca da Pantera" className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg object-cover shrink-0" />
          <p className="font-bold tracking-tight text-accent text-sm sm:text-base leading-none">Toca da Pantera</p>
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
