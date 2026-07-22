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
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
  } catch (error: any) {
    console.error("[migrations] consignmentRequests:", error);
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

export async function listSales(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sales).orderBy(sql`${sales.saleDate} DESC`).limit(limit);
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
  notes?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const requestResult = await db.insert(consignmentRequests).values({ terreiroId, notes: notes ?? null, status: "pendente" });
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
    .where(eq(supplierCatalog.stockStatus, "disponivel"))
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const subtotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const addr = data.shippingMethod === "envio" ? data.shippingAddress : null;
  const orderResult = await db.insert(publicOrders).values({
    customerName: data.customerName,
    customerPhone: data.customerPhone,
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
      createdAt: publicOrders.createdAt,
      updatedAt: publicOrders.updatedAt,
    })
    .from(publicOrders)
    .leftJoin(terreiros, eq(terreiros.id, publicOrders.referredByTerreiroId))
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
