import { int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"]).notNull(),
  costPrice: int("costPrice").notNull(), // em centavos
  salePrice: int("salePrice").notNull(), // em centavos
  currentStock: int("currentStock").notNull().default(0),
  minimumStock: int("minimumStock").notNull().default(5),
  description: text("description"),
  imageUrl: mediumtext("imageUrl"), // mediumtext pra caber foto enviada do dispositivo (base64)
  isActive: int("isActive").default(1).notNull(), // 1 = ativo, 0 = inativo (soft delete)
  // Peso e dimensões (Fase 1 do plano de expansão nacional) — base pra
  // calcular frete por peso/CEP mais pra frente; opcional, não bloqueia nada.
  weightGrams: int("weightGrams"),
  lengthCm: int("lengthCm"),
  widthCm: int("widthCm"),
  heightCm: int("heightCm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(), // em centavos
  totalPrice: int("totalPrice").notNull(), // em centavos
  profit: int("profit").notNull(), // em centavos
  channel: mysqlEnum("channel", ["fisico", "instagram", "terreiro", "site"]).notNull().default("fisico"),
  terreiroId: int("terreiroId"), // preenchido quando channel = "terreiro", pra somar gasto por parceiro
  saleDate: timestamp("saleDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(), // em centavos
  totalPrice: int("totalPrice").notNull(), // em centavos
  supplier: varchar("supplier", { length: 255 }).notNull(),
  channel: mysqlEnum("channel", ["direto", "distribuidor", "fabricante"]).notNull().default("distribuidor"),
  purchaseDate: timestamp("purchaseDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = typeof purchases.$inferInsert;

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  cnpj: varchar("cnpj", { length: 18 }),
  paymentTerms: varchar("paymentTerms", { length: 100 }),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

export const productSuppliers = mysqlTable("productSuppliers", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  supplierId: int("supplierId").notNull(),
  supplierProductCode: varchar("supplierProductCode", { length: 100 }),
  costPrice: int("costPrice").notNull(), // em centavos
  minimumOrderQuantity: int("minimumOrderQuantity").default(1),
  leadTimeDays: int("leadTimeDays").default(7),
  isPreferred: int("isPreferred").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSupplier = typeof productSuppliers.$inferSelect;
export type InsertProductSupplier = typeof productSuppliers.$inferInsert;

// ─── System Configuration ──────────────────────────────────────────────────────

export const systemConfig = mysqlTable("systemConfig", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }).default("Toca da Pantera"),
  companyEmail: varchar("companyEmail", { length: 320 }),
  timezone: varchar("timezone", { length: 64 }).default("America/Sao_Paulo"),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  language: varchar("language", { length: 10 }).default("pt-BR"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#d4af37"), // Dourado
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#000000"), // Preto
  logoUrl: text("logoUrl"),
  // InfiniteTag (identificador público, sem o "$") usada pra gerar cobranças
  // via API da InfinitePay — não é uma chave secreta.
  infinitePayHandle: varchar("infinitePayHandle", { length: 100 }),
  // Frete fixo por região (Fase 1 do plano de expansão nacional) — 3 faixas
  // simples, sem integração externa nenhuma: local (cidade+UF configurados
  // abaixo), resto do mesmo estado, resto do Brasil. Tudo em centavos.
  shippingLocalCity: varchar("shippingLocalCity", { length: 100 }).default("Ribeirão Preto"),
  shippingLocalState: varchar("shippingLocalState", { length: 2 }).default("SP"),
  shippingLocalCents: int("shippingLocalCents").default(0).notNull(),
  shippingStateCents: int("shippingStateCents").default(0).notNull(),
  shippingNationalCents: int("shippingNationalCents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

// Formas de pagamento nativas do sistema (Dinheiro/Pix/Débito/Crédito/Cheque)
// — fixas (não dá pra criar/excluir pela UI), mas o admin pode ativar/
// desativar e renomear cada uma. InfinitePay não entra aqui: é uma forma à
// parte, condicionada a ter a InfiniteTag configurada em systemConfig.
export const paymentMethods = mysqlTable("paymentMethods", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  enabled: int("enabled").notNull().default(1),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// Cobranças geradas via InfinitePay (Checkout Integrado) — cada venda paga
// por lá vira uma linha aqui, pra acompanhar o status até o pagamento cair.
export const infinitePayCharges = mysqlTable("infinitePayCharges", {
  id: int("id").autoincrement().primaryKey(),
  orderNsu: varchar("orderNsu", { length: 64 }).notNull().unique(),
  amountCents: int("amountCents").notNull(),
  description: varchar("description", { length: 255 }),
  checkoutUrl: text("checkoutUrl").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "failed"]).default("pending").notNull(),
  invoiceSlug: varchar("invoiceSlug", { length: 100 }),
  transactionNsu: varchar("transactionNsu", { length: 100 }),
  paidAmountCents: int("paidAmountCents"),
  captureMethod: varchar("captureMethod", { length: 32 }),
  receiptUrl: text("receiptUrl"),
  publicOrderId: int("publicOrderId"), // preenchido quando a cobrança é do checkout Pronta Entrega
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InfinitePayCharge = typeof infinitePayCharges.$inferSelect;
export type InsertInfinitePayCharge = typeof infinitePayCharges.$inferInsert;

// ─── Roles and Permissions ─────────────────────────────────────────────────────

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
  isBuiltIn: int("isBuiltIn").default(0), // 1 para roles padrão (Admin, Gerente, Vendedor, Visualizador)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(), // ex: "products:create", "sales:read"
  description: text("description"),
  module: varchar("module", { length: 64 }).notNull(), // "products", "sales", "purchases", "users", "settings"
  action: varchar("action", { length: 64 }).notNull(), // "create", "read", "update", "delete"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

export const rolePermissions = mysqlTable("rolePermissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: int("roleId").notNull(),
  permissionId: int("permissionId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

// ─── User Roles (many-to-many) ────────────────────────────────────────────────

export const userRoles = mysqlTable("userRoles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 128 }).notNull(), // "user_created", "config_updated", etc
  module: varchar("module", { length: 64 }).notNull(), // "users", "settings", "products", etc
  description: text("description"),
  changes: text("changes"), // JSON com antes/depois
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ─── Supplier Catalog (Catálogo de Fornecedores) ──────────────────────────────

export const supplierCatalog = mysqlTable("supplierCatalog", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["guias", "pulseiras", "velas", "incensos", "ervas", "imagens", "ferramentas", "vestuario", "livros", "pedras", "outros"]).notNull(),
  sourceSlug: varchar("sourceSlug", { length: 255 }).notNull(), // identificador único do produto no site do fornecedor
  sourceUrl: text("sourceUrl").notNull(),
  imageUrl: text("imageUrl"),
  price: int("price").notNull(), // preço de atacado em centavos
  suggestedSalePrice: int("suggestedSalePrice"), // sugestão calculada, em centavos
  stockStatus: mysqlEnum("stockStatus", ["disponivel", "indisponivel", "desconhecido"]).default("desconhecido").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupplierCatalogItem = typeof supplierCatalog.$inferSelect;
export type InsertSupplierCatalogItem = typeof supplierCatalog.$inferInsert;

// ─── Receipts (Recibos) ──────────────────────────────────────────────────────

export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  receiptNumber: int("receiptNumber").notNull().unique(), // Numeração sequencial
  subtotal: int("subtotal").notNull(), // em centavos
  discount: int("discount").notNull().default(0), // em centavos
  total: int("total").notNull(), // em centavos
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(),
  notes: text("notes"), // Observações do cliente
  items: text("items").notNull(), // JSON com itens da venda
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;

// ─── Terreiros Parceiros (Portal do Parceiro) ─────────────────────────────────
// Login separado dos usuários do sistema (staff). Cada terreiro parceiro
// recebe um usuário/senha cadastrado pelo admin e só acessa o portal
// simplificado com os produtos em estoque e o preço de venda.

export const terreiros = mysqlTable("terreiros", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // Nome do terreiro
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  logoUrl: mediumtext("logoUrl"), // logo do terreiro, upload do próprio parceiro (base64)
  tierId: int("tierId"), // plano de parceria (Prata/Ouro/Diamante) — define o preço que ele vê
  // Endereço de entrega do terreiro (Fase 1 do plano de expansão nacional) —
  // editado pelo próprio parceiro em "Minha Conta", usado nos pedidos feitos
  // em "Gerar Pedidos" e nas entregas de comodato fora de Ribeirão Preto.
  shippingZipCode: varchar("shippingZipCode", { length: 9 }),
  shippingStreet: varchar("shippingStreet", { length: 255 }),
  shippingNumber: varchar("shippingNumber", { length: 20 }),
  shippingComplement: varchar("shippingComplement", { length: 100 }),
  shippingNeighborhood: varchar("shippingNeighborhood", { length: 100 }),
  shippingCity: varchar("shippingCity", { length: 100 }),
  shippingState: varchar("shippingState", { length: 2 }),
  // Código de indicação (Fase 2 do plano de expansão nacional) — o terreiro
  // divulga esse código pros próprios frequentadores; usado como cupom de
  // desconto na loja pública, e permite ver qual terreiro trouxe a venda.
  referralCode: varchar("referralCode", { length: 30 }).unique(),
  isActive: int("isActive").default(1).notNull(),
  mustChangePassword: int("mustChangePassword").default(0).notNull(), // força trocar a senha pré-cadastrada no próximo login
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type Terreiro = typeof terreiros.$inferSelect;
export type InsertTerreiro = typeof terreiros.$inferInsert;

// Usuários adicionais do terreiro — o parceiro principal pode cadastrar mais
// gente pra acessar o mesmo Portal (ex: quem cuida dos pedidos no dia a dia).
// Login independente, mas cai na mesma sessão do terreiro (mesmo preço,
// mesmo carrinho, mesmas permissões — não existe hierarquia entre eles).
export const terreiroUsers = mysqlTable("terreiroUsers", {
  id: int("id").autoincrement().primaryKey(),
  terreiroId: int("terreiroId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  mustChangePassword: int("mustChangePassword").default(1).notNull(), // força trocar a senha pré-cadastrada no primeiro login
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type TerreiroUser = typeof terreiroUsers.$inferSelect;
export type InsertTerreiroUser = typeof terreiroUsers.$inferInsert;

// ─── Planos de Parceria (Prata/Ouro/Diamante) ─────────────────────────────────
// Substituem o preço único: cada terreiro sobe de plano por mérito (volume de
// compra) e cada plano tem seu próprio preço por produto. Produto sem preço
// cadastrado no plano do terreiro fica escondido pra ele.

// Planos fixos (Cobre/Bronze/Prata/Ouro/Diamante) — cada um com um percentual
// de desconto fixo sobre o preço de venda da loja. O preço do terreiro nesse
// plano é sempre calculado na hora (salePrice * (1 - discountPercent/100)),
// nunca guardado por produto — assim fica automaticamente correto pra
// produto novo e atualizado sozinho quando o preço de venda muda.
export const partnerTiers = mysqlTable("partnerTiers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  sortOrder: int("sortOrder").notNull().default(0), // menor = plano mais básico
  discountPercent: int("discountPercent").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PartnerTier = typeof partnerTiers.$inferSelect;
export type InsertPartnerTier = typeof partnerTiers.$inferInsert;

// Sobrescreve o preço do plano só pra um terreiro específico (ex: negociação
// pontual). Quando existe, tem prioridade sobre o preço do plano dele.
export const terreiroProductPrices = mysqlTable("terreiroProductPrices", {
  id: int("id").autoincrement().primaryKey(),
  terreiroId: int("terreiroId").notNull(),
  productId: int("productId").notNull(),
  price: int("price").notNull(), // em centavos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TerreiroProductPrice = typeof terreiroProductPrices.$inferSelect;
export type InsertTerreiroProductPrice = typeof terreiroProductPrices.$inferInsert;

// ─── Comodato (itens deixados nos terreiros) ──────────────────────────────────
// Em dias de gira, itens saem da loja e ficam no terreiro sem pagamento
// prévio: pagos só se vendidos, senão devolvidos. O estoque baixa quando o
// item sai e volta quando é devolvido; a venda registrada no acerto NÃO baixa
// estoque de novo. unitPrice é o preço combinado no momento da entrega
// (snapshot do preço do parceiro), pra o acerto não mudar se o plano mudar.

export const consignments = mysqlTable("consignments", {
  id: int("id").autoincrement().primaryKey(),
  terreiroId: int("terreiroId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(), // total deixado
  quantitySold: int("quantitySold").notNull().default(0),
  quantityReturned: int("quantityReturned").notNull().default(0),
  unitPrice: int("unitPrice").notNull(), // em centavos — preço combinado na entrega
  notes: text("notes"),
  leftAt: timestamp("leftAt").defaultNow().notNull(), // quando foi deixado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Consignment = typeof consignments.$inferSelect;
export type InsertConsignment = typeof consignments.$inferInsert;

// ─── Solicitações de Comodato (o terreiro pede, o admin confirma na entrega) ──
// O terreiro escolhe itens do ESTOQUE DA LOJA (não do fornecedor) e pede pra
// Rafael entregar em comodato. Isso NÃO baixa estoque nem cria o comodato de
// verdade — só quando o admin confirma a entrega (define o preço combinado
// de cada item ali) é que vira um registro em `consignments` de verdade,
// com a baixa de estoque na hora certa.

export const consignmentRequests = mysqlTable("consignmentRequests", {
  id: int("id").autoincrement().primaryKey(),
  terreiroId: int("terreiroId").notNull(),
  status: mysqlEnum("status", ["pendente", "entregue", "cancelado"]).notNull().default("pendente"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConsignmentRequest = typeof consignmentRequests.$inferSelect;
export type InsertConsignmentRequest = typeof consignmentRequests.$inferInsert;

export const consignmentRequestItems = mysqlTable("consignmentRequestItems", {
  id: int("id").autoincrement().primaryKey(),
  consignmentRequestId: int("consignmentRequestId").notNull(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 255 }).notNull(), // snapshot — produto pode mudar depois
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsignmentRequestItem = typeof consignmentRequestItems.$inferSelect;
export type InsertConsignmentRequestItem = typeof consignmentRequestItems.$inferInsert;

// ─── Pedidos de Parceiros (tela "Gerar Pedidos" do Portal) ────────────────────
// O terreiro monta o pedido escolhendo itens do catálogo do fornecedor (sem
// nunca ver quem é o fornecedor ou o link do site dele) já com o preço do
// plano dele aplicado. O preço de cada item é sempre recalculado no servidor
// na hora de criar o pedido (nunca confia no preço vindo do cliente) e nunca
// fica abaixo de custo×1,5 (comissão mínima de 50%), mesmo que o desconto do
// plano permitiria um preço menor.

export const partnerOrders = mysqlTable("partnerOrders", {
  id: int("id").autoincrement().primaryKey(),
  terreiroId: int("terreiroId").notNull(),
  subtotal: int("subtotal").notNull(), // em centavos
  status: mysqlEnum("status", ["pendente", "confirmado", "entregue", "cancelado"]).notNull().default("pendente"),
  notes: text("notes"),
  // Frete + rastreio (Fase 1) — entrega usa o endereço já cadastrado do
  // terreiro (terreiros.shipping*), não precisa duplicar por pedido.
  shippingCents: int("shippingCents").default(0).notNull(),
  trackingCode: varchar("trackingCode", { length: 100 }),
  carrier: varchar("carrier", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PartnerOrder = typeof partnerOrders.$inferSelect;
export type InsertPartnerOrder = typeof partnerOrders.$inferInsert;

export const partnerOrderItems = mysqlTable("partnerOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  partnerOrderId: int("partnerOrderId").notNull(),
  source: mysqlEnum("source", ["catalogo", "estoque"]).notNull().default("catalogo"), // catalogo = fornecedor, estoque = produto já na loja
  supplierCatalogId: int("supplierCatalogId"), // preenchido quando source = "catalogo"
  productId: int("productId"), // preenchido quando source = "estoque"
  name: varchar("name", { length: 255 }).notNull(), // snapshot — o item pode mudar depois
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(), // em centavos, já com desconto do plano + trava de 50%
  totalPrice: int("totalPrice").notNull(), // em centavos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerOrderItem = typeof partnerOrderItems.$inferSelect;
export type InsertPartnerOrderItem = typeof partnerOrderItems.$inferInsert;

// ─── Catálogo Público (loja online, sem login) ────────────────────────────────
// Página pública equivalente ao Portal do Parceiro, mas com preço cheio (sem
// desconto de plano) e 5% a mais na aba de pedidos. Sem conta/login — o
// cliente só informa nome e telefone pra Rafael poder retornar o contato.

export const publicOrders = mysqlTable("publicOrders", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  subtotal: int("subtotal").notNull(), // em centavos, só os itens (sem frete)
  status: mysqlEnum("status", ["pendente", "confirmado", "entregue", "cancelado"]).notNull().default("pendente"),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // "infinitepay" pros pedidos de Pronta Entrega já pagos, null pros pedidos por encomenda (Fazer Pedidos)
  notes: text("notes"),
  // Entrega (Fase 1 do plano de expansão nacional) — cliente do site não tem
  // conta, então o endereço vai por pedido, não por cadastro. "retirada" não
  // preenche os campos de endereço (retira na loja, sem frete).
  shippingMethod: mysqlEnum("shippingMethod", ["retirada", "envio"]).notNull().default("retirada"),
  shippingZipCode: varchar("shippingZipCode", { length: 9 }),
  shippingStreet: varchar("shippingStreet", { length: 255 }),
  shippingNumber: varchar("shippingNumber", { length: 20 }),
  shippingComplement: varchar("shippingComplement", { length: 100 }),
  shippingNeighborhood: varchar("shippingNeighborhood", { length: 100 }),
  shippingCity: varchar("shippingCity", { length: 100 }),
  shippingState: varchar("shippingState", { length: 2 }),
  shippingCents: int("shippingCents").default(0).notNull(), // sempre recalculado no servidor, nunca confia no cliente
  trackingCode: varchar("trackingCode", { length: 100 }),
  carrier: varchar("carrier", { length: 100 }),
  // Cupom de indicação (Fase 2) — código do terreiro usado nesse pedido, se
  // algum. discountCents já vem descontado dos itens (subtotal reflete o
  // valor com desconto) — guardado separado só pra mostrar no admin.
  couponCode: varchar("couponCode", { length: 30 }),
  referredByTerreiroId: int("referredByTerreiroId"),
  discountCents: int("discountCents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PublicOrder = typeof publicOrders.$inferSelect;
export type InsertPublicOrder = typeof publicOrders.$inferInsert;

export const publicOrderItems = mysqlTable("publicOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  publicOrderId: int("publicOrderId").notNull(),
  source: mysqlEnum("source", ["catalogo", "estoque"]).notNull().default("catalogo"),
  supplierCatalogId: int("supplierCatalogId"),
  productId: int("productId"),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(), // em centavos, preço cheio + 5%
  totalPrice: int("totalPrice").notNull(), // em centavos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PublicOrderItem = typeof publicOrderItems.$inferSelect;
export type InsertPublicOrderItem = typeof publicOrderItems.$inferInsert;

// ─── Solicitações de Parceria (página "Parceria com a Toca") ──────────────────
// Terreiro interessado preenche o formulário na página pública — não cria
// login sozinho, só avisa o Rafael, que cria o acesso pelo cadastro normal
// de terreiros depois de entrar em contato.

export const partnerApplications = mysqlTable("partnerApplications", {
  id: int("id").autoincrement().primaryKey(),
  terreiroName: varchar("terreiroName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  city: varchar("city", { length: 100 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["pendente", "aprovado", "recusado"]).notNull().default("pendente"),
  // "site" = terreiro se cadastrou sozinho na página pública "Parceria com a
  // Toca"; "prospeccao" = o Rafael achou e cadastrou manualmente (ferramenta
  // de prospecção, ex: busca por terreiros de uma cidade) — nunca setado
  // pelo formulário público, só pela tela de admin.
  source: mysqlEnum("source", ["site", "prospeccao"]).notNull().default("site"),
  instagram: varchar("instagram", { length: 100 }),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PartnerApplication = typeof partnerApplications.$inferSelect;
export type InsertPartnerApplication = typeof partnerApplications.$inferInsert;
