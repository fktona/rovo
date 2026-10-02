"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Address } from "viem";
import { useLaunches, rovoKeys } from "@/hooks/useRovoQueries";
import { useRovoContext } from "@/providers/RovoProviders";
import type { LaunchView } from "@/lib/api";
import { feeShareBps, splitFees, type FeeSplit } from "@/lib/fee-split";
import { formatUsd } from "@/lib/token-market";
import { ScoutedBy } from "@/components/scout-by";

type FeeBody = {
  earnedForToken?: string | null;
  usdValue?: number;
};

type ChainLaunch = {
  launchType: number | bigint;
  claimed: boolean;
  shareWithHolders: boolean;
  creatorToHoldersBps: number | bigint;
  launchedAt: number | bigint;
};

type Buckets = {
  creator: number;
  holders: number;
  scout: number;
  buyback: number;
  burn: number;
  total: number;
};

const EMPTY: Buckets = {
  creator: 0,
  holders: 0,
  scout: 0,
  buyback: 0,
  burn: 0,
  total: 0,
};

const PARTS = [
  { key: "creator", label: "Creators", color: "#43e660" },
  { key: "holders", label: "Holders", color: "#9945ff" },
  { key: "scout", label: "Scout", color: "#4aa3ff" },
  { key: "buyback", label: "Buyback", color: "#fbad15" },
  { key: "burn", label: "Burn", color: "#ff6a3d" },
] as const;

