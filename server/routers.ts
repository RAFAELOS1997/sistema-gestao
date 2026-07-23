import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createPaymentLink, checkPayment } from "./_core/infinitePay";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import { fetchSupplierProductStatus, fetchSupplierProductImage, fetchSupplierListingPage, searchSupplierProducts } from "./_core/supplierScraper";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router, terreiroProcedure, customerProcedure } from "./_core/trpc";
import { CUSTOMER_COOKIE_NAME, signCustomerSession } from "./_core/customerAuth";
import { ENV } from "./_core/env";
import { verifyGoogleIdToken } from "./_core/googleAuth";
import { TERREIRO_COOKIE_NAME, signTerreiroSession } from "./_core/terreiroAuth";
import { searchOsmTerreiros } from "./_core/osmProspectSearch";
import { computeStockDeliveryCents } from "./_core/deliveryPricing";
import { notifyPartnerOrder, notifyPublicOrder, notifyConsignmentRequest, notifyPartnerApplication } from "./_core/whatsapp";
import {
  createProduct,
  createSale,
  createPurchase,
  updatePurchase,
  ensureProductImageColumn,
  ensureProductImageColumnIsMediumtext,
  deleteProduct,
  deactivateProduct,
  reactivateProduct,
  getAnalyticsByCategory,
  getDashboardKPIs,
  getProductById,
  listProducts,
  listSales,
  getTerreiroSpendingTotals,
  listPurchases,
  updateProduct,
  getSystemConfig,
  updateSystemConfig,
  listRoles,
  listPermissions,
  getRolePermissions,
  getUserRoles,
  assignRoleToUser,
  removeRoleFromUser,
  listAuditLog,
  createAuditLog,
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getProductSuppliers,
  createProductSupplier,
  updateProductSupplier,
  deleteProductSupplier,
  listUsers,
  getUserById,
  getUserByEmail,
  createLocalUser,
  updateUser,
  deleteUser,
  createReceipt,
  listReceipts,
  getReceiptByNumber,
  listSupplierCatalog,
  getSupplierCatalogItem,
  createSupplierCatalogBatch,
  updateSupplierCatalogItem,
  deleteSupplierCatalogItem,
  listTerreiros,
  getTerreiroById,
  getTerreiroByUsername,
  createTerreiro,
  updateTerreiro,
  setTerreiroActive,
  touchTerreiroLastSignedIn,
  createTerreiroUser,
  listTerreiroUsers,
  getTerreiroUserByUsername,
  getTerreiroUserById,
  setTerreiroUserActive,
  touchTerreiroUserLastSignedIn,
  updateTerreiroUserPassword,
  listPartnerVisibleProducts,
  listPartnerTiers,
  getPartnerTierById,
  updatePartnerTierDiscount,
  listTerreiroProductPrices,
  setTerreiroProductPrice,
  removeTerreiroProductPrice,
  resolvePartnerPrice,
  listConsignments,
  countOpenConsignmentsByTerreiro,
  createConsignment,
  markConsignmentSold,
  markConsignmentReturned,
  createConsignmentRequest,
  listConsignmentRequestsForTerreiro,
  listPendingConsignmentRequestsForTerreiro,
  countPendingConsignmentRequestsByTerreiro,
  cancelConsignmentRequest,
  fulfillConsignmentRequest,
  createInfinitePayCharge,
  getInfinitePayChargeByOrderNsu,
  markInfinitePayChargePaid,
  listPaymentMethods,
  updatePaymentMethod,
  listAvailableSupplierCatalogForOrders,
  listPartnerOrderableStockProducts,
  createPartnerOrder,
  listPartnerOrdersForTerreiro,
  listAllPartnerOrders,
  updatePartnerOrderStatus,
  listActiveProductsFullPrice,
  createPublicOrder,
  listAllPublicOrders,
  updatePublicOrderStatus,
  updatePublicOrderTracking,
  updatePartnerOrderTracking,
  getTerreiroByReferralCode,
  getCustomerByEmail,
  getCustomerByGoogleId,
  getCustomerById,
  createCustomer,
  updateCustomer,
  touchCustomerLastSignedIn,
  listCustomerOrders,
  listCustomers,
  fulfillPublicOrderForCharge,
  recalculatePartnerTierByOrders,
  ensureMinimumBronzeForConsignment,
  createPartnerApplication,
  listPartnerApplications,
  updatePartnerApplicationStatus,
  deletePartnerApplication,
} from "./db";

// O hash de senha (scrypt) nunca deve sair do servidor — sem isso, auth.me e
// as listagens de usuários/terreiros entregavam o hash pro navegador (e o
// front ainda espelhava em localStorage).
const stripPasswordHash = <T extends { passwordHash?: string | null }>(entity: T) => {
  const { passwordHash, ...safe } = entity;
  return safe;
};

// ─── Products Router ──────────────────────────────────────────────────────────

// Compara nomes de produtos ignorando acento/maiúscula e diferenças de
// palavras, pra casar produtos do estoque com itens do fornecedor.
const normalizeProductName = (s: string) =>
  s
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
const tokenizeProductName = (s: string) => normalizeProductName(s).split(" ").filter((w) => w.length > 1);
// Cobertura: quanto das palavras do lado menor aparecem no lado maior.
// Order-independente e tolera nomes com palavras a mais de um dos lados.
// Exige pelo menos 2 palavras em comum pra evitar "falso positivo" por uma
// única palavra genérica (ex.: só "GUIA" ou só "IMAGEM").
const nameCoverage = (aTokens: string[], bTokens: string[]) => {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let shared = 0;
  aSet.forEach((t) => { if (bSet.has(t)) shared++; });
  if (shared < 2 && Math.min(aSet.size, bSet.size) > 1) return 0;
  return shared / Math.min(aSet.size, bSet.size);
};

// Fotos enviadas do dispositivo chegam como data: URI (base64). Precisam da
// coluna em MEDIUMTEXT (o TEXT padrão só aguenta ~64KB) e um limite de
// tamanho pra não deixar alguém mandar uma imagem gigante sem querer.
const MAX_IMAGE_DATA_URL_LENGTH = 2_000_000;
async function prepareImageUrlForSave(imageUrl: string | null | undefined) {
  if (imageUrl && imageUrl.startsWith("data:")) {
    if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Foto muito grande. Tente uma imagem menor." });
    }
    await ensureProductImageColumnIsMediumtext();
  }
  return imageUrl;
}

