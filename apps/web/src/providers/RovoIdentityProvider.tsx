"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLinkAccount, usePrivy, useWallets } from "@privy-io/react-auth";
import type { Address } from "viem";
import type { RovoApiClient } from "../lib/api";

function useConnectedIdentity(api: RovoApiClient) {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    getAccessToken,
    connectOrCreateWallet,
  } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { linkTwitter } = useLinkAccount();
  return {
    configured: true,
    ready: ready && walletsReady,
    authenticated,
    user,
    xAccount: user?.twitter ?? null,
    wallets: wallets.filter((wallet) => wallet.type === "ethereum"),
    login,
    logout,
    linkTwitter,
    connectOrCreateWallet,
    getAccessToken,
    async verifyX(wallet: Address) {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in with Privy before verifying X");
      return api.verifyX(token, wallet);
    },
  };
}

type Identity = ReturnType<typeof useConnectedIdentity>;
const IdentityContext = createContext<Identity | null>(null);

function unavailable(): never {
  throw new Error(
    "Privy login is not configured yet. Add NEXT_PUBLIC_PRIVY_APP_ID to apps/web/.env.local.",
  );
}

const previewIdentity: Identity = {
  configured: false,
  ready: true,
  authenticated: false,
  user: null,
  xAccount: null,
  wallets: [],
  login: () => {
    window.alert(
      "Login is not configured yet. Add your Privy App ID to apps/web/.env.local.",
    );
  },
  logout: async () => unavailable(),
  linkTwitter: unavailable,
  connectOrCreateWallet: unavailable,
  getAccessToken: async () => null,
  verifyX: async () => unavailable(),
};

function ConnectedIdentityProvider({
  api,
  children,
}: {
  api: RovoApiClient;
  children: ReactNode;
}) {
  const value = useConnectedIdentity(api);
  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function RovoIdentityProvider({
  enabled,
  api,
  children,
}: {
  enabled: boolean;
  api: RovoApiClient;
  children: ReactNode;
}) {
  return enabled ? (
    <ConnectedIdentityProvider api={api}>{children}</ConnectedIdentityProvider>
  ) : (
    <IdentityContext.Provider value={previewIdentity}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useRovoIdentity() {
  const value = useContext(IdentityContext);
  if (!value) throw new Error("Wrap this hook in RovoIdentityProvider");
  return value;
}
