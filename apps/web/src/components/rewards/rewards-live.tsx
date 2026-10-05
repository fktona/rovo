"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatTokenAmount } from "@/lib/pump/trade-math";

type RewardQuote = {
  mint: string;
  symbol: string;
  source: "sol" | "global" | "quoteControl";
  feeLabel: string;
  decimals: number;
  pump: string;
  pumpswap: string;
  total: string;
};

type RewardsBody = {
  wallet: string;
  quotes: RewardQuote[];
};

const VENUES = [
  { key: "pump", label: "Pump curve", color: "#43e660" },
  { key: "pumpswap", label: "PumpSwap", color: "#9945ff" },
] as const;

export function RewardsLive() {
  const rewards = useQuery({
    queryKey: ["pump-rewards"],
    queryFn: async () => {
      const response = await fetch("/api/pump/rewards");
      const body = (await response.json()) as RewardsBody & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load rewards.");
      return body;
    },
  });

  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-6 text-foreground sm:px-6 sm:py-8"
      aria-busy={rewards.isPending}
    >
      <h1 className="text-[28px] font-bold tracking-[-0.6px] sm:text-3xl">Rewards</h1>
      <p className="mt-1 text-sm text-muted">
        Uncollected creator fees from coins launched on Rovo.
      </p>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        Fees accrue in the fee vault. The Pump curve balance is from coins
        still on the bonding curve. The PumpSwap balance is from coins that have
        graduated. Collecting them is a separate transaction.
      </p>

      {rewards.isPending ? (
        <RewardsSkeleton />
      ) : rewards.isError ? (
        <p role="alert" className="mt-8 text-sm text-danger">
          {rewards.error instanceof Error ? rewards.error.message : "Could not load rewards."}
        </p>
      ) : (
        <RewardsBodyView data={rewards.data} />
      )}
    </main>
  );
}

function RewardsBodyView({ data }: { data: RewardsBody }) {
  const quotes = data.quotes.filter((quote) => BigInt(quote.total) > 0n);
  return (
    <>
      <p className="mt-8 text-xs font-medium uppercase tracking-[0.08em] text-muted">
        Fee vault
      </p>
      <a
        className="mt-1 inline-block text-sm font-semibold text-accent"
        href={`https://solscan.io/account/${data.wallet}`}
        target="_blank"
        rel="noreferrer"
      >
        {shortAddress(data.wallet)}
      </a>
      <h2 className="mt-10 text-lg font-semibold">By quote</h2>
      {quotes.length === 0 ? (
        <p className="py-6 text-sm text-muted">No creator fees are waiting.</p>
      ) : (
        <div className="divide-y divide-[#2a2a2a]">
          {quotes.map((quote) => (
            <QuoteReward key={quote.mint} quote={quote} />
          ))}
        </div>
      )}
    </>
  );
}

function QuoteReward({ quote }: { quote: RewardQuote }) {
  const pump = BigInt(quote.pump);
  const pumpswap = BigInt(quote.pumpswap);
  const total = BigInt(quote.total);
  return (
    <article className="py-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-surface-raised text-sm font-semibold">
          {quote.symbol.slice(0, 3)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{quote.symbol}</p>
          <p className="truncate text-sm text-muted">
            Creator fee {quote.feeLabel}
            <span className="mx-1.5">·</span>
            <a
              className="text-accent"
              href={`https://solscan.io/token/${quote.mint}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(quote.mint)}
            </a>
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-accent">
          {formatTokenAmount(total, quote.decimals)}
        </p>
      </div>
      <VenueBar pump={pump} pumpswap={pumpswap} total={total} />
      <p className="mt-2 text-xs leading-5 text-muted">
        Pump curve {formatTokenAmount(pump, quote.decimals)} {share(pump, total)}
        <span className="mx-1.5">·</span>
        PumpSwap {formatTokenAmount(pumpswap, quote.decimals)} {share(pumpswap, total)}
      </p>
    </article>
  );
}

function VenueBar({
  pump,
  pumpswap,
  total,
}: {
  pump: bigint;
  pumpswap: bigint;
  total: bigint;
}) {
  const [hover, setHover] = useState<"pump" | "pumpswap" | null>(null);
  const slices = VENUES.map((venue) => ({
    ...venue,
    amount: venue.key === "pump" ? pump : pumpswap,
  })).filter((venue) => venue.amount > 0n);
  return (
    <div
      className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-surface"
      onMouseLeave={() => setHover(null)}
    >
      {slices.map((venue) => (
        <div
          key={venue.key}
          className="h-full"
          style={{
            width: widthPercent(venue.amount, total),
            background: venue.color,
            opacity: hover && hover !== venue.key ? 0.4 : 1,
          }}
          onMouseEnter={() => setHover(venue.key)}
          title={`${venue.label} ${share(venue.amount, total)}`}
        />
      ))}
    </div>
  );
}

function RewardsSkeleton() {
  return (
    <div className="mt-8" aria-hidden>
      <span className="shimmer block h-3 w-24 rounded" />
      <span className="shimmer mt-2 block h-4 w-36 rounded" />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="py-5">
          <div className="flex items-center gap-3">
            <span className="shimmer size-12 shrink-0 rounded-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="shimmer block h-4 w-24 rounded" />
              <span className="shimmer mt-2 block h-3 w-40 rounded" />
            </span>
            <span className="shimmer h-4 w-16 rounded" />
          </div>
          <span className="shimmer mt-4 block h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

function widthPercent(part: bigint, total: bigint) {
  if (total <= 0n || part <= 0n) return "0%";
  return `${Number((part * 10000n) / total) / 100}%`;
}

function share(part: bigint, total: bigint) {
  if (total <= 0n || part <= 0n) return "0%";
  const percent = Number((part * 10000n) / total) / 100;
  return percent >= 10 ? `${Math.round(percent)}%` : `${Math.round(percent * 10) / 10}%`;
}

function shortAddress(value: string) {
  return value.length < 12 ? value : `${value.slice(0, 4)}…${value.slice(-4)}`;
}
