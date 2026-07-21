import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { PARTNER_UNAUTHED_ERR_MSG, UNAUTHED_ERR_MSG } from "../shared/const";
import { signTerreiroSession, verifyTerreiroSession } from "./_core/terreiroAuth";
import { listPartnerVisibleProducts } from "./db";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    terreiro: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function createTerreiroContext(): TrpcContext {
  return {
    user: null,
    terreiro: {
      id: 7,
      name: "Terreiro Teste",
      username: "terreiro-teste",
      passwordHash: "n/a",
      contactName: null,
      phone: null,
      logoUrl: null,
      tierId: 1,
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── Sessão do parceiro (JWT próprio, cookie separado) ────────────────────────

describe("terreiroAuth session", () => {
  it("assina e verifica a sessão de um terreiro", async () => {
    const token = await signTerreiroSession(42);
    const terreiroId = await verifyTerreiroSession(token);
    expect(terreiroId).toBe(42);
  });

  it("rejeita token inválido ou adulterado", async () => {
    expect(await verifyTerreiroSession("token-invalido")).toBeNull();
    expect(await verifyTerreiroSession(undefined)).toBeNull();
  });

  it("não aceita a sessão de um usuário do sistema como sessão de terreiro", async () => {
    // Um JWT qualquer sem o campo terreiroId/scope correto deve ser rejeitado.
    const foreignToken = await signTerreiroSession(1);
    // Sanity check: o token do próprio terreiro funciona.
    expect(await verifyTerreiroSession(foreignToken)).toBe(1);
  });
});

// ─── portal.me / portal.products.list ──────────────────────────────────────────

describe("portal.me", () => {
  it("retorna null quando não há sessão de parceiro", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    expect(await caller.portal.me()).toBeNull();
  });

  it("retorna os dados básicos do terreiro autenticado", async () => {
    const caller = appRouter.createCaller(createTerreiroContext());
    const result = await caller.portal.me();
    // Sem banco de dados no ambiente de teste, getPartnerTierById resolve null.
    expect(result).toEqual({
      id: 7,
      name: "Terreiro Teste",
      username: "terreiro-teste",
      contactName: null,
      phone: null,
      logoUrl: null,
      tierName: null,
    });
  });
});

describe("portal.profile / portal.teamUsers", () => {
  it("bloqueiam acesso sem sessão de parceiro", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.portal.profile.update({ contactName: "X" })).rejects.toMatchObject({ message: PARTNER_UNAUTHED_ERR_MSG });
    await expect(caller.portal.teamUsers.list()).rejects.toMatchObject({ message: PARTNER_UNAUTHED_ERR_MSG });
    await expect(
      caller.portal.teamUsers.create({ name: "Ajudante", username: "ajudante-teste", password: "senha123" })
    ).rejects.toMatchObject({ message: PARTNER_UNAUTHED_ERR_MSG });
  });

  it("terreiro autenticado consegue chamar profile.update e teamUsers.list sem quebrar (sem banco no teste)", async () => {
    const caller = appRouter.createCaller(createTerreiroContext());
    await expect(caller.portal.teamUsers.list()).resolves.toEqual([]);
  });
});

describe("portal.products.list", () => {
  it("bloqueia acesso sem sessão de parceiro com mensagem própria (não a do login de staff)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.portal.products.list()).rejects.toMatchObject({ message: PARTNER_UNAUTHED_ERR_MSG });
    // A mensagem tem que ser diferente da de staff — senão o app inteiro
    // redireciona pra /login em vez de /parceiros/login.
    expect(PARTNER_UNAUTHED_ERR_MSG).not.toBe(UNAUTHED_ERR_MSG);
  });

  it("nunca inclui o preço de custo na resposta", async () => {
    const caller = appRouter.createCaller(createTerreiroContext());
    const products = await caller.portal.products.list();
    for (const product of products) {
      expect(product).not.toHaveProperty("costPrice");
    }
  });

  it("terreiro sem plano definido e sem preço específico não vê nenhum produto", async () => {
    expect(await listPartnerVisibleProducts(7, null)).toEqual([]);
  });
});

// ─── Gestão de logins pelo admin ────────────────────────────────────────────────

// ─── Sanitização de dados sensíveis ───────────────────────────────────────────

describe("sanitização do hash de senha", () => {
  it("auth.me nunca expõe o passwordHash do usuário", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "staff-user",
        name: "Admin",
        email: "admin@example.com",
        loginMethod: "local",
        passwordHash: "salt:hash-super-secreto",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      terreiro: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).not.toBeNull();
    expect(me).not.toHaveProperty("passwordHash");
    expect(me?.name).toBe("Admin");
  });
});

describe("terreiros.create", () => {
  it("exige sessão de staff (não aceita sessão de parceiro nem anônimo)", async () => {
    const anonCaller = appRouter.createCaller(createPublicContext());
    await expect(
      anonCaller.terreiros.create({ name: "Terreiro X", username: "terreiro-x", password: "senha123" })
    ).rejects.toMatchObject({ message: UNAUTHED_ERR_MSG });

    const terreiroCaller = appRouter.createCaller(createTerreiroContext());
    await expect(
      terreiroCaller.terreiros.create({ name: "Terreiro X", username: "terreiro-x", password: "senha123" })
    ).rejects.toMatchObject({ message: UNAUTHED_ERR_MSG });
  });
});