export function RewardsLive() {
  const { reads } = useRovoContext();
  const launches = useLaunches(100);
  const list = launches.data?.launches ?? [];
  const fees = useQueries({
    queries: list.map((launch) => ({
      queryKey: ["rovo", "creator-fees", launch.token.toLowerCase()],
      queryFn: () => readFee(launch.token),
    })),
  });
  const chains = useQueries({
    queries: list.map((launch) => ({
      queryKey: rovoKeys.chain("launch", launch.token.toLowerCase()),
      queryFn: () => reads.getLaunch(launch.token),
    })),
  });

  const rows = useMemo(() => {
    return list
      .map((launch, index) => {
        const fee = fees[index]?.data;
        const chain = chains[index]?.data as ChainLaunch | undefined;
        const earned = fee?.earned ?? 0n;
        const usd = fee?.usd ?? null;
        const split =
          earned > 0n ? splitFees(earned, splitInput(launch, chain)) : null;
        const buckets = bucketsFrom(split, earned, usd);
        return { launch, buckets, ready: fee != null || fees[index]?.isError === true };
      })
      .sort((a, b) => b.buckets.total - a.buckets.total);
  }, [list, fees, chains]);

  const total = rows.reduce(addBuckets, { ...EMPTY });
  const feesPending = list.length > 0 && fees.some((query) => query.isPending);
  const loading = launches.isPending || feesPending;

  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-6 text-foreground sm:px-6 sm:py-8"
      aria-busy={loading}
    >
      <h1 className="text-[28px] font-bold tracking-[-0.6px] sm:text-3xl">
        Rewards
      </h1>
      <p className="mt-1 text-sm text-muted">
        Creator fees from every profile and scout token.
      </p>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        During the contract audit, fees Rovo collects go to the X Money wallet
        for manual allocation. Amounts here are estimates. They are not an
        automatic on-chain payout.
      </p>

      <p className="mt-8 text-xs font-medium uppercase tracking-[0.08em] text-muted">
        Total rewards
      </p>
      {loading ? (
        <RewardsSummarySkeleton />
      ) : (
        <>
          <p className="mt-1 text-4xl font-bold tabular-nums">{money(total.total)}</p>
          <AllocationBar buckets={total} className="mt-3" barClassName="h-3" />
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {PARTS.filter((part) => part.key !== "buyback" && part.key !== "burn").map(
              (part) => (
                <AllocationStat
                  key={part.key}
                  label={part.label}
                  color={part.color}
                  amount={total[part.key]}
                  total={total.total}
                />
              ),
            )}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
              Protocol · 50% buyback, 50% burn
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-6">
              {PARTS.filter((part) => part.key === "buyback" || part.key === "burn").map(
                (part) => (
                  <AllocationStat
                    key={part.key}
                    label={part.label}
                    color={part.color}
                    amount={total[part.key]}
                    total={total.total}
                  />
                ),
              )}
            </div>
          </div>
        </>
      )}

      <h2 className="mt-10 text-lg font-semibold">Tokens</h2>
      {launches.isPending ? (
        <div className="divide-y divide-[#2a2a2a]">
          {Array.from({ length: 4 }, (_, index) => (
            <TokenSkeleton key={index} />
          ))}
        </div>
      ) : launches.isError ? (
        <p role="alert" className="py-6 text-sm text-danger">
          Could not load tokens.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-sm text-muted">No tokens yet.</p>
      ) : (
        <div className="divide-y divide-[#2a2a2a]">
          {rows.map(({ launch, buckets, ready }) => (
            <TokenReward
              key={launch.token}
              launch={launch}
              buckets={buckets}
              ready={ready}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function TokenReward({
  launch,
  buckets,
  ready,
}: {
  launch: LaunchView;
  buckets: Buckets;
  ready: boolean;
}) {
  const profile = launch.launchType === "self";
  const name = launch.displayName || `@${launch.handle}`;
  const parts = PARTS.filter((part) => part.key !== "scout" || !profile);
  return (
    <article className="py-5">
      <Link
        href={`/token/${launch.token}`}
        className="flex items-center gap-3 active:opacity-70"
      >
        <Avatar src={xAvatarUrl(launch.imageUrl)} label={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-sm text-muted">
            @{launch.handle}
            <span className="mx-1.5 text-muted">·</span>
            <span className={profile ? "text-accent" : "text-[#4aa3ff]"}>
              {profile ? "Profile" : "Scout"}
            </span>
          </p>
        </div>
        {ready ? (
          <p className="shrink-0 text-sm font-semibold tabular-nums text-accent">
            {money(buckets.total)}
          </p>
        ) : (
          <span className="shimmer inline-block h-4 w-14 shrink-0 rounded" />
        )}
      </Link>
      {!profile && launch.scout ? (
        <div className="mt-3">
          <ScoutedBy scout={launch.scout} />
        </div>
      ) : null}
      {ready ? (
        <>
          <AllocationBar buckets={buckets} className="mt-1" barClassName="h-1.5" />
          <p className="mt-2 text-xs leading-5 text-muted">
            {parts
              .map((part) => `${part.label} ${shareLabel(buckets[part.key], buckets.total)}`)
              .join(" · ")}
          </p>
        </>
      ) : (
        <>
          <span className="shimmer mt-4 block h-1.5 w-full rounded-full" />
          <span className="shimmer mt-2 block h-3 w-56 max-w-full rounded" />
        </>
      )}
    </article>
  );
}

function RewardsSummarySkeleton() {
  return (
    <div aria-hidden>
      <span className="shimmer mt-1 block h-10 w-36 rounded-lg" />
      <span className="shimmer mt-5 block h-3 w-full rounded-full" />
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <span className="shimmer block h-3 w-52 rounded" />
        <div className="mt-3 grid grid-cols-2 gap-x-6">
          <StatSkeleton />
          <StatSkeleton />
        </div>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div>
      <span className="shimmer block h-3 w-16 rounded" />
      <span className="shimmer mt-2 block h-6 w-20 rounded" />
      <span className="shimmer mt-1.5 block h-3 w-8 rounded" />
    </div>
  );
}

function TokenSkeleton() {
  return (
    <div className="py-5" aria-hidden>
      <div className="flex items-center gap-3">
        <span className="shimmer inline-block size-12 shrink-0 rounded-[10px]" />
        <span className="min-w-0 flex-1">
          <span className="shimmer block h-4 w-32 rounded" />
          <span className="shimmer mt-2 block h-3 w-44 rounded" />
        </span>
        <span className="shimmer inline-block h-4 w-14 shrink-0 rounded" />
      </div>
      <span className="shimmer mt-4 block h-1.5 w-full rounded-full" />
      <span className="shimmer mt-2 block h-3 w-56 max-w-full rounded" />
    </div>
  );
}

function AllocationBar({
  buckets,
  className,
  barClassName,
}: {
  buckets: Buckets;
  className: string;
  barClassName: string;
}) {
  const [hover, setHover] = useState<{ key: string; x: number } | null>(null);
  let cursor = 0;
  const slices = PARTS.map((part) => {
    const width = buckets.total > 0 ? (buckets[part.key] / buckets.total) * 100 : 0;
    const start = cursor;
    cursor += width;
    return { ...part, amount: buckets[part.key], width, start };
  }).filter((part) => part.width > 0);
  const tip = slices.find((part) => part.key === hover?.key);
  const place = hover ? placeTip(hover.x) : null;

  const track = (clientX: number, width: number, left: number) => {
    if (width <= 0 || slices.length === 0) return;
    const x = ((clientX - left) / width) * 100;
    const slice =
      slices.find((part, index) => {
        const end = index === slices.length - 1 ? 100 : part.start + part.width;
        return x >= part.start && x <= end;
      }) ?? null;
    setHover(slice ? { key: slice.key, x } : null);
  };

  return (
    <div
      className={`relative pt-8 ${className}`}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        track(event.clientX, rect.width, rect.left);
      }}
      onMouseLeave={() => setHover(null)}
    >
      {tip && place && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-20 flex w-max items-center gap-1.5 rounded-full border border-foreground/10 bg-surface-raised px-2.5 py-1 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          style={{ left: place.left, transform: place.transform }}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: tip.color }}
          />
          <span className="text-muted">{tip.label}</span>
          <span className="font-semibold tabular-nums text-foreground">{money(tip.amount)}</span>
          <span className="text-muted">{shareLabel(tip.amount, buckets.total)}</span>
        </div>
      )}
      <div className={`flex overflow-hidden rounded-full bg-surface ${barClassName}`}>
        {slices.map((part) => (
          <div
            key={part.key}
            className="transition-opacity"
            style={{
              width: `${part.width}%`,
              background: part.color,
              opacity: hover && hover.key !== part.key ? 0.4 : 1,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex" style={{ top: "2rem" }}>
        {slices.map((part) => (
          <button
            key={part.key}
            type="button"
            className="h-full min-w-0"
            style={{ width: `${part.width}%` }}
            aria-label={`${part.label} ${money(part.amount)}, ${shareLabel(part.amount, buckets.total)}`}
            onFocus={() => setHover({ key: part.key, x: part.start + part.width / 2 })}
            onBlur={() => setHover((current) => (current?.key === part.key ? null : current))}
          />
        ))}
      </div>
    </div>
  );
}

function placeTip(x: number) {
  if (x > 84) return { left: "100%", transform: "translateX(calc(-100% - 4px))" };
  if (x < 16) return { left: "0%", transform: "translateX(4px)" };
  return { left: `${x}%`, transform: "translateX(-50%)" };
}

function AllocationStat({
  label,
  color,
  amount,
  total,
}: {
  label: string;
  color: string;
  amount: number;
  total: number;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: color }}
        />
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{money(amount)}</p>
      <p className="text-xs text-muted">{shareLabel(amount, total)}</p>
    </div>
  );
}

function Avatar({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className="size-12 shrink-0 rounded-[10px] object-cover"
      />
    );
  }
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-surface-raised text-base font-semibold uppercase">
      {label.replace(/^@/, "").slice(0, 1) || "?"}
    </span>
  );
}

function splitInput(launch: LaunchView, chain: ChainLaunch | undefined) {
  const launchedAt = chain
    ? Number(chain.launchedAt)
    : Math.floor(new Date(launch.launchedAt).getTime() / 1000);
  return {
    launchType: (chain
      ? Number(chain.launchType) === 1
        ? "self"
        : "scout"
      : launch.launchType) as "self" | "scout",
    claimed: chain?.claimed ?? launch.claimed,
    shareWithHolders: chain?.shareWithHolders ?? false,
    creatorToHoldersBps: chain ? Number(chain.creatorToHoldersBps) : 0,
    launchedAt: Number.isFinite(launchedAt) ? launchedAt : 0,
    now: Math.floor(Date.now() / 1000),
  };
}

function bucketsFrom(
  split: FeeSplit | null,
  earned: bigint,
  usd: number | null,
): Buckets {
  if (!split || usd == null || earned <= 0n) {
    return { ...EMPTY, total: usd ?? 0 };
  }
  const buybackWei = split.platform / 2n;
  const burnWei = split.platform - buybackWei;
  const part = (amount: bigint) => portionUsd(amount, earned, usd) ?? 0;
  return {
    creator: part(split.creator),
    holders: part(split.holders),
    scout: part(split.rover),
    buyback: part(buybackWei),
    burn: part(burnWei),
    total: usd,
  };
}

function addBuckets(sum: Buckets, row: { buckets: Buckets }): Buckets {
  return {
    creator: sum.creator + row.buckets.creator,
    holders: sum.holders + row.buckets.holders,
    scout: sum.scout + row.buckets.scout,
    buyback: sum.buyback + row.buckets.buyback,
    burn: sum.burn + row.buckets.burn,
    total: sum.total + row.buckets.total,
  };
}

function portionUsd(part: bigint, total: bigint, usd: number) {
  if (total <= 0n || !Number.isFinite(usd)) return null;
  const micro = (part * 1_000_000n) / total;
  return (Number(micro) / 1_000_000) * usd;
}

function shareLabel(part: number, total: number) {
  if (total <= 0 || part <= 0) return "0%";
  const bps = feeShareBps(BigInt(Math.round(part * 100)), BigInt(Math.round(total * 100)));
  const percent = bps / 100;
  return percent >= 10 ? `${Math.round(percent)}%` : `${Math.round(percent * 10) / 10}%`;
}

function money(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  return formatUsd(value);
}

async function readFee(token: Address) {
  const response = await fetch(`/api/creator-fees/${token}`);
  if (!response.ok) throw new Error("Could not load rewards.");
  const body = (await response.json()) as FeeBody;
  const earned = /^\d+$/.test(body.earnedForToken ?? "")
    ? BigInt(body.earnedForToken ?? "0")
    : 0n;
  return {
    earned,
    usd: typeof body.usdValue === "number" ? body.usdValue : 0,
  };
}

function xAvatarUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.replace("_normal", "_bigger");
}
