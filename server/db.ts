import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, InsertProduct, InsertSale, InsertPurchase, InsertSupplier, InsertProductSupplier,
  products, sales, users, purchases, suppliers, productSuppliers,
  roles, permissions, rolePermissions, userRoles, auditLog, systemConfig,
  supplierCatalog, InsertSupplierCatalogItem,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
  data: Partial<{ price: number; suggestedSalePrice: number; stockStatus: "disponivel" | "indisponivel" | "desconhecido"; lastCheckedAt: Date }>
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
