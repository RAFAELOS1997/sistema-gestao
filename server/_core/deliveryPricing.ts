// Cálculo de frete por distância real (entrega própria, não Correios) — usa
// o OpenStreetMap (Nominatim, gratuito e sem chave) pra achar a posição de
// cada CEP e calcula a distância em linha reta até o cliente. Só cobre
// Ribeirão Preto e região por enquanto (decisão do Rafael: entrega própria,
// não frete nacional via Correios, que ainda não está configurado).

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TocaDaPantera-Frete/1.0 (sistema.tocadapantera.com.br)";

type LatLon = { lat: number; lon: number };

async function geocodeCep(cep: string): Promise<LatLon | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${NOMINATIM_URL}?postalcode=${clean}&country=Brazil&format=json&limit=1`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Retorna null se não conseguir geocodificar (CEP inválido ou serviço fora
// do ar) — quem chama decide o que fazer (ex.: pedir confirmação manual).
export async function computeStockDeliveryCents(
  destinationCep: string,
  originCep: string,
  perKmCents: number
): Promise<number | null> {
  const [origin, dest] = await Promise.all([geocodeCep(originCep), geocodeCep(destinationCep)]);
  if (!origin || !dest) return null;
  const km = haversineKm(origin, dest);
  return Math.round(km * perKmCents);
}
