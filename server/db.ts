import { and, eq, gte, lte, sql, desc, or, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, InsertProduct, InsertSale, InsertPurchase, InsertSupplier, InsertProductSupplier,
  products, sales, users, purchases, suppliers, productSuppliers,
  roles, permissions, rolePermissions, userRoles, auditLog, systemConfig,
  supplierCatalog, InsertSupplierCatalogItem,
  terreiros, InsertTerreiro,
  terreiroUsers, InsertTerreiroUser,
  partnerTiers,
  terreiroProductPrices,
  consignments,
  consignmentRequests, consignmentRequestItems,
  infinitePayCharges, InsertInfinitePayCharge,
  paymentMethods,
  partnerOrders, partnerOrderItems,
  publicOrders, publicOrderItems,
  partnerApplications, InsertPartnerApplication,
  customers, InsertCustomer,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { notifyProntaEntregaPaid } from "./_core/whatsapp";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function listProducts(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  if (includeInactive) {
    return db.select().from(products).orderBy(products.name);
  }
  return db.select().from(products).where(eq(products.isActive, 1)).orderBy(products.name);
}

export async function createProduct(data: Omit<InsertProduct, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<Omit<InsertProduct, "id" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

// Migração pontual: garante que a coluna imageUrl exista em products.
// Idempotente — pode ser chamada quantas vezes for preciso.
export async function ensureProductImageColumn() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.execute(sql`ALTER TABLE products ADD COLUMN imageUrl TEXT`);
    return { added: true };
  } catch (error: any) {
    // drizzle-orm/mysql2 embrulha o erro real do driver em .cause — o código
    // e a mensagem originais (ex.: ER_DUP_FIELDNAME) não ficam no topo.
    const code = error?.code ?? error?.cause?.code;
    const message = error?.message ?? error?.cause?.message ?? "";
    if (code === "ER_DUP_FIELDNAME" || /duplicate column/i.test(message)) {
      return { added: false };
    }
    throw error;
  }
}

// Migração pontual: amplia imageUrl pra MEDIUMTEXT (cabe foto enviada do
// dispositivo em base64, o TEXT padrão só aguenta ~64KB). MODIFY COLUMN é
// seguro de rodar de novo mesmo se já estiver no tipo certo.
export async function ensureProductImageColumnIsMediumtext() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`ALTER TABLE products MODIFY COLUMN imageUrl MEDIUMTEXT`);
}