const productsRouter = router({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(({ input }) => listProducts(input?.includeInactive ?? false)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        category: z.enum(["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"]),
        costPrice: z.number().int().positive(),
        salePrice: z.number().int().positive(),
        currentStock: z.number().int().min(0),
        minimumStock: z.number().int().min(0),
        description: z.string().optional(),
        imageUrl: z.string().optional().nullable(),
        weightGrams: z.number().int().positive().optional().nullable(),
        lengthCm: z.number().int().positive().optional().nullable(),
        widthCm: z.number().int().positive().optional().nullable(),
        heightCm: z.number().int().positive().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const imageUrl = await prepareImageUrlForSave(input.imageUrl);
      return createProduct({ ...input, imageUrl });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        category: z.enum(["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"]).optional(),
        costPrice: z.number().int().positive().optional(),
        salePrice: z.number().int().positive().optional(),
        currentStock: z.number().int().min(0).optional(),
        minimumStock: z.number().int().min(0).optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional().nullable(),
        weightGrams: z.number().int().positive().optional().nullable(),
        lengthCm: z.number().int().positive().optional().nullable(),
        widthCm: z.number().int().positive().optional().nullable(),
        heightCm: z.number().int().positive().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.imageUrl !== undefined) data.imageUrl = await prepareImageUrlForSave(data.imageUrl);
      return updateProduct(id, data);
    }),

  getMargin: publicProcedure
    .input(
      z.object({
        costPrice: z.number().int().min(0),
        salePrice: z.number().int().min(0),
      })
    )
    .query(({ input }) => {
      const { costPrice, salePrice } = input;
      if (salePrice === 0) return 0;
      return Math.round(((salePrice - costPrice) / salePrice) * 100);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteProduct(input.id)),

  // Confere uma lista de itens de uma nota/pedido contra os produtos e
  // compras já cadastrados, pra corrigir custos que entraram errados
  // (ex.: erro de leitura de uma nota importada anteriormente).
  auditOrder: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            name: z.string().min(1),
            unitPriceCents: z.number().int().positive(),
            quantity: z.number().int().positive(),
          })
        ).min(1),
      })
    )
    .query(async ({ input }) => {
      const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");
      const normalize = (s: string) =>
        s
          .normalize("NFD")
          .replace(DIACRITICS_RE, "")
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, " ")
          .trim();

      const allProducts = await listProducts(true);
      const allPurchases = await listPurchases(1000);

      return input.items.map((item) => {
        const normalizedInvoiceName = normalize(item.name);
        const product = allProducts.find((p) => normalize(p.name) === normalizedInvoiceName);

        if (!product) {
          return {
            invoiceName: item.name,
            invoiceUnitPriceCents: item.unitPriceCents,
            invoiceQuantity: item.quantity,
            matched: false as const,
          };
        }

        // Entre as compras desse produto, pega a mais recente (é a mais provável
        // de ser a desse pedido, já que os produtos vieram de uma importação única)
        const candidatePurchases = allPurchases
          .filter((p) => p.productId === product.id)
          .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
        const purchase = candidatePurchases[0] ?? null;

        return {
          invoiceName: item.name,
          invoiceUnitPriceCents: item.unitPriceCents,
          invoiceQuantity: item.quantity,
          matched: true as const,
          productId: product.id,
          productName: product.name,
          currentCostPriceCents: product.costPrice,
          purchaseId: purchase?.id ?? null,
          purchaseUnitPriceCents: purchase?.unitPrice ?? null,
          purchaseQuantity: purchase?.quantity ?? null,
          purchaseDate: purchase?.purchaseDate ?? null,
        };
      });
    }),

  applyOrderCorrections: protectedProcedure
    .input(
      z.object({
        corrections: z.array(
          z.object({
            productId: z.number().int().positive(),
            newCostPriceCents: z.number().int().positive(),
            purchaseId: z.number().int().positive().nullable(),
            newPurchaseUnitPriceCents: z.number().int().positive().nullable(),
            // Quantidade a usar no total da compra (corrigida ou a mesma de antes).
            purchaseQuantityForTotal: z.number().int().positive().nullable(),
            // Presente só quando a quantidade da compra também deve ser corrigida
            // (isso ajusta o estoque automaticamente).
            newPurchaseQuantity: z.number().int().positive().nullable(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ input }) => {
      let productsUpdated = 0;
      let purchasesUpdated = 0;
      for (const c of input.corrections) {
        await updateProduct(c.productId, { costPrice: c.newCostPriceCents });
        productsUpdated++;
        if (c.purchaseId && c.newPurchaseUnitPriceCents && c.purchaseQuantityForTotal) {
          await updatePurchase(c.purchaseId, {
            unitPrice: c.newPurchaseUnitPriceCents,
            totalPrice: c.newPurchaseUnitPriceCents * c.purchaseQuantityForTotal,
            ...(c.newPurchaseQuantity ? { quantity: c.newPurchaseQuantity } : {}),
          });
          purchasesUpdated++;
        }
      }
      return { productsUpdated, purchasesUpdated };
    }),

  // Puxa as fotos dos produtos do estoque a partir dos itens equivalentes
  // já cadastrados n'O Oráculo. Casamento em duas etapas: nome idêntico (ignorando
  // acento/maiúscula) aplica direto; nome parecido (a maioria das palavras bate)
  // fica pendente de revisão em vez de aplicar às cegas.
  pullImagesFromOracle: protectedProcedure.mutation(async () => {
    await ensureProductImageColumn();

    const [allProducts, catalogItems] = await Promise.all([
      listProducts(true),
      listSupplierCatalog(),
    ]);

    const catalogWithImage = catalogItems.filter((i) => !!i.imageUrl);
    const catalogExactByName = new Map<string, string>();
    for (const item of catalogWithImage) {
      const key = normalizeProductName(item.name);
      if (!catalogExactByName.has(key)) catalogExactByName.set(key, item.imageUrl!);
    }
    const catalogTokenized = catalogWithImage.map((item) => ({
      name: item.name,
      imageUrl: item.imageUrl!,
      tokens: tokenizeProductName(item.name),
    }));
    const catalogNoImageNormalized = new Set(
      catalogItems.filter((i) => !i.imageUrl).map((i) => normalizeProductName(i.name))
    );

    let updated = 0;
    let alreadyHadImage = 0;
    const noCatalogEntry: { productId: number; productName: string }[] = [];
    const catalogEntryMissingPhoto: string[] = [];
    const suggestions: { productId: number; productName: string; catalogName: string; imageUrl: string; score: number }[] = [];

    for (const product of allProducts) {
      const normalizedProductName = normalizeProductName(product.name);
      const exact = catalogExactByName.get(normalizedProductName);
      if (exact) {
        if (product.imageUrl === exact) alreadyHadImage++;
        else { await updateProduct(product.id, { imageUrl: exact }); updated++; }
        continue;
      }

      if (catalogNoImageNormalized.has(normalizedProductName)) {
        catalogEntryMissingPhoto.push(product.name);
        continue;
      }

      // Sem correspondência exata: procura o item do catálogo mais parecido
      const productTokens = tokenizeProductName(product.name);
      let best: { name: string; imageUrl: string; score: number } | null = null;
      for (const candidate of catalogTokenized) {
        const score = nameCoverage(productTokens, candidate.tokens);
        if (!best || score > best.score) best = { name: candidate.name, imageUrl: candidate.imageUrl, score };
      }

      if (best && best.score >= 0.85) {
        // Muito parecido (ex.: só uma palavra a mais/menos) — aplica direto
        if (product.imageUrl !== best.imageUrl) {
          await updateProduct(product.id, { imageUrl: best.imageUrl });
          updated++;
        } else {
          alreadyHadImage++;
        }
      } else if (best && best.score >= 0.5) {
        // Parecido mas arriscado — fica pra revisão manual
        suggestions.push({ productId: product.id, productName: product.name, catalogName: best.name, imageUrl: best.imageUrl, score: best.score });
      } else {
        noCatalogEntry.push({ productId: product.id, productName: product.name });
      }
    }

    return { updated, alreadyHadImage, noCatalogEntry, catalogEntryMissingPhoto, suggestions };
  }),

  // Busca as fotos direto no site do fornecedor (pesquisa por nome), pra quem
  // não achou correspondência n'O Oráculo — o catálogo local pode não ter
  // aquele produto ainda. Processa em lotes (parâmetro offset) pra não travar
  // numa chamada só.
  pullImagesFromSupplierSite: protectedProcedure
    .input(z.object({ productIds: z.array(z.number().int().positive()).min(1) }))
    .mutation(async ({ input }) => {
      await ensureProductImageColumn();

      const allProducts = await listProducts(true);
      const targets = allProducts.filter((p) => input.productIds.includes(p.id));

      let updated = 0;
      const suggestions: { productId: number; productName: string; catalogName: string; imageUrl: string; score: number }[] = [];
      const noResults: string[] = [];

      for (const product of targets) {
        const productTokens = tokenizeProductName(product.name);

        let results = await searchSupplierProducts(product.name);
        if (results.length === 0 && productTokens.length > 2) {
          // Nome completo não achou nada — tenta só as 2 primeiras palavras
          // (geralmente o núcleo do produto, ex. "GUIA MIÇANGA")
          results = await searchSupplierProducts(productTokens.slice(0, 2).join(" "));
        }
        await new Promise((resolve) => setTimeout(resolve, 300));

        const withImage = results.filter((r) => !!r.imageUrl);
        let best: { name: string; imageUrl: string; score: number } | null = null;
        for (const candidate of withImage) {
          const score = nameCoverage(productTokens, tokenizeProductName(candidate.name));
          if (!best || score > best.score) best = { name: candidate.name, imageUrl: candidate.imageUrl!, score };
        }

        if (best && best.score >= 0.85) {
          await updateProduct(product.id, { imageUrl: best.imageUrl });
          updated++;
        } else if (best && best.score >= 0.4) {
          suggestions.push({ productId: product.id, productName: product.name, catalogName: best.name, imageUrl: best.imageUrl, score: best.score });
        } else {
          noResults.push(product.name);
        }
      }

      return { updated, suggestions, noResults };
    }),

  applyImageSuggestions: protectedProcedure
    .input(
      z.object({
        items: z.array(z.object({ productId: z.number().int().positive(), imageUrl: z.string().min(1) })).min(1),
      })
    )
    .mutation(async ({ input }) => {
      for (const item of input.items) {
        await updateProduct(item.productId, { imageUrl: item.imageUrl });
      }
      return { updated: input.items.length };
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deactivateProduct(input.id)),

  reactivate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => reactivateProduct(input.id)),
});

// ─── Purchases Router ────────────────────────────────────────────────────────

const purchasesRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }))
    .query(({ input }) => listPurchases(input.limit ?? 50)),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().positive(),
        totalPrice: z.number().int().positive(),
        supplier: z.string().min(1),
        channel: z.enum(["direto", "distribuidor", "fabricante"]).default("distribuidor"),
        purchaseDate: z.date(),
      })
    )
    .mutation(({ input }) => createPurchase(input)),

  // Criar múltiplas compras de uma vez (painel detalhado)
  createBatch: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            productId: z.number().int().positive(),
            quantity: z.number().int().positive(),
            unitPrice: z.number().int().positive(),
            totalPrice: z.number().int().positive(),
          })
        ).min(1),
        supplier: z.string().min(1),
        purchaseDate: z.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const results = [];
      for (const item of input.items) {
        await createPurchase({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          supplier: input.supplier,
          channel: "distribuidor",
          purchaseDate: input.purchaseDate,
        });
        results.push(item.productId);
      }
      return { count: results.length };
    }),

  // Upload e importação de arquivo (PDF/XML/XLSX como base64)
  importFromFile: protectedProcedure
    .input(
      z.object({
        fileContent: z.string().min(10), // base64 encoded
        fileName: z.string(),
        mimeType: z.string(),
        existingProducts: z.array(z.object({ id: z.number(), name: z.string(), category: z.string() })).optional(),
        existingSuppliers: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileContent, "base64");
      let textContent = "";

      try {
        // Parsing real baseado no tipo de arquivo
        if (input.mimeType.includes("xml") || input.fileName.endsWith(".xml")) {
          // XML de NF-e - já é texto
          textContent = `[NOTA FISCAL XML]\n${buffer.toString("utf-8")}`;
        } else if (input.fileName.endsWith(".pdf") || input.mimeType.includes("pdf")) {
          // PDF - extrair texto com pdf-parse v2
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: buffer });
          const result = await parser.getText();
          const text = result.text || "";
          if (!text || text.trim().length < 5) {
            throw new Error("Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada.");
          }
          textContent = `[NOTA FISCAL PDF - ${input.fileName}]\n${text}`;
        } else if (input.fileName.endsWith(".xlsx") || input.fileName.endsWith(".xls") || input.mimeType.includes("spreadsheet") || input.mimeType.includes("excel")) {
          // Excel - extrair dados com xlsx
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheets: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
              sheets.push(`[Aba: ${sheetName}]\n${csv}`);
            }
          }
          if (sheets.length === 0) {
            throw new Error("Planilha vazia ou sem dados legíveis.");
          }
          textContent = `[PLANILHA DE COMPRAS - ${input.fileName}]\n${sheets.join("\n\n")}`;
        } else if (input.fileName.endsWith(".csv") || input.mimeType.includes("csv")) {
          // CSV - já é texto
          textContent = `[PLANILHA CSV - ${input.fileName}]\n${buffer.toString("utf-8")}`;
        } else if (input.mimeType.includes("text") || input.fileName.endsWith(".txt")) {
          textContent = `[DOCUMENTO TEXTO - ${input.fileName}]\n${buffer.toString("utf-8")}`;
        } else {
          // Tentar como texto genérico
          const text = buffer.toString("utf-8");
          if (text.includes("\ufffd") || text.includes("\x00")) {
            throw new Error(`Formato não suportado: ${input.fileName}. Use PDF, XML, CSV ou XLSX.`);
          }
          textContent = `[DOCUMENTO - ${input.fileName}]\n${text}`;
        }
      } catch (error: any) {
        if (error.message.includes("Formato não suportado") || error.message.includes("Não foi possível") || error.message.includes("vazia")) {
          throw error;
        }
        throw new Error(`Erro ao processar arquivo ${input.fileName}: ${error.message}`);
      }

      // Usar o mesmo LLM para extrair dados
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um assistente especializado em extrair dados de notas fiscais e planilhas de compras.
Analise o conteúdo do arquivo fornecido e extraia TODOS os itens de compra.

Produtos existentes no sistema: ${JSON.stringify(input.existingProducts || [])}
Fornecedores existentes: ${JSON.stringify(input.existingSuppliers || [])}

Categorias válidas: velas, guias, incensos, banhos, ervas

Para cada item, determine:
- Se o produto já existe no sistema (use o ID), ou se precisa ser criado (productId = null)
- A categoria mais adequada baseada no nome do produto
- Quantidade e preço unitário (em centavos)
- Dados do fornecedor (nome, CNPJ se disponível)

Se o preço estiver em reais (ex: 5.50), converta para centavos (550).
Se não conseguir determinar um campo, use null.`,
          },
          { role: "user", content: textContent.substring(0, 15000) }, // Limitar tamanho
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "purchase_import",
            strict: true,
            schema: {
              type: "object",
              properties: {
                supplier: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Nome do fornecedor" },
                    cnpj: { type: ["string", "null"], description: "CNPJ se disponível" },
                    phone: { type: ["string", "null"], description: "Telefone se disponível" },
                    existingId: { type: ["integer", "null"], description: "ID do fornecedor existente ou null" },
                  },
                  required: ["name", "cnpj", "phone", "existingId"],
                  additionalProperties: false,
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      productName: { type: "string", description: "Nome do produto" },
                      existingProductId: { type: ["integer", "null"], description: "ID do produto existente ou null se novo" },
                      category: { type: "string", enum: ["velas", "guias", "incensos", "banhos", "ervas"], description: "Categoria do produto" },
                      quantity: { type: "integer", description: "Quantidade comprada" },
                      unitPriceCents: { type: "integer", description: "Preço unitário em centavos" },
                      suggestedSalePriceCents: { type: ["integer", "null"], description: "Preço de venda sugerido em centavos (2x custo)" },
                    },
                    required: ["productName", "existingProductId", "category", "quantity", "unitPriceCents", "suggestedSalePriceCents"],
                    additionalProperties: false,
                  },
                },
                purchaseDate: { type: ["string", "null"], description: "Data da compra no formato YYYY-MM-DD se disponível" },
                totalValue: { type: ["integer", "null"], description: "Valor total da nota em centavos" },
              },
              required: ["supplier", "items", "purchaseDate", "totalValue"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("Falha ao processar o arquivo");
      return JSON.parse(content as string);
    }),

  // Importação inteligente via LLM (texto colado)
  importFromText: protectedProcedure
    .input(
      z.object({
        text: z.string().min(10),
        existingProducts: z.array(z.object({ id: z.number(), name: z.string(), category: z.string() })).optional(),
        existingSuppliers: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um assistente especializado em extrair dados de notas fiscais e planilhas de compras.
Analise o texto fornecido e extraia TODOS os itens de compra.

Produtos existentes no sistema: ${JSON.stringify(input.existingProducts || [])}
Fornecedores existentes: ${JSON.stringify(input.existingSuppliers || [])}

Categorias válidas: velas, guias, incensos, banhos, ervas

Para cada item, determine:
- Se o produto já existe no sistema (use o ID), ou se precisa ser criado (productId = null)
- A categoria mais adequada baseada no nome do produto
- Quantidade e preço unitário (em centavos)
- Dados do fornecedor (nome, CNPJ se disponível)

Se o preço estiver em reais (ex: 5.50), converta para centavos (550).
Se não conseguir determinar um campo, use null.`,
          },
          { role: "user", content: input.text },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "purchase_import",
            strict: true,
            schema: {
              type: "object",
              properties: {
                supplier: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Nome do fornecedor" },
                    cnpj: { type: ["string", "null"], description: "CNPJ se disponível" },
                    phone: { type: ["string", "null"], description: "Telefone se disponível" },
                    existingId: { type: ["integer", "null"], description: "ID do fornecedor existente ou null" },
                  },
                  required: ["name", "cnpj", "phone", "existingId"],
                  additionalProperties: false,
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      productName: { type: "string", description: "Nome do produto" },
                      existingProductId: { type: ["integer", "null"], description: "ID do produto existente ou null se novo" },
                      category: { type: "string", enum: ["velas", "guias", "incensos", "banhos", "ervas"], description: "Categoria do produto" },
                      quantity: { type: "integer", description: "Quantidade comprada" },
                      unitPriceCents: { type: "integer", description: "Preço unitário em centavos" },
                      suggestedSalePriceCents: { type: ["integer", "null"], description: "Preço de venda sugerido em centavos (2x custo)" },
                    },
                    required: ["productName", "existingProductId", "category", "quantity", "unitPriceCents", "suggestedSalePriceCents"],
                    additionalProperties: false,
                  },
                },
                purchaseDate: { type: ["string", "null"], description: "Data da compra no formato YYYY-MM-DD se disponível" },
                totalValue: { type: ["integer", "null"], description: "Valor total da nota em centavos" },
              },
              required: ["supplier", "items", "purchaseDate", "totalValue"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("Falha ao processar a nota fiscal");
      return JSON.parse(content as string);
    }),

  // Confirmar importação após revisão do usuário
  confirmImport: protectedProcedure
    .input(
      z.object({
        supplier: z.object({
          name: z.string().min(1),
          cnpj: z.string().optional(),
          phone: z.string().optional(),
          existingId: z.number().nullable(),
        }),
        items: z.array(
          z.object({
            productName: z.string(),
            existingProductId: z.number().nullable(),
            category: z.enum(["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"]),
            quantity: z.number().int().positive(),
            unitPriceCents: z.number().int().positive(),
            suggestedSalePriceCents: z.number().int().positive().nullable(),
          })
        ).min(1),
        purchaseDate: z.string().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Criar fornecedor se necessário
      let supplierName = input.supplier.name;
      if (!input.supplier.existingId) {
        await createSupplier({
          name: input.supplier.name,
          cnpj: input.supplier.cnpj || null,
          phone: input.supplier.phone || null,
        });
      }

      // 2. Para cada item, criar produto se necessário e registrar compra
      const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : new Date();
      let createdProducts = 0;
      let registeredPurchases = 0;

      for (const item of input.items) {
        let productId = item.existingProductId;

        // Criar produto se não existe
        if (!productId) {
          const salePrice = item.suggestedSalePriceCents || item.unitPriceCents * 2;
          const newProduct = await createProduct({
            name: item.productName,
            category: item.category,
            costPrice: item.unitPriceCents,
            salePrice,
            currentStock: 0,
            minimumStock: 5,
          });
          productId = (newProduct as any)[0]?.insertId || (newProduct as any).insertId;
          createdProducts++;
        }

        if (productId) {
          // Registrar compra (que também atualiza estoque)
          await createPurchase({
            productId,
            quantity: item.quantity,
            unitPrice: item.unitPriceCents,
            totalPrice: item.unitPriceCents * item.quantity,
            supplier: supplierName,
            channel: "distribuidor",
            purchaseDate,
          });
          registeredPurchases++;
        }
      }

      return { createdProducts, registeredPurchases, supplierName };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        quantity: z.number().int().positive().optional(),
        unitPrice: z.number().int().positive().optional(),
        totalPrice: z.number().int().positive().optional(),
        supplier: z.string().min(1).optional(),
        channel: z.enum(["direto", "distribuidor", "fabricante"]).optional(),
        purchaseDate: z.date().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updatePurchase(id, data);
    }),
});

