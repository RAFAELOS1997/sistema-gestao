import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import { fetchSupplierProductStatus, fetchSupplierProductImage } from "./_core/supplierScraper";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createProduct,
  createSale,
  createPurchase,
  updatePurchase,
  deleteProduct,
  deactivateProduct,
  reactivateProduct,
  getAnalyticsByCategory,
  getDashboardKPIs,
  getProductById,
  listProducts,
  listSales,
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
} from "./db";

// ─── Products Router ──────────────────────────────────────────────────────────

const productsRouter = router({
  list: protectedProcedure.query(() => listProducts()),

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
      })
    )
    .mutation(({ input }) => createProduct(input)),

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
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
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
        channel: z.enum(["fisico", "instagram"]),
        saleDate: z.date(),
      })
    )
    .mutation(async ({ input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new Error("Produto não encontrado");
      if (product.currentStock < input.quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.currentStock}`);
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

const usersRouter = router({
  list: protectedProcedure.query(() => listUsers()),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ input }) => getUserById(input.id)),

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

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
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

        return { success: true, user } as const;
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

        return { success: true, user } as const;
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
  receipts: receiptsRouter,
});

export type AppRouter = typeof appRouter;
