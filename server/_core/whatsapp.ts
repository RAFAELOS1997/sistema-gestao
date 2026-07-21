// Notificação por WhatsApp pro Rafael via CallMeBot (serviço gratuito de
// terceiros: https://www.callmebot.com/). Só manda mensagem PRA ELE MESMO —
// não é um canal de resposta, é aviso de "aconteceu algo no sistema".
// Nunca deve derrubar a operação principal se falhar (rede fora do ar, bot
// pausado etc.) — por isso engole qualquer erro e só loga um aviso.

const CALLMEBOT_PHONE = process.env.CALLMEBOT_PHONE || "";
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY || "";

export async function notifyRafaelWhatsApp(text: string): Promise<void> {
  if (!CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
      CALLMEBOT_PHONE
    )}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(CALLMEBOT_APIKEY)}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[WhatsApp] CallMeBot respondeu ${response.status}`);
    }
  } catch (error) {
    console.warn("[WhatsApp] Erro ao notificar Rafael:", error);
  }
}

const formatCents = (cents: number): string => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function notifyPartnerOrder(terreiroName: string, subtotalCents: number): void {
  void notifyRafaelWhatsApp(
    `🛒 *Novo pedido de parceiro*\n${terreiroName}\nTotal: ${formatCents(subtotalCents)}\n\nVeja em Parceiros > Pedidos.`
  );
}

export function notifyPublicOrder(customerName: string, subtotalCents: number): void {
  void notifyRafaelWhatsApp(
    `🛍️ *Novo pedido na loja online (Fazer Pedidos)*\n${customerName}\nTotal: ${formatCents(subtotalCents)}\n\nVeja em Pedidos do Site.`
  );
}

export function notifyProntaEntregaPaid(customerName: string, subtotalCents: number): void {
  void notifyRafaelWhatsApp(
    `✅ *Pedido Pronta Entrega PAGO*\n${customerName}\nTotal: ${formatCents(subtotalCents)}\n\nJá deu baixa no estoque. Confira em Pedidos do Site.`
  );
}

export function notifyConsignmentRequest(terreiroName: string, itemCount: number): void {
  void notifyRafaelWhatsApp(
    `📦 *Solicitação de comodato*\n${terreiroName}\n${itemCount} item(ns) pedido(s)\n\nVeja em Parceiros > Comodato.`
  );
}

export function notifyPartnerApplication(terreiroName: string, contactName: string): void {
  void notifyRafaelWhatsApp(
    `🤝 *Novo pedido de cadastro de parceiro*\nTerreiro: ${terreiroName}\nContato: ${contactName}\n\nVeja em Parceiros > Solicitações.`
  );
}