// ─── Sales Router ─────────────────────────────────────────────────────────────

const salesRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }))
    .query(({ input }) => listSales(input.limit ?? 50)),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().positive(),
        channel: z.enum(["fisico", "instagram", "terreiro"]),
        terreiroId: z.number().int().positive().optional(),
        saleDate: z.date(),
      })
    )
    .mutation(async ({ input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new Error("Produto não encontrado");
      if (product.currentStock < input.quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.currentStock}`);
      }
      if (input.channel === "terreiro" && !input.terreiroId) {
        throw new Error("Selecione o parceiro pra registrar essa venda");
      }
      const totalPrice = input.unitPrice * input.quantity;
      const profit = (input.unitPrice - product.costPrice) * input.quantity;
      await createSale({
        productId: input.productId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalPrice,
        profit,
        channel: input.channel,
        terreiroId: input.channel === "terreiro" ? input.terreiroId! : null,
        saleDate: input.saleDate,
      });
      return { success: true };
    }),
});

// ─── Analytics Router ─────────────────────────────────────────────────────────

const analyticsRouter = router({
  dashboard: protectedProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(({ input }) => getDashboardKPIs(input.startDate, input.endDate)),

  byCategory: protectedProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(({ input }) => getAnalyticsByCategory(input.startDate, input.endDate)),
});

// ─── Settings Router ────────────────────────────────────────────────────────────

// ─── Formas de Pagamento (nativas) ─────────────────────────────────────────────
// Fixas (5: Dinheiro/Pix/Débito/Crédito/Cheque) — não dá pra criar/excluir
// pela UI, só ativar/desativar e renomear. InfinitePay é tratada à parte
// (infinitePayRouter abaixo), já que depende de uma InfiniteTag configurada.

const paymentMethodsRouter = router({
  list: protectedProcedure.query(() => listPaymentMethods()),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        label: z.string().min(1).max(100).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updatePaymentMethod(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "payment_method_updated",
        module: "settings",
        description: `Forma de pagamento ID ${id} atualizada`,
      });
      return { success: true };
    }),
});

// ─── InfinitePay (Checkout Integrado) ──────────────────────────────────────────
// Autenticação da API é só a InfiniteTag (handle público, sem "$") — não é
// uma chave secreta. Ainda assim nunca é exposta pro portal do parceiro nem
// pra rotas públicas; só protectedProcedure (staff logado) mexe nela.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://sistema.tocadapantera.com.br";

const infinitePayRouter = router({
  getHandle: protectedProcedure.query(async () => {
    const config = await getSystemConfig();
    return { handle: config?.infinitePayHandle ?? null };
  }),

  setHandle: protectedProcedure
    .input(z.object({ handle: z.string().trim().max(100).nullable() }))
    .mutation(async ({ input, ctx }) => {
      const cleanHandle = input.handle ? input.handle.replace(/^\$/, "").trim() || null : null;
      await updateSystemConfig({ infinitePayHandle: cleanHandle });
      await createAuditLog({
        userId: ctx.user.id,
        action: "infinitepay_handle_updated",
        module: "settings",
        description: "InfiniteTag da InfinitePay atualizada",
      });
      return { success: true };
    }),

  createCharge: protectedProcedure
    .input(z.object({ amountCents: z.number().int().positive(), description: z.string().max(255).optional() }))
    .mutation(async ({ input }) => {
      const config = await getSystemConfig();
      const handle = config?.infinitePayHandle;
      if (!handle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure sua InfiniteTag em Configurações antes de cobrar com InfinitePay",
        });
      }

      const orderNsu = randomUUID();
      const { url } = await createPaymentLink({
        handle,
        orderNsu,
        items: [{ quantity: 1, price: input.amountCents, description: input.description || "Venda Toca da Pantera" }],
        webhookUrl: `${PUBLIC_BASE_URL}/api/webhooks/infinitepay`,
      });
      await createInfinitePayCharge({
        orderNsu,
        amountCents: input.amountCents,
        description: input.description ?? null,
        checkoutUrl: url,
      });
      return { orderNsu, checkoutUrl: url };
    }),

  // Confere o status de uma cobrança — sempre reconfere direto na InfinitePay
  // se ainda estiver pendente localmente, pra cobrir o caso do webhook não
  // ter chegado (não existe assinatura na API, então o webhook nunca é a
  // única fonte de verdade).
  checkChargeStatus: protectedProcedure
    .input(z.object({ orderNsu: z.string().min(1) }))
    .query(async ({ input }) => {
      const charge = await getInfinitePayChargeByOrderNsu(input.orderNsu);
      if (!charge) throw new TRPCError({ code: "NOT_FOUND", message: "Cobrança não encontrada" });
      if (charge.status === "paid") {
        return { status: "paid" as const, paidAmountCents: charge.paidAmountCents, captureMethod: charge.captureMethod };
      }

      const config = await getSystemConfig();
      const handle = config?.infinitePayHandle;
      if (handle) {
        const result = await checkPayment({ handle, orderNsu: input.orderNsu });
        if (result.paid) {
          await markInfinitePayChargePaid(input.orderNsu, {
            paidAmountCents: result.paidAmount,
            captureMethod: result.captureMethod,
          });
          return { status: "paid" as const, paidAmountCents: result.paidAmount ?? null, captureMethod: result.captureMethod ?? null };
        }
      }
      return { status: "pending" as const, paidAmountCents: null, captureMethod: null };
    }),
});

const settingsRouter = router({
  getConfig: protectedProcedure.query(async () => {
    const config = await getSystemConfig();
    return config || {
      companyName: "Toca da Pantera",
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      language: "pt-BR",
      primaryColor: "#d4af37",
      secondaryColor: "#000000",
    };
  }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        companyName: z.string().optional(),
        companyEmail: z.string().email().optional(),
        timezone: z.string().optional(),
        currency: z.string().optional(),
        language: z.string().optional(),
        primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
        secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
        logoUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updateSystemConfig(input);
      await createAuditLog({
        userId: ctx.user.id,
        action: "config_updated",
        module: "settings",
        description: "Configurações do sistema atualizadas",
        changes: JSON.stringify(input),
      });
      return { success: true };
    }),

  // Entrega própria (Fase 1, ajustada) — só Ribeirão Preto e região por
  // enquanto, sem Correios/frete nacional ainda. Tudo em centavos.
  getShippingConfig: protectedProcedure.query(async () => {
    const config = await getSystemConfig();
    return {
      shippingOriginZipCode: config?.shippingOriginZipCode ?? "14090210",
      shippingPerKmCents: config?.shippingPerKmCents ?? 150,
      shippingSupplierFixedCents: config?.shippingSupplierFixedCents ?? 4000,
    };
  }),

  updateShippingConfig: protectedProcedure
    .input(
      z.object({
        shippingOriginZipCode: z.string().min(8).max(9),
        shippingPerKmCents: z.number().int().min(0),
        shippingSupplierFixedCents: z.number().int().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updateSystemConfig(input);
      await createAuditLog({
        userId: ctx.user.id,
        action: "shipping_config_updated",
        module: "settings",
        description: "Configuração de frete atualizada",
        changes: JSON.stringify(input),
      });
      return { success: true };
    }),

  listRoles: protectedProcedure.query(() => listRoles()),

  listPermissions: protectedProcedure.query(() => listPermissions()),

  getRolePermissions: protectedProcedure
    .input(z.object({ roleId: z.number().int().positive() }))
    .query(({ input }) => getRolePermissions(input.roleId)),

  getUserRoles: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(({ input }) => getUserRoles(input.userId)),

  assignRoleToUser: protectedProcedure
    .input(z.object({ userId: z.number().int().positive(), roleId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await assignRoleToUser(input.userId, input.roleId);
      await createAuditLog({
        userId: ctx.user.id,
        action: "role_assigned",
        module: "users",
        description: `Role ${input.roleId} atribuído ao usuário ${input.userId}`,
      });
      return { success: true };
    }),

  removeRoleFromUser: protectedProcedure
    .input(z.object({ userId: z.number().int().positive(), roleId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await removeRoleFromUser(input.userId, input.roleId);
      await createAuditLog({
        userId: ctx.user.id,
        action: "role_removed",
        module: "users",
        description: `Role ${input.roleId} removido do usuário ${input.userId}`,
      });
      return { success: true };
    }),

  listAuditLog: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).optional() }))
    .query(({ input }) => listAuditLog(input.limit)),
});

// ─── Suppliers Router ────────────────────────────────────────────────────────────────

const suppliersRouter = router({
  list: protectedProcedure.query(() => listSuppliers()),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ input }) => getSupplierById(input.id)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().or(z.literal("")).optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().max(2).optional(),
        zipCode: z.string().optional(),
        cnpj: z.string().optional(),
        paymentTerms: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await createSupplier(input);
      await createAuditLog({
        userId: ctx.user.id,
        action: "supplier_created",
        module: "suppliers",
        description: `Fornecedor "${input.name}" criado`,
      });
      return result;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        email: z.string().email().or(z.literal("")).optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().max(2).optional(),
        zipCode: z.string().optional(),
        cnpj: z.string().optional(),
        paymentTerms: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateSupplier(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "supplier_updated",
        module: "suppliers",
        description: `Fornecedor ID ${id} atualizado`,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await deleteSupplier(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "supplier_deleted",
        module: "suppliers",
        description: `Fornecedor ID ${input.id} deletado`,
      });
      return { success: true };
    }),

  getProductSuppliers: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) => getProductSuppliers(input.productId)),

  createProductSupplier: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        supplierId: z.number().int().positive(),
        supplierProductCode: z.string().optional(),
        costPrice: z.number().int().positive(),
        minimumOrderQuantity: z.number().int().min(1).optional(),
        leadTimeDays: z.number().int().min(1).optional(),
        isPreferred: z.number().int().optional(),
      })
    )
    .mutation(({ input }) => createProductSupplier(input)),
});

// ─── Supplier Catalog Router ──────────────────────────────────────────────────
// Catálogo de produtos consultados no site do fornecedor. Não é o mesmo que o
// estoque próprio (tabela `products`) — é uma referência pra decidir o que
// pedir e a que preço revender.

const CATALOG_CATEGORY = z.enum(["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"]);

const suggestSalePrice = (costCents: number) => {
  if (costCents <= 500) return Math.round(costCents * 3);
  if (costCents <= 2000) return Math.round(costCents * 2.5);
  if (costCents <= 5000) return Math.round(costCents * 2);
  return Math.round(costCents * 1.8);
};

// Preço de um item do fornecedor pro parceiro montar o pedido: parte do
// preço de venda sugerido, aplica o desconto do plano dele e trava num
// mínimo de custo×1,5 — comissão nunca pode ficar abaixo de 50%, mesmo que
// o desconto do plano (até 20% no Diamante) empurraria o preço mais baixo.
const MIN_ORDER_MARGIN_MULT = 1.5;
const computePartnerOrderItemPrice = (costCents: number, suggestedSalePriceCents: number | null, discountPercent: number) => {
  const baseSalePrice = suggestedSalePriceCents ?? suggestSalePrice(costCents);
  const tierPrice = Math.round(baseSalePrice * (1 - discountPercent / 100));
  const minPrice = Math.ceil(costCents * MIN_ORDER_MARGIN_MULT);
  return Math.max(tierPrice, minPrice);
};

const ORDER_MINIMUM_CENTS = 15000; // R$ 150 (a compra mínima do fornecedor pra loja é R$ 300)

// Preço da aba "Fazer Pedidos" do catálogo público: preço cheio + 5% (sem
// desconto nenhum, é o visitante comum, não um parceiro) — ainda travado no
// mínimo de custo×1,5 por segurança, embora o preço cheio já costume ficar
// bem acima disso.
const PUBLIC_ORDER_MARKUP_MULT = 1.05;
const computePublicOrderItemPrice = (costCents: number, fullPriceCents: number) => {
  const markedUpPrice = Math.round(fullPriceCents * PUBLIC_ORDER_MARKUP_MULT);
  const minPrice = Math.ceil(costCents * MIN_ORDER_MARGIN_MULT);
  return Math.max(markedUpPrice, minPrice);
};

// Entrega própria por enquanto — só Ribeirão Preto e região, não é frete
// nacional via Correios (ainda não configurado). Item do ESTOQUE cobra pela
// distância real (Rafael/motoboy entrega); item do FORNECEDOR cobra um valor
// fixo (cobre buscar com o fornecedor antes). Sempre recalculado aqui no
// servidor a partir do endereço, nunca confia num valor vindo do cliente.
type ShippingConfig = {
  shippingOriginZipCode: string;
  shippingPerKmCents: number;
  shippingSupplierFixedCents: number;
};

const normalizeCityName = (city: string): string =>
  city
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim()
    .toLowerCase();

const isRibeiraoPretoCity = (city: string | null | undefined): boolean =>
  normalizeCityName(city ?? "") === "ribeirao preto";

const computeShippingCents = async (
  method: "retirada" | "envio",
  zipCode: string | null | undefined,
  hasEstoqueItems: boolean,
  hasCatalogoItems: boolean,
  config: ShippingConfig | null
): Promise<number> => {
  if (method === "retirada" || !config) return 0;
  let total = 0;
  if (hasEstoqueItems) {
    if (!zipCode) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o CEP pra calcular o frete de entrega" });
    }
    const distanceCents = await computeStockDeliveryCents(zipCode, config.shippingOriginZipCode, config.shippingPerKmCents);
    if (distanceCents === null) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não conseguimos calcular o frete pro seu CEP agora. Confira o CEP ou tente de novo em instantes.",
      });
    }
    total += distanceCents;
  }
  if (hasCatalogoItems) {
    total += config.shippingSupplierFixedCents;
  }
  return total;
};

// Cupom de indicação por terreiro (Fase 2 do plano de expansão nacional) —
// código público, validado sempre no servidor. Desconto é distribuído
// proporcionalmente pelos itens do pedido ANTES de gravar (mesmo padrão já
// usado pros descontos de carrinho em Vendas) pra sales/profit ficarem
// certos quando o pedido for confirmado — nunca é um valor à parte.
const COUPON_DISCOUNT_PERCENT = 5;

function applyCouponDiscount<T extends { totalPrice: number; quantity: number; unitPrice: number }>(
  items: T[]
): { items: T[]; discountCents: number } {
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const discountCents = Math.round((subtotal * COUPON_DISCOUNT_PERCENT) / 100);
  if (discountCents <= 0) return { items, discountCents: 0 };
  let remaining = discountCents;
  const discounted = items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    const itemDiscount = isLast ? remaining : Math.min(remaining, Math.round((item.totalPrice * COUPON_DISCOUNT_PERCENT) / 100));
    remaining -= itemDiscount;
    const newTotalPrice = Math.max(0, item.totalPrice - itemDiscount);
    const newUnitPrice = item.quantity > 0 ? Math.round(newTotalPrice / item.quantity) : item.unitPrice;
    return { ...item, totalPrice: newTotalPrice, unitPrice: newUnitPrice };
  });
  return { items: discounted, discountCents };
}

const shippingAddressSchema = z.object({
  zipCode: z.string().min(8).max(9),
  street: z.string().min(1).max(255),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
});

const supplierCatalogRouter = router({
  list: protectedProcedure
    .input(z.object({ supplierId: z.number().int().positive().optional() }))
    .query(({ input }) => listSupplierCatalog(input.supplierId)),

  createBatch: protectedProcedure
    .input(
      z.object({
        supplierId: z.number().int().positive(),
        items: z
          .array(
            z.object({
              name: z.string().min(1),
              category: CATALOG_CATEGORY,
              sourceSlug: z.string().min(1),
              sourceUrl: z.string().min(1),
              imageUrl: z.string().optional(),
              price: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .mutation(({ input }) =>
      createSupplierCatalogBatch(
        input.items.map((item) => ({
          supplierId: input.supplierId,
          name: item.name,
          category: item.category,
          sourceSlug: item.sourceSlug,
          sourceUrl: item.sourceUrl,
          imageUrl: item.imageUrl,
          price: item.price,
          suggestedSalePrice: suggestSalePrice(item.price),
        }))
      )
    ),

  refresh: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const item = await getSupplierCatalogItem(input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });

      const status = await fetchSupplierProductStatus(item.sourceUrl);
      const updates: Parameters<typeof updateSupplierCatalogItem>[1] = {
        stockStatus: status.stockStatus,
        lastCheckedAt: new Date(),
      };
      if (status.price !== null) {
        updates.price = status.price;
        updates.suggestedSalePrice = suggestSalePrice(status.price);
      }
      await updateSupplierCatalogItem(input.id, updates);
      return getSupplierCatalogItem(input.id);
    }),

  updateSuggestedPrice: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), suggestedSalePrice: z.number().int().positive() }))
    .mutation(({ input }) => updateSupplierCatalogItem(input.id, { suggestedSalePrice: input.suggestedSalePrice })),

  importFromSupplierSite: protectedProcedure
    .input(
      z.object({
        supplierId: z.number().int().positive(),
        categoryPath: z.string().min(1),
        myCategory: CATALOG_CATEGORY,
        startPage: z.number().int().min(1).default(1),
      })
    )
    .mutation(async ({ input }) => {
      const MAX_PAGES_PER_CALL = 8; // evita estourar o tempo da requisição
      const existing = await listSupplierCatalog(input.supplierId);
      const existingSlugs = new Set(existing.map((item) => item.sourceSlug));

      let found = 0;
      let inserted = 0;
      let nextPage: number | null = input.startPage;

      for (let i = 0; i < MAX_PAGES_PER_CALL && nextPage; i++) {
        const { items, hasNext } = await fetchSupplierListingPage(input.categoryPath, nextPage);
        if (items.length === 0) {
          nextPage = null;
          break;
        }
        found += items.length;

        const fresh = items.filter((item) => !existingSlugs.has(item.slug));
        for (const item of fresh) existingSlugs.add(item.slug);
        if (fresh.length > 0) {
          await createSupplierCatalogBatch(
            fresh.map((item) => ({
              supplierId: input.supplierId,
              name: item.name,
              category: input.myCategory,
              sourceSlug: item.slug,
              sourceUrl: "https://www.atacadodeumbanda.com.br/" + item.slug,
              imageUrl: item.imageUrl,
              // Produto indisponível não mostra preço na listagem — entra com
              // preço zerado e sem sugestão; o botão "Atualizar" (ou uma nova
              // importação quando ele voltar ao estoque) preenche depois.
              price: item.priceCents ?? 0,
              suggestedSalePrice: item.priceCents ? suggestSalePrice(item.priceCents) : null,
              stockStatus: item.unavailable
                ? ("indisponivel" as const)
                : item.priceCents !== null
                  ? ("disponivel" as const)
                  : ("desconhecido" as const),
            }))
          );
          inserted += fresh.length;
        }

        if (!hasNext) {
          nextPage = null;
        } else {
          nextPage += 1;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      return { found, inserted, nextPage };
    }),

  addToInventory: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const item = await getSupplierCatalogItem(input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });

      const existing = (await listProducts(true)).find(
        (p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${item.name}" já está cadastrado nos seus produtos`,
        });
      }

      const salePrice = item.suggestedSalePrice ?? suggestSalePrice(item.price);
      const created = await createProduct({
        name: item.name,
        category: item.category,
        costPrice: item.price,
        salePrice,
        currentStock: 0,
        minimumStock: 5,
        description: `Importado do Oráculo — ${item.sourceUrl}`,
      });
      const productId = (created as any)[0]?.insertId || (created as any).insertId;

      if (productId) {
        await createProductSupplier({
          productId,
          supplierId: item.supplierId,
          costPrice: item.price,
          isPreferred: 1,
        });
      }

      return { productId, name: item.name };
    }),

  backfillImages: protectedProcedure.mutation(async () => {
    const BATCH_LIMIT = 60; // evita estourar o tempo de resposta da requisição
    const items = await listSupplierCatalog();
    const missing = items.filter((item) => !item.imageUrl);
    const batch = missing.slice(0, BATCH_LIMIT);

    let updated = 0;
    for (const item of batch) {
      try {
        const imageUrl = await fetchSupplierProductImage(item.sourceUrl);
        if (imageUrl) {
          await updateSupplierCatalogItem(item.id, { imageUrl });
          updated++;
        }
      } catch {
        // ignora falhas individuais e segue para o próximo produto
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return { checked: batch.length, updated, remaining: missing.length - batch.length };
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteSupplierCatalogItem(input.id)),
});

// ─── Users Router ────────────────────────────────────────────────────────────

// Clientes cadastrados na loja pública (área do usuário) — visão do admin,
// só pra consulta/contato, nunca edita nada aqui (o cliente cuida da
// própria conta em /conta).
const customersRouter = router({
  list: protectedProcedure.query(() => listCustomers()),
});

const usersRouter = router({
  list: protectedProcedure.query(async () => (await listUsers()).map(stripPasswordHash)),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const user = await getUserById(input.id);
      return user ? stripPasswordHash(user) : null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { password, ...rest } = input;
      const passwordHash = await hashPassword(password);
      return createLocalUser({ ...rest, passwordHash });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateUser(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteUser(input.id)),
});

// ─── Receipts Router ─────────────────────────────────────────────────────────

const receiptsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        subtotal: z.number().int().nonnegative(),
        discount: z.number().int().nonnegative(),
        total: z.number().int().positive(),
        paymentMethod: z.string().min(1),
        notes: z.string().optional(),
        items: z.string().min(1), // JSON string
      })
    )
    .mutation(async ({ input }) => {
      const result = await createReceipt({
        subtotal: input.subtotal,
        discount: input.discount,
        total: input.total,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        items: input.items,
      });
      return result;
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }))
    .query(({ input }) => listReceipts(input.limit ?? 50)),

  getByNumber: protectedProcedure
    .input(z.object({ receiptNumber: z.number().int().positive() }))
    .query(({ input }) => getReceiptByNumber(input.receiptNumber)),
});

