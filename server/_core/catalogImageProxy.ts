import type { Express } from "express";
import { getSupplierCatalogItem } from "../db";

// Serve as fotos do catálogo do fornecedor a partir do NOSSO domínio — usado
// na tela "Gerar Pedidos" do Portal do Parceiro, onde o parceiro nunca pode
// descobrir quem é o fornecedor. Um <img src> apontando direto pro CDN do
// fornecedor vazaria o domínio dele no painel de rede do navegador; aqui o
// servidor busca a imagem e repassa os bytes, então o navegador do parceiro
// só enxerga uma requisição pro nosso próprio site.
export function registerCatalogImageProxy(app: Express) {
  app.get("/api/catalog-image/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).send("ID inválido");
      return;
    }

    const item = await getSupplierCatalogItem(id);
    if (!item?.imageUrl) {
      res.status(404).send("Imagem não encontrada");
      return;
    }

    try {
      const upstream = await fetch(item.imageUrl);
      if (!upstream.ok || !upstream.body) {
        res.status(502).send("Falha ao buscar imagem");
        return;
      }
      res.set("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400");
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      console.error("[CatalogImageProxy] failed:", err);
      res.status(502).send("Erro ao buscar imagem");
    }
  });
}
