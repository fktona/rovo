"use client";

import Link from "next/link";
import { useState } from "react";
import { useCreateWallet, useWallets } from "@privy-io/react-auth/solana";
import { useToast } from "@/components/toast/toast-provider";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";

export default function WalletPage() {
  const identity = useRovoIdentity();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const wallet = wallets[0];

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
  const copy = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-foreground sm:px-6">
      <h1 className="text-3xl font-bold">Wallet</h1>
      <p className="mt-2 text-muted">Your Solana wallet on mainnet.</p>
      <section className="mt-7 rounded-2xl border border-line bg-surface p-6">
        {!identity.authenticated ? (
          <button
            type="button"
            onClick={() => identity.login()}
            className="rounded-xl bg-action px-6 py-3 font-semibold text-ink"
          >
            Log in
          </button>
        ) : !wallet ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="rounded-xl bg-action px-6 py-3 font-semibold text-ink disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Solana wallet"}
          </button>
        ) : (
          <>
            <p className="text-xs text-muted">Solana wallet</p>
            <p className="mt-2 break-all font-medium">{wallet.address}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
              <button type="button" onClick={() => void copy()} className="text-accent">
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                className="text-accent"
                href={`https://solscan.io/account/${wallet.address}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Solscan
              </a>
            </div>
          </>
        )}
      </section>
      <p className="mt-6 max-w-xl text-sm leading-6 text-muted">
        Creator fees from coins launched on TryFolio accrue in the fee vault.
        <Link href="/rewards" className="ml-1 text-accent">
          Rewards
        </Link>{" "}
        shows what is waiting there.
      </p>
    </main>
  );
}
