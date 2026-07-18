import { parse as parseCookieHeader } from "cookie";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Terreiro, User } from "../../drizzle/schema";
import { getTerreiroById } from "../db";
import { sdk } from "./sdk";
import { TERREIRO_COOKIE_NAME, verifyTerreiroSession } from "./terreiroAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  terreiro: Terreiro | null;
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
  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    const terreiroId = await verifyTerreiroSession(cookies[TERREIRO_COOKIE_NAME]);
    if (terreiroId) {
      const found = await getTerreiroById(terreiroId);
      if (found && found.isActive) terreiro = found;
    }
  } catch (error) {
    terreiro = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    terreiro,
  };
}
