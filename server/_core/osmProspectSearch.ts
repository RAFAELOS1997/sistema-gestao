// Busca automática de terreiros/centros de Umbanda e Candomblé usando o
// OpenStreetMap (Overpass API) — banco de dados de mapas aberto e gratuito,
// sem chave de API nem cadastro. Cobertura é menor que a do Google Maps
// (depende de voluntários terem cadastrado o local no mapa), mas é o único
// jeito de ter uma busca de verdade rodando dentro do sistema sem custo.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "TocaDaPantera-ProspeccaoParceiros/1.0 (sistema.tocadapantera.com.br)";

export type OsmProspect = {
  name: string;
  address: string | null;
  lat: number;
  lon: number;
};

function buildQuery(city: string): string {
  return `[out:json][timeout:25];
area["name"="${city}"]->.searchArea;
(
  node["amenity"="place_of_worship"]["religion"~"umbanda|candomble|afro-brasileira",i](area.searchArea);
  node["name"~"terreiro|umbanda|candombl|ax[ée] ",i](area.searchArea);
  way["amenity"="place_of_worship"]["religion"~"umbanda|candomble|afro-brasileira",i](area.searchArea);
);
out center;`;
}

function formatAddress(tags: Record<string, string>): string | null {
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const neighborhood = tags["addr:suburb"] ?? tags["addr:neighbourhood"];
  const parts = [street && number ? `${street}, ${number}` : street, neighborhood].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}

export async function searchOsmTerreiros(city: string): Promise<OsmProspect[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
      body: buildQuery(city),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass API respondeu ${response.status}`);
    const data = await response.json();
    const elements: any[] = data.elements ?? [];
    return elements
      .map((el) => {
        const tags = el.tags ?? {};
        const name = tags.name || tags["name:pt"];
        if (!name) return null;
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null) return null;
        return { name: String(name).trim(), address: formatAddress(tags), lat, lon };
      })
      .filter((x): x is OsmProspect => x !== null);
  } finally {
    clearTimeout(timeout);
  }
}
