import type { Express } from "express";
import { checkPayment } from "./infinitePay";
import { getSystemConfig, getInfinitePayChargeByOrderNsu, markInfinitePayChargePaid } from "../db";

// Webhook da InfinitePay: chamado por eles quando um pagamento é aprovado.
// A API não tem assinatura/HMAC — qualquer um que descubra essa URL poderia
// tentar mandar um payload falso dizendo "paguei". Por isso NUNCA confiamos
// direto no corpo da requisição: sempre reconferimos o pagamento de verdade
// via checkPayment (que consulta a própria InfinitePay) antes de marcar
// qualquer cobrança como paga.
export function registerInfinitePayWebhook(app: Express) {
  app.post("/api/webhooks/infinitepay", async (req, res) => {
    try {
      const orderNsu: string | undefined = req.body?.order_nsu;
      const transactionNsu: string | undefined = req.body?.transaction_nsu;
      const invoiceSlug: string | undefined = req.body?.invoice_slug;

      if (!orderNsu) {
        res.status(200).json({ success: true });
        return;
      }

      const charge = await getInfinitePayChargeByOrderNsu(orderNsu);
      if (!charge || charge.status === "paid") {
        res.status(200).json({ success: true });
        return;
      }

      const config = await getSystemConfig();
      const handle = config?.infinitePayHandle;
      if (!handle) {
        console.error("[infinitepay webhook] Recebido mas sem InfiniteTag configurada");
        res.status(200).json({ success: true });
        return;
      }

      const verified = await checkPayment({ handle, orderNsu, transactionNsu, slug: invoiceSlug });
      if (verified.paid) {
        await markInfinitePayChargePaid(orderNsu, {
          transactionNsu,
          invoiceSlug,
          paidAmountCents: verified.paidAmount,
          captureMethod: verified.captureMethod,
          receiptUrl: req.body?.receipt_url,
        });
      } else {
        console.warn(`[infinitepay webhook] order_nsu ${orderNsu}: webhook chegou mas checkPayment não confirmou pagamento`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[infinitepay webhook] Erro ao processar:", error);
      // Responde 200 mesmo em erro — o polling do cliente (checkChargeStatus)
      // é o caminho confiável; deixar a InfinitePay retentar sem parar não ajuda.
      res.status(200).json({ success: true });
    }
  });
}
