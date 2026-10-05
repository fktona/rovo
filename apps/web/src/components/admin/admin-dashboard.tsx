"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

type PumpCoin = {
  mint: string;
  name: string | null;
  symbol: string | null;
  launcherWallet: string | null;
  createdAt: string;
};

const panel = "rounded-[24px] border border-line bg-surface";

export function AdminDashboard() {
  const feeVault = process.env.NEXT_PUBLIC_PUMP_FEE_WALLET?.trim() || null;
  const coins = useQuery({
    queryKey: ["pump-admin-coins"],
    queryFn: listCoins,
  });

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-7 text-foreground sm:px-7 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-line pb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.24em] text-accent">Rovo operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Admin</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Coins launched on Pump, on Solana mainnet. Creator fees accrue in the fee vault.
          </p>
        </div>
        <span className="rounded-full border border-accent-border bg-accent-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-[.15em] text-accent">
          Solana mainnet
        </span>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className={`${panel} p-5`}>
          <p className="text-xs uppercase tracking-[.16em] text-muted">Fee vault</p>
          {feeVault ? (
            <a
              className="mt-3 inline-block break-all font-mono text-sm font-semibold text-accent"
              href={`https://solscan.io/account/${feeVault}`}
              target="_blank"
              rel="noreferrer"
            >
              {feeVault}
            </a>
          ) : (
            <p className="mt-3 text-sm text-muted">Not configured.</p>
          )}
          <Link href="/rewards" className="mt-4 inline-flex text-sm font-semibold text-accent">
            Open rewards →
          </Link>
        </div>
        <div className={`${panel} p-5`}>
          <p className="text-xs uppercase tracking-[.16em] text-muted">Coins</p>
          <p className="mt-3 text-2xl font-semibold">
            {coins.isPending ? "—" : coins.data?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted">Saved Pump mints</p>
        </div>
      </div>

      <section className={`${panel} mt-6 p-5 sm:p-6`}>
        <h2 className="text-lg font-semibold">Launches</h2>
        {coins.isPending ? (
          <p className="mt-4 text-sm text-muted">Loading coins…</p>
        ) : coins.isError ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            Could not load coins.
          </p>
        ) : coins.data.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No coins saved yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-line">
            {coins.data.map((coin) => (
              <Link
                key={coin.mint}
                href={`/token/${coin.mint}`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {coin.name || "Token"}
                    {coin.symbol ? <span className="ml-2 text-muted">${coin.symbol}</span> : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted">{coin.mint}</p>
                </div>
                <p className="shrink-0 text-xs text-muted">
                  {coin.launcherWallet ? `${coin.launcherWallet.slice(0, 4)}…${coin.launcherWallet.slice(-4)}` : "—"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

async function listCoins() {
  const base = process.env.NEXT_PUBLIC_ROVO_API_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("The Rovo API is not configured.");
  const response = await fetch(`${base}/v1/pump/coins?limit=100`);
  if (!response.ok) throw new Error("Could not load coins.");
  const body = (await response.json()) as { coins: PumpCoin[] };
  return body.coins;
}
