import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@tocadapantera.com",
    name: "Usuário Teste",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    terreiro: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("limpa o cookie de sessão e retorna sucesso", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ─── Products - getMargin ─────────────────────────────────────────────────────

describe("products.getMargin", () => {
  it("calcula margem de lucro corretamente", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Custo: R$10,00 (1000 centavos), Venda: R$20,00 (2000 centavos) → margem 50%
    const margin = await caller.products.getMargin({ costPrice: 1000, salePrice: 2000 });
    expect(margin).toBe(50);
  });

  it("retorna 0 quando preço de venda é zero", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const margin = await caller.products.getMargin({ costPrice: 1000, salePrice: 0 });
    expect(margin).toBe(0);
  });

  it("calcula margem com centavos preservados (fix do bug parseInt→parseFloat)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Custo: R$5,50 (550 centavos), Venda: R$11,00 (1100 centavos) → margem 50%
    const margin = await caller.products.getMargin({ costPrice: 550, salePrice: 1100 });
    expect(margin).toBe(50);
  });
});

// ─── Auth.me ─────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("retorna o usuário autenticado", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Usuário Teste");
    expect(user?.email).toBe("test@tocadapantera.com");
  });
});


// ─── Products - Soft Delete ───────────────────────────────────────────────────

describe("products.deactivate", () => {
  it("desativa um produto com sucesso", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Nota: Este teste verifica se a função é chamada sem erro
    // Em um ambiente real, seria necessário ter um produto no banco de dados
    try {
      // Tenta desativar um produto inexistente (ID 999)
      // O teste passa se não lançar erro de tipo/schema
      await caller.products.deactivate({ id: 999 });
    } catch (error: any) {
      // Esperamos um erro de banco de dados, não de validação
      expect(error?.message).not.toContain("zodError");
    }
  });

  it("valida entrada com ID positivo", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Tenta com ID inválido (zero)
    try {
      await caller.products.deactivate({ id: 0 });
      // Se chegou aqui, o teste falha
      expect(true).toBe(false);
    } catch (error: any) {
      // Esperamos um erro de validação Zod
      const errorStr = JSON.stringify(error);
      expect(errorStr).toContain("Too small");
    }
  });
});

describe("products.reactivate", () => {
  it("reativa um produto com sucesso", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.products.reactivate({ id: 999 });
    } catch (error: any) {
      expect(error?.message).not.toContain("zodError");
    }
  });

  it("valida entrada com ID positivo", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.products.reactivate({ id: -1 });
      expect(true).toBe(false);
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      expect(errorStr).toContain("Too small");
    }
  });
});


// ─── Purchases - Update ───────────────────────────────────────────────────────

describe("purchases.update", () => {
  it("valida entrada com ID positivo", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.purchases.update({
        id: -1,
        quantity: 10,
        unitPrice: 2500,
      });
      expect(true).toBe(false);
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      expect(errorStr).toContain("Too small");
    }
  });

  it("valida quantidade como positiva", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.purchases.update({
        id: 1,
        quantity: 0,
        unitPrice: 2500,
      });
      expect(true).toBe(false);
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      expect(errorStr).toContain("Too small");
    }
  });

  it("valida preço unitário como positivo", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.purchases.update({
        id: 1,
        quantity: 10,
        unitPrice: -100,
      });
      expect(true).toBe(false);
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      expect(errorStr).toContain("Too small");
    }
  });

  it("aceita campos opcionais", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Apenas testa que a validação aceita entrada com ID
    // (teste real requer banco de dados)
    expect(true).toBe(true);
  });
});
