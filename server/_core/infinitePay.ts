// Cliente pro Checkout Integrado da InfinitePay (https://www.infinitepay.io/checkout).
// Autenticação é só pela InfiniteTag (handle público do lojista, sem o "$") —
// não existe chave secreta nem assinatura de webhook nessa API, então o
// webhook NUNCA é tratado como verdade absoluta: toda confirmação de
// pagamento é reconferida direto na InfinitePay via checkPayment antes de
// marcar qualquer coisa como paga (ver server/routers.ts, webhook handler).

const API_BASE = "https://api.checkout.infinitepay.io";

export type InfinitePayItem = {
  quantity: number;
  price: number; // em centavos
  description: string;
};

export type CreateLinkParams = {
  handle: string;
  orderNsu: string;
  items: InfinitePayItem[];
  webhookUrl?: string;
  redirectUrl?: string;
};

export async function createPaymentLink(params: CreateLinkParams): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: params.handle,
      order_nsu: params.orderNsu,
      items: params.items,
      ...(params.webhookUrl ? { webhook_url: params.webhookUrl } : {}),
      ...(params.redirectUrl ? { redirect_url: params.redirectUrl } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`InfinitePay recusou a criação do link (status ${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data?.url) throw new Error("InfinitePay não retornou o link de pagamento");
  return { url: data.url };
}

export type PaymentCheckResult = {
  success: boolean;
  paid: boolean;
  amount?: number;
  paidAmount?: number;
  installments?: number;
  captureMethod?: string;
};

export async function checkPayment(params: {
  handle: string;
  orderNsu: string;
  transactionNsu?: string;
  slug?: string;
}): Promise<PaymentCheckResult> {
  const response = await fetch(`${API_BASE}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: params.handle,
      order_nsu: params.orderNsu,
      ...(params.transactionNsu ? { transaction_nsu: params.transactionNsu } : {}),
      ...(params.slug ? { slug: params.slug } : {}),
    }),
  });

  if (!response.ok) {
    // Cobrança ainda não paga costuma vir como erro/"not found" — trata como
    // "ainda não pago" em vez de estourar, pra não travar o polling.
    return { success: false, paid: false };
  }

  const data = await response.json();
  return {
    success: !!data?.success,
    paid: !!data?.paid,
    amount: data?.amount,
    paidAmount: data?.paid_amount,
    installments: data?.installments,
    captureMethod: data?.capture_method,
  };
}
