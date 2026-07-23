// Busca produtos no site do fornecedor Cristais de Curvelo
// (cristaisdecurvelo.com.br, plataforma Nuvemshop). Diferente do fornecedor
// de artigos de umbanda, aqui os dados vêm de JSON já embutido no HTML —
// mais confiável que parsear texto/preço solto.

const UA = "Mozilla/5.0 (compatible; TocaDaPanteraCatalogBot/1.0)";
const BASE = "https://www.cristaisdecurvelo.com.br/";

export type CrystalsListingItem = {
  name: string;
  slug: string;
  sourceUrl: string;
  priceCents: number | null;
  imageUrl: string | null;
  unavailable: boolean;
};

// Cada card de produto (tanto na listagem quanto no carrossel de
// "relacionados" de uma página de produto) vem com um bloco JSON-LD próprio
// marcado com data-component='structured-data.item'.
function parseJsonLdItems(html: string): CrystalsListingItem[] {
  const re = /<script type="application\/ld\+json" data-component='structured-data\.item'>([\s\S]*?)<\/script>/g;
  const items: CrystalsListingItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let data: any;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const url: string | undefined = data?.offers?.url;
    if (!data?.name || !url) continue;
    const priceRaw = data?.offers?.price;
    const priceCents = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null;
    const availability: string = data?.offers?.availability ?? "";
    const slug = url.replace(BASE, "").replace(/^produtos\//, "").replace(/\/$/, "");
    const image = Array.isArray(data.image) ? data.image[0] : data.image;
    items.push({
      name: String(data.name).trim(),
      slug,
      sourceUrl: url,
      priceCents,
      imageUrl: typeof image === "string" ? image : null,
      unavailable: !/InStock/i.test(availability),
    });
  }
  return items;
}

export async function fetchCrystalsListingPage(
  categoryPath: string,
  page: number
): Promise<{ items: CrystalsListingItem[]; hasNext: boolean }> {
  const path = categoryPath.endsWith("/") ? categoryPath : `${categoryPath}/`;
  const url = page === 1 ? `${BASE}${path}` : `${BASE}${path}?page=${page}`;

  const response = await fetch(url, { headers: { "user-agent": UA } });
  if (!response.ok) return { items: [], hasNext: false };

  const html = await response.text();
  const items = parseJsonLdItems(html);
  // O tema não expõe link de "próxima página" no HTML (é carregado por JS) —
  // segue tentando enquanto a página devolver produtos; a página vazia (0
  // itens) é o sinal de fim, tratado por quem chama essa função.
  return { items, hasNext: items.length > 0 };
}

// Busca preço/estoque atuais de UM produto. A página do produto embute o
// próprio preço/estoque num script `LS.variants = [...]` (JSON puro, sem
// escape de aspas — diferente do JSON-LD dos cards, que só traz produtos
// "relacionados", nunca o produto principal da página).
export async function fetchCrystalsProductStatus(
  url: string
): Promise<{ price: number | null; stockStatus: "disponivel" | "indisponivel" | "desconhecido" }> {
  const response = await fetch(url, { headers: { "user-agent": UA } });
  if (!response.ok) {
    throw new Error(`Não foi possível acessar a página do fornecedor (status ${response.status})`);
  }

  const html = await response.text();
  const match = html.match(/LS\.variants\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return { price: null, stockStatus: "desconhecido" };

  let variants: any[];
  try {
    variants = JSON.parse(match[1]);
  } catch {
    return { price: null, stockStatus: "desconhecido" };
  }

  const variant = variants[0];
  if (!variant) return { price: null, stockStatus: "desconhecido" };

  return {
    price: typeof variant.price_number_raw === "number" ? variant.price_number_raw : null,
    stockStatus: variant.available ? "disponivel" : "indisponivel",
  };
}
