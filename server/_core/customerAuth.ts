// Sessão da área do cliente (loja pública) — cookie e verificação próprios,
// nunca se mistura com a sessão de staff (users) nem de parceiro (terreiros).
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

export const CUSTOMER_COOKIE_NAME = "customer_session_id";
const CUSTOMER_SESSION_SCOPE = "customer";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 90; // 90 dias — cliente não precisa logar toda hora

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function signCustomerSession(customerId: number): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);
  return new SignJWT({ scope: CUSTOMER_SESSION_SCOPE, customerId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export async function verifyCustomerSession(cookieValue: string | undefined | null): Promise<{ customerId: number } | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSessionSecret(), { algorithms: ["HS256"] });
    if (payload.scope !== CUSTOMER_SESSION_SCOPE || typeof payload.customerId !== "number") return null;
    return { customerId: payload.customerId };
  } catch {
    return null;
  }
}
