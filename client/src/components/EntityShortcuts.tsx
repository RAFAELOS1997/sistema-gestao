// Atalhos por entidade/linha de trabalho — cada um remete às cores
// tradicionais da Umbanda e, ao clicar, filtra o catálogo pelos produtos
// daquela cor (velas, guias...). Não representa a entidade em si (sem
// imagem de nenhuma figura sagrada) — só a cor e uma frase curta e
// respeitosa, ligando direto aos produtos de verdade que a loja vende.
// Clicar de novo no mesmo cartão desmarca (volta ao normal).
export const ENTITIES = [
  {
    name: "Exu",
    desc: "Guardião dos caminhos e das encruzilhadas",
    colors: ["#8b1a1a", "#111111"],
    searchTerm: "VERMELHA/PRETA",
  },
  {
    name: "Pombagira",
    desc: "Mulher de liberdade, amor e força feminina",
    colors: ["#b5124e", "#8b1a1a"],
    searchTerm: "VERMELHA",
  },
  {
    name: "Caboclo",
    desc: "Força da mata, da natureza e da cura",
    colors: ["#2e6b3e", "#6b4a2e"],
    searchTerm: "VERDE",
  },
  {
    name: "Malandragem",
    desc: "Sorte e proteção nas ruas — Zé Pilintra",
    colors: ["#e6e6e6", "#8b1a1a"],
    searchTerm: "BRANCA/VERMELHA",
  },
  {
    name: "Orixás",
    desc: "Oxalá e toda a linha dos Orixás",
    colors: ["#f5f5f0", "#c9a961"],
    searchTerm: "BRANCA",
  },
] as const;

export type EntityShortcut = (typeof ENTITIES)[number];

export function EntityShortcuts({
  activeName,
  onSelect,
}: {
  activeName: string | null;
  onSelect: (entity: EntityShortcut | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Encontre pro seu caminho
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
        {ENTITIES.map((entity) => {
          const isActive = activeName === entity.name;
          return (
            <button
              key={entity.name}
              onClick={() => onSelect(isActive ? null : entity)}
              className={`shrink-0 w-36 text-left rounded-lg border bg-card overflow-hidden transition-all ${
                isActive
                  ? "shadow-md"
                  : "border-border hover:border-[#c9a961]/50 hover:shadow-md hover:shadow-[#c9a961]/10"
              }`}
              style={isActive ? { borderColor: entity.colors[0], boxShadow: `0 0 0 1px ${entity.colors[0]}` } : undefined}
            >
              <div className="h-2 flex">
                <span className="flex-1" style={{ backgroundColor: entity.colors[0] }} />
                <span className="flex-1" style={{ backgroundColor: entity.colors[1] }} />
              </div>
              <div className="p-2.5">
                <p className="font-semibold text-sm text-foreground">{entity.name}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{entity.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
