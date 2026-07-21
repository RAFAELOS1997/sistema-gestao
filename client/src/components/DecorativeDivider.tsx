// Divisor decorativo — um emblema simples (círculo + raios + ponto central,
// no estilo de um ponto riscado abstrato) entre linhas em gradiente. Só
// enfeite visual, sem pretensão de representar símbolo religioso nenhum
// específico. Tom "gold" usa o dourado antigo da própria logo da loja (não
// é o --accent genérico do resto do sistema) pra reforçar a identidade
// visual nas páginas voltadas pro público.
export function DecorativeDivider({
  className = "",
  tone = "accent",
}: {
  className?: string;
  tone?: "accent" | "gold";
}) {
  const colorClass = tone === "gold" ? "text-[#c9a961]" : "text-accent";
  const lineFrom = tone === "gold" ? "via-[#c9a961]/50 to-[#c9a961]/50" : "via-accent/40 to-accent/40";

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className={`h-px flex-1 bg-gradient-to-r from-transparent ${lineFrom}`} />
      <svg width="28" height="28" viewBox="0 0 28 28" className={`${colorClass} shrink-0`}>
        <circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <circle cx="14" cy="14" r="2.5" fill="currentColor" opacity="0.8" />
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * Math.PI) / 4;
          const x1 = 14 + Math.cos(angle) * 11.5;
          const y1 = 14 + Math.sin(angle) * 11.5;
          const x2 = 14 + Math.cos(angle) * 13.5;
          const y2 = 14 + Math.sin(angle) * 13.5;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" opacity="0.4" />;
        })}
      </svg>
      <span className={`h-px flex-1 bg-gradient-to-l from-transparent ${lineFrom}`} />
    </div>
  );
}
