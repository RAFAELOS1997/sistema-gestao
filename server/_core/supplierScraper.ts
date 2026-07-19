// Busca o preço e status de estoque atuais de um produto direto na página
// pública do fornecedor. Roda sob demanda (botão "Atualizar" no catálogo),
// não em lote, para não sobrecarregar o site do fornecedor.

export type SupplierProductStatus = {
  price: number | null; // em centavos
  stockStatus: "disponivel" | "indisponivel" | "desconhecido";
};

export async function fetchSupplierProductStatus(url: string): Promise<SupplierProductStatus> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TocaDaPanteraCatalogBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Não foi possível acessar a página do fornecedor (status ${response.status})`);
  }

  const html = await response.text();

  // Preço: primeiro "R$ X,XX" que aparecer fora do carrossel de recomendação
  // (o preço principal do produto aparece antes da seção "Recomendação").
  const mainSection = html.split("Recomendação")[0] ?? html;
  const priceMatches = mainSection.match(/R\$\s?([\d.]+,\d{2})/g);
  let price: number | null = null;
  if (priceMatches && priceMatches.length > 0) {
    const raw = priceMatches[0].replace("R$", "").trim();
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed)) price = Math.round(parsed * 100);
  }

  let stockStatus: SupplierProductStatus["stockStatus"] = "desconhecido";
  if (/EM ESTOQUE:\s*Dispon[ií]vel/i.test(html)) {
    stockStatus = "disponivel";
  } else if (/indispon[ií]vel|esgotado|fora de estoque/i.test(html)) {
    stockStatus = "indisponivel";
  }

  return { price, stockStatus };
}

// Busca uma página de listagem de categoria do fornecedor e extrai os
// produtos (nome, slug, preço, foto e disponibilidade). Produtos
// indisponíveis não têm preço no HTML (o site troca o preço por um botão
// "Avise-me"), então priceCents pode ser null — o import registra esses
// itens mesmo assim, com status indisponível.
export type SupplierListingItem = {
  name: string;
  slug: string;
  priceCents: number | null;
  imageUrl: string | null;
  unavailable: boolean;
};

const SUPPLIER_BASE = "https://www.atacadodeumbanda.com.br/";

function parseListingItems(html: string): SupplierListingItem[] {
  const items: SupplierListingItem[] = [];
  const blockRe = /<div class="listagem-item prod-id-(\d+)([^"]*)"[\s\S]*?(?=<div class="listagem-item prod-id-|<\/ul>)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const block = m[0];
    const blockClasses = m[2] ?? "";
    const nameMatch = block.match(/class="nome-produto[^"]*">([^<]+)</);
    const hrefMatch = block.match(/<a href="([^"]+)" class="nome-produto/);
    const priceMatch = block.match(/data-sell-price="([\d.]+)"/);
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    if (!nameMatch || !hrefMatch) continue;
    items.push({
      name: nameMatch[1].trim(),
      slug: hrefMatch[1].replace(SUPPLIER_BASE, ""),
      priceCents: priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : null,
      imageUrl: imgMatch ? imgMatch[1] : null,
      unavailable: blockClasses.includes("indisponivel"),
    });
  }
  return items;
}

export async function fetchSupplierListingPage(
  categoryPath: string,
  page: number
): Promise<{ items: SupplierListingItem[]; hasNext: boolean }> {
  const sep = categoryPath.includes("?") ? "&" : "?";
  const url = page === 1
    ? `${SUPPLIER_BASE}${categoryPath}`
    : `${SUPPLIER_BASE}${categoryPath}${sep}pagina=${page}`;

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TocaDaPanteraCatalogBot/1.0)",
    },
  });
  if (!response.ok) return { items: [], hasNext: false };

  const html = await response.text();
  const items = parseListingItems(html);
  // Fim de paginação detectado pelo link "próxima página" no HTML — não pela
  // contagem de itens: uma página cheia pode ter itens que o parser pula
  // (ex.: indisponíveis), e contar itens fazia a varredura parar cedo demais.
  const hasNext = items.length > 0 && html.includes(`pagina=${page + 1}`);
  return { items, hasNext };
}

// Busca produtos direto na busca do site do fornecedor (usado quando o nome
// do produto não bate com nada já importado no catálogo local).
export async function searchSupplierProducts(query: string): Promise<SupplierListingItem[]> {
  const url = `${SUPPLIER_BASE}buscar?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TocaDaPanteraCatalogBot/1.0)",
    },
  });
  if (!response.ok) return [];

  return parseListingItems(await response.text());
}

// Busca a foto principal de um produto direto na página do fornecedor
// (usada para preencher produtos que ficaram sem foto na importação inicial).
export async function fetchSupplierProductImage(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TocaDaPanteraCatalogBot/1.0)",
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  const match = html.match(/<meta property="og:image" content="([^"]+)"/);
  const imageUrl = match ? match[1] : null;
  // Páginas sem uma foto própria (produto removido, redirecionado etc.) caem
  // no logo genérico do site — não é a foto do produto, então é descartado.
  if (imageUrl && !imageUrl.includes("/produto/")) return null;
  return imageUrl;
}
