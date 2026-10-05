"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  mainnet,
} from "@solana/kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RovoApiClient } from "../lib/api";
import {
  createRovoPublicClient,
  getWebConfig,
  robinhoodChainWithRpc,
} from "../lib/chain";
import { createRovoReads } from "../lib/contracts/reads";
import { ToastProvider } from "@/components/toast/toast-provider";
import { RovoIdentityProvider } from "./RovoIdentityProvider";

export type RovoWebConfig = ReturnType<typeof getWebConfig>;

function createContextValue(config: RovoWebConfig) {
  const publicClient = createRovoPublicClient(config.rpcUrl);
  return {
    config,
    api: new RovoApiClient(config.apiUrl),
    publicClient,
    reads: createRovoReads(publicClient, config.addresses),
  };
}

type RovoContextValue = ReturnType<typeof createContextValue>;
const RovoContext = createContext<RovoContextValue | null>(null);

export function RovoProviders({
  children,
  config,
}: {
  children: ReactNode;
  config?: RovoWebConfig;
}) {
  const resolved = useMemo(() => config ?? getWebConfig(), [config]);
  const walletChain = useMemo(() => robinhoodChainWithRpc(resolved.rpcUrl), [resolved.rpcUrl]);
  const solanaRpcs = useMemo(() => {
    const httpUrl =
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
      "https://api.mainnet-beta.solana.com";
    const webSocketUrl = httpUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
    return {
      "solana:mainnet": {
        rpc: createSolanaRpc(mainnet(httpUrl)),
        rpcSubscriptions: createSolanaRpcSubscriptions(mainnet(webSocketUrl)),
        blockExplorerUrl: "https://explorer.solana.com",
      },
    };
  }, []);
  const value = useMemo(() => createContextValue(resolved), [resolved]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const app = (
    <QueryClientProvider client={queryClient}>
      <RovoContext.Provider value={value}>
        <RovoIdentityProvider enabled={!!resolved.privyAppId} api={value.api}>
          <ToastProvider>{children}</ToastProvider>
        </RovoIdentityProvider>
      </RovoContext.Provider>
    </QueryClientProvider>
  );
  if (!resolved.privyAppId) return app;
  return (
    <PrivyProvider
      appId={resolved.privyAppId}
      config={{
        ...(resolved.walletConnectProjectId
          ? { walletConnectCloudProjectId: resolved.walletConnectProjectId }
          : {}),
        supportedChains: [
          walletChain as unknown as NonNullable<
            PrivyClientConfig["defaultChain"]
          >,
        ],
        defaultChain: walletChain as unknown as NonNullable<
          PrivyClientConfig["defaultChain"]
        >,
        loginMethods: ["wallet", "twitter", "email" , "google"],
        appearance: {
          walletChainType: "solana-only",
          walletList: ["metamask", "detected_solana_wallets"],
        },
        solana: { rpcs: solanaRpcs },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        embeddedWallets: {
          solana: { createOnLogin: "off" },
        },
      }}
    >
      {app}
    </PrivyProvider>
  );
}

export function useRovoContext(): RovoContextValue {
  const context = useContext(RovoContext);
  if (!context) throw new Error("Wrap this hook in RovoProviders");
  return context;
}
