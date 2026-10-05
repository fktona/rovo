"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCreateWallet, useWallets } from "@privy-io/react-auth/solana";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { CreatorIdentity } from "@/components/creator-identity";
import { useToast } from "@/components/toast/toast-provider";
import { ipfsUrl } from "@/lib/ipfs";

type PumpCoin = {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  launcherWallet: string | null;
};

export function ProfileLive() {
  const identity = useRovoIdentity();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const wallet = wallets[0];
  const handle = identity.xAccount?.username ?? undefined;
  const displayName =
    identity.xAccount?.name?.trim() || (handle ? `@${handle}` : "");
  const avatar = xAvatarUrl(identity.xAccount?.profilePictureUrl);
  const coins = useQuery({
    queryKey: ["pump-profile-coins", wallet?.address],
    enabled: !!wallet,
    queryFn: () => listLaunchedCoins(wallet!.address),
  });

  const linkX = async () => {
    try {
      await identity.linkTwitter();
    } catch (cause) {
      toast.walletError(cause, "Could not link X. Try again.");
    }
  };
  const create = async () => {
    setBusy(true);
    try {
      await createWallet();
    } catch (cause) {
      toast.walletError(cause, "Could not create a Solana wallet.");
    } finally {
      setBusy(false);
    }
  };
  const copyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <h1 className="text-[28px] font-bold tracking-[-0.6px] sm:text-3xl">
        Your profile
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Coins you launch trade on Pump. Creator fees from those coins accrue
        in the fee vault.
      </p>
      {!identity.authenticated ? (
        <div className="mt-6">
          <p className="text-sm text-muted">
            Log in to see your X account and the coins you launched.
          </p>
          <button
            type="button"
            onClick={() => identity.login()}
            className="mt-4 rounded-xl bg-action px-6 py-3 font-semibold text-ink"
          >
            Log in
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6">
            {handle ? <CreatorIdentity handle={handle} /> : null}
            {identity.xAccount && handle ? (
              <div className="flex items-center gap-3">
                <Avatar src={avatar} label={displayName || handle} round />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-bold">{displayName || handle}</p>
                  <p className="truncate text-sm text-muted">@{handle}</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-semibold">X account not linked</p>
                <p className="mt-1 text-sm text-muted">
                  Link X to show your name and launch a profile token.
                </p>
                <button
                  type="button"
                  onClick={() => void linkX()}
                  className="mt-4 rounded-xl bg-action px-5 py-3 text-sm font-semibold text-ink"
                >
                  Link X account
                </button>
              </div>
            )}
            {wallet ? (
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Solana wallet</p>
                  <p className="truncate text-sm font-medium">
                    {sliceAddress(wallet.address)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyWallet()}
                  className="shrink-0 text-sm font-semibold text-accent"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void create()}
                className="mt-4 text-sm font-semibold text-accent disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create Solana wallet"}
              </button>
            )}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Coins you launched</h2>
          {!wallet ? (
            <p className="py-6 text-sm text-muted">
              Create a Solana wallet to see coins launched from it.
            </p>
          ) : coins.isPending ? (
            <p className="py-6 text-sm text-muted">Loading coins…</p>
          ) : coins.isError ? (
            <p role="alert" className="py-6 text-sm text-danger">
              Could not load coins.
            </p>
          ) : coins.data.length === 0 ? (
            <div className="py-6">
              <p className="font-semibold">No coins yet</p>
              <p className="mt-1 text-sm text-muted">
                Launch a profile or a meme. Creator fees accrue in the fee vault.
              </p>
              <Link
                href="/launch"
                className="mt-4 inline-flex rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-ink"
              >
                Launch a token
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {coins.data.map((coin) => (
                <CoinRow key={coin.mint} coin={coin} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function CoinRow({ coin }: { coin: PumpCoin }) {
  const name = coin.name || coin.symbol || "Token";
  return (
    <Link
      href={`/token/${coin.mint}`}
      className="flex items-center gap-3 py-5 active:opacity-70"
    >
      <Avatar src={ipfsUrl(coin.imageUrl)} label={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{name}</p>
        <p className="truncate text-sm text-muted">
          {coin.symbol ? `$${coin.symbol}` : sliceAddress(coin.mint)}
        </p>
      </div>
    </Link>
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
      className={`flex size-14 shrink-0 items-center justify-center bg-surface-raised text-lg font-semibold uppercase ${shape}`}
    >
      {label.replace(/^[@$]/, "").slice(0, 1) || "?"}
    </span>
  );
}

async function listLaunchedCoins(wallet: string) {
  const base = process.env.NEXT_PUBLIC_ROVO_API_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("The Rovo API is not configured.");
  const response = await fetch(`${base}/v1/pump/coins?limit=100`);
  if (!response.ok) throw new Error("Could not load coins.");
  const body = (await response.json()) as { coins: PumpCoin[] };
  return body.coins.filter((coin) => coin.launcherWallet === wallet);
}

function xAvatarUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.replace("_normal", "_bigger");
}

function sliceAddress(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
