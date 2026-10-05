"use client";

import { useQuery } from "@tanstack/react-query";
import type { ChartPoint } from "./token-chart";
import { ipfsUrl } from "@/lib/ipfs";
import { formatPriceUsd, formatUsd } from "@/lib/token-market";
import type {
  PumpCoinDetail,
  PumpMarketActivity,
  PumpPosition,
  PumpTrade,
} from "@/lib/pump/client";

export const CHART_RANGES = ["5m", "1h", "6h", "1d", "all"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

const PUMP_SUPPLY = 1_000_000_000;

function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

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

function shortAddress(value: string) {
  return value.length < 10 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function tokenImage(value: string | undefined) {
  if (!value) return "/figma-token/zora.png";
  return ipfsUrl(value);
}

function activityKey(range: ChartRange): keyof PumpMarketActivity {
  if (range === "5m" || range === "1h" || range === "6h") return range;
  return "24h";
}

function tradeTime(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const seconds = numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : numeric;
    return relativeTime(seconds);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? relativeTime(Math.floor(parsed / 1000)) : "—";
}

function money(value: string | number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? formatUsd(amount) : "—";
}

function holderShare(position: PumpPosition) {
  const held = position.amountHeld;
  if (!Number.isFinite(held) || held <= 0) return "—";
  const tokens = held > PUMP_SUPPLY * 10 ? held / 1_000_000 : held;
  return `${((tokens / PUMP_SUPPLY) * 100).toFixed(2)}%`;
}

async function readJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

const empty = {
  valid: false,
  name: "Token",
  handle: "",
  image: "/figma-token/zora.png",
  scout: null,
  pairLabel: "—",
  pairIcon: undefined,
  status: null,
  priceLabel: "—",
  marketCapLabel: "—",
  volumeLabel: "—",
  changeLabel: "—",
  changeUp: true,
  creatorEarnings: "—",
  holderEarnings: "—",
  feeParts: [],
  feesLoading: false,
  points: [] as ChartPoint[],
  chartLoading: false,
  quoteUsd: null,
  supply: null,
  trades: [],
  tradesLoading: false,
  holders: [],
  holdersCount: null,
  holdersLoading: false,
};

export function useTokenPageData(token: string, range: ChartRange) {
  const solana = isSolanaAddress(token);
  const coin = useQuery({
    queryKey: ["pump-page", token, "coin"],
    enabled: solana,
    refetchInterval: 15_000,
    queryFn: () => readJson<PumpCoinDetail>(`/api/pump/coins/${token}`),
  });
  const activity = useQuery({
    queryKey: ["pump-page", token, "activity"],
    enabled: solana,
    refetchInterval: 15_000,
    queryFn: () =>
      readJson<PumpMarketActivity>(`/api/pump/coins/${token}/activity`),
  });
  const trades = useQuery({
    queryKey: ["pump-page", token, "trades"],
    enabled: solana,
    refetchInterval: 15_000,
    queryFn: () =>
      readJson<{ trades?: PumpTrade[] }>(
        `/api/pump/coins/${token}/trades?limit=20&minSolAmount=0`,
      ),
  });
  const positions = useQuery({
    queryKey: ["pump-page", token, "positions"],
    enabled: solana,
    refetchInterval: 15_000,
    queryFn: () =>
      readJson<{ positions?: PumpPosition[]; totalCount?: number }>(
        `/api/pump/coins/${token}/positions?pageSize=20`,
      ),
  });

  if (!solana) return empty;

  const info = coin.data;
  const window = activity.data?.[activityKey(range)];
  const marketCapUsd =
    typeof info?.marketCapUsd === "number" ? info.marketCapUsd : null;
  const priceUsd =
    marketCapUsd != null && marketCapUsd > 0 ? marketCapUsd / PUMP_SUPPLY : null;
  const change =
    typeof window?.priceChangePercent === "number" ? window.priceChangePercent : null;
  const graduated = info?.graduationDate != null || (info?.progress ?? 0) >= 100;
  const pairLabel = info?.pair || "SOL";

  return {
    valid: true,
    name: info?.name || info?.ticker || "Token",
    handle: info?.ticker || "",
    image: tokenImage(info?.imageUrl),
    scout: null,
    pairLabel,
    pairIcon: undefined,
    status: coin.isPending ? null : graduated ? "Graduated" : "Bonding",
    priceLabel: priceUsd == null ? "—" : formatPriceUsd(priceUsd),
    marketCapLabel: marketCapUsd == null ? "—" : formatUsd(marketCapUsd),
    volumeLabel: money(window?.volumeUSD),
    changeLabel: change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    changeUp: change == null ? true : change >= 0,
    creatorEarnings: "—",
    holderEarnings: "—",
    feeParts: [],
    feesLoading: false,
    points: [] as ChartPoint[],
    chartLoading: false,
    quoteUsd: null,
    supply: PUMP_SUPPLY,
    trades: (trades.data?.trades ?? []).slice(0, 20).map((trade) => ({
      id: trade.tx || trade.slotIndexId,
      time: tradeTime(trade.timestamp),
      side: trade.type === "sell" ? "Sell" : "Buy",
      usd: money(trade.amountUsd),
      quote: trade.quoteAmount
        ? `${Number(trade.quoteAmount).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${pairLabel}`
        : "—",
      mcap: money(trade.priceUsd ? Number(trade.priceUsd) * PUMP_SUPPLY : null),
      wallet: trade.userAddress ? shortAddress(trade.userAddress) : "—",
      tx: trade.tx ? `https://solscan.io/tx/${trade.tx}` : undefined,
    })),
    tradesLoading: trades.isPending,
    holders: (positions.data?.positions ?? []).slice(0, 20).map((holder, index) => ({
      rank: index + 1,
      wallet: holder.userName
        ? `${shortAddress(holder.walletAddress)} · ${holder.userName}`
        : shortAddress(holder.walletAddress),
      share: holderShare(holder),
      href: `https://solscan.io/account/${holder.walletAddress}`,
    })),
    holdersCount: info?.numHolders ?? positions.data?.totalCount ?? null,
    holdersLoading: positions.isPending || coin.isPending,
  };
}
