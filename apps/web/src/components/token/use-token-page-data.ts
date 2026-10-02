"use client";

import { useQuery } from "@tanstack/react-query";
import { isAddress, parseAbi, zeroAddress, type Address } from "viem";
import { useOnchainLaunch, useLaunch, usePonsPhase } from "@/hooks/useRovoQueries";
import { useRovoContext } from "@/providers/RovoProviders";
import { feeShareBps, splitFees } from "@/lib/fee-split";
import { getPairChoice, pairIconSrc } from "@/lib/pairs";
import { formatPriceUsd, formatUsd } from "@/lib/token-market";
import type { ScoutProfile } from "@/lib/api";
import type { ChartPoint } from "./token-chart";

export const CHART_RANGES = ["5m", "1h", "6h", "1d", "all"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

type ChartBody = {
  points?: ChartPoint[];
  quoteSymbol?: string;
  quoteUsd?: number;
};

type Trade = {
  side?: string;
  tokenAmount?: string;
  quoteAmount?: string;
  account?: string;
  transactionHash?: string;
  timestamp?: number;
};

type Holder = {
  address?: string;
  percentage?: number;
};

type MarketBody = {
  available?: boolean;
  marketCapUsd?: number;
  priceUsd?: number;
};

type FeeBody = {
  earnedForToken?: string;
  usdValue?: number;
  quoteAsset?: { symbol?: string; decimals?: number };
};

const emptySplit = { platform: 0n, creator: 0n, rover: 0n, holders: 0n };

function relativeTime(unixSeconds: number) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function scoutProfile(
  launch: { launchType?: string; scout?: ScoutProfile | null } | undefined,
): ScoutProfile | null {
  if (launch?.launchType !== "scout" || !launch.scout) return null;
  return launch.scout;
}

function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function tokenImage(value: string | undefined) {
  if (!value) return "/figma-token/zora.png";
  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`;
  }
  return value;
}

type RaydiumHolder = {
  owner: string;
  percentage: number;
  label?: string;
};

type RaydiumDetail = {
  token: {
    name?: string;
    symbol?: string;
    imgUrl?: string;
    poolId?: string;
    supply?: number;
    marketCap?: number;
    finishingRate?: number;
    migrateAmmId?: string;
    volumeU?: number;
    mintB?: { symbol?: string; logoURI?: string };
  };
  market: {
    usdPrice: number | null;
    pairedUsdPrice: number | null;
  };
  holders: {
    count: number | null;
    holders: RaydiumHolder[];
  };
};

type RaydiumTrade = {
  signature: string;
  time: number | null;
  trader: string;
  side: "buy" | "sell";
  tokenAmount: number;
  pairedAmount: number;
};

function shortAddress(value: string) {
  return value.length < 10 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function portionUsd(part: bigint, total: bigint, usd: number) {
  if (total <= 0n || !Number.isFinite(usd)) return null;
  const micro = (part * 1_000_000n) / total;
  return (Number(micro) / 1_000_000) * usd;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Market data is unavailable.");
  return response.json() as Promise<T>;
}

const erc20NameAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
]);

export function useTokenPageData(token: string, range: ChartRange) {
  const evm = isAddress(token);
  const solana = !evm && isSolanaAddress(token);
  const address = evm ? (token as Address) : undefined;
  const { publicClient } = useRovoContext();
  const launch = useLaunch(address);
  const metadata = useQuery({
    queryKey: ["rovo", "token-metadata", address?.toLowerCase()],
    enabled: !!address,
    queryFn: async () => {
      const [name, symbol] = await Promise.all([
        publicClient.readContract({
          address: address!,
          abi: erc20NameAbi,
          functionName: "name",
        }),
        publicClient.readContract({
          address: address!,
          abi: erc20NameAbi,
          functionName: "symbol",
        }),
      ]);
      return { name, symbol };
    },
  });
  const onchain = useOnchainLaunch(address);
  const phase = usePonsPhase(address);
  const market = useQuery({
    queryKey: ["rovo", "token-market", address?.toLowerCase()],
    enabled: !!address,
    queryFn: () => readJson<MarketBody>(`/api/market/${address}`),
  });
  const fees = useQuery({
    queryKey: ["rovo", "token-fees", address?.toLowerCase()],
    enabled: !!address,
    queryFn: () => readJson<FeeBody>(`/api/creator-fees/${address}`),
  });
  const chart = useQuery({
    queryKey: ["rovo", "token-chart", address?.toLowerCase(), range],
    enabled: !!address,
    queryFn: () =>
      readJson<ChartBody>(`/api/pons-market/${address}/chart?range=${range}`),
  });
  const day = useQuery({
    queryKey: ["rovo", "token-chart", address?.toLowerCase(), "1d"],
    enabled: !!address,
    queryFn: () => readJson<ChartBody>(`/api/pons-market/${address}/chart?range=1d`),
  });
  const trades = useQuery({
    queryKey: ["rovo", "token-trades", address?.toLowerCase()],
    enabled: !!address,
    queryFn: () => readJson<{ trades?: Trade[] }>(`/api/pons-market/${address}/trades`),
  });
  const holders = useQuery({
    queryKey: ["rovo", "token-holders", address?.toLowerCase()],
    enabled: !!address,
    queryFn: () =>
      readJson<{ holders?: Holder[]; holdersCount?: number }>(
        `/api/pons-market/${address}/holders`,
      ),
  });

  const raydium = useQuery({
    queryKey: ["rovo", "raydium-token", token],
    enabled: solana,
    refetchInterval: 15_000,
    queryFn: () => readJson<RaydiumDetail>(`/api/raydium/token/${encodeURIComponent(token)}`),
  });
  const poolId = raydium.data?.token.poolId;
  const raydiumTrades = useQuery({
    queryKey: ["rovo", "raydium-trades", poolId],
    enabled: solana && !!poolId,
    refetchInterval: 15_000,
    queryFn: () =>
      readJson<{ trades?: RaydiumTrade[] }>(
        `/api/raydium/trades?poolId=${encodeURIComponent(poolId ?? "")}`,
      ),
  });

  const pairToken = launch.data?.pairToken ?? onchain.data?.pairToken;
  const pair = pairToken ? getPairChoice(pairToken) : undefined;
  const quoteUsd =
    typeof chart.data?.quoteUsd === "number"
      ? chart.data.quoteUsd
      : typeof day.data?.quoteUsd === "number"
        ? day.data.quoteUsd
        : null;
  const quoteSymbol = chart.data?.quoteSymbol ?? day.data?.quoteSymbol ?? pair?.symbol ?? "";
  const priceUsd = market.data?.priceUsd ?? null;
  const marketCapUsd = market.data?.marketCapUsd ?? null;
  const supply =
    priceUsd != null && priceUsd > 0 && marketCapUsd != null
      ? marketCapUsd / priceUsd
      : null;
  const dayPoints = day.data?.points ?? [];
  const dayVolume = dayPoints.reduce((sum, point) => sum + (point.volumeQuote ?? 0), 0);
  const first = dayPoints[0]?.price;
  const last = dayPoints[dayPoints.length - 1]?.price;
  const change =
    first != null && last != null && first > 0 ? ((last - first) / first) * 100 : null;

  const earned = /^\d+$/.test(fees.data?.earnedForToken ?? "")
    ? BigInt(fees.data?.earnedForToken ?? "0")
    : 0n;
  const chain = onchain.data;
  const split =
    chain && earned > 0n
      ? splitFees(earned, {
          launchType: Number(chain.launchType) === 1 ? "self" : "scout",
          claimed: chain.claimed,
          shareWithHolders: chain.shareWithHolders,
          creatorToHoldersBps: Number(chain.creatorToHoldersBps),
          launchedAt: Number(chain.launchedAt),
          now: Math.floor(Date.now() / 1000),
        })
      : emptySplit;
  const usdValue = typeof fees.data?.usdValue === "number" ? fees.data.usdValue : null;
  const money = (part: bigint) => {
    if (usdValue == null) return "—";
    const value = portionUsd(part, earned, usdValue);
    return value == null ? "—" : formatUsd(value);
  };
  const feeParts = [
    { key: "creator", label: "Creators", color: "#43e660", amount: split.creator },
    { key: "holders", label: "Holders", color: "#9945ff", amount: split.holders },
    { key: "rover", label: "Scout", color: "#4aa3ff", amount: split.rover },
    { key: "platform", label: "Platform", color: "#fbad15", amount: split.platform },
  ]
    .filter((part) => part.amount > 0n)
    .map((part) => ({
      ...part,
      width: feeShareBps(part.amount, earned) / 100,
      usd: money(part.amount),
    }));

  const quoteDecimals = fees.data?.quoteAsset?.decimals ?? 18;
  const quoteScale = 10 ** quoteDecimals;

  if (solana) {
    const info = raydium.data?.token;
    const market = raydium.data?.market;
    const priceUsd = market?.usdPrice ?? null;
    const marketCapUsd =
      typeof info?.marketCap === "number" ? info.marketCap : null;
    const pairedUsd = market?.pairedUsdPrice ?? null;
    const quoteSymbol = info?.mintB?.symbol || "quote";
    const graduated =
      Boolean(info?.migrateAmmId) || (info?.finishingRate ?? 0) >= 1;
    const volume =
      typeof info?.volumeU === "number" ? info.volumeU : null;
    return {
      valid: true,
      name: info?.name || info?.symbol || "Token",
      handle: info?.symbol || "",
      image: tokenImage(info?.imgUrl),
      scout: null,
      pairLabel: quoteSymbol,
      pairIcon: info?.mintB?.logoURI,
      status: raydium.isPending ? null : graduated ? "Graduated" : "Bonding",
      priceLabel: priceUsd == null ? "—" : formatPriceUsd(priceUsd),
      marketCapLabel: marketCapUsd == null ? "—" : formatUsd(marketCapUsd),
      volumeLabel: volume == null ? "—" : formatUsd(volume),
      changeLabel: "—",
      changeUp: true,
      creatorEarnings: "—",
      holderEarnings: "—",
      feeParts: [],
      feesLoading: false,
      points: [],
      chartLoading: false,
      quoteUsd: pairedUsd,
      supply: typeof info?.supply === "number" ? info.supply : null,
      trades: (raydiumTrades.data?.trades ?? []).slice(0, 20).map((trade) => ({
        id: trade.signature,
        time: typeof trade.time === "number" ? relativeTime(trade.time) : "—",
        side: trade.side === "sell" ? "Sell" : "Buy",
        usd:
          pairedUsd == null ? "—" : formatUsd(trade.pairedAmount * pairedUsd),
        quote: `${trade.pairedAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${quoteSymbol}`,
        mcap:
          pairedUsd == null || trade.tokenAmount <= 0 || !info?.supply
            ? "—"
            : formatUsd(
                (trade.pairedAmount / trade.tokenAmount) * info.supply * pairedUsd,
              ),
        wallet: shortAddress(trade.trader),
        tx: `https://solscan.io/tx/${trade.signature}`,
      })),
      tradesLoading: raydium.isPending || raydiumTrades.isPending,
      holders: (raydium.data?.holders.holders ?? []).slice(0, 20).map((holder, index) => ({
        rank: index + 1,
        wallet: holder.label
          ? `${shortAddress(holder.owner)} · ${holder.label}`
          : shortAddress(holder.owner),
        share: `${holder.percentage.toFixed(2)}%`,
        href: `https://solscan.io/account/${holder.owner}`,
      })),
      holdersCount: raydium.data?.holders.count ?? null,
      holdersLoading: raydium.isPending,
    };
  }

  return {
    valid: evm,
    name: launch.data?.displayName || metadata.data?.name || launch.data?.handle || "Token",
    handle: launch.data?.handle || metadata.data?.symbol || "",
    image: launch.data?.imageUrl || "/figma-token/zora.png",
    scout: scoutProfile(launch.data),
    pairLabel: pair?.symbol ?? (pairToken === zeroAddress ? "ETH" : quoteSymbol || "—"),
    pairIcon: pair ? pairIconSrc(pair.iconUrl) : undefined,
    status: phase.data == null ? null : phase.data === 0 ? "Bonding" : "Graduated",
    priceLabel: priceUsd == null ? "—" : formatPriceUsd(priceUsd),
    marketCapLabel: marketCapUsd == null ? "—" : formatUsd(marketCapUsd),
    volumeLabel:
      quoteUsd == null ? "—" : formatUsd(dayVolume * quoteUsd),
    changeLabel: change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    changeUp: change == null ? true : change >= 0,
    creatorEarnings: chain ? money(split.creator) : fees.isPending ? null : "—",
    holderEarnings: chain ? money(split.holders) : fees.isPending ? null : "—",
    feeParts: chain ? feeParts : [],
    feesLoading: fees.isPending || onchain.isPending,
    points: chart.data?.points ?? [],
    chartLoading: chart.isPending,
    quoteUsd,
    supply,
    trades: (trades.data?.trades ?? []).slice(0, 20).map((trade) => {
      const quote =
        typeof trade.quoteAmount === "string" && /^\d+$/.test(trade.quoteAmount)
          ? Number(trade.quoteAmount) / quoteScale
          : null;
      return {
        id: `${trade.transactionHash}-${trade.timestamp}`,
        time: typeof trade.timestamp === "number" ? relativeTime(trade.timestamp) : "—",
        side: trade.side === "sell" ? "Sell" : "Buy",
        usd: quote == null || quoteUsd == null ? "—" : formatUsd(quote * quoteUsd),
        quote: quote == null ? "—" : `${quote.toFixed(4)} ${quoteSymbol || "quote"}`,
        mcap:
          quote == null ||
          quoteUsd == null ||
          supply == null ||
          !/^\d+$/.test(trade.tokenAmount ?? "") ||
          trade.tokenAmount === "0"
            ? "—"
            : formatUsd(
                (quote / (Number(trade.tokenAmount) / quoteScale)) * supply * quoteUsd,
              ),
        wallet: trade.account ? shortAddress(trade.account) : "—",
        tx: trade.transactionHash
          ? `https://robinhoodchain.blockscout.com/tx/${trade.transactionHash}`
          : undefined,
      };
    }),
    tradesLoading: trades.isPending,
    holders: (holders.data?.holders ?? []).slice(0, 20).map((holder, index) => ({
      rank: index + 1,
      wallet: holder.address ? shortAddress(holder.address) : "—",
      share:
        typeof holder.percentage === "number"
          ? `${holder.percentage.toFixed(2)}%`
          : "—",
      href: holder.address
        ? `https://robinhoodchain.blockscout.com/address/${holder.address}`
        : undefined,
    })),
    holdersCount: holders.data?.holdersCount ?? null,
    holdersLoading: holders.isPending,
  };
}