// Roda todas as migrações pendentes de forma seguríssima (idempotente) —
// chamada uma vez no boot do servidor. Existe porque o `drizzle-kit migrate`
// nunca roda sozinho no deploy da Hostinger, e normalmente não há acesso
// direto ao banco (phpMyAdmin/SSH) a partir do ambiente onde o código é
// escrito. CREATE TABLE IF NOT EXISTS já é idempotente por natureza; ADD
// COLUMN usa o mesmo padrão de captura de "coluna duplicada" das funções
// acima (drizzle-orm/mysql2 embrulha o erro real do driver em .cause).
export async function runStartupMigrations() {
  const db = await getDb();
  if (!db) return;

  const isDupColumn = (error: any) => {
    const code = error?.code ?? error?.cause?.code;
    const message = error?.message ?? error?.cause?.message ?? "";
    return code === "ER_DUP_FIELDNAME" || /duplicate column/i.test(message);
  };

  try {
    await db.execute(sql`ALTER TABLE products ADD COLUMN imageUrl TEXT`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] products.imageUrl:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE products MODIFY COLUMN imageUrl MEDIUMTEXT`);
  } catch (error: any) {
    console.error("[migrations] products.imageUrl mediumtext:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS terreiros (
        id int AUTO_INCREMENT NOT NULL,
        name varchar(255) NOT NULL,
        username varchar(100) NOT NULL,
        passwordHash varchar(255) NOT NULL,
        contactName varchar(255),
        phone varchar(20),
        isActive int NOT NULL DEFAULT 1,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        lastSignedIn timestamp,
        tierId int,
        PRIMARY KEY (id),
        UNIQUE KEY terreiros_username_unique (username)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] terreiros:", error);
  }
  // tierId pode não existir se a tabela já tiver sido criada por uma
  // migração anterior sem essa coluna — tenta adicionar separado.
  try {
    await db.execute(sql`ALTER TABLE terreiros ADD COLUMN tierId int`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] terreiros.tierId:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partnerTiers (
        id int AUTO_INCREMENT NOT NULL,
        name varchar(100) NOT NULL,
        sortOrder int NOT NULL DEFAULT 0,
        discountPercent int NOT NULL DEFAULT 0,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY partnerTiers_name_unique (name)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] partnerTiers:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE partnerTiers ADD COLUMN discountPercent int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerTiers.discountPercent:", error);
  }

  // Planos deixaram de ter preço manual por produto — cada um agora tem um
  // desconto % fixo sobre o preço de venda, calculado na hora. A tabela
  // antiga não é mais usada.
  try {
    await db.execute(sql`DROP TABLE IF EXISTS tierProductPrices`);
  } catch (error: any) {
    console.error("[migrations] drop tierProductPrices:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS terreiroProductPrices (
        id int AUTO_INCREMENT NOT NULL,
        terreiroId int NOT NULL,
        productId int NOT NULL,
        price int NOT NULL,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] terreiroProductPrices:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consignments (
        id int AUTO_INCREMENT NOT NULL,
        terreiroId int NOT NULL,
        productId int NOT NULL,
        quantity int NOT NULL,
        quantitySold int NOT NULL DEFAULT 0,
        quantityReturned int NOT NULL DEFAULT 0,
        unitPrice int NOT NULL,
        notes text,
        leftAt timestamp NOT NULL DEFAULT (now()),
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] consignments:", error);
  }
  // MODIFY COLUMN com a lista completa do enum é seguro de rodar de novo.
  try {
    await db.execute(sql`ALTER TABLE sales MODIFY COLUMN channel enum('fisico','instagram','terreiro') NOT NULL DEFAULT 'fisico'`);
  } catch (error: any) {
    console.error("[migrations] sales.channel terreiro:", error);
  }

  try {
    await seedPartnerTiers();
  } catch (error: any) {
    console.error("[migrations] seedPartnerTiers:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN infinitePayHandle varchar(100)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.infinitePayHandle:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS infinitePayCharges (
        id int AUTO_INCREMENT NOT NULL,
        orderNsu varchar(64) NOT NULL,
        amountCents int NOT NULL,
        description varchar(255),
        checkoutUrl text NOT NULL,
        status enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
        invoiceSlug varchar(100),
        transactionNsu varchar(100),
        paidAmountCents int,
        captureMethod varchar(32),
        receiptUrl text,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY infinitePayCharges_orderNsu_unique (orderNsu)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] infinitePayCharges:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS paymentMethods (
        id int AUTO_INCREMENT NOT NULL,
        \`key\` varchar(50) NOT NULL,
        label varchar(100) NOT NULL,
        enabled int NOT NULL DEFAULT 1,
        sortOrder int NOT NULL DEFAULT 0,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY paymentMethods_key_unique (\`key\`)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] paymentMethods:", error);
  }
  try {
    await seedPaymentMethods();
  } catch (error: any) {
    console.error("[migrations] seedPaymentMethods:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE sales ADD COLUMN terreiroId int`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] sales.terreiroId:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partnerOrders (
        id int AUTO_INCREMENT NOT NULL,
        terreiroId int NOT NULL,
        subtotal int NOT NULL,
        status enum('pendente','confirmado','entregue','cancelado') NOT NULL DEFAULT 'pendente',
        notes text,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] partnerOrders:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partnerOrderItems (
        id int AUTO_INCREMENT NOT NULL,
        partnerOrderId int NOT NULL,
        source enum('catalogo','estoque') NOT NULL DEFAULT 'catalogo',
        supplierCatalogId int,
        productId int,
        name varchar(255) NOT NULL,
        quantity int NOT NULL,
        unitPrice int NOT NULL,
        totalPrice int NOT NULL,
        createdAt timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] partnerOrderItems:", error);
  }
  // Colunas adicionadas depois — supplierCatalogId virou opcional (pedido
  // pode ter só itens do estoque) e productId/source são novos.
  try {
    await db.execute(sql`ALTER TABLE partnerOrderItems MODIFY COLUMN supplierCatalogId int`);
  } catch (error: any) {
    console.error("[migrations] partnerOrderItems.supplierCatalogId nullable:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE partnerOrderItems ADD COLUMN productId int`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerOrderItems.productId:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE partnerOrderItems ADD COLUMN source enum('catalogo','estoque') NOT NULL DEFAULT 'catalogo'`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerOrderItems.source:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS publicOrders (
        id int AUTO_INCREMENT NOT NULL,
        customerName varchar(255) NOT NULL,
        customerPhone varchar(20) NOT NULL,
        subtotal int NOT NULL,
        status enum('pendente','confirmado','entregue','cancelado') NOT NULL DEFAULT 'pendente',
        notes text,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] publicOrders:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS publicOrderItems (
        id int AUTO_INCREMENT NOT NULL,
        publicOrderId int NOT NULL,
        source enum('catalogo','estoque') NOT NULL DEFAULT 'catalogo',
        supplierCatalogId int,
        productId int,
        name varchar(255) NOT NULL,
        quantity int NOT NULL,
        unitPrice int NOT NULL,
        totalPrice int NOT NULL,
        createdAt timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] publicOrderItems:", error);
  }

  // MODIFY COLUMN com a lista completa do enum é seguro de rodar de novo.
  try {
    await db.execute(sql`ALTER TABLE sales MODIFY COLUMN channel enum('fisico','instagram','terreiro','site') NOT NULL DEFAULT 'fisico'`);
  } catch (error: any) {
    console.error("[migrations] sales.channel site:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN paymentMethod varchar(50)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.paymentMethod:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE infinitePayCharges ADD COLUMN publicOrderId int`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] infinitePayCharges.publicOrderId:", error);
  }

  // Novos percentuais dos planos ("regra dos planos" 2026-07-21) — só
  // aplica se o valor ainda for o default antigo, pra nunca sobrescrever um
  // ajuste manual que o admin já tenha feito depois disso.
  const TIER_PERCENT_MIGRATIONS: [string, number, number][] = [
    ["Cobre", 3, 10],
    ["Bronze", 5, 12],
    ["Prata", 10, 15],
    ["Ouro", 15, 18],
    ["Diamante", 20, 22],
  ];
  for (const [name, oldPercent, newPercent] of TIER_PERCENT_MIGRATIONS) {
    try {
      await db.execute(
        sql`UPDATE partnerTiers SET discountPercent = ${newPercent} WHERE name = ${name} AND discountPercent = ${oldPercent}`
      );
    } catch (error: any) {
      console.error(`[migrations] partnerTiers.${name} novo percentual:`, error);
    }
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partnerApplications (
        id int AUTO_INCREMENT NOT NULL,
        terreiroName varchar(255) NOT NULL,
        contactName varchar(255) NOT NULL,
        phone varchar(20) NOT NULL,
        city varchar(100),
        notes text,
        status enum('pendente','aprovado','recusado') NOT NULL DEFAULT 'pendente',
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] partnerApplications:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE terreiros ADD COLUMN logoUrl mediumtext`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] terreiros.logoUrl:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS terreiroUsers (
        id int AUTO_INCREMENT NOT NULL,
        terreiroId int NOT NULL,
        name varchar(255) NOT NULL,
        username varchar(100) NOT NULL,
        passwordHash varchar(255) NOT NULL,
        isActive int NOT NULL DEFAULT 1,
        mustChangePassword int NOT NULL DEFAULT 1,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        lastSignedIn timestamp NULL,
        PRIMARY KEY (id),
        UNIQUE KEY terreiroUsers_username_unique (username)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] terreiroUsers:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE terreiroUsers ADD COLUMN mustChangePassword int NOT NULL DEFAULT 1`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] terreiroUsers.mustChangePassword:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE terreiros ADD COLUMN mustChangePassword int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] terreiros.mustChangePassword:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consignmentRequests (
        id int AUTO_INCREMENT NOT NULL,
        terreiroId int NOT NULL,
        status enum('pendente','entregue','cancelado') NOT NULL DEFAULT 'pendente',
        notes text,
        termsAcceptedAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] consignmentRequests:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE consignmentRequests ADD COLUMN termsAcceptedAt timestamp NULL`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] consignmentRequests.termsAcceptedAt:", error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consignmentRequestItems (
        id int AUTO_INCREMENT NOT NULL,
        consignmentRequestId int NOT NULL,
        productId int NOT NULL,
        name varchar(255) NOT NULL,
        quantity int NOT NULL,
        createdAt timestamp NOT NULL DEFAULT (now()),
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] consignmentRequestItems:", error);
  }

  // Endereço + frete (Fase 1 do plano de expansão nacional, 2026-07-21) —
  // ver server/_core/whatsapp.ts e o artifact do roadmap pra contexto.
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingLocalCity varchar(100) DEFAULT 'Ribeirão Preto'`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingLocalCity:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingLocalState varchar(2) DEFAULT 'SP'`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingLocalState:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingLocalCents int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingLocalCents:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingStateCents int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingStateCents:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingNationalCents int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingNationalCents:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingOriginZipCode varchar(9) NOT NULL DEFAULT '14090210'`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingOriginZipCode:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingPerKmCents int NOT NULL DEFAULT 150`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingPerKmCents:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE systemConfig ADD COLUMN shippingSupplierFixedCents int NOT NULL DEFAULT 4000`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] systemConfig.shippingSupplierFixedCents:", error);
  }

  for (const col of ["shippingZipCode varchar(9)", "shippingStreet varchar(255)", "shippingNumber varchar(20)", "shippingComplement varchar(100)", "shippingNeighborhood varchar(100)", "shippingCity varchar(100)", "shippingState varchar(2)"]) {
    try {
      await db.execute(sql.raw(`ALTER TABLE terreiros ADD COLUMN ${col}`));
    } catch (error: any) {
      if (!isDupColumn(error)) console.error(`[migrations] terreiros.${col}:`, error);
    }
  }

  try {
    await db.execute(sql`ALTER TABLE partnerOrders ADD COLUMN shippingCents int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerOrders.shippingCents:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE partnerOrders ADD COLUMN trackingCode varchar(100)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerOrders.trackingCode:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE partnerOrders ADD COLUMN carrier varchar(100)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerOrders.carrier:", error);
  }

  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN shippingMethod enum('retirada','envio') NOT NULL DEFAULT 'retirada'`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.shippingMethod:", error);
  }
  for (const col of ["shippingZipCode varchar(9)", "shippingStreet varchar(255)", "shippingNumber varchar(20)", "shippingComplement varchar(100)", "shippingNeighborhood varchar(100)", "shippingCity varchar(100)", "shippingState varchar(2)"]) {
    try {
      await db.execute(sql.raw(`ALTER TABLE publicOrders ADD COLUMN ${col}`));
    } catch (error: any) {
      if (!isDupColumn(error)) console.error(`[migrations] publicOrders.${col}:`, error);
    }
  }
  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN shippingCents int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.shippingCents:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN trackingCode varchar(100)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.trackingCode:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN carrier varchar(100)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.carrier:", error);
  }

  for (const col of ["weightGrams", "lengthCm", "widthCm", "heightCm"]) {
    try {
      await db.execute(sql.raw(`ALTER TABLE products ADD COLUMN ${col} int`));
    } catch (error: any) {
      if (!isDupColumn(error)) console.error(`[migrations] products.${col}:`, error);
    }
  }

  // Cupom de indicação por terreiro (Fase 2 do plano de expansão nacional).
  try {
    await db.execute(sql`ALTER TABLE terreiros ADD COLUMN referralCode varchar(30)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] terreiros.referralCode:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN couponCode varchar(30)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.couponCode:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN referredByTerreiroId int`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.referredByTerreiroId:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN discountCents int NOT NULL DEFAULT 0`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.discountCents:", error);
  }
  // Preenche o código de indicação de terreiros que já existiam antes dessa
  // coluna existir — idempotente, só mexe em quem ainda está null.
  try {
    await backfillMissingReferralCodes();
  } catch (error: any) {
    console.error("[migrations] backfillMissingReferralCodes:", error);
  }

  // Ferramenta de prospecção: distingue solicitação vinda do site (padrão
  // "site") de lead cadastrado manualmente pelo admin ("prospeccao").
  try {
    await db.execute(sql`ALTER TABLE partnerApplications ADD COLUMN source enum('site','prospeccao') DEFAULT 'site' NOT NULL`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerApplications.source:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE partnerApplications ADD COLUMN instagram varchar(100)`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerApplications.instagram:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE partnerApplications ADD COLUMN address text`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] partnerApplications.address:", error);
  }
  try {
    await seedProspectionLeads();
  } catch (error: any) {
    console.error("[migrations] seedProspectionLeads:", error);
  }

  // Área do cliente (login na loja pública) — conta opcional pra acompanhar
  // pedidos, com e-mail/senha ou Google.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS customers (
        id int AUTO_INCREMENT NOT NULL,
        name varchar(255) NOT NULL,
        email varchar(320) NOT NULL,
        passwordHash varchar(255),
        googleId varchar(100),
        phone varchar(20),
        shippingZipCode varchar(9),
        shippingStreet varchar(255),
        shippingNumber varchar(20),
        shippingComplement varchar(100),
        shippingNeighborhood varchar(100),
        shippingCity varchar(100),
        shippingState varchar(2),
        isActive int NOT NULL DEFAULT 1,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        lastSignedIn timestamp NULL,
        PRIMARY KEY (id),
        UNIQUE KEY customers_email_unique (email),
        UNIQUE KEY customers_googleId_unique (googleId)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] customers:", error);
  }
  try {
    await db.execute(sql`ALTER TABLE publicOrders ADD COLUMN customerId int`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] publicOrders.customerId:", error);
  }

  // Segundo fornecedor no catálogo (Sabedoria dos Cristais) — sourceKey
  // distingue de qual site/scraper cada item veio, já que os dois
  // fornecedores compartilham a mesma tabela supplierCatalog.
  try {
    await db.execute(sql`ALTER TABLE supplierCatalog ADD COLUMN sourceKey varchar(40) NOT NULL DEFAULT 'atacado_umbanda'`);
  } catch (error: any) {
    if (!isDupColumn(error)) console.error("[migrations] supplierCatalog.sourceKey:", error);
  }
  try {
    await ensureCrystalsSupplier();
  } catch (error: any) {
    console.error("[migrations] ensureCrystalsSupplier:", error);
  }
  try {
    await seedCrystalsCatalog();
  } catch (error: any) {
    console.error("[migrations] seedCrystalsCatalog:", error);
  }

  console.log("[migrations] Verificação de schema concluída.");
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export async function createSale(data: Omit<InsertSale, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Registra a venda
  await db.insert(sales).values(data);
  // Desconta do estoque automaticamente
  await db
    .update(products)
    .set({ currentStock: sql`${products.currentStock} - ${data.quantity}` })
    .where(eq(products.id, data.productId));
}

export async function createSaleBatch(data: {
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
  }>;
  channel: "fisico" | "instagram" | "terreiro";
  terreiroId?: number | null;
  saleDate: Date;
  receipt?: {
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    notes?: string;
  };
}): Promise<{ success: boolean; receiptNumber?: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Validação prévia de estoque para TODOS os itens
  const receiptItemsArray: Array<{ name: string; quantity: number; unitPrice: number; total: number }> = [];

  for (const item of data.items) {
    const productList = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (!productList.length) {
      throw new Error(`Produto #${item.productId} não encontrado.`);
    }
    const product = productList[0];
    if (product.currentStock < item.quantity) {
      throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.currentStock}`);
    }
    receiptItemsArray.push({
      name: product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.unitPrice * item.quantity,
    });
  }

  if (data.channel === "terreiro" && !data.terreiroId) {
    throw new Error("Selecione o parceiro para registrar essa venda.");
  }

  // 2. Registro em lote das vendas e dedução de estoque
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const productList = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    const product = productList[0];

    const totalPrice = item.unitPrice * item.quantity;
    const profit = (item.unitPrice - product.costPrice) * item.quantity;

    await db.insert(sales).values({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice,
      profit,
      channel: data.channel,
      terreiroId: data.channel === "terreiro" ? data.terreiroId! : null,
      saleDate: data.saleDate,
    });

    await db
      .update(products)
      .set({ currentStock: sql`${products.currentStock} - ${item.quantity}` })
      .where(eq(products.id, item.productId));
  }

  // 3. Criação de recibo integrada (se solicitado)
  let createdReceiptNumber: number | undefined;
  if (data.receipt) {
    const receiptNumber = await getNextReceiptNumber();
    await db.insert(receipts).values({
      receiptNumber,
      subtotal: data.receipt.subtotal,
      discount: data.receipt.discount,
      total: data.receipt.total,
      paymentMethod: data.receipt.paymentMethod,
      notes: data.receipt.notes || null,
      items: JSON.stringify(receiptItemsArray),
    });
    createdReceiptNumber = receiptNumber;
  }

  return { success: true, receiptNumber: createdReceiptNumber };
}

export async function listSales(options?: number | { limit?: number; startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];

  if (typeof options === "number") {
    return db.select().from(sales).orderBy(sql`${sales.saleDate} DESC`).limit(options);
  }

  const { limit, startDate, endDate } = options ?? {};
  const conditions = [];
  if (startDate) conditions.push(gte(sales.saleDate, startDate));
  if (endDate) conditions.push(lte(sales.saleDate, endDate));

  if (conditions.length > 0) {
    const q = db.select().from(sales).where(and(...conditions)).orderBy(sql`${sales.saleDate} DESC`);
    if (limit) return q.limit(limit);
    return q;
  }

  const q = db.select().from(sales).orderBy(sql`${sales.saleDate} DESC`);
  if (limit) return q.limit(limit);
  return q;
}

// Total gasto por parceiro (soma das vendas canal "terreiro" vinculadas a
// cada terreiroId) — usado pra decidir avanço de plano por volume de compra.
export async function getTerreiroSpendingTotals() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      terreiroId: sales.terreiroId,
      totalSpent: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
      ordersCount: sql<number>`COUNT(*)`,
      lastPurchaseAt: sql<string>`MAX(${sales.saleDate})`,
    })
    .from(sales)
    .where(sql`${sales.terreiroId} IS NOT NULL`)
    .groupBy(sales.terreiroId);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getDashboardKPIs(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { totalStock: 0, salesCount: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, totalInvestment: 0, profitMargin: 0, lowStockAlerts: 0 };

  // Total em estoque e investimento
  const stockResult = await db
    .select({
      totalStock: sql<number>`COALESCE(SUM(${products.currentStock}), 0)`,
      totalInvestment: sql<number>`COALESCE(SUM(${products.currentStock} * ${products.costPrice}), 0)`,
      lowStockAlerts: sql<number>`COALESCE(SUM(CASE WHEN ${products.currentStock} <= ${products.minimumStock} THEN 1 ELSE 0 END), 0)`,
    })
    .from(products);

  // Vendas do período
  const salesResult = await db
    .select({
      salesCount: sql<number>`COALESCE(COUNT(*), 0)`,
      totalRevenue: sql<number>`COALESCE(SUM(${sales.totalPrice}), 0)`,
      totalProfit: sql<number>`COALESCE(SUM(${sales.profit}), 0)`,
    })
    .from(sales)
    .where(and(gte(sales.saleDate, startDate), lte(sales.saleDate, endDate)));

  const stockData = stockResult[0] ?? { totalStock: 0, totalInvestment: 0, lowStockAlerts: 0 };
  const salesData = salesResult[0] ?? { salesCount: 0, totalRevenue: 0, totalProfit: 0 };

  const totalRevenue = Number(salesData.totalRevenue);
  const totalProfit = Number(salesData.totalProfit);
  const totalCost = totalRevenue - totalProfit;
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  return {
    totalStock: Number(stockData.totalStock),
    salesCount: Number(salesData.salesCount),
    totalRevenue,
    totalCost,
    totalProfit,
    totalInvestment: Number(stockData.totalInvestment),
    profitMargin,
    lowStockAlerts: Number(stockData.lowStockAlerts),
  };
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export async function createPurchase(data: Omit<InsertPurchase, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Registra a compra
  await db.insert(purchases).values(data);
  // Adiciona ao estoque automaticamente
  await db
    .update(products)
    .set({ currentStock: sql`${products.currentStock} + ${data.quantity}` })
    .where(eq(products.id, data.productId));
}

export async function listPurchases(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchases).orderBy(sql`${purchases.purchaseDate} DESC`).limit(limit);
}

export async function updatePurchase(
  id: number,
  data: {
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    supplier?: string;
    channel?: "direto" | "distribuidor" | "fabricante";
    purchaseDate?: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Busca a compra antiga para calcular diferença de estoque
  const oldPurchase = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
  if (!oldPurchase.length) throw new Error("Purchase not found");
  
  const old = oldPurchase[0];
  const newQuantity = data.quantity ?? old.quantity;
  const quantityDiff = newQuantity - old.quantity;
  
  // Atualiza a compra
  await db.update(purchases).set(data).where(eq(purchases.id, id));
  
  // Atualiza o estoque se a quantidade mudou
  if (quantityDiff !== 0) {
    await db
      .update(products)
      .set({ currentStock: sql`${products.currentStock} + ${quantityDiff}` })
      .where(eq(products.id, old.productId));
  }
}

// ─── Delete Operations ────────────────────────────────────────────────────────

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Hard delete - apenas para produtos sem histórico
  const saleCount = await db.select({ count: sql<number>`COUNT(*)` }).from(sales).where(eq(sales.productId, id));
  if (saleCount[0] && saleCount[0].count > 0) {
    throw new Error("Não é possível excluir um produto com vendas registradas");
  }
  const purchaseCount = await db.select({ count: sql<number>`COUNT(*)` }).from(purchases).where(eq(purchases.productId, id));
  if (purchaseCount[0] && purchaseCount[0].count > 0) {
    throw new Error("Não é possível excluir um produto com compras registradas");
  }
  await db.delete(products).where(eq(products.id, id));
}

export async function deactivateProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set({ isActive: 0 }).where(eq(products.id, id));
}

export async function reactivateProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set({ isActive: 1 }).where(eq(products.id, id));
}

export async function getAnalyticsByCategory(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return {};

  const result = await db
    .select({
      category: products.category,
      stock: sql<number>`COALESCE(SUM(${products.currentStock}), 0)`,
      investment: sql<number>`COALESCE(SUM(${products.currentStock} * ${products.costPrice}), 0)`,
    })
    .from(products)
    .groupBy(products.category);

  const byCategory: Record<string, { stock: number; investment: number }> = {};
  for (const row of result) {
    byCategory[row.category] = {
      stock: Number(row.stock),
      investment: Number(row.investment),
    };
  }
  return byCategory;
}


// ─── System Configuration ─────────────────────────────────────────────────────

export async function getSystemConfig() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemConfig).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateSystemConfig(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(systemConfig).limit(1);
  if (existing.length > 0) {
    return await db.update(systemConfig).set(data).where(eq(systemConfig.id, existing[0].id));
  } else {
    return await db.insert(systemConfig).values(data);
  }
}

// ─── Roles and Permissions ────────────────────────────────────────────────────

export async function listRoles() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(roles);
}

export async function getRoleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createRole(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(roles).values(data);
}

export async function listPermissions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(permissions);
}

export async function getRolePermissions(roleId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
}

export async function assignPermissionToRole(roleId: number, permissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(rolePermissions).values({ roleId, permissionId });
}

// ─── User Roles ───────────────────────────────────────────────────────────────

export async function getUserRoles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userRoles).where(eq(userRoles.userId, userId));
}

export async function assignRoleToUser(userId: number, roleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(userRoles).values({ userId, roleId });
}

export async function removeRoleFromUser(userId: number, roleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(userRoles).where(
    and(
      eq(userRoles.userId, userId),
      eq(userRoles.roleId, roleId)
    )
  );
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function createAuditLog(data: any) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(auditLog).values(data);
}

export async function listAuditLog(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export async function listSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(suppliers).where(eq(suppliers.isActive, 1)).orderBy(suppliers.name);
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createSupplier(data: InsertSupplier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data);
  return result;
}

export async function updateSupplier(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(suppliers).set({ isActive: 0 }).where(eq(suppliers.id, id));
}

const CRYSTALS_SUPPLIER_NAME = "Distribuidora CristaisdeCurvelo";

// Cria (uma vez só) o cadastro de fornecedor pro catálogo "Sabedoria dos
// Cristais" e devolve o id — como o id é auto-incremento e não dá pra
// prever, o catálogo sempre resolve o id por aqui em vez de um número fixo.
export async function ensureCrystalsSupplier(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(suppliers).where(eq(suppliers.name, CRYSTALS_SUPPLIER_NAME)).limit(1);
  if (existing.length > 0) return existing[0].id;
  const result = await db.insert(suppliers).values({
    name: CRYSTALS_SUPPLIER_NAME,
    email: "cristaisdecurvelo@gmail.com",
    phone: "5538992056463",
    city: "Curvelo",
    state: "MG",
  });
  return (result as any)[0]?.insertId ?? (result as any).insertId ?? null;
}

// Carga inicial do catálogo "Sabedoria dos Cristais" — o site do fornecedor
// (cristaisdecurvelo.com.br) fica atrás de Cloudflare e bloqueia (403) o
// fetch automático rodando no servidor da Hostinger, mesmo com cabeçalhos
// de navegador. Solução: peguei esses 82 produtos reais (categoria Atacado)
// navegando manualmente, e essa lista entra no catálogo sozinha na primeira
// vez que o servidor sobe (idempotente — nunca duplica, só insere o que
// ainda não existe pelo sourceSlug). Import automático de itens NOVOS que o
// fornecedor adicionar depois continua exigindo repetir esse processo
// manual até existir uma forma de contornar o bloqueio do Cloudflare.
type CrystalsSeedItem = {
  name: string;
  slug: string;
  sourceUrl: string;
  priceCents: number | null;
  imageUrl: string | null;
  unavailable: boolean;
};

const CRYSTALS_SEED_ITEMS: CrystalsSeedItem[] = [
  {"name":"2kg Pontas Cristal Bruto Natural Pedra Com Base Serrada ATACADO","slug":"2kg-pontas-cristal-bruto-natural-pedra-com-base-serrada-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/2kg-pontas-cristal-bruto-natural-pedra-com-base-serrada-atacado/","priceCents":6999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/3cc65f19d1244d09c03deb495f9100d4awsaccesskeyidakiatclmsgfx4j7tu445expires1684759019signature32thehzohkeni6dycnpnunykybm3d-4839c33e4a824b151f16821670279245-480-0.webp","unavailable":false},
  {"name":"1kg Geodo de Agata Cores Mistas Classe B Tamanho 7 a 12cm","slug":"1kg-geodo-de-agata-cores-mistas-classe-b-tamanho-7-a-12cm","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1kg-geodo-de-agata-cores-mistas-classe-b-tamanho-7-a-12cm/","priceCents":19999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/c3b19ea677134431e2459c7faa3b7fc4awsaccesskeyidakiatclmsgfx4j7tu445expires1703768511signatureauq2bwv29v9d5u7xoyeg2xx2fskvq3d-1d601bc62bbdaecf6517011765220073-480-0.webp","unavailable":false},
  {"name":"Cristal Gerador Bruto Natural Pacote 05 KG ( Pontas comum) Quartzo de Garimpo","slug":"cristal-gerador-bruto-natural-pacote-05-kg-pontas-comum-quartzo-de-garimpo","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/cristal-gerador-bruto-natural-pacote-05-kg-pontas-comum-quartzo-de-garimpo/","priceCents":6500,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/e2ab90f44b46657cabac686c79e428de-09453f5608b76bcfa417483638848069-480-0.webp","unavailable":false},
  {"name":"10 Saquinho Tecido TNT Misto Para Guardar Pingente Brinco Anel REFF 0043","slug":"10-saquinho-tecido-tnt-misto-para-guardar-pingente-brinco-anel-reff-0043","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-saquinho-tecido-tnt-misto-para-guardar-pingente-brinco-anel-reff-0043/","priceCents":299,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/cefd4ea8b807c270ee637476788275d6awsaccesskeyidakiatclmsgfx4j7tu445expires1684755781signatureui0wtxyk2byntghg1n4sdlgbfadu3d-18755b3591368ae4da16821637871379-480-0.webp","unavailable":false},
  {"name":"20 Kits Chakras 7 Pedras Lapidação Vibrada Kit Atacado Pedras Pequenas","slug":"20-kits-chakras-7-pedras-lapidacao-vibrada-kit-atacado-pedras-pequenas","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-kits-chakras-7-pedras-lapidacao-vibrada-kit-atacado-pedras-pequenas/","priceCents":9000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/fd6a931322e532c58c9f476b879b5959awsaccesskeyidakiatclmsgfx4j7tu445expires1677844010signatureslybi5bpg9crej5d2t2bufnbadtg3d-4be282a1ac61687ca316752520146136-480-0.webp","unavailable":false},
  {"name":"05 Chaveiro Geodo de Agata Pedra Natural Garimpo Prateado ATACADO","slug":"05-chaveiro-geodo-de-agata-pedra-natural-garimpo-prateado-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/05-chaveiro-geodo-de-agata-pedra-natural-garimpo-prateado-atacado/","priceCents":5000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/ac64a96a57d5344769834ff75b941d4fawsaccesskeyidakiatclmsgfx4j7tu445expires1690392675signaturenrtn7evuimk0ihdzxg70kxlt0mi3d-0bede693d8bbed31a616878006908978-480-0.webp","unavailable":false},
  {"name":"Kit 03 Ponta Natural Pedras Lapidado Laranja Gerador ATACADO","slug":"kit-03-ponta-natural-pedras-lapidado-laranja-gerador-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/kit-03-ponta-natural-pedras-lapidado-laranja-gerador-atacado/","priceCents":5999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/44d534a34ad91baac774435cf82aa275awsaccesskeyidakiatclmsgfx4j7tu445expires1684519714signaturepuxxwxf3mdj2tkdjytvaag1tguy3d-2d08ccf7a4540d3b2216819277218878-480-0.webp","unavailable":false},
  {"name":"1000 Tulipa Para Pendulo Prateada Com Furo para Argola ATACADo","slug":"1000-tulipa-para-pendulo-prateada-com-furo-para-argola-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-tulipa-para-pendulo-prateada-com-furo-para-argola-atacado/","priceCents":19999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/289e4735c77a49fb0f072146ad58dd3bawsaccesskeyidakiatclmsgfx4j7tu445expires1678298414signaturejog4g1bhb0jumue02zdkogbi8ri3d-cd67098c295636d39e16757064235035-480-0.webp","unavailable":false},
  {"name":"05 Piramide Obsidiana Negra 20mm Pedra Natural Baseada Quéops","slug":"05-piramide-obsidiana-negra-20mm-pedra-natural-baseada-queops","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/05-piramide-obsidiana-negra-20mm-pedra-natural-baseada-queops/","priceCents":9999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/e5b0d6348598d598618697c8f1556e10awsaccesskeyidakiatclmsgfx4j7tu445expires1702575558signaturernqvohylsvq7putxmj2mibkd82bq3d-e6090abad824a3e43c16999835634264-480-0.webp","unavailable":false},
  {"name":"10 kg Pontas Cristal Bruto Natural Pedra Com Base Serrada ATACADO","slug":"10-kg-pontas-cristal-bruto-natural-pedra-com-base-serrada-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-kg-pontas-cristal-bruto-natural-pedra-com-base-serrada-atacado/","priceCents":28900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/cc198d60ace1306c383483b31068e8f1awsaccesskeyidakiatclmsgfx4j7tu445expires1677076889signaturedx3evttua1hqghnrirnoeyb2kq03d-4839c33e4a824b151f16744848952731-480-0.webp","unavailable":false},
  {"name":"100 Tulipa Para Pendulo Prateada Com Furo para Argola ATACADo","slug":"100-tulipa-para-pendulo-prateada-com-furo-para-argola-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-tulipa-para-pendulo-prateada-com-furo-para-argola-atacado/","priceCents":7999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/dd5b9509c03945f7f7589e20cdb49530awsaccesskeyidakiatclmsgfx4j7tu445expires1678298423signaturedwhcb9risl14acwvtz2fbwum03ms3d-829de5ccc310ddd0db16757064321939-480-0.webp","unavailable":false},
  {"name":"20 Kits Chakras 12 Pedras Lapidação Vibrada Kit Atacado Pedras Pequenas","slug":"20-kits-chakras-12-pedras-lapidacao-vibrada-kit-atacado-pedras-pequenas","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-kits-chakras-12-pedras-lapidacao-vibrada-kit-atacado-pedras-pequenas/","priceCents":18000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/61e9038fa35d460e5040ba2527819855awsaccesskeyidakiatclmsgfx4j7tu445expires1677843546signature5lpgsti1txqhhalciz6zrmznl103d-d1822082cff42155c216752515511695-480-0.webp","unavailable":false},
  {"name":"20 kg Pontas Cristal Bruto Natural Pedra Com Base Serrada ATACADO","slug":"20-kg-pontas-cristal-bruto-natural-pedra-com-base-serrada-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-kg-pontas-cristal-bruto-natural-pedra-com-base-serrada-atacado/","priceCents":54900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/86c88c2d78653fe0a46cadc3db8f61aaawsaccesskeyidakiatclmsgfx4j7tu445expires1677076862signaturerqqeribuft2infxiencdp0zwalg3d-4839c33e4a824b151f16744848686816-480-0.webp","unavailable":false},
  {"name":"100 Piramides Cristal Medida Baseada Quéops Tamanho Medio 50% Transparente","slug":"100-piramides-cristal-medida-baseada-queops-tamanho-medio-50-transparente","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-piramides-cristal-medida-baseada-queops-tamanho-medio-50-transparente/","priceCents":106000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/48f666d1dbff91fc320a376153543922awsaccesskeyidakiatclmsgfx4j7tu445expires1677265112signatureoebcglfoxpj6id3j7dgwh1auszy3d-1221be0bc4d2b5f64a16746731177987-480-0.webp","unavailable":false},
  {"name":"1000 Pino e Presilha Dourado Pronto Para Montagem de Pingente ATACADO","slug":"1000-pino-e-presilha-dourado-pronto-para-montagem-de-pingente-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-pino-e-presilha-dourado-pronto-para-montagem-de-pingente-atacado/","priceCents":34998,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/136a7c2b7aaecebfa14961c35d95e8daawsaccesskeyidakiatclmsgfx4j7tu445expires1678297694signaturekrz4mc59xp22fa7xyq0l07s6zngw3d-db705c81e71c87d9df16757057001541-480-0.webp","unavailable":false},
  {"name":"100 Pedras Rolados Mista Meio Furo Pra Montar Pingente ATACADO","slug":"100-pedras-rolados-mista-meio-furo-pra-montar-pingente-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-pedras-rolados-mista-meio-furo-pra-montar-pingente-atacado/","priceCents":11999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/38a4bcecb310702b5d9d798ec9a1d70aawsaccesskeyidakiatclmsgfx4j7tu445expires1702302902signaturehuevrcnkbfbemfi2fabpbpeyzk5c3d-d192462cb27a42d81616997109129544-480-0.webp","unavailable":false},
  {"name":"100 Kits Chakras 12 Pedras Lapidação Vibrada Kit Atacado Pedras Pequenas","slug":"100-kits-chakras-12-pedras-lapidacao-vibrada-kit-atacado-pedras-pequenas","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-kits-chakras-12-pedras-lapidacao-vibrada-kit-atacado-pedras-pequenas/","priceCents":70000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/a07ae81361282bce544fab537a2c168dawsaccesskeyidakiatclmsgfx4j7tu445expires1677843585signaturenjnn87rgufazmt4kseuq87vsaai3d-d1822082cff42155c216752515902233-480-0.webp","unavailable":false},
  {"name":"03 Pirâmide Agata 35mm Pedra Cores Mistas Baseada Quéops ATACADO","slug":"03-piramide-agata-35mm-pedra-cores-mistas-baseada-queops-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/03-piramide-agata-35mm-pedra-cores-mistas-baseada-queops-atacado/","priceCents":5400,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/abfa6b21438c2116424d78ea9edcb523awsaccesskeyidakiatclmsgfx4j7tu445expires1702575347signaturetdomoi7gpqlbaumgpp92gvubva43d-763e59cfdebcb673ad16999833551803-480-0.webp","unavailable":false},
  {"name":"20 Mini Cristais Natural Para Montagem de Brinco 15 a 30 mm ATACADO","slug":"20-mini-cristais-natural-para-montagem-de-brinco-15-a-30-mm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-mini-cristais-natural-para-montagem-de-brinco-15-a-30-mm-atacado/","priceCents":2500,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/61644dd321bf91320b12cb9bc5181d19awsaccesskeyidakiatclmsgfx4j7tu445expires1678303752signaturedtqcmumxj9otwhqsut2ftvnpj1lq3d-e0e065fa249ecb2c3316757117598950-480-0.webp","unavailable":false},
  {"name":"1000 Pino Prateado Para Montagem de Pingentes Furados ATACADO","slug":"1000-pino-prateado-para-montagem-de-pingentes-furados-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-pino-prateado-para-montagem-de-pingentes-furados-atacado/","priceCents":9999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/f7e3620487e210601a2f933af03cd842awsaccesskeyidakiatclmsgfx4j7tu445expires1678298165signature3aodjoffrwkc4vbbld56buot4ce3d-cacfec39f981b393f216757061710955-480-0.webp","unavailable":false},
  {"name":"1000 Presilha Prateado Para Montagem de Pingentes Furados ATACADO","slug":"1000-presilha-prateado-para-montagem-de-pingentes-furados-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-presilha-prateado-para-montagem-de-pingentes-furados-atacado/","priceCents":24999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/a1b7e2fb6ef87ebc9b429c05fab95cd8awsaccesskeyidakiatclmsgfx4j7tu445expires1678298156signature2fefydqug66afiwrrzdl2fnrerzlo3d-92bd8fd6d7f5dd404016757061615546-480-0.webp","unavailable":false},
  {"name":"20 Coração Pedra Quartzo Vermelho Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-quartzo-vermelho-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-quartzo-vermelho-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/e7cc4cde2edda567e0c692071c502f8eawsaccesskeyidakiatclmsgfx4j7tu445expires1701611397signatureyp94jfowcffzoq8ovdts3bbr42fc3d-93dfaaccf6ca94ba7c16990194014176-480-0.webp","unavailable":false},
  {"name":"20 kg Riolita Azul Pacote Pedra Bruto Para Lapidação Atacado","slug":"20-kg-riolita-azul-pacote-pedra-bruto-para-lapidacao-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-kg-riolita-azul-pacote-pedra-bruto-para-lapidacao-atacado/","priceCents":12000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/f9b6acfbcfccbaee8327fa642db2aee3awsaccesskeyidakiatclmsgfx4j7tu445expires1684758610signaturewz0jg70erabunfih9nnhxn21p0w3d-c1aa225db80d7a81e416821666174370-480-0.webp","unavailable":false},
  {"name":"03 Pirâmide Agata 45mm Pedra Cores Mistas Baseada Quéops ATACADO","slug":"03-piramide-agata-45mm-pedra-cores-mistas-baseada-queops-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/03-piramide-agata-45mm-pedra-cores-mistas-baseada-queops-atacado/","priceCents":8900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/72281e40d468a4a6537df9b7da2cf974awsaccesskeyidakiatclmsgfx4j7tu445expires1702575342signature2fa0ahwhlkrgcwhijljksywsfwsk3d-d7d98fd6bb5e5a31d216999833479531-480-0.webp","unavailable":false},
  {"name":"05 Pingente Bolinha Agata Amarela Envolto Pedra Montagem Dourada ATACADO","slug":"05-pingente-bolinha-agata-amarela-envolto-pedra-montagem-dourada-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/05-pingente-bolinha-agata-amarela-envolto-pedra-montagem-dourada-atacado/","priceCents":5099,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/82bd558232f78c1fcff679e12d32ff2bawsaccesskeyidakiatclmsgfx4j7tu445expires1679684449signatureor1bvqsxl9dfgve1wn1a2qkrhqw3d-4a4fae633191990e2c16770924614513-480-0.webp","unavailable":false},
  {"name":"Kit 03 Ponta Natural Pedras Lapidado Vermelhas Gerador ATACADO","slug":"kit-03-ponta-natural-pedras-lapidado-vermelhas-gerador-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/kit-03-ponta-natural-pedras-lapidado-vermelhas-gerador-atacado/","priceCents":5999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/32c944e99de8a4cd7130921b6b10e469awsaccesskeyidakiatclmsgfx4j7tu445expires1684519703signatureqdij2fffzungsiwvywt6bc0a3b983d-f902abc32ca87031df16819277102294-480-0.webp","unavailable":false},
  {"name":"05 Pingente Bolinha Howlita Vermelha Envolto Montagem Dourada ATACADO","slug":"05-pingente-bolinha-howlita-vermelha-envolto-montagem-dourada-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/05-pingente-bolinha-howlita-vermelha-envolto-montagem-dourada-atacado/","priceCents":5099,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/b4875c19578df4db1d2eb78f78115442awsaccesskeyidakiatclmsgfx4j7tu445expires1679683763signature3clzj78cucspjayqakpwqlj9pnk3d-d4030d2de148156de216770917753938-480-0.webp","unavailable":false},
  {"name":"Lembrança de Casamento 10 Corações Quartzo Rosa Tamanho 5 cm ATACADO","slug":"lembranca-de-casamento-10-coracoes-quartzo-rosa-tamanho-5-cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lembranca-de-casamento-10-coracoes-quartzo-rosa-tamanho-5-cm-atacado/","priceCents":24000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/ee00d7236e04fd72618739a1a1c0ee6bawsaccesskeyidakiatclmsgfx4j7tu445expires1701612113signaturex9ilhdvrb3cwdutewklarcz0d2ba3d-febaf01b2542b9fb7616990201192826-480-0.webp","unavailable":false},
  {"name":"03 kg Massageador Tipo Seixo Quartzo Azul Pedras Comuns ATACADO","slug":"03-kg-massageador-tipo-seixo-quartzo-azul-pedras-comuns-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/03-kg-massageador-tipo-seixo-quartzo-azul-pedras-comuns-atacado/","priceCents":15000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/a7a0b881bdba39c0944b210a8bf19ca4awsaccesskeyidakiatclmsgfx4j7tu445expires1702295516signatureuzn2vlocq9ndwtykeoqtdkdo8uo3d-86ecb7e0409e1816a516997035237135-480-0.webp","unavailable":false},
  {"name":"03 Pirâmide Agata 55mm Pedra Cores Mistas Baseada Quéops ATACADO","slug":"03-piramide-agata-55mm-pedra-cores-mistas-baseada-queops-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/03-piramide-agata-55mm-pedra-cores-mistas-baseada-queops-atacado/","priceCents":13800,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/9467fe6f793d2ca3772050cb6b76f67dawsaccesskeyidakiatclmsgfx4j7tu445expires1702575336signaturefufxkxfgqt3gaddonajm8u34lru3d-4a0b77ec17490152d116999833422217-480-0.webp","unavailable":false},
  {"name":"100 Pingente DENTE DE DRAGAO Pedra Quartzo Verde Natural com Montagem Banho Dourado ATACADO","slug":"100-pingente-dente-de-dragao-pedra-quartzo-verde-natural-com-montagem-banho-dourado-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-pingente-dente-de-dragao-pedra-quartzo-verde-natural-com-montagem-banho-dourado-atacado/","priceCents":73999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/7788d29d175c041ac85359fc97968a39awsaccesskeyidakiatclmsgfx4j7tu445expires1679764275signaturehqa4mxtqqmlsvx6c6zefcprige03d-3b354ec867a5d67b7b16771722841244-480-0.webp","unavailable":false},
  {"name":"1000 Pino e Presilha Prateada Pronto Para Montagem de Pingente ATACADO","slug":"1000-pino-e-presilha-prateada-pronto-para-montagem-de-pingente-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-pino-e-presilha-prateada-pronto-para-montagem-de-pingente-atacado/","priceCents":34998,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/fede64be6a730959739ebfbb961cf3cdawsaccesskeyidakiatclmsgfx4j7tu445expires1678298146signatureg2fcksyxncz4j88zkhpryj0d2apq3d-97f2e2860ef6fe43ae16757061517783-480-0.webp","unavailable":false},
  {"name":"1000 Pino Dourado Para Montagem de Pingentes Furados ATACADO","slug":"1000-pino-dourado-para-montagem-de-pingentes-furados-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-pino-dourado-para-montagem-de-pingentes-furados-atacado/","priceCents":9999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/efed851a8444e04357c45cdaa9e940a1awsaccesskeyidakiatclmsgfx4j7tu445expires1678297705signaturelsgoj66piagy0rpiw5ysfteqoxo3d-593007390adaee56e916757057102400-480-0.webp","unavailable":false},
  {"name":"1000 Presilha Dourado Para Montagem de Pingentes Furados ATACADO","slug":"1000-presilha-dourado-para-montagem-de-pingentes-furados-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-presilha-dourado-para-montagem-de-pingentes-furados-atacado/","priceCents":129999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/9b6170d9ee36be5d015e7fcc2dc465acawsaccesskeyidakiatclmsgfx4j7tu445expires1678297347signature9b2b0jbd2fxvmzdeouphzcovadrgs3d-cabc25db79ddb7ff8616757053544412-480-0.webp","unavailable":false},
  {"name":"100 Presilha Com Pino Prata 950 Para Montagem de Pingentes com Furo ATACADO","slug":"100-presilha-com-pino-prata-950-para-montagem-de-pingentes-com-furo-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-presilha-com-pino-prata-950-para-montagem-de-pingentes-com-furo-atacado/","priceCents":59999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/b623f3e5a5be0d2fff46c2583de9ce93awsaccesskeyidakiatclmsgfx4j7tu445expires1678296856signature7hxgvpnard8c6l5tekwivvwojv03d-01f9dd3a6645e383eb16757048623876-480-0.webp","unavailable":false},
  {"name":"1000 Presilha Com Pino Prata 950 Para Montagem de Pingentes com Furo ATACADO","slug":"1000-presilha-com-pino-prata-950-para-montagem-de-pingentes-com-furo-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/1000-presilha-com-pino-prata-950-para-montagem-de-pingentes-com-furo-atacado/","priceCents":1032000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/3efd817f0566d540aaf568e38ba72a42awsaccesskeyidakiatclmsgfx4j7tu445expires1678296849signaturedhuglpe8cqsahz7qdmsbtnjrqku3d-01f9dd3a6645e383eb16757048571474-480-0.webp","unavailable":false},
  {"name":"100 Pop Socket Agata MISTA Natural Suporte P/ Celular ATACADO","slug":"100-pop-socket-agata-mista-natural-suporte-p-celular-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-pop-socket-agata-mista-natural-suporte-p-celular-atacado/","priceCents":349999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/fbf60868ada5fd29c58f810f43457c06awsaccesskeyidakiatclmsgfx4j7tu445expires1703424341signatureig5izcpp2a2r2bcixisy2fwu4siw83d-c1d0b11cfb6c961aa517008323458477-480-0.webp","unavailable":false},
  {"name":"05 Pingente Extra Cabochao Pedra Quartzo Cristal Montagem Garra Dourado ATACADO","slug":"05-pingente-extra-cabochao-pedra-quartzo-cristal-montagem-garra-dourado-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/05-pingente-extra-cabochao-pedra-quartzo-cristal-montagem-garra-dourado-atacado/","priceCents":17000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/80fe74bfc828c5a9a0a1cf26e1eb32b3awsaccesskeyidakiatclmsgfx4j7tu445expires1679675694signaturec1vegomlopjel2bdghp673zwf1no3d-e312f146ebf6b80d9b16770837056289-480-0.webp","unavailable":false},
  {"name":"Lembrança de Casamento 100 Corações Quartzo Rosa Tamanho 5 cm ATACADO","slug":"lembranca-de-casamento-100-coracoes-quartzo-rosa-tamanho-5-cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lembranca-de-casamento-100-coracoes-quartzo-rosa-tamanho-5-cm-atacado/","priceCents":195000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/f75bf7b4139ad0ee83d5d9d2f7093991awsaccesskeyidakiatclmsgfx4j7tu445expires1701612041signaturev8qpeclsfe23jivs4s1hptiuqla3d-a0deedcc208141a21f16990200452902-480-0.webp","unavailable":false},
  {"name":"Lembrança de Casamento 50 Corações Quartzo Rosa Tamanho 5 cm ATACADO","slug":"lembranca-de-casamento-50-coracoes-quartzo-rosa-tamanho-5-cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lembranca-de-casamento-50-coracoes-quartzo-rosa-tamanho-5-cm-atacado/","priceCents":105000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/dd139ba2335d2e24b48450d6805a2701awsaccesskeyidakiatclmsgfx4j7tu445expires1701612027signaturesiv2br5qio2b4ufjz984zastkyrs43d-ba85150c6a5b7ffa9616990200334094-480-0.webp","unavailable":false},
  {"name":"20 Coração Pedra Jaspe Vermelho Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-jaspe-vermelho-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-jaspe-vermelho-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/5a1262ac65af66e13c9ee5c59eee5974awsaccesskeyidakiatclmsgfx4j7tu445expires1701611413signature4e6fui2iertljejckwnqolhdn2bc3d-1cae67b4a20b70b40916990194171347-480-0.webp","unavailable":false},
  {"name":"20 Coração Pedra Quartzo Preto Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-quartzo-preto-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-quartzo-preto-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/1f475c8850cd9b352b8fbd87fd995015awsaccesskeyidakiatclmsgfx4j7tu445expires1701611405signatureblayiztmw3pswgqg2brer2t3bosw3d-f49b8230ea1c2acc7216990194093713-480-0.webp","unavailable":false},
  {"name":"20 Coração Pedra Quartzo Brasil Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-quartzo-brasil-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-quartzo-brasil-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/58c227dd5181d7a8c8b91b3f8a93a95cawsaccesskeyidakiatclmsgfx4j7tu445expires1701610942signaturefbwf5qngehpoa4wez5mokl2f2fzxu3d-df74563b5a32b61ce716990189497057-480-0.webp","unavailable":false},
  {"name":"20 Coração Pedra Unakita Brasileira Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-unakita-brasileira-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-unakita-brasileira-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/f7932250e98944b8f4f6c66acd40e35cawsaccesskeyidakiatclmsgfx4j7tu445expires1701610925signaturezblqaxfdbiexs61sff58kbhsodo3d-f398087b65a9b1a7f416990189336727-480-0.webp","unavailable":false},
  {"name":"4 Pares Gota Longa pra Pingente ou Brinco Pedra Obsidiana Negra Lapidado 40 x 10mm","slug":"4-pares-gota-longa-pra-pingente-ou-brinco-pedra-obsidiana-negra-lapidado-40-x-10mm","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/4-pares-gota-longa-pra-pingente-ou-brinco-pedra-obsidiana-negra-lapidado-40-x-10mm/","priceCents":5400,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/618ebdcb9f2ea701c244003c924fccc5awsaccesskeyidakiatclmsgfx4j7tu445expires1677774803signatureudtqvuwqedj9ranqenwpwnakwze3d-3eff6fbb8f08d8107a16751828081462-480-0.webp","unavailable":false},
  {"name":"10 Retangulo Cabochao pra Pingente Pedra Hematoide Vermelho Calibrado 15 x 20 MM","slug":"10-retangulo-cabochao-pra-pingente-pedra-hematoide-vermelho-calibrado-15-x-20-mm","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-retangulo-cabochao-pra-pingente-pedra-hematoide-vermelho-calibrado-15-x-20-mm/","priceCents":6099,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/cacbf79388accb38d5ac7722a3dbcf56awsaccesskeyidakiatclmsgfx4j7tu445expires1677774189signaturerl777o2iomjncum9lp0xfaqxt1y3d-72a6c228f1d250510116751821967819-480-0.webp","unavailable":false},
  {"name":"100 Prisma Feng Shui Bola Multifacetada Cristal de Quartzo Montado Corrente e Tulipa","slug":"100-prisma-feng-shui-bola-multifacetada-cristal-de-quartzo-montado-corrente-e-tulipa","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/100-prisma-feng-shui-bola-multifacetada-cristal-de-quartzo-montado-corrente-e-tulipa/","priceCents":319900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/e96d3e6efe2516044c417e95acecbba8awsaccesskeyidakiatclmsgfx4j7tu445expires1677501826signature9wnzjoqarnrfkuzi0fpnb2bbvess3d-0bcb469ffa0ec0c63516749098303337-480-0.webp","unavailable":false},
  {"name":"Lembrança Casamento 100 Corações Pingente Pedra Quartzo Rosa Montagem PRATA 950 ATACADO","slug":"lembranca-casamento-100-coracoes-pingente-pedra-quartzo-rosa-montagem-prata-950-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lembranca-casamento-100-coracoes-pingente-pedra-quartzo-rosa-montagem-prata-950-atacado/","priceCents":106099,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/95514a3a84a291aecb18cbf02238ffe4awsaccesskeyidakiatclmsgfx4j7tu445expires1677682798signaturemkz2w5kkpv0mgi1t51x4x2frxdyu3d-6983886c301fb17c1816750908039550-480-0.webp","unavailable":false},
  {"name":"Lembrança Casamento 50 Corações Pingente Pedra Quartzo Rosa Montagem PRATA 950 ATACADO","slug":"lembranca-casamento-50-coracoes-pingente-pedra-quartzo-rosa-montagem-prata-950-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lembranca-casamento-50-coracoes-pingente-pedra-quartzo-rosa-montagem-prata-950-atacado/","priceCents":56399,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/5532f50866aace2f7de12155337368a5awsaccesskeyidakiatclmsgfx4j7tu445expires1677682756signatureoyhplh2bhdzivglxigciur4esjdm3d-6983886c301fb17c1816750907611599-480-0.webp","unavailable":false},
  {"name":"Lote de 10 Cranio Cristal Quartzo Natural skull Stone ATACADO","slug":"lote-de-10-cranio-cristal-quartzo-natural-skull-stone-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lote-de-10-cranio-cristal-quartzo-natural-skull-stone-atacado/","priceCents":49900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/015d84fa7a00a2f4c58c4d9770c41bf9awsaccesskeyidakiatclmsgfx4j7tu445expires1703515543signaturehg3on2flunsbfva7s5vhkunz9wei3d-f3f321414ee5f8131917009235509644-480-0.webp","unavailable":false},
  {"name":"20 kg Riolita Rosa Pacote Pedra Bruto Para Lapidação Atacado","slug":"20-kg-riolita-rosa-pacote-pedra-bruto-para-lapidacao-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-kg-riolita-rosa-pacote-pedra-bruto-para-lapidacao-atacado/","priceCents":12000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/ddf566c0de1b964598b595865a46c8f2awsaccesskeyidakiatclmsgfx4j7tu445expires1684758604signature9quamupz7zqbxuwupwljv5qowyw3d-97816b2e4662778f0116821666116610-480-0.webp","unavailable":false},
  {"name":"20 Massageador Roliço Quartzo Cristal 8 a 12cm Atacado Cod 275838","slug":"20-massageador-rolico-quartzo-cristal-8-a-12cm-atacado-cod-275838","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-rolico-quartzo-cristal-8-a-12cm-atacado-cod-275838/","priceCents":26000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/2923704c27e549221d6dc2bbe478d7d2awsaccesskeyidakiatclmsgfx4j7tu445expires1677344759signaturezn36t2bglhzkpbpcy2fsitsgg2bpg83d-e19dba403e84e6852216747527634610-480-0.webp","unavailable":false},
  {"name":"01kg Massageador De Seixo Jaspe Vermelho ATACADO Reff 116352","slug":"01kg-massageador-de-seixo-jaspe-vermelho-atacado-reff-116352","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/01kg-massageador-de-seixo-jaspe-vermelho-atacado-reff-116352/","priceCents":4900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/a74e8b4cc5e7002682157a1d43166a28awsaccesskeyidakiatclmsgfx4j7tu445expires1702295609signatureamyr7oryo2ft62ef4bshcjos44is3d-8aeefddd36e707c2c416997036134129-480-0.webp","unavailable":false},
  {"name":"20 Massageador Roliço Jaspe Vermelho 8 a 12cm Atacado","slug":"20-massageador-rolico-jaspe-vermelho-8-a-12cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-rolico-jaspe-vermelho-8-a-12cm-atacado/","priceCents":32000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/ef0f89e93e76250dfd4de4a6da7b6f9aawsaccesskeyidakiatclmsgfx4j7tu445expires1677336769signaturekowsiriqdrojhhmuq6liyx0kd0g3d-435c7358b7f1816e3216747447734328-480-0.webp","unavailable":false},
  {"name":"20 Massageador Roliço Quartzo Preto 8 a 12cm Atacado","slug":"20-massageador-rolico-quartzo-preto-8-a-12cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-rolico-quartzo-preto-8-a-12cm-atacado/","priceCents":26000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/7c45b3ccbdc132fb0d747e8bc4ebbc93awsaccesskeyidakiatclmsgfx4j7tu445expires1677336272signaturejjaxohwyvsbdiobhb2brexss43sy3d-6cb6b4b5b3ac7c39f916747442763732-480-0.webp","unavailable":false},
  {"name":"20 Massageador Roliço Quartzo Vermelho 8 a 12cm Atacado","slug":"20-massageador-rolico-quartzo-vermelho-8-a-12cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-rolico-quartzo-vermelho-8-a-12cm-atacado/","priceCents":26000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/54759b55687fa2a2e712e7572af70793awsaccesskeyidakiatclmsgfx4j7tu445expires1677336058signaturebpmo5qn2fxo1vcasvsmjhaiuel9a3d-e34456d7afc395f30116747440632027-480-0.webp","unavailable":false},
  {"name":"20 Massageador Roliço Misto 8 a 12cm Atacado Cod 120389","slug":"20-massageador-rolico-misto-8-a-12cm-atacado-cod-120389","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-rolico-misto-8-a-12cm-atacado-cod-120389/","priceCents":26000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/b2cfdb1249f0b1a4d96e8a22a9ab26cbawsaccesskeyidakiatclmsgfx4j7tu445expires1677335756signature9lafrd1ixit3pxvzneucioe4ua03d-1b93f91a70816499ab16747437601547-480-0.webp","unavailable":false},
  {"name":"10 kg Massageador Tipo Seixo Turmalina no Feldspato Pedras Comuns","slug":"10-kg-massageador-tipo-seixo-turmalina-no-feldspato-pedras-comuns","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-kg-massageador-tipo-seixo-turmalina-no-feldspato-pedras-comuns/","priceCents":49900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/7240ea8e80df53b57314637ba0318f74awsaccesskeyidakiatclmsgfx4j7tu445expires1702295446signature45sp15e7zabcxfq5tw1h2bs5btrs3d-2ebb33d52adf23a43616997034564704-480-0.webp","unavailable":false},
  {"name":"10 kg Massageador De Seixo Basalto Para Terapia Pedra Quente Frias MEDIO ATACADO","slug":"10-kg-massageador-de-seixo-basalto-para-terapia-pedra-quente-frias-medio-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-kg-massageador-de-seixo-basalto-para-terapia-pedra-quente-frias-medio-atacado/","priceCents":36000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/1b427ae7119762ccc934f5969c915afbawsaccesskeyidakiatclmsgfx4j7tu445expires1702295413signature6kfgn3u3oeefxubrby9tlszxyfa3d-9f539c11b5e6949e5e16997034236673-480-0.webp","unavailable":false},
  {"name":"4 Porta Vela Cascalho Misto Pedra Rolada na Resina ATACADO","slug":"4-porta-vela-cascalho-misto-pedra-rolada-na-resina-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/4-porta-vela-cascalho-misto-pedra-rolada-na-resina-atacado/","priceCents":3900,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/d6dc508030ed245749bbb64f1928aa32awsaccesskeyidakiatclmsgfx4j7tu445expires1677259682signaturebb6ybmlacpakliw9tqotowpml1s3d-150135ff60f605e73b16746676896092-480-0.webp","unavailable":true},
  {"name":"05 Pirâmide Ametista 20mm Pedra Natural Baseada Quéops Atacado","slug":"05-piramide-ametista-20mm-pedra-natural-baseada-queops-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/05-piramide-ametista-20mm-pedra-natural-baseada-queops-atacado/","priceCents":6000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/ec4cb1318e5b6b0c9fcc8680bc455968awsaccesskeyidakiatclmsgfx4j7tu445expires1677262663signatureqjrtry52fo9v6cogrbyt3ib6u8tm3d-2f8c47953a32d57d2b16746706692791-480-0.webp","unavailable":true},
  {"name":"20 Coração Pedra Jade Verde Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-jade-verde-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-jade-verde-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/0c42a634cce5e479a2690aa49425dbb2awsaccesskeyidakiatclmsgfx4j7tu445expires1701611382signaturepxo2bxg2b3pk3oaeqobmv2bjsvg2fs43d-f4e074ef69d9e2d65c16990193858766-480-0.webp","unavailable":true},
  {"name":"Lote 10 Pontas Cristais Pequeno 4 a 5cm Gerador Lapidado Loja Fisica","slug":"lote-10-pontas-cristais-pequeno-4-a-5cm-gerador-lapidado-loja-fisica","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lote-10-pontas-cristais-pequeno-4-a-5cm-gerador-lapidado-loja-fisica/","priceCents":20000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/ed521728582411e0cd2e70ae8a36e7cfawsaccesskeyidakiatclmsgfx4j7tu445expires1702747593signaturei880ipyznsp2ffsch31y2fhne1v0g3d-c7c715ad05e1b6ae3817001556011973-480-0.webp","unavailable":true},
  {"name":"20 Coração Pedra Hematoide Amarelo Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-hematoide-amarelo-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-hematoide-amarelo-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/856235791567d8468d42797209bc7e01awsaccesskeyidakiatclmsgfx4j7tu445expires1701611421signaturemzow7lt1kfiyo8ao0qzdvpuzele3d-68ecbfb200dabf224816990194250021-480-0.webp","unavailable":true},
  {"name":"20 Coração Pedras Misto Natural 4 a 6 cm ATACADO","slug":"20-coracao-pedras-misto-natural-4-a-6-cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedras-misto-natural-4-a-6-cm-atacado/","priceCents":44995,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/a0c0b069edfe6da75eb53add149a21a3awsaccesskeyidakiatclmsgfx4j7tu445expires1701610965signatureovanw2fy8sw2r3djnphfysctkds03d-7ee366e9069787982816990189696122-480-0.webp","unavailable":true},
  {"name":"5 Massageador Sabonete Pedra Jade Verde 6 a 8cm Terapeutica","slug":"5-massageador-sabonete-pedra-jade-verde-6-a-8cm-terapeutica","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/5-massageador-sabonete-pedra-jade-verde-6-a-8cm-terapeutica/","priceCents":7500,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/4dbf531e8ca29430de98d54ca5f7282bawsaccesskeyidakiatclmsgfx4j7tu445expires1702229080signaturexhfxcunpyslfj9eudnc8ylaikx83d-a2e7029af56a9414ce16996370860501-480-0.webp","unavailable":true},
  {"name":"20 Massageador Sabonete Pedra Mistas 6 a 8cm Terapeutica","slug":"20-massageador-sabonete-pedra-mistas-6-a-8cm-terapeutica","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-sabonete-pedra-mistas-6-a-8cm-terapeutica/","priceCents":26000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/4d1022e534518bdc21c8ef81628fa23fawsaccesskeyidakiatclmsgfx4j7tu445expires1704375746signaturekusc9kp1dtfukprkv740jftuccm3d-56b1168ec89fec128c17017837508527-480-0.webp","unavailable":true},
  {"name":"Chevron Rolado Pequeno Pct Com 1kg Pedra Natural Reff 278274","slug":"chevron-rolado-pequeno-pct-com-1kg-pedra-natural-reff-278274","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/chevron-rolado-pequeno-pct-com-1kg-pedra-natural-reff-278274/","priceCents":2200,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/1f6ac13ed2d2688f733c0d3d7857406cawsaccesskeyidakiatclmsgfx4j7tu445expires1704048793signaturer1nxvbqdfqfa3fwpylqfuia9u4m3d-1b32c56a72af4c344017014567968526-480-0.webp","unavailable":true},
  {"name":"20 Massageador Roliço Quartzo Rosa 8 a 12cm Atacado Cod 210204","slug":"20-massageador-rolico-quartzo-rosa-8-a-12cm-atacado-cod-210204","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-rolico-quartzo-rosa-8-a-12cm-atacado-cod-210204/","priceCents":26000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/65c19a5ae3d1b554c39e08e60d321a19awsaccesskeyidakiatclmsgfx4j7tu445expires1704042151signaturek2vh5bq6iozmys5yvvl92tkex2fe3d-b20e78a0feb5fe2eca17014501548061-480-0.webp","unavailable":true},
  {"name":"Lote 02 Cristais MEDIO 5 a 8 cm Gerador Lapidado Loja Fisica","slug":"lote-02-cristais-medio-5-a-8-cm-gerador-lapidado-loja-fisica","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/lote-02-cristais-medio-5-a-8-cm-gerador-lapidado-loja-fisica/","priceCents":6000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/33b45735f7498f0e5c2bd4a74d0b42a9awsaccesskeyidakiatclmsgfx4j7tu445expires1702747601signaturevmzth3ra7qoerihdyjgyq7bxpv43d-89fe1edb385a85f62817001556070864-480-0.webp","unavailable":true},
  {"name":"05 Pingente Trillion Obsidiana Verde Caixinha e Garras Reforçado Dourado REF 15.5 ATACADO","slug":"05-pingente-trillion-obsidiana-verde-caixinha-e-garras-reforcado-dourado-ref-15-5-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/05-pingente-trillion-obsidiana-verde-caixinha-e-garras-reforcado-dourado-ref-15-5-atacado/","priceCents":16399,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/8d4ef7ae2c3414bf87e2786cfbda7931awsaccesskeyidakiatclmsgfx4j7tu445expires1679675624signatureliyycwua3urehhkeecmpij6p67q3d-9140c5638ff6359aaf16770836292620-480-0.webp","unavailable":true},
  {"name":"10 Pingente Pontinha Atacado Pedra Bronzita Presilha e Pino Dourado","slug":"10-pingente-pontinha-atacado-pedra-bronzita-presilha-e-pino-dourado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-pingente-pontinha-atacado-pedra-bronzita-presilha-e-pino-dourado/","priceCents":8599,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/cb815ec03320429c2918105323389c7eawsaccesskeyidakiatclmsgfx4j7tu445expires1678476135signature6lbjoitqow5lbevnfekf9ix8ez03d-3f9a4c369d8bf375df16758841390270-480-0.webp","unavailable":true},
  {"name":"5 Micro Pontinha cristal Amazonita 15mm pra montar joias","slug":"5-micro-pontinha-cristal-amazonita-15mm-pra-montar-joias","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/5-micro-pontinha-cristal-amazonita-15mm-pra-montar-joias/","priceCents":4050,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/51efec574da54e511dd619b0641d0a53awsaccesskeyidakiatclmsgfx4j7tu445expires1678302381signaturefib5bd2scourkaryptayjf0qpcy3d-f93fe3b518f92c958c16757103868098-480-0.webp","unavailable":true},
  {"name":"50 Pingente Bolinha Pedra Agata Rosa Pino Dourada ATACADO","slug":"50-pingente-bolinha-pedra-agata-rosa-pino-dourada-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/50-pingente-bolinha-pedra-agata-rosa-pino-dourada-atacado/","priceCents":28799,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/8241651d77f89a4cd859908ba60694a3awsaccesskeyidakiatclmsgfx4j7tu445expires1678280039signaturecqw1ajxnipxq0b2by2bcygnpcexji3d-16989da90c5ec8e66816756880472538-480-0.webp","unavailable":true},
  {"name":"20 Coração Pedra Quartzo Leitoso Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-quartzo-leitoso-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-quartzo-leitoso-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/52f60f619ba23555db16ad2f251f344aawsaccesskeyidakiatclmsgfx4j7tu445expires1701611963signature8tg7o7snoyw2bm2alcldoztljaie3d-f7890dda256fc70d6216990199672016-480-0.webp","unavailable":true},
  {"name":"20 Coração Pedra Quartzo Fumê Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-quartzo-fume-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-quartzo-fume-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/7339806fc0d250eb33daf9f128927211awsaccesskeyidakiatclmsgfx4j7tu445expires1701611568signaturevz5dw9phsg7tuqbuytecstwgagy3d-62283cc060da27f55b16990195717825-480-0.webp","unavailable":true},
  {"name":"20 Coração Pedra Chevron Extra Natural 4.7 a 6.5cm ATACADO","slug":"20-coracao-pedra-chevron-extra-natural-4-7-a-6-5cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-coracao-pedra-chevron-extra-natural-4-7-a-6-5cm-atacado/","priceCents":44999,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/ee928faa8c0dbdd9ea34dc31983d154dawsaccesskeyidakiatclmsgfx4j7tu445expires1701611366signaturelvjxbu5dthtdh74v7ci2fgysapzu3d-c2b25cf19e8a7e978516990193699683-480-0.webp","unavailable":true},
  {"name":"10 Retangulo Cabochao pra Pingente Pedra Amazonita Verde Furado Calibrado 15 x 20 MM","slug":"10-retangulo-cabochao-pra-pingente-pedra-amazonita-verde-furado-calibrado-15-x-20-mm","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-retangulo-cabochao-pra-pingente-pedra-amazonita-verde-furado-calibrado-15-x-20-mm/","priceCents":6599,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/982ddd2a0b5f8f22484eb13f53a399a2awsaccesskeyidakiatclmsgfx4j7tu445expires1677688106signaturetnmgesfokk0q5nfwe15ncbfu9ic3d-89d29c110ed178e8e616750961121760-480-0.webp","unavailable":true},
  {"name":"10 Retangulo Cabochao pra Pingente Pedra Ametista Furado Lapidado Calibrado 15 x 20 MM","slug":"10-retangulo-cabochao-pra-pingente-pedra-ametista-furado-lapidado-calibrado-15-x-20-mm","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-retangulo-cabochao-pra-pingente-pedra-ametista-furado-lapidado-calibrado-15-x-20-mm/","priceCents":6599,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/17d38934c0b8e6c50e55a9b340fada0eawsaccesskeyidakiatclmsgfx4j7tu445expires1677688102signatureaorjcl3cqkv9lhujxicwmt2hxsu3d-e3736024b218e697e616750961072912-480-0.webp","unavailable":true},
  {"name":"10 Retangulo Cabochao pra Pingente Pedra Quartzo Fume Furado Calibrado 15 x 20 MM","slug":"10-retangulo-cabochao-pra-pingente-pedra-quartzo-fume-furado-calibrado-15-x-20-mm","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/10-retangulo-cabochao-pra-pingente-pedra-quartzo-fume-furado-calibrado-15-x-20-mm/","priceCents":6599,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/4440034fcdeb09bad20f02158d5795a1awsaccesskeyidakiatclmsgfx4j7tu445expires1677688093signaturerznhnncdw1i2ygfzuhfayysiife3d-2e6babbb081abc6ae916750960982696-480-0.webp","unavailable":true},
  {"name":"20 Pingente Pontinha Citrino Cachinha Prata 950 REFF PC7873","slug":"20-pingente-pontinha-citrino-cachinha-prata-950-reff-pc7873","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-pingente-pontinha-citrino-cachinha-prata-950-reff-pc7873/","priceCents":45000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/88c67670427774ecc2101c0207b36298awsaccesskeyidakiatclmsgfx4j7tu445expires1677441389signature9in4sgo7gdn86uk4qwgqv3dz2w03d-417f6e96260e37748116748493987098-480-0.webp","unavailable":true},
  {"name":"20 Massageador Roliço Quartzo Leitoso 8 a 12cm Atacado","slug":"20-massageador-rolico-quartzo-leitoso-8-a-12cm-atacado","sourceUrl":"https://www.cristaisdecurvelo.com.br/produtos/20-massageador-rolico-quartzo-leitoso-8-a-12cm-atacado/","priceCents":26000,"imageUrl":"https://acdn-us.mitiendanube.com/stores/002/764/861/products/b2dc6cecc89b25cfee2f639e3f046f4aawsaccesskeyidakiatclmsgfx4j7tu445expires1677336594signaturemfd2fvhw9b32cforfinwhqhyx7ra3d-aebea918b8d39bace116747445995146-480-0.webp","unavailable":true},
];

const suggestCrystalsSalePrice = (costCents: number) => {
  if (costCents <= 500) return Math.round(costCents * 3);
  if (costCents <= 2000) return Math.round(costCents * 2.5);
  if (costCents <= 5000) return Math.round(costCents * 2);
  return Math.round(costCents * 1.8);
};

export async function seedCrystalsCatalog() {
  const db = await getDb();
  if (!db) return;
  const supplierId = await ensureCrystalsSupplier();
  if (!supplierId) return;
  const existing = await listSupplierCatalog(supplierId);
  const existingSlugs = new Set(existing.map((item) => item.sourceSlug));
  const fresh = CRYSTALS_SEED_ITEMS.filter((item) => !existingSlugs.has(item.slug));
  if (fresh.length === 0) return;
  await createSupplierCatalogBatch(
    fresh.map((item) => ({
      supplierId,
      sourceKey: "cristais_curvelo" as const,
      name: item.name,
      category: "pedras" as const,
      sourceSlug: item.slug,
      sourceUrl: item.sourceUrl,
      imageUrl: item.imageUrl ?? undefined,
      price: item.priceCents ?? 0,
      suggestedSalePrice: item.priceCents ? suggestCrystalsSalePrice(item.priceCents) : null,
      stockStatus: item.unavailable ? ("indisponivel" as const) : item.priceCents !== null ? ("disponivel" as const) : ("desconhecido" as const),
    }))
  );
}

export async function getProductSuppliers(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(productSuppliers).where(eq(productSuppliers.productId, productId));
}

export async function createProductSupplier(data: InsertProductSupplier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(productSuppliers).values(data);
}

export async function updateProductSupplier(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(productSuppliers).set(data).where(eq(productSuppliers.id, id));
}

export async function deleteProductSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(productSuppliers).where(eq(productSuppliers.id, id));
}

// ─── Users Management ─────────────────────────────────────────────────────────

export async function listUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(users);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

export async function createLocalUser(data: {
  name: string;
  email: string;
  role?: "user" | "admin";
  passwordHash?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserByEmail(data.email);
  if (existing) throw new Error("Já existe um usuário com esse email");

  const openId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return await db
    .insert(users)
    .values({
      openId,
      name: data.name,
      email: data.email,
      loginMethod: "local",
      role: data.role || "user",
      passwordHash: data.passwordHash,
    });
}

export async function updateUser(id: number, data: Partial<{ name: string; email: string; role: "user" | "admin" }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(users).where(eq(users.id, id));
}

// ─── Receipts ────────────────────────────────────────────────────────────────

import { receipts, InsertReceipt } from "../drizzle/schema";

export async function getNextReceiptNumber(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ maxNum: sql<number>`COALESCE(MAX(${receipts.receiptNumber}), 0)` }).from(receipts);
  return (result[0]?.maxNum ?? 0) + 1;
}

export async function createReceipt(data: {
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  items: string; // JSON string
}): Promise<{ receiptNumber: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const receiptNumber = await getNextReceiptNumber();
  await db.insert(receipts).values({
    receiptNumber,
    subtotal: data.subtotal,
    discount: data.discount,
    total: data.total,
    paymentMethod: data.paymentMethod,
    notes: data.notes || null,
    items: data.items,
  });
  return { receiptNumber };
}

export async function listReceipts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(receipts).orderBy(desc(receipts.createdAt)).limit(limit);
}

export async function getReceiptByNumber(receiptNumber: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(receipts).where(eq(receipts.receiptNumber, receiptNumber)).limit(1);
  return result[0] || null;
}

// ─── Supplier Catalog ──────────────────────────────────────────────────────

export async function listSupplierCatalog(supplierId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (supplierId) {
    return await db.select().from(supplierCatalog).where(eq(supplierCatalog.supplierId, supplierId)).orderBy(supplierCatalog.name);
  }
  return await db.select().from(supplierCatalog).orderBy(supplierCatalog.name);
}

export async function getSupplierCatalogItem(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(supplierCatalog).where(eq(supplierCatalog.id, id)).limit(1);
  return result[0] || null;
}

export async function createSupplierCatalogItem(data: InsertSupplierCatalogItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(supplierCatalog).values(data);
}

export async function createSupplierCatalogBatch(items: InsertSupplierCatalogItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return { count: 0 };
  const CHUNK = 50;
  for (let i = 0; i < items.length; i += CHUNK) {
    await db.insert(supplierCatalog).values(items.slice(i, i + CHUNK));
  }
  return { count: items.length };
}

export async function updateSupplierCatalogItem(
  id: number,
  data: Partial<{ price: number; suggestedSalePrice: number; stockStatus: "disponivel" | "indisponivel" | "desconhecido"; lastCheckedAt: Date; imageUrl: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(supplierCatalog).set(data).where(eq(supplierCatalog.id, id));
}

export async function deleteSupplierCatalogItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(supplierCatalog).where(eq(supplierCatalog.id, id));
}

// ─── Terreiros Parceiros (Portal do Parceiro) ─────────────────────────────────

export async function listTerreiros(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  if (includeInactive) return db.select().from(terreiros).orderBy(terreiros.name);
  return db.select().from(terreiros).where(eq(terreiros.isActive, 1)).orderBy(terreiros.name);
}

export async function getTerreiroById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(terreiros).where(eq(terreiros.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getTerreiroByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(terreiros).where(eq(terreiros.username, username)).limit(1);
  return result[0] ?? null;
}

export async function getTerreiroByReferralCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const normalized = code.trim().toUpperCase();
  const result = await db.select().from(terreiros).where(eq(terreiros.referralCode, normalized)).limit(1);
  return result[0] ?? null;
}

// Gera um código curto e único a partir do nome do terreiro (ex.: "Terreiro
// de Oxalá" -> "TERREIRODEOXA", ou "...OXA2" se já existir). Só letras/
// números, sem acento, pra ser fácil de digitar/falar por telefone.
export async function generateUniqueReferralCode(name: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const base = name
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "TERREIRO";
  let candidate = base;
  let suffix = 1;
  while (await getTerreiroByReferralCode(candidate)) {
    suffix += 1;
    candidate = `${base.slice(0, 11)}${suffix}`;
  }
  return candidate;
}

export async function backfillMissingReferralCodes() {
  const db = await getDb();
  if (!db) return;
  const withoutCode = await db.select().from(terreiros).where(isNull(terreiros.referralCode));
  for (const t of withoutCode) {
    const code = await generateUniqueReferralCode(t.name);
    await db.update(terreiros).set({ referralCode: code }).where(eq(terreiros.id, t.id));
  }
}

export async function createTerreiro(data: Omit<InsertTerreiro, "id" | "createdAt" | "updatedAt" | "lastSignedIn">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getTerreiroByUsername(data.username);
  if (existing) throw new Error("Já existe um login com esse nome de usuário");
  const referralCode = await generateUniqueReferralCode(data.name);
  return db.insert(terreiros).values({ ...data, referralCode });
}

export async function updateTerreiro(
  id: number,
  data: Partial<Omit<InsertTerreiro, "id" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.username) {
    const existing = await getTerreiroByUsername(data.username);
    if (existing && existing.id !== id) throw new Error("Já existe um login com esse nome de usuário");
  }
  await db.update(terreiros).set(data).where(eq(terreiros.id, id));
}

export async function setTerreiroActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(terreiros).set({ isActive: isActive ? 1 : 0 }).where(eq(terreiros.id, id));
}

export async function touchTerreiroLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(terreiros).set({ lastSignedIn: new Date() }).where(eq(terreiros.id, id));
}

// ─── Usuários adicionais do terreiro (equipe) ──────────────────────────────────
// Login independente, mas resolve pra sessão do MESMO terreiro (sem
// hierarquia entre eles — todo mundo vê e faz tudo que o terreiro vê/faz).

export async function createTerreiroUser(data: Omit<InsertTerreiroUser, "id" | "createdAt" | "updatedAt" | "lastSignedIn" | "isActive">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getTerreiroUserByUsername(data.username);
  if (existing) throw new Error("Já existe um login com esse nome de usuário");
  const existingTerreiro = await getTerreiroByUsername(data.username);
  if (existingTerreiro) throw new Error("Já existe um login com esse nome de usuário");
  await db.insert(terreiroUsers).values({ ...data, isActive: 1 });
}

export async function listTerreiroUsers(terreiroId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(terreiroUsers).where(eq(terreiroUsers.terreiroId, terreiroId)).orderBy(terreiroUsers.name);
}

export async function getTerreiroUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(terreiroUsers).where(eq(terreiroUsers.username, username)).limit(1);
  return result[0] ?? null;
}

export async function getTerreiroUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(terreiroUsers).where(eq(terreiroUsers.id, id)).limit(1);
  return result[0] ?? null;
}

export async function setTerreiroUserActive(id: number, terreiroId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(terreiroUsers)
    .set({ isActive: isActive ? 1 : 0 })
    .where(and(eq(terreiroUsers.id, id), eq(terreiroUsers.terreiroId, terreiroId)));
}

export async function updateTerreiroUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(terreiroUsers).set({ passwordHash, mustChangePassword: 0 }).where(eq(terreiroUsers.id, id));
}

export async function touchTerreiroUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(terreiroUsers).set({ lastSignedIn: new Date() }).where(eq(terreiroUsers.id, id));
}

// Catálogo exposto no Portal do Parceiro: só produtos ativos com estoque, e
// só os que têm preço cadastrado (preço específico do terreiro OU preço do
// plano dele — produto sem nenhum dos dois fica escondido). O preço
// específico do terreiro tem prioridade sobre o do plano. Nunca inclui custo.
// Preço do terreiro nesse plano pra um produto: sempre calculado a partir do
// preço de venda da loja, nunca guardado — assim fica automaticamente em dia
// quando o preço muda ou um produto novo é cadastrado.
const tierPriceExpr = (discountPercentCol: any) =>
  sql<number>`round(${products.salePrice} * (1 - ${discountPercentCol} / 100))`;

export async function listPartnerVisibleProducts(terreiroId: number, tierId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const tierJoinCondition = tierId ? eq(partnerTiers.id, tierId) : sql`false`;
  return db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      salePrice: sql<number>`coalesce(${terreiroProductPrices.price}, ${tierPriceExpr(partnerTiers.discountPercent)})`,
      currentStock: products.currentStock,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .leftJoin(partnerTiers, tierJoinCondition)
    .leftJoin(
      terreiroProductPrices,
      and(eq(terreiroProductPrices.productId, products.id), eq(terreiroProductPrices.terreiroId, terreiroId))
    )
    .where(
      and(
        eq(products.isActive, 1),
        gte(products.currentStock, 1),
        or(isNotNull(partnerTiers.discountPercent), isNotNull(terreiroProductPrices.price))
      )
    )
    .orderBy(products.name);
}

// Igual a listPartnerVisibleProducts, mas inclui costPrice — usado só pelo
// servidor pra calcular a trava de comissão mínima na tela "Gerar Pedidos"
// (o costPrice nunca é devolvido pro parceiro).
export async function listPartnerOrderableStockProducts(terreiroId: number, tierId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const tierJoinCondition = tierId ? eq(partnerTiers.id, tierId) : sql`false`;
  return db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      salePrice: sql<number>`coalesce(${terreiroProductPrices.price}, ${tierPriceExpr(partnerTiers.discountPercent)})`,
      costPrice: products.costPrice,
      currentStock: products.currentStock,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .leftJoin(partnerTiers, tierJoinCondition)
    .leftJoin(
      terreiroProductPrices,
      and(eq(terreiroProductPrices.productId, products.id), eq(terreiroProductPrices.terreiroId, terreiroId))
    )
    .where(
      and(
        eq(products.isActive, 1),
        gte(products.currentStock, 1),
        or(isNotNull(partnerTiers.discountPercent), isNotNull(terreiroProductPrices.price))
      )
    )
    .orderBy(products.name);
}

// Preços de um terreiro específico: todos os produtos ativos, com o preço do
// plano dele (calculado a partir do desconto do plano) como referência e o
// preço específico (se sobrescrito). Usado na página de gestão individual.
export async function listTerreiroProductPrices(terreiroId: number) {
  const db = await getDb();
  if (!db) return [];
  const terreiro = await getTerreiroById(terreiroId);
  const tierId = terreiro?.tierId ?? null;
  const tierJoinCondition = tierId ? eq(partnerTiers.id, tierId) : sql`false`;
  return db
    .select({
      productId: products.id,
      name: products.name,
      category: products.category,
      currentStock: products.currentStock,
      tierPrice: tierId ? tierPriceExpr(partnerTiers.discountPercent) : sql<number | null>`null`,
      overridePrice: terreiroProductPrices.price,
    })
    .from(products)
    .leftJoin(partnerTiers, tierJoinCondition)
    .leftJoin(
      terreiroProductPrices,
      and(eq(terreiroProductPrices.productId, products.id), eq(terreiroProductPrices.terreiroId, terreiroId))
    )
    .where(eq(products.isActive, 1))
    .orderBy(products.name);
}

export async function setTerreiroProductPrice(terreiroId: number, productId: number, price: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select({ id: terreiroProductPrices.id })
    .from(terreiroProductPrices)
    .where(and(eq(terreiroProductPrices.terreiroId, terreiroId), eq(terreiroProductPrices.productId, productId)))
    .limit(1);
  if (existing[0]) {
    await db.update(terreiroProductPrices).set({ price }).where(eq(terreiroProductPrices.id, existing[0].id));
  } else {
    await db.insert(terreiroProductPrices).values({ terreiroId, productId, price });
  }
}

export async function removeTerreiroProductPrice(terreiroId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(terreiroProductPrices)
    .where(and(eq(terreiroProductPrices.terreiroId, terreiroId), eq(terreiroProductPrices.productId, productId)));
}

// ─── Planos de Parceria (Cobre/Bronze/Prata/Ouro/Diamante) ────────────────────
// Planos fixos — não são criados/excluídos pela UI, só semeados no boot (ver
// seedPartnerTiers). O admin só pode ajustar o percentual de desconto.

export const FIXED_PARTNER_TIERS = [
  { name: "Cobre", sortOrder: 1, discountPercent: 10 },
  { name: "Bronze", sortOrder: 2, discountPercent: 12 },
  { name: "Prata", sortOrder: 3, discountPercent: 15 },
  { name: "Ouro", sortOrder: 4, discountPercent: 18 },
  { name: "Diamante", sortOrder: 5, discountPercent: 22 },
] as const;

// Garante que os 5 planos fixos existam com o sortOrder certo — chamado no
// boot do servidor. NÃO mexe no discountPercent de planos já existentes
// (preserva ajuste manual feito pelo admin); só corrige nome/ordem e cria o
// que estiver faltando.
export async function seedPartnerTiers() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(partnerTiers);
  const byName = new Map(existing.map((t) => [t.name, t]));
  for (const fixedTier of FIXED_PARTNER_TIERS) {
    const current = byName.get(fixedTier.name);
    if (!current) {
      await db.insert(partnerTiers).values(fixedTier);
    } else if (current.sortOrder !== fixedTier.sortOrder) {
      await db.update(partnerTiers).set({ sortOrder: fixedTier.sortOrder }).where(eq(partnerTiers.id, current.id));
    }
  }
}

export async function listPartnerTiers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(partnerTiers).orderBy(partnerTiers.sortOrder);
}

export async function getPartnerTierById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(partnerTiers).where(eq(partnerTiers.id, id)).limit(1);
  return result[0] ?? null;
}

// Só o percentual de desconto é editável — nome/ordem dos planos são fixos.
export async function updatePartnerTierDiscount(id: number, discountPercent: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnerTiers).set({ discountPercent }).where(eq(partnerTiers.id, id));
}

// ─── Formas de pagamento nativas ────────────────────────────────────────────

export const NATIVE_PAYMENT_METHODS = [
  { key: "dinheiro", label: "Dinheiro", sortOrder: 1 },
  { key: "pix", label: "PIX", sortOrder: 2 },
  { key: "debito", label: "Cartão de Débito", sortOrder: 3 },
  { key: "credito", label: "Cartão de Crédito", sortOrder: 4 },
  { key: "cheque", label: "Cheque", sortOrder: 5 },
] as const;

// Garante que as 5 formas nativas existam — chamado no boot. Não mexe em
// label/enabled já ajustados pelo admin, só cria o que faltar e corrige a
// ordem.
export async function seedPaymentMethods() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(paymentMethods);
  const byKey = new Map(existing.map((m) => [m.key, m]));
  for (const method of NATIVE_PAYMENT_METHODS) {
    const current = byKey.get(method.key);
    if (!current) {
      await db.insert(paymentMethods).values(method);
    } else if (current.sortOrder !== method.sortOrder) {
      await db.update(paymentMethods).set({ sortOrder: method.sortOrder }).where(eq(paymentMethods.id, current.id));
    }
  }
}

export async function listPaymentMethods() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentMethods).orderBy(paymentMethods.sortOrder);
}

export async function updatePaymentMethod(id: number, data: { label?: string; enabled?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set: { label?: string; enabled?: number } = {};
  if (data.label !== undefined) set.label = data.label;
  if (data.enabled !== undefined) set.enabled = data.enabled ? 1 : 0;
  await db.update(paymentMethods).set(set).where(eq(paymentMethods.id, id));
}

// ─── Comodato (itens deixados nos terreiros) ──────────────────────────────────

// Resolve o preço que vale pra um terreiro num produto: preço específico dele
// > preço do plano dele > preço de venda da loja (fallback pro comodato, já
// que a entrega é decidida pelo admin na hora).
export async function resolvePartnerPrice(terreiroId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const override = await db
    .select({ price: terreiroProductPrices.price })
    .from(terreiroProductPrices)
    .where(and(eq(terreiroProductPrices.terreiroId, terreiroId), eq(terreiroProductPrices.productId, productId)))
    .limit(1);
  if (override[0]) return override[0].price;

  const product = await getProductById(productId);
  if (!product) throw new Error("Produto não encontrado");

  const terreiro = await getTerreiroById(terreiroId);
  if (terreiro?.tierId) {
    const tier = await getPartnerTierById(terreiro.tierId);
    if (tier) return Math.round(product.salePrice * (1 - tier.discountPercent / 100));
  }

  return product.salePrice;
}

export async function listConsignments(terreiroId: number, includeSettled = false) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: consignments.id,
      productId: consignments.productId,
      productName: products.name,
      imageUrl: products.imageUrl,
      quantity: consignments.quantity,
      quantitySold: consignments.quantitySold,
      quantityReturned: consignments.quantityReturned,
      unitPrice: consignments.unitPrice,
      notes: consignments.notes,
      leftAt: consignments.leftAt,
    })
    .from(consignments)
    .innerJoin(products, eq(consignments.productId, products.id))
    .where(eq(consignments.terreiroId, terreiroId))
    .orderBy(desc(consignments.leftAt));
  if (includeSettled) return rows;
  return rows.filter((row) => row.quantitySold + row.quantityReturned < row.quantity);
}

// Quantos itens de cada terreiro ainda estão "na rua" (deixados e não
// acertados) — pra coluna de resumo na lista de terreiros.
export async function countOpenConsignmentsByTerreiro() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      terreiroId: consignments.terreiroId,
      openItems: sql<number>`sum(${consignments.quantity} - ${consignments.quantitySold} - ${consignments.quantityReturned})`,
    })
    .from(consignments)
    .groupBy(consignments.terreiroId);
}

export async function createConsignment(data: {
  terreiroId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const product = await getProductById(data.productId);
  if (!product) throw new Error("Produto não encontrado");
  if (product.currentStock < data.quantity) {
    throw new Error(`Estoque insuficiente. Disponível: ${product.currentStock}`);
  }

  await db.insert(consignments).values({
    terreiroId: data.terreiroId,
    productId: data.productId,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    notes: data.notes ?? null,
  });
  // O item saiu fisicamente da loja — baixa o estoque já na entrega.
  await db
    .update(products)
    .set({ currentStock: sql`${products.currentStock} - ${data.quantity}` })
    .where(eq(products.id, data.productId));
}

export async function getConsignmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(consignments).where(eq(consignments.id, id)).limit(1);
  return result[0] ?? null;
}

// Acerto de venda: registra a venda (canal "terreiro") SEM baixar estoque de
// novo — a baixa já aconteceu quando o item foi deixado no terreiro.
export async function markConsignmentSold(id: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const consignment = await getConsignmentById(id);
  if (!consignment) throw new Error("Registro de comodato não encontrado");

  const remaining = consignment.quantity - consignment.quantitySold - consignment.quantityReturned;
  if (quantity > remaining) {
    throw new Error(`Só restam ${remaining} item(ns) pendentes nesse comodato`);
  }

  const product = await getProductById(consignment.productId);
  const costPrice = product?.costPrice ?? 0;

  await db.insert(sales).values({
    productId: consignment.productId,
    quantity,
    unitPrice: consignment.unitPrice,
    totalPrice: consignment.unitPrice * quantity,
    profit: (consignment.unitPrice - costPrice) * quantity,
    channel: "terreiro",
    terreiroId: consignment.terreiroId,
    saleDate: new Date(),
  });
  await db
    .update(consignments)
    .set({ quantitySold: consignment.quantitySold + quantity })
    .where(eq(consignments.id, id));
}

// Devolução: o item volta fisicamente pra loja — estoque sobe de volta.
export async function markConsignmentReturned(id: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const consignment = await getConsignmentById(id);
  if (!consignment) throw new Error("Registro de comodato não encontrado");

  const remaining = consignment.quantity - consignment.quantitySold - consignment.quantityReturned;
  if (quantity > remaining) {
    throw new Error(`Só restam ${remaining} item(ns) pendentes nesse comodato`);
  }

  await db
    .update(consignments)
    .set({ quantityReturned: consignment.quantityReturned + quantity })
    .where(eq(consignments.id, id));
  await db
    .update(products)
    .set({ currentStock: sql`${products.currentStock} + ${quantity}` })
    .where(eq(products.id, consignment.productId));
}

// ─── Solicitações de Comodato (terreiro pede, admin confirma na entrega) ──────

export async function createConsignmentRequest(
  terreiroId: number,
  items: { productId: number; name: string; quantity: number }[],
  notes?: string | null,
  termsAcceptedAt?: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const requestResult = await db.insert(consignmentRequests).values({
    terreiroId,
    notes: notes ?? null,
    status: "pendente",
    termsAcceptedAt: termsAcceptedAt ?? new Date(),
  });
  const requestId = ((requestResult as any)[0]?.insertId ?? (requestResult as any).insertId) as number;
  await db.insert(consignmentRequestItems).values(
    items.map((item) => ({
      consignmentRequestId: requestId,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
    }))
  );
  return { id: requestId };
}

export async function listConsignmentRequestsForTerreiro(terreiroId: number) {
  const db = await getDb();
  if (!db) return [];
  const requests = await db
    .select()
    .from(consignmentRequests)
    .where(eq(consignmentRequests.terreiroId, terreiroId))
    .orderBy(desc(consignmentRequests.createdAt));
  const items = await db.select().from(consignmentRequestItems);
  return requests.map((r) => ({ ...r, items: items.filter((i) => i.consignmentRequestId === r.id) }));
}

// Visão do admin: só as pendentes (é o que precisa de ação) — usado no card
// da página de um terreiro específico e pra mostrar a contagem na listagem.
export async function listPendingConsignmentRequestsForTerreiro(terreiroId: number) {
  const db = await getDb();
  if (!db) return [];
  const requests = await db
    .select()
    .from(consignmentRequests)
    .where(and(eq(consignmentRequests.terreiroId, terreiroId), eq(consignmentRequests.status, "pendente")))
    .orderBy(desc(consignmentRequests.createdAt));
  const items = await db.select().from(consignmentRequestItems);
  return requests.map((r) => ({ ...r, items: items.filter((i) => i.consignmentRequestId === r.id) }));
}

export async function countPendingConsignmentRequestsByTerreiro() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ terreiroId: consignmentRequests.terreiroId, openRequests: sql<number>`COUNT(*)` })
    .from(consignmentRequests)
    .where(eq(consignmentRequests.status, "pendente"))
    .groupBy(consignmentRequests.terreiroId);
}

export async function cancelConsignmentRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(consignmentRequests).set({ status: "cancelado" }).where(eq(consignmentRequests.id, id));
}

// Confirma a entrega: cria o comodato de verdade pra cada item (com o preço
// combinado que o admin define aqui), baixando o estoque na hora — só agora,
// nunca na hora do pedido. Se algum item não tiver estoque suficiente, para
// tudo antes de mexer em qualquer coisa (evita ficar pela metade).
export async function fulfillConsignmentRequest(
  requestId: number,
  itemPrices: { itemId: number; unitPrice: number }[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const requestRows = await db.select().from(consignmentRequests).where(eq(consignmentRequests.id, requestId)).limit(1);
  const request = requestRows[0];
  if (!request) throw new Error("Solicitação de comodato não encontrada");
  if (request.status !== "pendente") throw new Error("Essa solicitação já foi processada");

  const items = await db.select().from(consignmentRequestItems).where(eq(consignmentRequestItems.consignmentRequestId, requestId));
  const priceByItemId = new Map(itemPrices.map((p) => [p.itemId, p.unitPrice]));

  for (const item of items) {
    const unitPrice = priceByItemId.get(item.id);
    if (!unitPrice || unitPrice < 1) throw new Error(`Informe o preço combinado de "${item.name}"`);
    const product = await getProductById(item.productId);
    if (!product) throw new Error(`Produto "${item.name}" não encontrado`);
    if (product.currentStock < item.quantity) {
      throw new Error(`Estoque insuficiente de "${item.name}". Disponível: ${product.currentStock}`);
    }
  }

  for (const item of items) {
    const unitPrice = priceByItemId.get(item.id)!;
    await createConsignment({
      terreiroId: request.terreiroId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      notes: request.notes,
    });
  }

  await db.update(consignmentRequests).set({ status: "entregue" }).where(eq(consignmentRequests.id, requestId));
  return { terreiroId: request.terreiroId };
}

// ─── Pedidos de Parceiros (tela "Gerar Pedidos" do Portal) ────────────────────

// Itens disponíveis do catálogo do fornecedor pro parceiro montar o pedido —
// só as colunas necessárias pro preço, NUNCA supplierId/sourceUrl/sourceSlug
// (o parceiro não pode saber quem é nem onde fica o fornecedor).
// Só o Fornecedor 1 (Atacado de Umbanda) aparece pro cliente/parceiro pedir
// — os itens da Cristais de Curvelo (Fornecedor 2) são pacotes de atacado
// (ex. "1000 unidades", "20kg") pensados pra Rafael revisar e cadastrar no
// próprio estoque aos poucos, não pra ir direto pro cliente final pedir.
export async function listAvailableSupplierCatalogForOrders() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: supplierCatalog.id,
      name: supplierCatalog.name,
      category: supplierCatalog.category,
      imageUrl: supplierCatalog.imageUrl,
      price: supplierCatalog.price, // custo — usado só pro cálculo server-side, nunca devolvido pro parceiro
      suggestedSalePrice: supplierCatalog.suggestedSalePrice,
    })
    .from(supplierCatalog)
    .where(and(eq(supplierCatalog.stockStatus, "disponivel"), eq(supplierCatalog.sourceKey, "atacado_umbanda")))
    .orderBy(supplierCatalog.name);
}

export async function createPartnerOrder(
  terreiroId: number,
  items: {
    source: "catalogo" | "estoque";
    supplierCatalogId?: number;
    productId?: number;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[],
  shippingCents: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const orderResult = await db.insert(partnerOrders).values({ terreiroId, subtotal, status: "pendente", shippingCents });
  const orderId = ((orderResult as any)[0]?.insertId ?? (orderResult as any).insertId) as number;
  await db.insert(partnerOrderItems).values(
    items.map((item) => ({
      partnerOrderId: orderId,
      source: item.source,
      supplierCatalogId: item.supplierCatalogId ?? null,
      productId: item.productId ?? null,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }))
  );
  return { id: orderId, subtotal };
}

export async function listPartnerOrdersForTerreiro(terreiroId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select()
    .from(partnerOrders)
    .where(eq(partnerOrders.terreiroId, terreiroId))
    .orderBy(desc(partnerOrders.createdAt));
  const items = await db.select().from(partnerOrderItems);
  return orders.map((order) => ({
    ...order,
    items: items.filter((i) => i.partnerOrderId === order.id),
  }));
}

// Visão do admin: todos os pedidos de todos os parceiros, mais recentes primeiro.
export async function listAllPartnerOrders() {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select({
      id: partnerOrders.id,
      terreiroId: partnerOrders.terreiroId,
      terreiroName: terreiros.name,
      subtotal: partnerOrders.subtotal,
      status: partnerOrders.status,
      notes: partnerOrders.notes,
      shippingCents: partnerOrders.shippingCents,
      trackingCode: partnerOrders.trackingCode,
      carrier: partnerOrders.carrier,
      shippingZipCode: terreiros.shippingZipCode,
      shippingStreet: terreiros.shippingStreet,
      shippingNumber: terreiros.shippingNumber,
      shippingComplement: terreiros.shippingComplement,
      shippingNeighborhood: terreiros.shippingNeighborhood,
      shippingCity: terreiros.shippingCity,
      shippingState: terreiros.shippingState,
      createdAt: partnerOrders.createdAt,
      updatedAt: partnerOrders.updatedAt,
    })
    .from(partnerOrders)
    .leftJoin(terreiros, eq(terreiros.id, partnerOrders.terreiroId))
    .orderBy(desc(partnerOrders.createdAt));
  const items = await db.select().from(partnerOrderItems);
  const catalogStock = await db.select({ id: supplierCatalog.id, stockStatus: supplierCatalog.stockStatus }).from(supplierCatalog);
  const stockById = new Map(catalogStock.map((c) => [c.id, c.stockStatus]));
  return orders.map((order) => ({
    ...order,
    items: items
      .filter((i) => i.partnerOrderId === order.id)
      .map((i) => ({ ...i, currentStockStatus: i.supplierCatalogId ? stockById.get(i.supplierCatalogId) ?? null : null })),
  }));
}

export async function updatePartnerOrderStatus(id: number, status: "pendente" | "confirmado" | "entregue" | "cancelado") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnerOrders).set({ status }).where(eq(partnerOrders.id, id));
}

// Avanço automático de plano — "regra dos planos" (2026-07-21): reavalia
// com base nos pedidos feitos pelo terreiro (tabela partnerOrders, os
// pedidos de verdade feitos em "Gerar Pedidos") nos últimos 3 meses.
// Sempre pega o plano mais alto que ele já mereceu nesse período — nunca
// rebaixa sozinho aqui (rebaixar exigiria um job periódico que não existe
// nesse servidor; o admin pode ajustar manualmente se quiser).
export async function recalculatePartnerTierByOrders(terreiroId: number) {
  const db = await getDb();
  if (!db) return null;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const orders = await db
    .select({ subtotal: partnerOrders.subtotal, createdAt: partnerOrders.createdAt })
    .from(partnerOrders)
    .where(
      and(
        eq(partnerOrders.terreiroId, terreiroId),
        gte(partnerOrders.createdAt, threeMonthsAgo),
        sql`${partnerOrders.status} != 'cancelado'`
      )
    );

  const ordersCount = orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + o.subtotal, 0);
  const monthsWithOrder = new Set(orders.map((o) => `${o.createdAt.getFullYear()}-${o.createdAt.getMonth()}`)).size;

  let qualifyingTierName: string;
  if (totalSpent > 50000) qualifyingTierName = "Diamante"; // > R$500
  else if (totalSpent > 30000) qualifyingTierName = "Ouro"; // > R$300
  else if (monthsWithOrder >= 3) qualifyingTierName = "Prata"; // pediu todo mês nos últimos 3
  else if (ordersCount >= 1) qualifyingTierName = "Bronze"; // já fez o primeiro pedido
  else qualifyingTierName = "Cobre";

  const allTiers = await listPartnerTiers();
  const qualifyingTier = allTiers.find((t) => t.name === qualifyingTierName);
  if (!qualifyingTier) return null;

  const terreiro = await getTerreiroById(terreiroId);
  if (!terreiro) return null;

  const currentTier = allTiers.find((t) => t.id === terreiro.tierId);
  // Só sobe (ou define, se não tinha plano) — nunca desce sozinho aqui.
  if (currentTier && currentTier.sortOrder >= qualifyingTier.sortOrder) {
    return { upgraded: false, tierName: currentTier.name };
  }

  await db.update(terreiros).set({ tierId: qualifyingTier.id }).where(eq(terreiros.id, terreiroId));
  return { upgraded: true, tierName: qualifyingTier.name };
}

// Ter um "stand" da Toca no terreiro (comodato) garante pelo menos o plano
// Bronze — chamado toda vez que um comodato novo é criado. Só sobe (nunca
// desce) e não faz nada se o terreiro já está no Bronze ou acima.
export async function ensureMinimumBronzeForConsignment(terreiroId: number) {
  const db = await getDb();
  if (!db) return null;

  const allTiers = await listPartnerTiers();
  const bronzeTier = allTiers.find((t) => t.name === "Bronze");
  if (!bronzeTier) return null;

  const terreiro = await getTerreiroById(terreiroId);
  if (!terreiro) return null;

  const currentTier = allTiers.find((t) => t.id === terreiro.tierId);
  if (currentTier && currentTier.sortOrder >= bronzeTier.sortOrder) {
    return { upgraded: false, tierName: currentTier.name };
  }

  await db.update(terreiros).set({ tierId: bronzeTier.id }).where(eq(terreiros.id, terreiroId));
  return { upgraded: true, tierName: bronzeTier.name };
}

// ─── Solicitações de Parceria (página "Parceria com a Toca") ──────────────────

export async function createPartnerApplication(data: Omit<InsertPartnerApplication, "id" | "createdAt" | "updatedAt" | "status">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(partnerApplications).values({ ...data, status: "pendente" });
}

export async function listPartnerApplications() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(partnerApplications).orderBy(desc(partnerApplications.createdAt));
}

export async function updatePartnerApplicationStatus(id: number, status: "pendente" | "aprovado" | "recusado") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnerApplications).set({ status }).where(eq(partnerApplications.id, id));
}

export async function deletePartnerApplication(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(partnerApplications).where(eq(partnerApplications.id, id));
}

// Leads iniciais de prospecção — terreiros/centros de Umbanda e Candomblé
// REAIS de Ribeirão Preto, achados por pesquisa (nunca inventados). Ferramenta
// de descoberta automática de verdade (tipo Google Places) exigiria uma
// chave de API paga configurada pelo Rafael; enquanto isso não existe, essa
// função é o "algoritmo" — roda uma vez, adiciona quem ainda não está
// cadastrado (dedup por nome, nunca duplica nem sobrescreve o que já foi
// editado/movido de status).
export async function seedProspectionLeads() {
  const db = await getDb();
  if (!db) return;
  const leads: { terreiroName: string; address: string; city: string; instagram?: string; phone?: string; notes: string }[] = [
    {
      terreiroName: "Terreiro de Umbanda Caboclo Samambaia e Ogum de Ronda",
      address: "Rua Piauí, 2061 — Ipiranga",
      city: "Ribeirão Preto",
      notes: "Achado por pesquisa (Solutudo).",
    },
    {
      terreiroName: "CEIA Umbanda (Centro de Estudos e Irradiações do Aumbandan)",
      address: "Rua Marechal Deodoro, 2586 — Alto da Boa Vista",
      city: "Ribeirão Preto",
      instagram: "@ceia_umbanda",
      notes: "Achado por pesquisa (Instagram).",
    },
    {
      terreiroName: "Templo de Umbanda Pai João da Caridade",
      address: "Rua Bernardo Guimarães, 512 — Jardim Piratininga",
      city: "Ribeirão Preto",
      notes: "Achado por pesquisa (registro de empresa, CNPJ 09.541.655/0001-41).",
    },
    {
      terreiroName: "Tenda de Umbanda Mané Baiano",
      address: "Rua Aurélio Mosca, 151 — Jardim Heitor Rigon",
      city: "Ribeirão Preto",
      notes: "Achado por pesquisa (igrejas.net.br).",
    },
    {
      terreiroName: "Templo de Umbanda Ilê Axé Oba Menan",
      address: "Rua Martin Afonso de Souza, 1187 — Alto do Ipiranga",
      city: "Ribeirão Preto",
      notes: "Casa de candomblé. Achado por pesquisa (registro de empresa, CNPJ 54.923.073/0001-84).",
    },
    {
      terreiroName: "Ilê Asé d'Oya",
      address: "Rua Jorge de Lima, 1764 — Jardim Maria Gorete",
      city: "Ribeirão Preto",
      phone: "16988138913",
      notes: "Casa de candomblé. Achado por pesquisa.",
    },
    {
      terreiroName: "Tenda Espírita de Umbanda Pai Joaquim de Guiné",
      address: "Rua João Ramalho, 300 — Campos Elíseos",
      city: "Ribeirão Preto",
      notes: "Achado por pesquisa (registro de empresa, CNPJ 51.820.637/0001-65, fundada em 1983).",
    },
  ];
  for (const lead of leads) {
    const existing = await db.select().from(partnerApplications).where(eq(partnerApplications.terreiroName, lead.terreiroName)).limit(1);
    if (existing.length === 0) {
      await db.insert(partnerApplications).values({
        terreiroName: lead.terreiroName,
        contactName: "A definir",
        phone: lead.phone ?? "A confirmar",
        city: lead.city,
        instagram: lead.instagram ?? null,
        address: lead.address,
        notes: lead.notes,
        status: "pendente",
        source: "prospeccao",
      });
    }
  }
}

// ─── Catálogo Público (loja online, sem login) ─────────────────────────────────

// Produtos do estoque a preço cheio (sem desconto de plano) — inclui
// costPrice só pra trava de comissão mínima no cálculo do pedido, nunca
// devolvido pro visitante.
export async function listActiveProductsFullPrice() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      imageUrl: products.imageUrl,
      salePrice: products.salePrice,
      costPrice: products.costPrice,
      currentStock: products.currentStock,
    })
    .from(products)
    .where(and(eq(products.isActive, 1), gte(products.currentStock, 1)))
    .orderBy(products.name);
}

export async function createPublicOrder(data: {
  customerName: string;
  customerPhone: string;
  items: {
    source: "catalogo" | "estoque";
    supplierCatalogId?: number;
    productId?: number;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  paymentMethod?: string | null;
  shippingMethod: "retirada" | "envio";
  shippingCents: number;
  shippingAddress?: {
    zipCode: string;
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
  couponCode?: string | null;
  referredByTerreiroId?: number | null;
  discountCents?: number;
  customerId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const subtotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const addr = data.shippingMethod === "envio" ? data.shippingAddress : null;
  const orderResult = await db.insert(publicOrders).values({
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerId: data.customerId ?? null,
    subtotal,
    status: "pendente",
    paymentMethod: data.paymentMethod ?? null,
    shippingMethod: data.shippingMethod,
    shippingZipCode: addr?.zipCode ?? null,
    shippingStreet: addr?.street ?? null,
    shippingNumber: addr?.number ?? null,
    shippingComplement: addr?.complement ?? null,
    shippingNeighborhood: addr?.neighborhood ?? null,
    shippingCity: addr?.city ?? null,
    shippingState: addr?.state ?? null,
    shippingCents: data.shippingCents,
    couponCode: data.couponCode ?? null,
    referredByTerreiroId: data.referredByTerreiroId ?? null,
    discountCents: data.discountCents ?? 0,
  });
  const orderId = ((orderResult as any)[0]?.insertId ?? (orderResult as any).insertId) as number;
  await db.insert(publicOrderItems).values(
    data.items.map((item) => ({
      publicOrderId: orderId,
      source: item.source,
      supplierCatalogId: item.supplierCatalogId ?? null,
      productId: item.productId ?? null,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }))
  );
  return { id: orderId, subtotal, shippingCents: data.shippingCents };
}

// ─── Contas de cliente (área do usuário na loja pública) ──────────────────────

export async function getCustomerByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(customers).where(eq(customers.email, email.trim().toLowerCase())).limit(1);
  return result[0] ?? null;
}

export async function getCustomerByGoogleId(googleId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(customers).where(eq(customers.googleId, googleId)).limit(1);
  return result[0] ?? null;
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createCustomer(data: Omit<InsertCustomer, "id" | "createdAt" | "updatedAt" | "lastSignedIn" | "isActive" | "email"> & { email: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const email = data.email.trim().toLowerCase();
  const existing = await getCustomerByEmail(email);
  if (existing) throw new Error("Já existe uma conta com esse e-mail");
  const result = await db.insert(customers).values({ ...data, email });
  const id = ((result as any)[0]?.insertId ?? (result as any).insertId) as number;
  return getCustomerById(id);
}

export async function updateCustomer(
  id: number,
  data: Partial<Omit<InsertCustomer, "id" | "createdAt" | "updatedAt" | "email">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function touchCustomerLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set({ lastSignedIn: new Date() }).where(eq(customers.id, id));
}

export async function listCustomerOrders(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db.select().from(publicOrders).where(eq(publicOrders.customerId, customerId)).orderBy(desc(publicOrders.createdAt));
  const items = await db.select().from(publicOrderItems);
  return orders.map((order) => ({
    ...order,
    items: items.filter((i) => i.publicOrderId === order.id),
  }));
}

// Lista pro admin ver quem se cadastrou na loja (tela "Clientes") — nunca
// devolve passwordHash/googleId, só o necessário pra identificar e contatar.
export async function listCustomers() {
  const db = await getDb();
  if (!db) return [];
  const all = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      shippingCity: customers.shippingCity,
      shippingState: customers.shippingState,
      hasPassword: sql<number>`(${customers.passwordHash} IS NOT NULL)`,
      hasGoogle: sql<number>`(${customers.googleId} IS NOT NULL)`,
      isActive: customers.isActive,
      createdAt: customers.createdAt,
      lastSignedIn: customers.lastSignedIn,
    })
    .from(customers)
    .orderBy(desc(customers.createdAt));
  const orders = await db.select({ id: publicOrders.id, customerId: publicOrders.customerId, subtotal: publicOrders.subtotal }).from(publicOrders);
  return all.map((c) => {
    const customerOrders = orders.filter((o) => o.customerId === c.id);
    return {
      ...c,
      hasPassword: !!c.hasPassword,
      hasGoogle: !!c.hasGoogle,
      orderCount: customerOrders.length,
      totalSpent: customerOrders.reduce((sum, o) => sum + o.subtotal, 0),
    };
  });
}

export async function updatePublicOrderTracking(id: number, trackingCode: string | null, carrier: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(publicOrders).set({ trackingCode, carrier }).where(eq(publicOrders.id, id));
}

export async function updatePartnerOrderTracking(id: number, trackingCode: string | null, carrier: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnerOrders).set({ trackingCode, carrier }).where(eq(partnerOrders.id, id));
}

export async function listAllPublicOrders() {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select({
      id: publicOrders.id,
      customerName: publicOrders.customerName,
      customerPhone: publicOrders.customerPhone,
      subtotal: publicOrders.subtotal,
      status: publicOrders.status,
      paymentMethod: publicOrders.paymentMethod,
      notes: publicOrders.notes,
      shippingMethod: publicOrders.shippingMethod,
      shippingZipCode: publicOrders.shippingZipCode,
      shippingStreet: publicOrders.shippingStreet,
      shippingNumber: publicOrders.shippingNumber,
      shippingComplement: publicOrders.shippingComplement,
      shippingNeighborhood: publicOrders.shippingNeighborhood,
      shippingCity: publicOrders.shippingCity,
      shippingState: publicOrders.shippingState,
      shippingCents: publicOrders.shippingCents,
      trackingCode: publicOrders.trackingCode,
      carrier: publicOrders.carrier,
      couponCode: publicOrders.couponCode,
      referredByTerreiroId: publicOrders.referredByTerreiroId,
      referredByTerreiroName: terreiros.name,
      discountCents: publicOrders.discountCents,
      customerId: publicOrders.customerId,
      customerEmail: customers.email,
      createdAt: publicOrders.createdAt,
      updatedAt: publicOrders.updatedAt,
    })
    .from(publicOrders)
    .leftJoin(terreiros, eq(terreiros.id, publicOrders.referredByTerreiroId))
    .leftJoin(customers, eq(customers.id, publicOrders.customerId))
    .orderBy(desc(publicOrders.createdAt));
  const items = await db.select().from(publicOrderItems);
  const catalogStock = await db.select({ id: supplierCatalog.id, stockStatus: supplierCatalog.stockStatus }).from(supplierCatalog);
  const stockById = new Map(catalogStock.map((c) => [c.id, c.stockStatus]));
  return orders.map((order) => ({
    ...order,
    items: items
      .filter((i) => i.publicOrderId === order.id)
      .map((i) => ({ ...i, currentStockStatus: i.supplierCatalogId ? stockById.get(i.supplierCatalogId) ?? null : null })),
  }));
}

export async function updatePublicOrderStatus(id: number, status: "pendente" | "confirmado" | "entregue" | "cancelado") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(publicOrders).set({ status }).where(eq(publicOrders.id, id));
}

// Chamado depois que uma cobrança InfinitePay é confirmada como paga (pelo
// webhook ou pelo polling do cliente) — se essa cobrança é de um pedido
// Pronta Entrega, dá baixa no estoque e registra a venda de verdade (pra
// entrar no Dashboard/Controle de Vendas), e marca o pedido como confirmado.
// Idempotente: só age se o pedido ainda estiver "pendente".
export async function fulfillPublicOrderForCharge(orderNsu: string) {
  const db = await getDb();
  if (!db) return;
  const charge = await getInfinitePayChargeByOrderNsu(orderNsu);
  if (!charge?.publicOrderId) return;

  const orderRows = await db.select().from(publicOrders).where(eq(publicOrders.id, charge.publicOrderId)).limit(1);
  const order = orderRows[0];
  if (!order || order.status !== "pendente") return;

  const items = await db.select().from(publicOrderItems).where(eq(publicOrderItems.publicOrderId, order.id));
  for (const item of items) {
    if (item.source !== "estoque" || !item.productId) continue;
    const product = await getProductById(item.productId);
    const costPrice = product?.costPrice ?? 0;
    await db.insert(sales).values({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      profit: (item.unitPrice - costPrice) * item.quantity,
      channel: "site",
      saleDate: new Date(),
    });
    // GREATEST(...,0): dois clientes podem pagar a última unidade quase ao
    // mesmo tempo (o estoque só é reservado na confirmação do pagamento, não
    // na hora de gerar a cobrança) — trava em 0 pra nunca ficar negativo.
    await db
      .update(products)
      .set({ currentStock: sql`GREATEST(${products.currentStock} - ${item.quantity}, 0)` })
      .where(eq(products.id, item.productId));
  }

  await db.update(publicOrders).set({ status: "confirmado" }).where(eq(publicOrders.id, order.id));
  notifyProntaEntregaPaid(order.customerName, order.subtotal);
}

// ─── Cobranças InfinitePay ─────────────────────────────────────────────────────

export async function createInfinitePayCharge(data: Omit<InsertInfinitePayCharge, "id" | "createdAt" | "updatedAt" | "status">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(infinitePayCharges).values({ ...data, status: "pending" });
}

export async function getInfinitePayChargeByOrderNsu(orderNsu: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(infinitePayCharges).where(eq(infinitePayCharges.orderNsu, orderNsu)).limit(1);
  return result[0] ?? null;
}

export async function markInfinitePayChargePaid(
  orderNsu: string,
  data: { transactionNsu?: string; invoiceSlug?: string; paidAmountCents?: number; captureMethod?: string; receiptUrl?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(infinitePayCharges).set({ status: "paid", ...data }).where(eq(infinitePayCharges.orderNsu, orderNsu));
}
