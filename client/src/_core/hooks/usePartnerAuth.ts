import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

const PARTNER_LOGIN_PATH = "/parceiros/login";

export function usePartnerAuth(options?: { redirectOnUnauthenticated?: boolean }) {
  const { redirectOnUnauthenticated = false } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.portal.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.portal.logout.useMutation({
    onSuccess: () => {
      utils.portal.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (!(error instanceof TRPCClientError)) throw error;
    } finally {
      utils.portal.me.setData(undefined, null);
      await utils.portal.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(
    () => ({
      terreiro: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      isAuthenticated: Boolean(meQuery.data),
    }),
    [meQuery.data, meQuery.isLoading, logoutMutation.isPending]
  );

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (state.terreiro) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === PARTNER_LOGIN_PATH) return;

    window.location.href = PARTNER_LOGIN_PATH;
  }, [redirectOnUnauthenticated, meQuery.isLoading, state.terreiro]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
