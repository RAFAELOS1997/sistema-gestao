// Verifica o token de "Entrar com Google" (Google Identity Services) — só
// precisa do Client ID (gratuito, sem cartão). Sem GOOGLE_CLIENT_ID
// configurado, verifyGoogleIdToken sempre retorna null (o botão nem aparece
// no site nesse caso, mas isso protege o endpoint de qualquer jeito).
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ENV } from "./env";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return jwks;
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  if (!ENV.googleClientId) return null;
  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: ENV.googleClientId,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.email_verified === false) return null;
    return {
      googleId: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : payload.email,
    };
  } catch {
    return null;
  }
}