// ─── Terreiros Parceiros (gestão pelo admin) ──────────────────────────────────

const terreirosRouter = router({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(async ({ input }) => (await listTerreiros(input?.includeInactive ?? false)).map(stripPasswordHash)),

  // Total gasto por parceiro (pedidos feitos na loja, canal "terreiro") —
  // base pra decidir avanço de plano por volume de compra.
  spendingTotals: protectedProcedure.query(() => getTerreiroSpendingTotals()),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const terreiro = await getTerreiroById(input.id);
      return terreiro ? stripPasswordHash(terreiro) : null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        username: z.string().min(3).max(100).regex(/^[a-z0-9._-]+$/i, "Use apenas letras, números, ponto, hífen ou underline"),
        password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        tierId: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await hashPassword(input.password);
      // Todo parceiro novo já nasce no plano Cobre (10% — regra definida em
      // 2026-07-21), a menos que o admin escolha outro plano na hora.
      let tierId = input.tierId ?? null;
      if (tierId === null) {
        const tiers = await listPartnerTiers();
        tierId = tiers.find((t) => t.name === "Cobre")?.id ?? null;
      }
      const result = await createTerreiro({
        name: input.name,
        username: input.username,
        passwordHash,
        contactName: input.contactName || null,
        phone: input.phone || null,
        tierId,
        isActive: 1,
        mustChangePassword: 1,
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_created",
        module: "partners",
        description: `Login do terreiro "${input.name}" criado`,
      });
      return result;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        username: z.string().min(3).max(100).regex(/^[a-z0-9._-]+$/i).optional(),
        password: z.string().min(6).optional(),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        tierId: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, password, ...rest } = input;
      const data: Parameters<typeof updateTerreiro>[1] = { ...rest };
      if (password) data.passwordHash = await hashPassword(password);
      await updateTerreiro(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_updated",
        module: "partners",
        description: `Login do terreiro ID ${id} atualizado`,
      });
      return { success: true };
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await setTerreiroActive(input.id, input.isActive);
      await createAuditLog({
        userId: ctx.user.id,
        action: input.isActive ? "partner_activated" : "partner_deactivated",
        module: "partners",
        description: `Login do terreiro ID ${input.id} ${input.isActive ? "ativado" : "desativado"}`,
      });
      return { success: true };
    }),

  // Loga o admin no Portal do Parceiro como esse terreiro (cookie próprio,
  // não mexe na sessão do admin) — pra poder ver/testar tudo exatamente
  // como o parceiro vê, sem precisar saber a senha dele.
  impersonate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const terreiro = await getTerreiroById(input.id);
      if (!terreiro) throw new TRPCError({ code: "NOT_FOUND", message: "Terreiro não encontrado" });
      const sessionToken = await signTerreiroSession(terreiro.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(TERREIRO_COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true };
    }),

  // Preço específico de um terreiro — sobrescreve o preço do plano dele
  // só pra esse produto (ex: negociação pontual com aquele parceiro).
  prices: router({
    list: protectedProcedure
      .input(z.object({ terreiroId: z.number().int().positive() }))
      .query(({ input }) => listTerreiroProductPrices(input.terreiroId)),

    setPrice: protectedProcedure
      .input(z.object({ terreiroId: z.number().int().positive(), productId: z.number().int().positive(), price: z.number().int().positive() }))
      .mutation(({ input }) => setTerreiroProductPrice(input.terreiroId, input.productId, input.price)),

    removePrice: protectedProcedure
      .input(z.object({ terreiroId: z.number().int().positive(), productId: z.number().int().positive() }))
      .mutation(({ input }) => removeTerreiroProductPrice(input.terreiroId, input.productId)),
  }),

  // Comodato: itens deixados no terreiro em dias de gira, sem pagamento
  // prévio — pagos se vendidos ("marcar vendido" registra a venda no canal
  // "terreiro"), devolvidos senão ("marcar devolvido" repõe o estoque).
  consignments: router({
    list: protectedProcedure
      .input(z.object({ terreiroId: z.number().int().positive(), includeSettled: z.boolean().optional() }))
      .query(({ input }) => listConsignments(input.terreiroId, input.includeSettled ?? false)),

    openCountByTerreiro: protectedProcedure.query(() => countOpenConsignmentsByTerreiro()),

    // Preço sugerido pro item na entrega (específico > plano > preço da loja)
    suggestedPrice: protectedProcedure
      .input(z.object({ terreiroId: z.number().int().positive(), productId: z.number().int().positive() }))
      .query(({ input }) => resolvePartnerPrice(input.terreiroId, input.productId)),

    create: protectedProcedure
      .input(
        z.object({
          terreiroId: z.number().int().positive(),
          productId: z.number().int().positive(),
          quantity: z.number().int().positive(),
          unitPrice: z.number().int().positive(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await createConsignment(input);
        const tierUpdate = await ensureMinimumBronzeForConsignment(input.terreiroId);
        await createAuditLog({
          userId: ctx.user.id,
          action: "consignment_created",
          module: "partners",
          description: `Comodato: ${input.quantity}x produto ${input.productId} deixado no terreiro ${input.terreiroId}`,
        });
        return { success: true, tierUpgraded: tierUpdate?.upgraded ?? false, newTierName: tierUpdate?.upgraded ? tierUpdate.tierName : null };
      }),

    markSold: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), quantity: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await markConsignmentSold(input.id, input.quantity);
        await createAuditLog({
          userId: ctx.user.id,
          action: "consignment_sold",
          module: "partners",
          description: `Comodato ID ${input.id}: ${input.quantity} item(ns) vendido(s)`,
        });
        return { success: true };
      }),

    markReturned: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), quantity: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await markConsignmentReturned(input.id, input.quantity);
        await createAuditLog({
          userId: ctx.user.id,
          action: "consignment_returned",
          module: "partners",
          description: `Comodato ID ${input.id}: ${input.quantity} item(ns) devolvido(s)`,
        });
        return { success: true };
      }),
  }),

  // Solicitações de comodato feitas pelo terreiro na aba "Comodato" do
  // Portal — Rafael confirma na entrega (define o preço combinado ali, o
  // estoque só baixa nesse momento) ou cancela.
  consignmentRequests: router({
    pendingForTerreiro: protectedProcedure
      .input(z.object({ terreiroId: z.number().int().positive() }))
      .query(({ input }) => listPendingConsignmentRequestsForTerreiro(input.terreiroId)),

    pendingCountByTerreiro: protectedProcedure.query(() => countPendingConsignmentRequestsByTerreiro()),

    confirm: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          items: z.array(z.object({ itemId: z.number().int().positive(), unitPrice: z.number().int().positive() })).min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await fulfillConsignmentRequest(input.id, input.items);
        const tierUpdate = await ensureMinimumBronzeForConsignment(result.terreiroId);
        await createAuditLog({
          userId: ctx.user.id,
          action: "consignment_request_fulfilled",
          module: "partners",
          description: `Solicitação de comodato ID ${input.id} entregue e confirmada`,
        });
        return { success: true, tierUpgraded: tierUpdate?.upgraded ?? false, newTierName: tierUpdate?.upgraded ? tierUpdate.tierName : null };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await cancelConsignmentRequest(input.id);
        await createAuditLog({
          userId: ctx.user.id,
          action: "consignment_request_cancelled",
          module: "partners",
          description: `Solicitação de comodato ID ${input.id} cancelada`,
        });
        return { success: true };
      }),
  }),
});

