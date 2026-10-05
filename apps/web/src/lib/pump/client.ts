export const PUMP_MAINNET_CHAIN_ID =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

const INDEXER = "https://advanced-indexer.pump.fun";
const SWAP = "https://swap-api.pump.fun";
const FRONTEND = "https://frontend-api-v3.pump.fun";

export interface PumpCoinDetail {
  mint: string;
  chain: string;
  name: string;
  ticker: string;
  dev: string;
  program: string;
  quoteMint: string;
  pair: string;
  marketCapUsd: number;
  volumeUsd: number;
  progress: number;
  athMarketCapUsd: number;
  numHolders: number;
  imageUrl: string;
  description: string;
  totalFeesUSD: number;
  creationTime: number;
  graduationDate: number | null;
  isHolderReward: boolean;
}

export interface PumpMarketWindow {
  numTxs: number;
  volumeUSD: number;
  numUsers: number;
  numBuys: number;
  numSells: number;
  buyVolumeUSD: number;
  sellVolumeUSD: number;
  numBuyers: number;
  numSellers: number;
  priceChangePercent: number;
}

export interface PumpMarketActivity {
  "5m": PumpMarketWindow;
  "1h": PumpMarketWindow;
  "6h": PumpMarketWindow;
  "24h": PumpMarketWindow;
}

export interface PumpMarketCoin {
  mint: string;
  name: string;
  symbol: string;
  description: string | null;
  image_uri: string | null;
  metadata_uri: string | null;
  creator: string;
  created_timestamp: number;
  complete: boolean;
  market_cap_usd: number;
  usd_market_cap: number;
  quote_mint: string;
  program: string;
  chain_id: string;
  ath_market_cap: number;
  volume_1h_usd?: number;
}

export interface PumpTrade {
  slotIndexId: string;
  tx: string;
  timestamp: string;
  userAddress: string;
  type: "buy" | "sell";
  program: string;
  priceUsd: string;
  priceSol: string;
  amountUsd: string;
  amountSol: string;
  baseAmount: string;
  quoteAmount: string;
}

export interface PumpTrades {
  trades: PumpTrade[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export interface PumpPosition {
  coinMint: string;
  walletAddress: string;
  userName: string | null;
  amountHeld: number;
  pnlUsd: number;
  pnlPercentage: number;
  realizedPnlUsd: number;
  costBasisUsd: number;
  amountBought: number;
  callout: unknown;
}

export interface PumpPositions {
  positions: PumpPosition[];
  totalCount: number;
  hasMore: boolean;
}

export class PumpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function coinsV2Body(mints: string[]) {
  return { mints };
}

async function pumpRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      origin: "https://pump.fun",
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new PumpRequestError(
      `Pump request failed (${response.status})`,
      response.status,
    );
  }
  return response.json() as Promise<unknown>;
}

export function fetchPumpCoin(mint: string) {
  return pumpRequest(
    `${INDEXER}/in-memory-coin/${encodeURIComponent(mint)}`,
  ) as Promise<PumpCoinDetail>;
}

export function fetchPumpMarketActivity(
  mint: string,
  chainId = PUMP_MAINNET_CHAIN_ID,
) {
  const params = new URLSearchParams({ program: "pump", chainId });
  return pumpRequest(
    `${SWAP}/v1/coins/${encodeURIComponent(mint)}/market-activity?${params}`,
  ) as Promise<PumpMarketActivity>;
}

export function fetchPumpMarkets(mints: string[]) {
  return pumpRequest(`${FRONTEND}/coins-v2/mints`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(coinsV2Body(mints)),
  }) as Promise<PumpMarketCoin[]>;
}

export function fetchPumpTrades(
  mint: string,
  query: {
    limit?: number;
    cursor?: string;
    minSolAmount?: number;
    createdTs?: string;
    chainId?: string;
  } = {},
) {
  const params = new URLSearchParams({
    limit: String(query.limit ?? 100),
    cursor: query.cursor ?? "0",
    program: "pump",
    minSolAmount: String(query.minSolAmount ?? 0.05),
    chainId: query.chainId ?? PUMP_MAINNET_CHAIN_ID,
  });
  if (query.createdTs) params.set("createdTs", query.createdTs);
  return pumpRequest(
    `${SWAP}/v2/coins/${encodeURIComponent(mint)}/trades?${params}`,
  ) as Promise<PumpTrades>;
}

export function fetchPumpPositions(
  mint: string,
  query: { sortBy?: string; pageSize?: number } = {},
) {
  const params = new URLSearchParams({
    sortBy: query.sortBy ?? "TOP",
    pageSize: String(query.pageSize ?? 50),
  });
  return pumpRequest(
    `${FRONTEND}/mint-positions/${encodeURIComponent(mint)}?${params}`,
  ) as Promise<PumpPositions>;
}
