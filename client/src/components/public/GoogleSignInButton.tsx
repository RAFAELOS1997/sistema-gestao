import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

// Tipagem local (não global) do Google Identity Services, pra não colidir
// com o "window.google" já tipado em Map.tsx (Google Maps JS API é outra coisa).
type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

function getGis(): GoogleIdentityServices | undefined {
  return (window as unknown as { google?: GoogleIdentityServices }).google;
}

let scriptLoadingPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (getGis()?.accounts?.id) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o script do Google"));
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

// Botão "Entrar com Google" — só aparece se o Rafael já configurou o Client
// ID (server/_core/env.ts). Some sozinho do site enquanto isso não existir.
export function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const configQuery = trpc.account.config.useQuery();
  const loginMutation = trpc.account.loginWithGoogle.useMutation({ onSuccess });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!configQuery.data?.hasGoogleLogin || !configQuery.data.googleClientId || !containerRef.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const gis = getGis();
        if (cancelled || !gis || !containerRef.current) return;
        gis.accounts.id.initialize({
          client_id: configQuery.data!.googleClientId!,
          callback: (response) => loginMutation.mutate({ idToken: response.credential }),
        });
        gis.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
          locale: "pt-BR",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [configQuery.data]);

  if (!configQuery.data?.hasGoogleLogin) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
