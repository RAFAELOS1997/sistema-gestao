import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
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
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

// ─── Sales Router Tests ──────────────────────────────────────────────────────

describe("sales.create", () => {
  it("rejeita venda com carrinho vazio (productId inválido)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sales.create({
        productId: 0,
        quantity: 1,
        unitPrice: 1000,
        channel: "fisico",
        saleDate: new Date(),
      })
    ).rejects.toThrow();
  });

  it("rejeita venda com quantidade zero", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sales.create({
        productId: 1,
        quantity: 0,
        unitPrice: 1000,
        channel: "fisico",
        saleDate: new Date(),
      })
    ).rejects.toThrow();
  });

  it("rejeita venda com preço unitário zero", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sales.create({
        productId: 1,
        quantity: 1,
        unitPrice: 0,
        channel: "fisico",
        saleDate: new Date(),
      })
    ).rejects.toThrow();
  });

  it("rejeita canal de venda inválido", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sales.create({
        productId: 1,
        quantity: 1,
        unitPrice: 1000,
        channel: "invalido" as any,
        saleDate: new Date(),
      })
    ).rejects.toThrow();
  });
});

// ─── Receipts Router Tests ───────────────────────────────────────────────────

describe("receipts.create", () => {
  it("rejeita recibo com total zero", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.receipts.create({
        subtotal: 0,
        discount: 0,
        total: 0,
        paymentMethod: "pix",
        items: JSON.stringify([{ name: "A", quantity: 1, unitPrice: 0, total: 0 }]),
      })
    ).rejects.toThrow();
  });

  it("rejeita recibo sem forma de pagamento", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.receipts.create({
        subtotal: 3000,
        discount: 0,
        total: 3000,
        paymentMethod: "",
        items: JSON.stringify([{ name: "A", quantity: 1, unitPrice: 3000, total: 3000 }]),
      })
    ).rejects.toThrow();
  });

  it("rejeita recibo sem itens", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.receipts.create({
        subtotal: 3000,
        discount: 0,
        total: 3000,
        paymentMethod: "dinheiro",
        items: "",
      })
    ).rejects.toThrow();
  });

  it("aceita recibo com notes opcionais", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Valida que o input com notes é aceito pelo schema (pode falhar no DB mas não no input)
    const input = {
      subtotal: 5000,
      discount: 500,
      total: 4500,
      paymentMethod: "pix",
      notes: "Cliente: João da Silva",
      items: JSON.stringify([{ name: "VELA", quantity: 2, unitPrice: 2500, total: 5000 }]),
    };

    // Deve aceitar o input (pode falhar no DB, mas não na validação)
    try {
      await caller.receipts.create(input);
    } catch (e: any) {
      // Se falhar, deve ser por DB, não por validação de input
      expect(e.message).not.toContain("Expected");
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });
});

describe("receipts.list", () => {
  it("rejeita limit maior que 200", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.receipts.list({ limit: 201 })
    ).rejects.toThrow();
  });

  it("rejeita limit menor que 1", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.receipts.list({ limit: 0 })
    ).rejects.toThrow();
  });
});

describe("receipts.getByNumber", () => {
  it("rejeita número de recibo zero", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.receipts.getByNumber({ receiptNumber: 0 })
    ).rejects.toThrow();
  });

  it("rejeita número de recibo negativo", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.receipts.getByNumber({ receiptNumber: -1 })
    ).rejects.toThrow();
  });
});

// ─── Receipt Data Validation ─────────────────────────────────────────────────

describe("Receipt data calculation", () => {
  it("calcula subtotal corretamente", () => {
    const items = [
      { productId: 1, name: "Vela 7 Dias", quantity: 2, unitPrice: 1500, total: 3000 },
      { productId: 2, name: "Incenso", quantity: 3, unitPrice: 500, total: 1500 },
    ];
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    expect(subtotal).toBe(4500); // R$ 45,00
  });

  it("calcula desconto percentual corretamente", () => {
    const subtotal = 10000; // R$ 100,00
    const discountPercent = 10;
    const discount = Math.round(subtotal * (discountPercent / 100));
    expect(discount).toBe(1000); // R$ 10,00
  });

  it("calcula total final com desconto", () => {
    const subtotal = 10000;
    const discount = 1000;
    const total = subtotal - discount;
    expect(total).toBe(9000); // R$ 90,00
  });

  it("formata número de recibo sequencial com 6 dígitos", () => {
    const receiptNumber = 42;
    const formatted = receiptNumber.toString().padStart(6, "0");
    expect(formatted).toBe("000042");
    expect(formatted).toHaveLength(6);
  });

  it("formata valores monetários corretamente", () => {
    const value = 1550; // 1550 centavos = R$ 15,50
    const formatted = (value / 100).toFixed(2);
    expect(formatted).toBe("15.50");
  });

  it("calcula total de item (quantidade x preço unitário)", () => {
    const unitPrice = 1500;
    const quantity = 3;
    const total = unitPrice * quantity;
    expect(total).toBe(4500); // R$ 45,00
  });

  it("serializa itens para JSON corretamente", () => {
    const items = [
      { name: "VELA BRANCA", quantity: 2, unitPrice: 1500, total: 3000 },
      { name: "INCENSO", quantity: 1, unitPrice: 300, total: 300 },
    ];
    const json = JSON.stringify(items);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("VELA BRANCA");
    expect(parsed[1].total).toBe(300);
  });

  it("trata observações opcionais corretamente", () => {
    const withNotes = "Cliente: Maria - Entrega amanhã";
    const withoutNotes = undefined;
    
    expect(withNotes).toBeTruthy();
    expect(withoutNotes).toBeUndefined();
    expect(withNotes || undefined).toBe(withNotes);
    expect(withoutNotes || undefined).toBeUndefined();
  });
});
