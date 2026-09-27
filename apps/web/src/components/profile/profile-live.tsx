"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zeroAddress, type Address } from "viem";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import {
  useLaunches,
  useOnchainLaunch,
  useTokenForHandle,
  useXAccount,
} from "@/hooks/useRovoQueries";
import { useToast } from "@/components/toast/toast-provider";
import { feeShareBps, splitFees } from "@/lib/fee-split";
import { formatUsd } from "@/lib/token-market";

type ShareRole = "creator" | "rover";

const NOMINAL_SHARE = { creator: 70, rover: 15 } as const;

type FeeBody = {
  earnedForToken?: string;
  usdValue?: number;
};

type MarketBody = {
  marketCapUsd?: number;
};

export function ProfileLive() {
  const identity = useRovoIdentity();
  const [tab, setTab] = useState<"profile" | "scout">("profile");
  const [ownershipVerified, setOwnershipVerified] = useState(false);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const wallet = identity.wallets[0]?.address as Address | undefined;
  const handle = identity.xAccount?.username ?? undefined;
  const x = useXAccount(handle);
  const tokenQuery = useTokenForHandle(handle);
  const launches = useLaunches(100);
  const profileToken =
    tokenQuery.data && tokenQuery.data !== zeroAddress
      ? tokenQuery.data
      : undefined;
  const verified = x.data?.verified === true || ownershipVerified;
  const displayName =
    x.data?.displayName?.trim() ||
    identity.xAccount?.name?.trim() ||
    (handle ? `@${handle}` : "");
  const avatar = xAvatarUrl(
    x.data?.imageUrl ?? identity.xAccount?.profilePictureUrl,
  );
  const scouts = (launches.data?.launches ?? []).filter(
    (launch) =>
      launch.launchType === "scout" &&
      !!wallet &&
      launch.rover?.toLowerCase() === wallet.toLowerCase(),
  );
  const profileMarket = useQuery({
    queryKey: ["rovo", "profile-market", profileToken?.toLowerCase()],
    enabled: !!profileToken,
    queryFn: () => readJson<MarketBody>(`/api/market/${profileToken}`),
    staleTime: 30_000,
  });
  const profileCap =
    typeof profileMarket.data?.marketCapUsd === "number"
      ? formatUsd(profileMarket.data.marketCapUsd)
      : null;

  const linkX = async () => {
    try {
      await identity.linkTwitter();
    } catch (cause) {
      toast.walletError(cause, "Could not link X. Try again.");
    }
  };
  const verify = async () => {
    setBusy(true);
    try {
      if (!wallet) {
        await identity.connectOrCreateWallet();
        return;
      }
      await identity.verifyX(wallet);
      setOwnershipVerified(true);
      toast.success("X ownership verified.");
    } catch (cause) {
      toast.walletError(cause, "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const face = handle ? (
    <IdentityFace
      name={displayName || handle}
      handle={handle}
      avatar={avatar}
      {...(typeof x.data?.followers === "number"
        ? { followers: x.data.followers }
        : {})}
      verified={verified}
      marketCap={profileCap}
      linked={!!profileToken}
    />
  ) : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-white sm:px-6 sm:py-8">
      <h1 className="text-[28px] font-bold tracking-[-0.6px] sm:text-3xl">
        Your profile
      </h1>
      {!identity.authenticated ? (
        <div className="mt-6">
          <p className="text-sm text-[#999]">
            Log in to see your X account, profile token, and scout fees.
          </p>
          <button
            type="button"
            onClick={() => identity.login()}
            className="mt-4 rounded-xl bg-[#ccff00] px-6 py-3 font-semibold text-black"
          >
            Log in
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6">
            {identity.xAccount && handle && face ? (
              profileToken ? (
                <Link
                  href={`/token/${profileToken}`}
                  aria-label={`Open ${displayName || handle} token`}
                  className="flex items-center gap-3 active:opacity-70"
                >
                  {face}
                </Link>
              ) : (
                <div className="flex items-center gap-3">{face}</div>
              )
            ) : (
              <div>
                <p className="font-semibold">X account not linked</p>
                <p className="mt-1 text-sm text-[#8a8a8a]">
                  Link X to show your name and launch a profile token.
                </p>
                <button
                  type="button"
                  onClick={() => void linkX()}
                  className="mt-4 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-semibold text-black"
                >
                  Link X account
                </button>
              </div>
            )}
            {identity.xAccount && !verified && (
              <button
                type="button"
                disabled={busy}
                onClick={verify}
                className="mt-4 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy
                  ? "Verifying…"
                  : wallet
                    ? "Verify X ownership"
                    : "Connect wallet to verify"}
              </button>
            )}
            {wallet ? (
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#8a8a8a]">Wallet</p>
                  <p className="truncate text-sm font-medium">
                    {sliceAddress(wallet)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyWallet}
                  className="shrink-0 text-sm font-semibold text-[#ccff00]"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => identity.connectOrCreateWallet()}
                className="mt-4 text-sm font-semibold text-[#ccff00]"
              >
                Connect wallet
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Fee allocations"
            className="mt-6 flex gap-6 border-b border-[#2a2a2a]"
          >
            {(
              [
                ["profile", "Profile"],
                ["scout", "Scout"],
              ] as const
            ).map(([id, label]) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${
                    selected
                      ? "border-[#ccff00] text-white"
                      : "border-transparent text-[#8a8a8a]"
                  }`}
                >
                  {label}
                  {id === "scout" && scouts.length > 0
                    ? ` · ${scouts.length}`
                    : ""}
                </button>
              );
            })}
          </div>

          {tab === "profile" ? (
            <div role="tabpanel">
              {tokenQuery.isPending ? (
                <p className="py-6 text-sm text-[#8a8a8a]">Loading your token…</p>
              ) : profileToken ? (
                <FeeShare token={profileToken} role="creator" />
              ) : (
                <EmptyTokens
                  title="No profile token yet"
                  body="Launch yourself and 70% of the creator fees are allocated to you."
                  action="Launch your token"
                />
              )}
            </div>
          ) : (
            <div role="tabpanel">
              {launches.isPending ? (
                <p className="py-6 text-sm text-[#8a8a8a]">
                  Loading scout tokens…
                </p>
              ) : scouts.length > 0 ? (
                <div className="divide-y divide-[#2a2a2a]">
                  {scouts.map((launch) => (
                    <ScoutToken key={launch.token} launch={launch} />
                  ))}
                </div>
              ) : (
                <EmptyTokens
                  title="No scout tokens yet"
                  body="Tokens you scout allocate 15% of creator fees to you."
                  action="Scout a profile"
                />
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function IdentityFace({
  name,
  handle,
  avatar,
  followers,
  verified,
  marketCap,
  linked,
}: {
  name: string;
  handle: string;
  avatar: string | null;
  followers?: number | null;
  verified: boolean;
  marketCap: string | null;
  linked: boolean;
}) {
  return (
    <>
      <Avatar src={avatar} label={name} round />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-xl font-bold">
          <span className="truncate">{name}</span>
          {verified ? <VerifiedMark /> : null}
        </p>
        <p className="truncate text-sm text-[#8a8a8a]">
          @{handle}
          {followers != null ? ` · ${formatFollowers(followers)} followers` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {marketCap ? (
          <p className="text-sm font-semibold text-[#ccff00]">{marketCap}</p>
        ) : null}
        {linked ? <Chevron /> : null}
      </div>
    </>
  );
}

function ScoutToken({
  launch,
}: {
  launch: {
    token: Address;
    handle: string;
    displayName: string | null;
    imageUrl: string | null;
  };
}) {
  const market = useQuery({
    queryKey: ["rovo", "profile-market", launch.token.toLowerCase()],
    queryFn: () => readJson<MarketBody>(`/api/market/${launch.token}`),
    staleTime: 30_000,
  });
  const marketCap =
    typeof market.data?.marketCapUsd === "number"
      ? formatUsd(market.data.marketCapUsd)
      : null;
  const name = launch.displayName || `@${launch.handle}`;
  return (
    <section className="py-5">
      <Link
        href={`/token/${launch.token}`}
        aria-label={`Open ${name} token`}
        className="flex items-center gap-3 active:opacity-70"
      >
        <Avatar src={xAvatarUrl(launch.imageUrl)} label={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{name}</p>
          <p className="truncate text-sm text-[#8a8a8a]">@{launch.handle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {marketCap ? (
            <p className="text-sm font-semibold text-[#ccff00]">{marketCap}</p>
          ) : null}
          <Chevron />
        </div>
      </Link>
      <FeeShare token={launch.token} role="rover" />
    </section>
  );
}

function FeeShare({ token, role }: { token: Address; role: ShareRole }) {
  const chain = useOnchainLaunch(token);
  const fees = useQuery({
    queryKey: ["rovo", "creator-fees", token.toLowerCase()],
    queryFn: () => readJson<FeeBody>(`/api/creator-fees/${token}`),
  });
  const earned = /^\d+$/.test(fees.data?.earnedForToken ?? "")
    ? BigInt(fees.data?.earnedForToken ?? "0")
    : 0n;
  const launch = chain.data;
  const split =
    launch && earned > 0n
      ? splitFees(earned, {
          launchType: Number(launch.launchType) === 1 ? "self" : "scout",
          claimed: launch.claimed,
          shareWithHolders: launch.shareWithHolders,
          creatorToHoldersBps: Number(launch.creatorToHoldersBps),
          launchedAt: Number(launch.launchedAt),
          now: Math.floor(Date.now() / 1000),
        })
      : null;
  const part = split ? (role === "creator" ? split.creator : split.rover) : 0n;
  const percent =
    split && earned > 0n
      ? Math.round(feeShareBps(part, earned) / 100)
      : NOMINAL_SHARE[role];
  const usd =
    typeof fees.data?.usdValue === "number"
      ? fees.data.usdValue
      : fees.isSuccess
        ? 0
        : null;
  const shareUsd =
    usd == null ? null : earned > 0n ? portionUsd(part, earned, usd) : 0;

  return (
    <div className="pt-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[#8a8a8a]">Creator fees</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(usd)}</p>
        </div>
        <div>
          <p className="text-xs text-[#8a8a8a]">Your share · {percent}%</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#ccff00]">
            {money(shareUsd)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[#8a8a8a]">
        {percent}% of fees is allocated to you.
      </p>
      <button
        type="button"
        disabled
        className="mt-4 h-12 w-full cursor-not-allowed rounded-xl bg-[#1c1c1c] text-sm font-semibold text-[#6a6a6a]"
      >
        Claim
      </button>
    </div>
  );
}

function EmptyTokens({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: string;
}) {
  return (
    <div className="py-8">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[#8a8a8a]">{body}</p>
      <Link
        href="/launch"
        className="mt-4 inline-flex rounded-xl bg-[#ccff00] px-4 py-2.5 text-sm font-semibold text-black"
      >
        {action}
      </Link>
    </div>
  );
}

function Avatar({
  src,
  label,
  round = false,
}: {
  src: string | null;
  label: string;
  round?: boolean;
}) {
  const shape = round ? "rounded-full" : "rounded-[10px]";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={`size-14 shrink-0 object-cover ${shape}`}
      />
    );
  }
  return (
    <span
      className={`flex size-14 shrink-0 items-center justify-center bg-[#2a2a2a] text-lg font-semibold uppercase ${shape}`}
    >
      {label.replace(/^@/, "").slice(0, 1) || "?"}
    </span>
  );
}

function VerifiedMark() {
  return (
    <span
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0]"
      title="Verified"
      aria-label="Verified"
    >
      <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
        <path
          d="M2.2 6.2 4.6 8.6 9.8 3.4"
          fill="none"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-[#8a8a8a]">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function money(value: number | null) {
  if (value == null) return "—";
  if (value === 0) return "$0.00";
  return formatUsd(value);
}

function portionUsd(part: bigint, total: bigint, usd: number) {
  if (total <= 0n || !Number.isFinite(usd)) return null;
  const micro = (part * 1_000_000n) / total;
  return (Number(micro) / 1_000_000) * usd;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load token data.");
  return response.json() as Promise<T>;
}

function xAvatarUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.replace("_normal", "_bigger");
}

function formatFollowers(count: number) {
  if (count >= 1_000_000) return `${trimCount(count / 1_000_000)}M`;
  if (count >= 1_000) return `${trimCount(count / 1_000)}K`;
  return count.toLocaleString("en-US");
}

function trimCount(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function sliceAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
