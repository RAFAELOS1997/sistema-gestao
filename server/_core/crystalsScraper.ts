// Busca produtos no site do fornecedor Cristais de Curvelo
// (cristaisdecurvelo.com.br, plataforma Nuvemshop). Diferente do fornecedor
// de artigos de umbanda, aqui os dados vêm de JSON já embutido no HTML —
// mais confiável que parsear texto/preço solto.

// Cabeçalhos parecidos com os de um navegador real — sites atrás de
// Cloudflare (como este) costumam bloquear/desafiar requisições com
// cabeçalhos claramente automatizados (só User-Agent, sem Accept etc.).
const FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
};
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

  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`O site do fornecedor recusou o acesso (status ${response.status}) em ${url}`);
  }

  const html = await response.text();
  const items = parseJsonLdItems(html);
  // Página 1 sem NENHUM produto reconhecível é sinal de erro (bloqueio,
  // captcha, mudança de layout) — não de categoria vazia de verdade, já
  // que /atacado/ sempre tem produtos. Página >1 vazia é o fim normal da
  // paginação, tratado por quem chama essa função.
  if (page === 1 && items.length === 0) {
    throw new Error(
      `Não encontrei nenhum produto reconhecível em ${url} — o site pode ter bloqueado o acesso automático ou mudado a estrutura da página.`
    );
  }
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
  const response = await fetch(url, { headers: FETCH_HEADERS });
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