// ─── Portal do Parceiro (acesso dos terreiros) ────────────────────────────────
// Sessão própria (cookie terreiro_session_id), nunca a mesma dos usuários do
// sistema. O parceiro só enxerga produtos ativos em estoque com o preço de
// venda — o preço de custo nunca é incluído na resposta.

const portalRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.terreiro) return null;
    const tier = ctx.terreiro.tierId ? await getPartnerTierById(ctx.terreiro.tierId) : null;
    // Se logou com um usuário da equipe, a senha "pré-cadastrada" é a DELE,
    // não a do terreiro principal — o popup de trocar senha olha pra conta
    // certa dependendo de quem entrou.
    let mustChangePassword = ctx.terreiro.mustChangePassword === 1;
    let loggedInAsName = ctx.terreiro.name;
    if (ctx.teamUserId) {
      const teamUser = await getTerreiroUserById(ctx.teamUserId);
      mustChangePassword = teamUser?.mustChangePassword === 1;
      loggedInAsName = teamUser?.name ?? ctx.terreiro.name;
    }
    return {
      id: ctx.terreiro.id,
      name: ctx.terreiro.name,
      username: ctx.terreiro.username,
      contactName: ctx.terreiro.contactName,
      phone: ctx.terreiro.phone,
      logoUrl: ctx.terreiro.logoUrl,
      tierName: tier?.name ?? null,
      mustChangePassword,
      loggedInAsName,
      shippingZipCode: ctx.terreiro.shippingZipCode,
      shippingStreet: ctx.terreiro.shippingStreet,
      shippingNumber: ctx.terreiro.shippingNumber,
      shippingComplement: ctx.terreiro.shippingComplement,
      shippingNeighborhood: ctx.terreiro.shippingNeighborhood,
      shippingCity: ctx.terreiro.shippingCity,
      shippingState: ctx.terreiro.shippingState,
      referralCode: ctx.terreiro.referralCode,
    };
  }),

  // Aceita tanto o login principal do terreiro quanto um usuário da equipe
  // dele (terreiroUsers) — os dois caem na mesma sessão (mesmo terreiroId),
  // sem hierarquia entre eles.
  login: publicProcedure
    .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const terreiro = await getTerreiroByUsername(input.username);
      if (terreiro && terreiro.isActive && (await verifyPassword(input.password, terreiro.passwordHash))) {
        const sessionToken = await signTerreiroSession(terreiro.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(TERREIRO_COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        await touchTerreiroLastSignedIn(terreiro.id);
        return { success: true, terreiro: { id: terreiro.id, name: terreiro.name, username: terreiro.username } } as const;
      }

      const teamUser = await getTerreiroUserByUsername(input.username);
      if (teamUser && teamUser.isActive && (await verifyPassword(input.password, teamUser.passwordHash))) {
        const parentTerreiro = await getTerreiroById(teamUser.terreiroId);
        if (parentTerreiro && parentTerreiro.isActive) {
          const sessionToken = await signTerreiroSession(parentTerreiro.id, teamUser.id);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(TERREIRO_COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          await touchTerreiroUserLastSignedIn(teamUser.id);
          return { success: true, terreiro: { id: parentTerreiro.id, name: parentTerreiro.name, username: teamUser.username } } as const;
        }
      }

      throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos" });
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(TERREIRO_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  products: router({
    list: terreiroProcedure.query(({ ctx }) => listPartnerVisibleProducts(ctx.terreiro.id, ctx.terreiro.tierId)),
  }),

  // Dados de cadastro do próprio terreiro — consultar/editar (nome de
  // contato, telefone, logo). Username e plano continuam só editáveis pelo
  // admin (evita lockout e evita burlar o avanço automático de plano).
  profile: router({
    update: terreiroProcedure
      .input(
        z.object({
          contactName: z.string().max(255).optional(),
          phone: z.string().max(20).optional(),
          shippingZipCode: z.string().max(9).optional(),
          shippingStreet: z.string().max(255).optional(),
          shippingNumber: z.string().max(20).optional(),
          shippingComplement: z.string().max(100).optional(),
          shippingNeighborhood: z.string().max(100).optional(),
          shippingCity: z.string().max(100).optional(),
          shippingState: z.string().max(2).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await updateTerreiro(ctx.terreiro.id, {
          contactName: input.contactName ?? undefined,
          phone: input.phone ?? undefined,
          shippingZipCode: input.shippingZipCode ?? undefined,
          shippingStreet: input.shippingStreet ?? undefined,
          shippingNumber: input.shippingNumber ?? undefined,
          shippingComplement: input.shippingComplement ?? undefined,
          shippingNeighborhood: input.shippingNeighborhood ?? undefined,
          shippingCity: input.shippingCity ?? undefined,
          shippingState: input.shippingState ?? undefined,
        });
        return { success: true };
      }),

    uploadLogo: terreiroProcedure
      .input(z.object({ logoUrl: z.string().nullable() }))
      .mutation(async ({ input, ctx }) => {
        if (input.logoUrl && input.logoUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Logo muito grande. Tente uma imagem menor." });
        }
        await updateTerreiro(ctx.terreiro.id, { logoUrl: input.logoUrl });
        return { success: true };
      }),

    // Troca a senha de QUEM ESTÁ LOGADO — se entrou como usuário da equipe,
    // troca a senha dele; se entrou com o login principal, troca a do
    // terreiro. Exige a senha atual (a "pré-cadastrada", no primeiro acesso)
    // pra confirmar que é realmente quem diz ser.
    changePassword: terreiroProcedure
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6, "Senha deve ter ao menos 6 caracteres") }))
      .mutation(async ({ input, ctx }) => {
        const newPasswordHash = await hashPassword(input.newPassword);
        if (ctx.teamUserId) {
          const teamUser = await getTerreiroUserById(ctx.teamUserId);
          if (!teamUser || !(await verifyPassword(input.currentPassword, teamUser.passwordHash))) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
          }
          await updateTerreiroUserPassword(teamUser.id, newPasswordHash);
        } else {
          if (!(await verifyPassword(input.currentPassword, ctx.terreiro.passwordHash))) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
          }
          await updateTerreiro(ctx.terreiro.id, { passwordHash: newPasswordHash, mustChangePassword: 0 });
        }
        return { success: true };
      }),
  }),

  // Usuários adicionais que o terreiro cadastra pra acessar o mesmo Portal
  // (ex: quem cuida dos pedidos no dia a dia) — sem hierarquia entre eles.
  teamUsers: router({
    list: terreiroProcedure.query(({ ctx }) => listTerreiroUsers(ctx.terreiro.id)),

    create: terreiroProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          username: z.string().min(3).max(100).regex(/^[a-z0-9._-]+$/i, "Use apenas letras, números, ponto, hífen ou underline"),
          password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const passwordHash = await hashPassword(input.password);
        await createTerreiroUser({ terreiroId: ctx.terreiro.id, name: input.name, username: input.username, passwordHash });
        return { success: true };
      }),

    setActive: terreiroProcedure
      .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await setTerreiroUserActive(input.id, ctx.terreiro.id, input.isActive);
        return { success: true };
      }),
  }),

  // Itens em comodato com ESTE terreiro (sessão dele) — inclui histórico.
  consignments: router({
    list: terreiroProcedure
      .input(z.object({ includeSettled: z.boolean().optional() }).optional())
      .query(({ ctx, input }) => listConsignments(ctx.terreiro.id, input?.includeSettled ?? false)),
  }),

  // "Solicitar Produtos" na aba Comodato: o terreiro pede itens do ESTOQUE
  // DA LOJA (nunca do catálogo do fornecedor) pra Rafael entregar em
  // comodato. Não baixa estoque nem cria o comodato ainda — só quando o
  // admin confirma a entrega (terreiros.consignmentRequests.confirm).
  consignmentRequests: router({
    list: terreiroProcedure.query(({ ctx }) => listConsignmentRequestsForTerreiro(ctx.terreiro.id)),

    create: terreiroProcedure
      .input(
        z.object({
          items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
          notes: z.string().max(500).optional(),
          // Obrigatório aceitar o Contrato de Comodato antes de solicitar —
          // nunca confia só no client, sempre exige literalmente `true` aqui.
          termsAccepted: z.literal(true, { message: "É preciso aceitar os termos do contrato de comodato" }),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const stockItems = await listPartnerVisibleProducts(ctx.terreiro.id, ctx.terreiro.tierId);
        const stockById = new Map(stockItems.map((i) => [i.id, i]));
        const items = input.items.map(({ productId, quantity }) => {
          const item = stockById.get(productId);
          if (!item) throw new TRPCError({ code: "BAD_REQUEST", message: "Produto não encontrado ou indisponível" });
          if (quantity > item.currentStock) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Só há ${item.currentStock} unidade(s) de "${item.name}" em estoque` });
          }
          return { productId, name: item.name, quantity };
        });
        const result = await createConsignmentRequest(ctx.terreiro.id, items, input.notes, new Date());
        notifyConsignmentRequest(ctx.terreiro.name, items.length);
        return { success: true, requestId: result.id };
      }),
  }),

  // Tela "Gerar Pedidos": dois catálogos pra montar o pedido — itens do
  // fornecedor (nunca revela supplierId/sourceUrl/sourceSlug, o parceiro não
  // pode saber quem é o fornecedor) e produtos já no estoque da loja. Ambos
  // já com o preço do plano do parceiro aplicado e travados num mínimo de
  // 50% de comissão.
  orderCatalog: router({
    catalog: terreiroProcedure.query(async ({ ctx }) => {
      const discountPercent = ctx.terreiro.tierId
        ? (await getPartnerTierById(ctx.terreiro.tierId))?.discountPercent ?? 0
        : 0;
      const items = await listAvailableSupplierCatalogForOrders();
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        // Nunca a URL real do fornecedor — sempre pelo nosso proxy de imagem.
        imageUrl: item.imageUrl ? `/api/catalog-image/${item.id}` : null,
        price: computePartnerOrderItemPrice(item.price, item.suggestedSalePrice, discountPercent),
      }));
    }),

    stock: terreiroProcedure.query(async ({ ctx }) => {
      const items = await listPartnerOrderableStockProducts(ctx.terreiro.id, ctx.terreiro.tierId);
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        currentStock: item.currentStock,
        price: computePartnerOrderItemPrice(item.costPrice, item.salePrice, 0), // salePrice já vem com desconto do plano aplicado
      }));
    }),
  }),

  orders: router({
    minimumCents: terreiroProcedure.query(() => ORDER_MINIMUM_CENTS),

    list: terreiroProcedure.query(({ ctx }) => listPartnerOrdersForTerreiro(ctx.terreiro.id)),

    create: terreiroProcedure
      .input(
        z.object({
          items: z
            .array(
              z.object({
                source: z.enum(["catalogo", "estoque"]),
                id: z.number().int().positive(),
                quantity: z.number().int().positive(),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const discountPercent = ctx.terreiro.tierId
          ? (await getPartnerTierById(ctx.terreiro.tierId))?.discountPercent ?? 0
          : 0;

        const catalogItems = await listAvailableSupplierCatalogForOrders();
        const catalogById = new Map(catalogItems.map((i) => [i.id, i]));
        const stockItems = await listPartnerOrderableStockProducts(ctx.terreiro.id, ctx.terreiro.tierId);
        const stockById = new Map(stockItems.map((i) => [i.id, i]));

        const orderItems = input.items.map(({ source, id, quantity }) => {
          if (source === "catalogo") {
            const catalogItem = catalogById.get(id);
            if (!catalogItem) throw new TRPCError({ code: "BAD_REQUEST", message: "Item não encontrado ou indisponível" });
            const unitPrice = computePartnerOrderItemPrice(catalogItem.price, catalogItem.suggestedSalePrice, discountPercent);
            return {
              source: "catalogo" as const,
              supplierCatalogId: id,
              name: catalogItem.name,
              quantity,
              unitPrice,
              totalPrice: unitPrice * quantity,
            };
          }
          const stockItem = stockById.get(id);
          if (!stockItem) throw new TRPCError({ code: "BAD_REQUEST", message: "Produto não encontrado ou sem estoque" });
          if (quantity > stockItem.currentStock) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Só há ${stockItem.currentStock} unidade(s) de "${stockItem.name}" em estoque` });
          }
          const unitPrice = computePartnerOrderItemPrice(stockItem.costPrice, stockItem.salePrice, 0);
          return {
            source: "estoque" as const,
            productId: id,
            name: stockItem.name,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
          };
        });

        // Mínimo de R$150 vale só pros itens do fornecedor (reflete a compra
        // mínima real de R$300 que a loja tem com ele) — produto do estoque
        // já é da loja, não tem restrição nenhuma.
        const catalogSubtotal = orderItems.filter((i) => i.source === "catalogo").reduce((sum, item) => sum + item.totalPrice, 0);
        if (catalogSubtotal > 0 && catalogSubtotal < ORDER_MINIMUM_CENTS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Pedido mínimo de R$ ${(ORDER_MINIMUM_CENTS / 100).toFixed(2)} nos itens do fornecedor — faltam R$ ${((ORDER_MINIMUM_CENTS - catalogSubtotal) / 100).toFixed(2)}`,
          });
        }

        // Entrega usa o endereço já cadastrado do terreiro (Minha Conta) — se
        // ele ainda não preencheu o CEP, frete fica 0 e Rafael combina manualmente
        // (não bloqueia o pedido do parceiro, diferente da loja pública).
        const shippingConfig = await getSystemConfig();
        let shippingCents = 0;
        if (ctx.terreiro.shippingZipCode) {
          try {
            shippingCents = await computeShippingCents(
              "envio",
              ctx.terreiro.shippingZipCode,
              orderItems.some((i) => i.source === "estoque"),
              orderItems.some((i) => i.source === "catalogo"),
              shippingConfig
            );
          } catch {
            shippingCents = 0;
          }
        }
        const order = await createPartnerOrder(ctx.terreiro.id, orderItems, shippingCents);
        notifyPartnerOrder(ctx.terreiro.name, order.subtotal + shippingCents);
        const tierUpdate = await recalculatePartnerTierByOrders(ctx.terreiro.id);
        return {
          success: true,
          orderId: order.id,
          subtotal: order.subtotal,
          shippingCents,
          tierUpgraded: tierUpdate?.upgraded ?? false,
          newTierName: tierUpdate?.upgraded ? tierUpdate.tierName : null,
        };
      }),
  }),
});

// ─── Área do Cliente (login na loja pública) ───────────────────────────────────
// Conta OPCIONAL do cliente final — sessão própria (cookie customer_session_id),
// nunca se mistura com a sessão de staff nem de parceiro. Cadastro por e-mail/
// senha ou "Entrar com Google" (token verificado em server/_core/googleAuth.ts).
// Continua dando pra comprar sem conta (checkout de visitante inalterado).

const accountRouter = router({
  // hasGoogleLogin: o client só mostra o botão do Google se isso vier true
  // (ou seja, se o Rafael já configurou o GOOGLE_CLIENT_ID).
  config: publicProcedure.query(() => ({
    hasGoogleLogin: !!ENV.googleClientId,
    googleClientId: ENV.googleClientId || null,
  })),

  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.customer) return null;
    return {
      id: ctx.customer.id,
      name: ctx.customer.name,
      email: ctx.customer.email,
      phone: ctx.customer.phone,
      hasPassword: !!ctx.customer.passwordHash,
      hasGoogle: !!ctx.customer.googleId,
      shippingZipCode: ctx.customer.shippingZipCode,
      shippingStreet: ctx.customer.shippingStreet,
      shippingNumber: ctx.customer.shippingNumber,
      shippingComplement: ctx.customer.shippingComplement,
      shippingNeighborhood: ctx.customer.shippingNeighborhood,
      shippingCity: ctx.customer.shippingCity,
      shippingState: ctx.customer.shippingState,
    };
  }),

  signup: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email(),
        password: z.string().min(6).max(100),
        phone: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await getCustomerByEmail(input.email);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Já existe uma conta com esse e-mail" });
      const passwordHash = await hashPassword(input.password);
      const customer = await createCustomer({
        name: input.name,
        email: input.email,
        passwordHash,
        phone: input.phone || null,
      });
      if (!customer) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar conta" });
      const sessionToken = await signCustomerSession(customer.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(CUSTOMER_COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      await touchCustomerLastSignedIn(customer.id);
      return { success: true, name: customer.name } as const;
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const customer = await getCustomerByEmail(input.email);
      if (!customer || !customer.isActive || !customer.passwordHash || !(await verifyPassword(input.password, customer.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos" });
      }
      const sessionToken = await signCustomerSession(customer.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(CUSTOMER_COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      await touchCustomerLastSignedIn(customer.id);
      return { success: true, name: customer.name } as const;
    }),

  // "Entrar com Google" — recebe o ID token do Google Identity Services,
  // verifica a assinatura (server/_core/googleAuth.ts) e cria a conta na
  // primeira vez (ou entra, se já existir pelo e-mail ou pelo google id).
  loginWithGoogle: publicProcedure
    .input(z.object({ idToken: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const profile = await verifyGoogleIdToken(input.idToken);
      if (!profile) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não foi possível confirmar o login do Google" });

      let customer = await getCustomerByGoogleId(profile.googleId);
      if (!customer) {
        const byEmail = await getCustomerByEmail(profile.email);
        if (byEmail) {
          await updateCustomer(byEmail.id, { googleId: profile.googleId });
          customer = await getCustomerById(byEmail.id);
        } else {
          customer = await createCustomer({ name: profile.name, email: profile.email, googleId: profile.googleId });
        }
      }
      if (!customer || !customer.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Conta indisponível" });
      }

      const sessionToken = await signCustomerSession(customer.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(CUSTOMER_COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      await touchCustomerLastSignedIn(customer.id);
      return { success: true, name: customer.name } as const;
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(CUSTOMER_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  updateProfile: customerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        phone: z.string().max(20).optional(),
        shippingAddress: shippingAddressSchema.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updateCustomer(ctx.customer.id, {
        name: input.name,
        phone: input.phone,
        shippingZipCode: input.shippingAddress?.zipCode,
        shippingStreet: input.shippingAddress?.street,
        shippingNumber: input.shippingAddress?.number,
        shippingComplement: input.shippingAddress?.complement,
        shippingNeighborhood: input.shippingAddress?.neighborhood,
        shippingCity: input.shippingAddress?.city,
        shippingState: input.shippingAddress?.state,
      });
      return { success: true };
    }),

  changePassword: customerProcedure
    .input(z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(6).max(100) }))
    .mutation(async ({ input, ctx }) => {
      // Quem só tem login do Google ainda não tem senha — pode criar uma
      // direto, sem precisar confirmar a "atual" (não existe uma ainda).
      if (ctx.customer.passwordHash) {
        if (!input.currentPassword || !(await verifyPassword(input.currentPassword, ctx.customer.passwordHash))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Senha atual incorreta" });
        }
      }
      const passwordHash = await hashPassword(input.newPassword);
      await updateCustomer(ctx.customer.id, { passwordHash });
      return { success: true };
    }),

  orders: customerProcedure.query(({ ctx }) => listCustomerOrders(ctx.customer.id)),
});

// ─── Catálogo Público (loja online, sem login) ─────────────────────────────────
// Página pública equivalente ao Portal do Parceiro, mas sem sessão nenhuma —
// preço cheio (sem desconto de plano) na aba Produtos, e preço cheio + 5% na
// aba Fazer Pedidos. Nunca revela quem é o fornecedor, igual ao portal.

const publicStoreRouter = router({
  // Frete (Fase 1 do plano de expansão nacional): info pública pro cliente
  // ver "grátis em Ribeirão Preto" etc. antes de fechar — o valor cobrado de
  // verdade é sempre recalculado no servidor na hora de criar o pedido.
  // Cupom de indicação (Fase 2): valida um código de terreiro sem revelar
  // nada sensível — só se é válido e o nome, pro cliente confirmar.
  coupons: router({
    validate: publicProcedure
      .input(z.object({ code: z.string().min(1).max(30) }))
      .query(async ({ input }) => {
        const terreiro = await getTerreiroByReferralCode(input.code);
        if (!terreiro || !terreiro.isActive) return { valid: false as const };
        return { valid: true as const, terreiroName: terreiro.name, discountPercent: COUPON_DISCOUNT_PERCENT };
      }),
  }),

  shipping: router({
    info: publicProcedure.query(async () => {
      const config = await getSystemConfig();
      return {
        perKmCents: config?.shippingPerKmCents ?? 150,
        supplierFixedCents: config?.shippingSupplierFixedCents ?? 4000,
      };
    }),

    // Prévia do frete real (com distância) antes de confirmar o pedido — o
    // valor cobrado de verdade é sempre recalculado de novo na hora de criar
    // o pedido/pagamento, isso aqui é só pra mostrar pro cliente com antecedência.
    preview: publicProcedure
      .input(
        z.object({
          zipCode: z.string().min(8).max(9),
          hasEstoqueItems: z.boolean(),
          hasCatalogoItems: z.boolean(),
        })
      )
      .query(async ({ input }) => {
        const config = await getSystemConfig();
        const shippingCents = await computeShippingCents(
          "envio",
          input.zipCode,
          input.hasEstoqueItems,
          input.hasCatalogoItems,
          config
        );
        return { shippingCents };
      }),
  }),

  // Aba "Produtos": só o estoque da loja, preço cheio, pra qualquer visitante ver.
  products: router({
    list: publicProcedure.query(async () => {
      const items = await listActiveProductsFullPrice();
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        currentStock: item.currentStock,
        price: item.salePrice,
      }));
    }),
  }),

  // Aba "Pronta Entrega": compra direta, com pagamento na hora via
  // InfinitePay — carrinho separado do de "Fazer Pedidos" (aquele é só um
  // pedido por encomenda, sem pagamento). Preço é o preço cheio mostrado na
  // vitrine, sem os 5% de "Fazer Pedidos". Igual ao padrão já usado nas
  // Vendas: nunca confia em pagamento sem reconferir direto na InfinitePay.
  prontaEntrega: router({
    checkout: publicProcedure
      .input(
        z.object({
          customerName: z.string().min(1).max(255),
          customerPhone: z.string().min(8).max(20),
          items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
          shippingMethod: z.enum(["retirada", "envio"]).default("retirada"),
          shippingAddress: shippingAddressSchema.optional(),
          couponCode: z.string().max(30).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const config = await getSystemConfig();
        const handle = config?.infinitePayHandle;
        if (!handle) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A loja ainda não configurou pagamento online. Fale com a gente pra finalizar seu pedido.",
          });
        }
        if (input.shippingMethod === "envio" && !input.shippingAddress) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o endereço de entrega" });
        }
        if (input.shippingMethod === "envio" && !isRibeiraoPretoCity(input.shippingAddress?.city)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Por enquanto só entregamos em Ribeirão Preto. Pra outras cidades, escolha retirar na loja.",
          });
        }

        const stockItems = await listActiveProductsFullPrice();
        const stockById = new Map(stockItems.map((i) => [i.id, i]));
        let orderItems = input.items.map(({ productId, quantity }) => {
          const stockItem = stockById.get(productId);
          if (!stockItem) throw new TRPCError({ code: "BAD_REQUEST", message: "Produto não encontrado ou sem estoque" });
          if (quantity > stockItem.currentStock) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Só há ${stockItem.currentStock} unidade(s) de "${stockItem.name}" em estoque` });
          }
          const unitPrice = Math.max(stockItem.salePrice, Math.ceil(stockItem.costPrice * MIN_ORDER_MARGIN_MULT));
          return {
            source: "estoque" as const,
            productId,
            name: stockItem.name,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
          };
        });

        let referredByTerreiroId: number | null = null;
        let discountCents = 0;
        if (input.couponCode) {
          const terreiro = await getTerreiroByReferralCode(input.couponCode);
          if (terreiro && terreiro.isActive) {
            referredByTerreiroId = terreiro.id;
            const result = applyCouponDiscount(orderItems);
            orderItems = result.items;
            discountCents = result.discountCents;
          }
        }

        const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const shippingCents = await computeShippingCents(
          input.shippingMethod,
          input.shippingAddress?.zipCode,
          true,
          false,
          config
        );

        const order = await createPublicOrder({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerId: ctx.customer?.id ?? null,
          items: orderItems,
          paymentMethod: "infinitepay",
          shippingMethod: input.shippingMethod,
          shippingCents,
          shippingAddress: input.shippingAddress ?? null,
          couponCode: referredByTerreiroId ? input.couponCode : null,
          referredByTerreiroId,
          discountCents,
        });

        // Se a InfinitePay falhar aqui, o pedido já foi gravado — cancela
        // pra não ficar "pendente" pra sempre sem cobrança nenhuma vinculada
        // (senão fica um lixo confuso em "Pedidos do Site").
        try {
          const orderNsu = randomUUID();
          const chargeItems = orderItems.map((i) => ({ quantity: i.quantity, price: i.unitPrice, description: i.name }));
          if (shippingCents > 0) chargeItems.push({ quantity: 1, price: shippingCents, description: "Frete" });
          const { url } = await createPaymentLink({
            handle,
            orderNsu,
            items: chargeItems,
            webhookUrl: `${PUBLIC_BASE_URL}/api/webhooks/infinitepay`,
          });
          await createInfinitePayCharge({
            orderNsu,
            amountCents: subtotal + shippingCents,
            description: `Pedido site #${order.id}`,
            checkoutUrl: url,
            publicOrderId: order.id,
          });
          return { orderNsu, checkoutUrl: url, orderId: order.id, subtotal, shippingCents, discountCents };
        } catch (error) {
          await updatePublicOrderStatus(order.id, "cancelado");
          throw error;
        }
      }),

    // Mesma lógica de checkChargeStatus (staff): sempre reconfere direto na
    // InfinitePay antes de considerar pago, já que a API não tem assinatura.
    checkStatus: publicProcedure
      .input(z.object({ orderNsu: z.string().min(1) }))
      .query(async ({ input }) => {
        const charge = await getInfinitePayChargeByOrderNsu(input.orderNsu);
        if (!charge) throw new TRPCError({ code: "NOT_FOUND", message: "Cobrança não encontrada" });
        if (charge.status === "paid") return { status: "paid" as const };

        const config = await getSystemConfig();
        const handle = config?.infinitePayHandle;
        if (handle) {
          const result = await checkPayment({ handle, orderNsu: input.orderNsu });
          if (result.paid) {
            await markInfinitePayChargePaid(input.orderNsu, {
              paidAmountCents: result.paidAmount,
              captureMethod: result.captureMethod,
            });
            await fulfillPublicOrderForCharge(input.orderNsu);
            return { status: "paid" as const };
          }
        }
        return { status: "pending" as const };
      }),
  }),

  // Aba "Fazer Pedidos": catálogo do fornecedor (nunca revela quem é) +
  // estoque da loja, ambos a preço cheio + 5%.
  orderCatalog: router({
    catalog: publicProcedure.query(async () => {
      const items = await listAvailableSupplierCatalogForOrders();
      return items.map((item) => {
        const fullPrice = item.suggestedSalePrice ?? suggestSalePrice(item.price);
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          imageUrl: item.imageUrl ? `/api/catalog-image/${item.id}` : null,
          price: computePublicOrderItemPrice(item.price, fullPrice),
        };
      });
    }),

    stock: publicProcedure.query(async () => {
      const items = await listActiveProductsFullPrice();
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        currentStock: item.currentStock,
        price: computePublicOrderItemPrice(item.costPrice, item.salePrice),
      }));
    }),
  }),

  orders: router({
    minimumCents: publicProcedure.query(() => ORDER_MINIMUM_CENTS),

    create: publicProcedure
      .input(
        z.object({
          customerName: z.string().min(1).max(255),
          customerPhone: z.string().min(8).max(20),
          items: z
            .array(
              z.object({
                source: z.enum(["catalogo", "estoque"]),
                id: z.number().int().positive(),
                quantity: z.number().int().positive(),
              })
            )
            .min(1),
          shippingMethod: z.enum(["retirada", "envio"]).default("retirada"),
          shippingAddress: shippingAddressSchema.optional(),
          couponCode: z.string().max(30).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.shippingMethod === "envio" && !input.shippingAddress) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o endereço de entrega" });
        }
        if (input.shippingMethod === "envio" && !isRibeiraoPretoCity(input.shippingAddress?.city)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Por enquanto só entregamos em Ribeirão Preto. Pra outras cidades, escolha retirar na loja.",
          });
        }
        const catalogItems = await listAvailableSupplierCatalogForOrders();
        const catalogById = new Map(catalogItems.map((i) => [i.id, i]));
        const stockItems = await listActiveProductsFullPrice();
        const stockById = new Map(stockItems.map((i) => [i.id, i]));

        let orderItems = input.items.map(({ source, id, quantity }) => {
          if (source === "catalogo") {
            const catalogItem = catalogById.get(id);
            if (!catalogItem) throw new TRPCError({ code: "BAD_REQUEST", message: "Item não encontrado ou indisponível" });
            const fullPrice = catalogItem.suggestedSalePrice ?? suggestSalePrice(catalogItem.price);
            const unitPrice = computePublicOrderItemPrice(catalogItem.price, fullPrice);
            return {
              source: "catalogo" as const,
              supplierCatalogId: id,
              name: catalogItem.name,
              quantity,
              unitPrice,
              totalPrice: unitPrice * quantity,
            };
          }
          const stockItem = stockById.get(id);
          if (!stockItem) throw new TRPCError({ code: "BAD_REQUEST", message: "Produto não encontrado ou sem estoque" });
          if (quantity > stockItem.currentStock) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Só há ${stockItem.currentStock} unidade(s) de "${stockItem.name}" em estoque` });
          }
          const unitPrice = computePublicOrderItemPrice(stockItem.costPrice, stockItem.salePrice);
          return {
            source: "estoque" as const,
            productId: id,
            name: stockItem.name,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
          };
        });

        const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
        // Mínimo de R$150 vale só pros itens do fornecedor — estoque não tem restrição.
        const catalogSubtotal = orderItems.filter((i) => i.source === "catalogo").reduce((sum, item) => sum + item.totalPrice, 0);
        if (catalogSubtotal > 0 && catalogSubtotal < ORDER_MINIMUM_CENTS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Pedido mínimo de R$ ${(ORDER_MINIMUM_CENTS / 100).toFixed(2)} nos itens do fornecedor — faltam R$ ${((ORDER_MINIMUM_CENTS - catalogSubtotal) / 100).toFixed(2)}`,
          });
        }

        let referredByTerreiroId: number | null = null;
        let discountCents = 0;
        if (input.couponCode) {
          const terreiro = await getTerreiroByReferralCode(input.couponCode);
          if (terreiro && terreiro.isActive) {
            referredByTerreiroId = terreiro.id;
            const result = applyCouponDiscount(orderItems);
            orderItems = result.items;
            discountCents = result.discountCents;
          }
        }

        const config = await getSystemConfig();
        const shippingCents = await computeShippingCents(
          input.shippingMethod,
          input.shippingAddress?.zipCode,
          orderItems.some((i) => i.source === "estoque"),
          orderItems.some((i) => i.source === "catalogo"),
          config
        );
        const order = await createPublicOrder({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerId: ctx.customer?.id ?? null,
          items: orderItems,
          shippingMethod: input.shippingMethod,
          shippingCents,
          shippingAddress: input.shippingAddress ?? null,
          couponCode: referredByTerreiroId ? input.couponCode : null,
          referredByTerreiroId,
          discountCents,
        });
        const finalSubtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
        notifyPublicOrder(input.customerName, finalSubtotal + shippingCents);
        return { success: true, orderId: order.id, subtotal: finalSubtotal, shippingCents, discountCents };
      }),
  }),
});

