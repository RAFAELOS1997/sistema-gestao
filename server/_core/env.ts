export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Login com Google (área do cliente na loja pública) — só o Client ID,
  // gratuito de criar no Google Cloud e sem precisar de cartão. Enquanto não
  // for configurado, o botão "Entrar com Google" some sozinho no site.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
};
