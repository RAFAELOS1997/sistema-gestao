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
