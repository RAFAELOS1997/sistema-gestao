import { parse as parseCookieHeader } from "cookie";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Terreiro, User, Customer } from "../../drizzle/schema";
import { getTerreiroById, getCustomerById } from "../db";
import { sdk } from "./sdk";
import { TERREIRO_COOKIE_NAME, verifyTerreiroSession } from "./terreiroAuth";
import { CUSTOMER_COOKIE_NAME, verifyCustomerSession } from "./customerAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  terreiro: Terreiro | null;
  // Qual login foi usado dentro da sessão do terreiro: null = o principal,
  // número = o id em terreiroUsers (usuário da equipe) — os dois têm as
  // mesmas permissões, isso só importa pra saber de quem é a senha na hora
  // de trocar.
  teamUserId: number | null;
  customer: Customer | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  let terreiro: Terreiro | null = null;
  let teamUserId: number | null = null;
  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    const session = await verifyTerreiroSession(cookies[TERREIRO_COOKIE_NAME]);
    if (session) {
      const found = await getTerreiroById(session.terreiroId);
      if (found && found.isActive) {
        terreiro = found;
        teamUserId = session.teamUserId;
      }
    }
  } catch (error) {
    terreiro = null;
    teamUserId = null;
  }

  let customer: Customer | null = null;
  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    const session = await verifyCustomerSession(cookies[CUSTOMER_COOKIE_NAME]);
    if (session) {
      const found = await getCustomerById(session.customerId);
      if (found && found.isActive) customer = found;
    }
  } catch (error) {
    customer = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    terreiro,
    teamUserId,
    customer,
  };
}
