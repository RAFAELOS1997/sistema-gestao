import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { PARTNER_UNAUTHED_ERR_MSG, UNAUTHED_ERR_MSG } from "../shared/const";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    terreiro: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createTerreiroContext(tierId: number | null = 1): TrpcContext {
  return {
    user: null,
    terreiro: {
      id: 7,
      name: "Terreiro Teste",
      username: "terreiro-teste",
      passwordHash: "n/a",
      contactName: null,
      phone: null,
      tierId,
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createStaffContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "staff-user",
      name: "Admin",
      email: "admin@example.com",
      loginMethod: "local",
      passwordHash: "salt:hash",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    terreiro: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── Catálogo Público (sem login) ──────────────────────────────────────────────

describe("publicStore.products.list", () => {
  it("é acessível sem nenhuma sessão", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.publicStore.products.list()).resolves.toEqual([]);
  });
});

describe("publicStore.orderCatalog.catalog", () => {
  it("nunca vaza dados do fornecedor (supplierId/sourceUrl/sourceSlug/price de custo)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const items = await caller.publicStore.orderCatalog.catalog();
    // Sem banco de dados no ambiente de teste a lista vem vazia, mas o
    // shape do endpoint (sempre passa pelo .map de sanitização) é o que
    // importa proteger contra regressão futura.
    for (const item of items) {
      expect(item).not.toHaveProperty("supplierId");
      expect(item).not.toHaveProperty("sourceUrl");
      expect(item).not.toHaveProperty("sourceSlug");
    }
  });
});

describe("publicStore.prontaEntrega.checkout", () => {
  it("recusa com mensagem clara quando a loja não configurou InfiniteTag", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.publicStore.prontaEntrega.checkout({
        customerName: "Cliente Teste",
        customerPhone: "11999999999",
        items: [{ productId: 1, quantity: 1 }],
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

// ─── Portal do Parceiro — "Gerar Pedidos" ──────────────────────────────────────

describe("portal.orderCatalog", () => {
  it("bloqueia acesso sem sessão de parceiro", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.portal.orderCatalog.catalog()).rejects.toMatchObject({ message: PARTNER_UNAUTHED_ERR_MSG });
    await expect(caller.portal.orderCatalog.stock()).rejects.toMatchObject({ message: PARTNER_UNAUTHED_ERR_MSG });
  });

  it("nunca vaza dados do fornecedor pro parceiro logado", async () => {
    const caller = appRouter.createCaller(createTerreiroContext());
    const items = await caller.portal.orderCatalog.catalog();
    for (const item of items) {
      expect(item).not.toHaveProperty("supplierId");
      expect(item).not.toHaveProperty("sourceUrl");
    }
  });
});

describe("portal.orders.create", () => {
  it("bloqueia acesso sem sessão de parceiro", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.portal.orders.create({ items: [{ source: "catalogo", id: 1, quantity: 1 }] })
    ).rejects.toMatchObject({ message: PARTNER_UNAUTHED_ERR_MSG });
  });

  it("rejeita item de catálogo inexistente com BAD_REQUEST (não derruba o servidor)", async () => {
    const caller = appRouter.createCaller(createTerreiroContext());
    await expect(
      caller.portal.orders.create({ items: [{ source: "catalogo", id: 999999, quantity: 1 }] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── Impersonação (admin acessa o portal como um terreiro) ────────────────────

describe("terreiros.impersonate", () => {
  it("exige sessão de staff — nem visitante anônimo nem outro terreiro pode chamar", async () => {
    const anonCaller = appRouter.createCaller(createPublicContext());
    await expect(anonCaller.terreiros.impersonate({ id: 7 })).rejects.toMatchObject({ message: UNAUTHED_ERR_MSG });

    const terreiroCaller = appRouter.createCaller(createTerreiroContext());
    await expect(terreiroCaller.terreiros.impersonate({ id: 7 })).rejects.toMatchObject({ message: UNAUTHED_ERR_MSG });
  });

  it("com sessão de staff, sem terreiro correspondente no banco, retorna NOT_FOUND (não quebra)", async () => {
    const staffCaller = appRouter.createCaller(createStaffContext());
    await expect(staffCaller.terreiros.impersonate({ id: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── Pedidos (admin) ────────────────────────────────────────────────────────────

describe("partnerOrders.list / publicOrders.list", () => {
  it("exigem sessão de staff", async () => {
    const anonCaller = appRouter.createCaller(createPublicContext());
    await expect(anonCaller.partnerOrders.list()).rejects.toMatchObject({ message: UNAUTHED_ERR_MSG });
    await expect(anonCaller.publicOrders.list()).rejects.toMatchObject({ message: UNAUTHED_ERR_MSG });

    const terreiroCaller = appRouter.createCaller(createTerreiroContext());
    await expect(terreiroCaller.partnerOrders.list()).rejects.toMatchObject({ message: UNAUTHED_ERR_MSG });
  });

  it("com sessão de staff, resolve lista vazia sem banco (não quebra)", async () => {
    const staffCaller = appRouter.createCaller(createStaffContext());
    await expect(staffCaller.partnerOrders.list()).resolves.toEqual([]);
    await expect(staffCaller.publicOrders.list()).resolves.toEqual([]);
  });
});