// ─── Pedidos do Catálogo Público (visão do admin) ──────────────────────────────

const publicOrdersRouter = router({
  list: protectedProcedure.query(() => listAllPublicOrders()),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["pendente", "confirmado", "entregue", "cancelado"]) }))
    .mutation(async ({ input, ctx }) => {
      await updatePublicOrderStatus(input.id, input.status);
      await createAuditLog({
        userId: ctx.user.id,
        action: "public_order_status_updated",
        module: "public_store",
        description: `Pedido do site ID ${input.id} marcado como "${input.status}"`,
      });
      return { success: true };
    }),

  updateTracking: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), trackingCode: z.string().max(100).optional(), carrier: z.string().max(100).optional() }))
    .mutation(async ({ input, ctx }) => {
      await updatePublicOrderTracking(input.id, input.trackingCode?.trim() || null, input.carrier?.trim() || null);
      await createAuditLog({
        userId: ctx.user.id,
        action: "public_order_tracking_updated",
        module: "public_store",
        description: `Pedido do site ID ${input.id}: rastreio atualizado`,
      });
      return { success: true };
    }),
});

// ─── Solicitações de Parceria (página pública "Parceria com a Toca") ──────────
// Terreiro interessado preenche o formulário — não cria login sozinho, só
// avisa o Rafael, que entra em contato e cria o acesso pelo cadastro normal.

const partnerApplicationsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        terreiroName: z.string().min(1).max(255),
        contactName: z.string().min(1).max(255),
        phone: z.string().min(8).max(20),
        city: z.string().max(100).optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createPartnerApplication({
        terreiroName: input.terreiroName,
        contactName: input.contactName,
        phone: input.phone,
        city: input.city || null,
        notes: input.notes || null,
      });
      notifyPartnerApplication(input.terreiroName, input.contactName);
      return { success: true };
    }),

  // Ferramenta de prospecção: o Rafael cadastra manualmente um terreiro que
  // achou (ex: busca por cidade), com dados que uma solicitação pelo site
  // não tem (endereço, Instagram). Cai na mesma lista/fluxo de aprovação das
  // solicitações que vêm pelo site — só o "source" que os diferencia.
  createManual: protectedProcedure
    .input(
      z.object({
        terreiroName: z.string().min(1).max(255),
        // Ao contrário do formulário público (onde quem preenche já tem
        // certeza dos próprios dados), um lead de prospecção pode começar só
        // com o nome achado numa busca — contato e telefone vêm depois.
        contactName: z.string().max(255).optional(),
        phone: z.string().max(20).optional(),
        city: z.string().max(100).optional(),
        instagram: z.string().max(100).optional(),
        address: z.string().max(1000).optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await createPartnerApplication({
        terreiroName: input.terreiroName,
        contactName: input.contactName || "A definir",
        phone: input.phone || "A confirmar",
        city: input.city || null,
        instagram: input.instagram || null,
        address: input.address || null,
        notes: input.notes || null,
        source: "prospeccao",
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_prospect_added",
        module: "partners",
        description: `Lead de prospecção "${input.terreiroName}" adicionado`,
      });
      return { success: true };
    }),

  // Busca automática de verdade (OpenStreetMap/Overpass API — gratuita, sem
  // chave) — roda toda vez que o admin clica no botão, não é um robô
  // rodando sozinho em segundo plano. Cobertura é menor que Google Maps
  // (depende do que já foi cadastrado no mapa aberto por voluntários), mas
  // não exige nenhuma conta nem cartão configurado.
  searchProspects: protectedProcedure
    .input(z.object({ city: z.string().min(1).max(100).default("Ribeirão Preto") }))
    .mutation(async ({ input, ctx }) => {
      let found: Awaited<ReturnType<typeof searchOsmTerreiros>> = [];
      try {
        found = await searchOsmTerreiros(input.city);
      } catch (error) {
        console.error("[searchProspects] Erro na busca OpenStreetMap:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Não consegui buscar agora — o serviço de mapas pode estar sobrecarregado. Tente de novo em alguns minutos.",
        });
      }

      const existing = await listPartnerApplications();
      const existingNames = new Set(existing.map((e) => e.terreiroName.trim().toLowerCase()));
      const terreiroNames = new Set((await listTerreiros(true)).map((t) => t.name.trim().toLowerCase()));

      let added = 0;
      for (const prospect of found) {
        const key = prospect.name.trim().toLowerCase();
        if (existingNames.has(key) || terreiroNames.has(key)) continue;
        await createPartnerApplication({
          terreiroName: prospect.name,
          contactName: "A definir",
          phone: "A confirmar",
          city: input.city,
          instagram: null,
          address: prospect.address,
          notes: `Achado automaticamente via OpenStreetMap (${prospect.lat.toFixed(5)}, ${prospect.lon.toFixed(5)}).`,
          source: "prospeccao",
        });
        existingNames.add(key);
        added += 1;
      }

      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_prospect_search",
        module: "partners",
        description: `Busca automática em "${input.city}": ${found.length} encontrado(s), ${added} novo(s) adicionado(s)`,
      });

      return { totalFound: found.length, added };
    }),

  list: protectedProcedure.query(() => listPartnerApplications()),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["pendente", "aprovado", "recusado"]) }))
    .mutation(async ({ input, ctx }) => {
      await updatePartnerApplicationStatus(input.id, input.status);
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_application_status_updated",
        module: "partners",
        description: `Solicitação de parceria ID ${input.id} marcada como "${input.status}"`,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await deletePartnerApplication(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_application_deleted",
        module: "partners",
        description: `Solicitação/lead ID ${input.id} removido`,
      });
      return { success: true };
    }),
});

