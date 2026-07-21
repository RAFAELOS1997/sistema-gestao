// Sessão separada para o Portal do Parceiro (terreiros). Usa cookie e
// verificação próprios para nunca se misturar com a sessão dos usuários do
// sistema (staff) — cada uma só é aceita pelo respectivo procedure do tRPC.
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

export const TERREIRO_COOKIE_NAME = "terreiro_session_id";
const TERREIRO_SESSION_SCOPE = "terreiro";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

// teamUserId identifica QUAL login foi usado (o principal do terreiro, ou um
// usuário da equipe dele) — os dois caem na mesma sessão/terreiroId, mas
// precisamos saber quem exatamente logou pra trocar a senha certa e decidir
// se mostra o popup de "primeiro acesso".
export async function signTerreiroSession(terreiroId: number, teamUserId: number | null = null): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);
  return new SignJWT({ scope: TERREIRO_SESSION_SCOPE, terreiroId, teamUserId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export async function verifyTerreiroSession(
  cookieValue: string | undefined | null
): Promise<{ terreiroId: number; teamUserId: number | null } | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSessionSecret(), { algorithms: ["HS256"] });
    if (payload.scope !== TERREIRO_SESSION_SCOPE || typeof payload.terreiroId !== "number") return null;
    const teamUserId = typeof payload.teamUserId === "number" ? payload.teamUserId : null;
    return { terreiroId: payload.terreiroId, teamUserId };
  } catch {
    return null;
  }
}
