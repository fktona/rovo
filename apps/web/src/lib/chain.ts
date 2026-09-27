import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  isAddress,
  type Address,
} from "viem";

export const NATIVE_ASSET =
  "0x0000000000000000000000000000000000000000" as Address;
const OFFICIAL_RPC = "https://rpc.mainnet.chain.robinhood.com";
const RELIABLE_RPC = "https://robinhood.drpc.org";

function rpcUrls(preferred?: string): [string, ...string[]] {
  const first =
    !preferred || preferred === OFFICIAL_RPC ? RELIABLE_RPC : preferred;
  return [...new Set([first, RELIABLE_RPC, OFFICIAL_RPC])] as [
    string,
    ...string[],
  ];
}

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: rpcUrls(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL) },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export function robinhoodChainWithRpc(rpcUrl: string) {
  return {
    ...robinhoodChain,
    rpcUrls: { default: { http: [rpcUrl] } },
  } as typeof robinhoodChain;
}

export type RovoAddresses = {
  registry: Address;
  wrapper: Address;
  zapRouter: Address;
  splitter: Address;
  nottingham: Address;
  holderRewards: Address;
};

export function requireAddress(
  value: string | undefined,
  name: string,
): Address {
  if (!value || !isAddress(value))
    throw new Error(`${name} must be a valid EVM address`);
  return value as Address;
}

export function getWebConfig() {
  const apiUrl = process.env.NEXT_PUBLIC_ROVO_API_URL;
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const walletConnectProjectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const rpcUrl =
    process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? RELIABLE_RPC;
  if (!apiUrl || !/^https?:\/\//.test(apiUrl))
    throw new Error("NEXT_PUBLIC_ROVO_API_URL is required");
  if (!/^https?:\/\//.test(rpcUrl))
    throw new Error("NEXT_PUBLIC_ROBINHOOD_RPC_URL must be HTTP(S)");
  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    privyAppId: privyAppId ?? "",
    walletConnectProjectId: walletConnectProjectId ?? "",
    rpcUrl,
    addresses: {
      registry: requireAddress(
        process.env.NEXT_PUBLIC_ROVO_REGISTRY_ADDRESS,
        "registry",
      ),
      wrapper: requireAddress(
        process.env.NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS,
        "wrapper",
      ),
      zapRouter: requireAddress(
        process.env.NEXT_PUBLIC_ROVO_ZAP_ROUTER_ADDRESS,
        "zap router",
      ),
      splitter: requireAddress(
        process.env.NEXT_PUBLIC_ROVO_SPLITTER_ADDRESS,
        "splitter",
      ),
      nottingham: requireAddress(
        process.env.NEXT_PUBLIC_ROVO_NOTTINGHAM_ADDRESS,
        "Nottingham vault",
      ),
      holderRewards: requireAddress(
        process.env.NEXT_PUBLIC_ROVO_HOLDER_REWARDS_ADDRESS,
        "holder rewards",
      ),
    } satisfies RovoAddresses,
  };
}

export function createRovoPublicClient(rpcUrl = getWebConfig().rpcUrl) {
  const urls = rpcUrls(rpcUrl);
  return createPublicClient({
    chain: robinhoodChain,
    transport: fallback(
      urls.map((url) => http(url, { retryCount: 1, timeout: 12_000 })),
    ),
  });
}