// ─── Planos de Parceria (Cobre/Bronze/Prata/Ouro/Diamante) ────────────────────
// 5 planos fixos, cada um com um percentual de desconto fixo sobre o preço de
// venda da loja. O preço do terreiro é sempre calculado na hora a partir
// desse desconto — não existe mais preço manual por produto dentro do plano,
// então cadastro de produto novo e mudança de preço já refletem sozinhos.

const partnerTiersRouter = router({
  list: protectedProcedure.query(() => listPartnerTiers()),

  // Só o percentual de desconto é editável — os 5 planos e sua ordem são fixos.
  updateDiscount: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), discountPercent: z.number().int().min(0).max(99) }))
    .mutation(async ({ input, ctx }) => {
      await updatePartnerTierDiscount(input.id, input.discountPercent);
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_tier_updated",
        module: "partners",
        description: `Desconto do plano ID ${input.id} alterado para ${input.discountPercent}%`,
      });
      return { success: true };
    }),
});

// ─── Pedidos de Parceiros (visão do admin) ─────────────────────────────────────
// O que os terreiros pediram pela tela "Gerar Pedidos" do Portal — pra
// confirmar, marcar como entregue depois que fizer a compra no fornecedor e
// entregar, ou cancelar.

const partnerOrdersRouter = router({
  list: protectedProcedure.query(() => listAllPartnerOrders()),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["pendente", "confirmado", "entregue", "cancelado"]) }))
    .mutation(async ({ input, ctx }) => {
      await updatePartnerOrderStatus(input.id, input.status);
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_order_status_updated",
        module: "partners",
        description: `Pedido de parceiro ID ${input.id} marcado como "${input.status}"`,
      });
      return { success: true };
    }),

  updateTracking: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), trackingCode: z.string().max(100).optional(), carrier: z.string().max(100).optional() }))
    .mutation(async ({ input, ctx }) => {
      await updatePartnerOrderTracking(input.id, input.trackingCode?.trim() || null, input.carrier?.trim() || null);
      await createAuditLog({
        userId: ctx.user.id,
        action: "partner_order_tracking_updated",
        module: "partners",
        description: `Pedido de parceiro ID ${input.id}: rastreio atualizado`,
      });
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => (opts.ctx.user ? stripPasswordHash(opts.ctx.user) : null)),
    needsSetup: publicProcedure.query(async () => {
      const existing = await listUsers();
      return existing.length === 0;
    }),
    setup: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Nome é obrigatório"),
          email: z.string().email("Email inválido"),
          password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await listUsers();
        if (existing.length > 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Configuração inicial já foi concluída" });
        }

        const passwordHash = await hashPassword(input.password);
        await createLocalUser({ name: input.name, email: input.email, role: "admin", passwordHash });
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar administrador" });

        const sessionToken = await sdk.signSession(
          { openId: user.openId, appId: process.env.VITE_APP_ID ?? "sistema-gestao", name: user.name ?? "" },
          { expiresInMs: ONE_YEAR_MS }
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true, user: stripPasswordHash(user) } as const;
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(1, "Senha é obrigatória"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha inválidos" });
        }

        const sessionToken = await sdk.signSession(
          { openId: user.openId, appId: process.env.VITE_APP_ID ?? "sistema-gestao", name: user.name ?? "" },
          { expiresInMs: ONE_YEAR_MS }
        );

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true, user: stripPasswordHash(user) } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  products: productsRouter,
  purchases: purchasesRouter,
  sales: salesRouter,
  analytics: analyticsRouter,
  settings: settingsRouter,
  suppliers: suppliersRouter,
  supplierCatalog: supplierCatalogRouter,
  users: usersRouter,
  customers: customersRouter,
  receipts: receiptsRouter,
  terreiros: terreirosRouter,
  portal: portalRouter,
  partnerTiers: partnerTiersRouter,
  partnerOrders: partnerOrdersRouter,
  publicStore: publicStoreRouter,
  publicOrders: publicOrdersRouter,
  account: accountRouter,
  partnerApplications: partnerApplicationsRouter,
  infinitePay: infinitePayRouter,
  paymentMethods: paymentMethodsRouter,
});

export type AppRouter = typeof appRouter;
