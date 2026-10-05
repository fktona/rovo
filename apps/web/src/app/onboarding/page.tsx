"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { markOnboardingSeen } from "@/lib/onboarding";
import { AssetIcon, icons } from "@/components/home/assets";
import type { Address } from "viem";

export default function OnboardingPage() {
  const router = useRouter();
  const identity = useRovoIdentity();
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const toast = useToast();
  const wallet = identity.wallets[0]?.address as Address | undefined;

  const continueToApp = () => {
    if (identity.user?.id) markOnboardingSeen(identity.user.id);
    router.replace("/");
  };
  const linkX = async () => {
    setBusy(true);
    try {
      await identity.linkTwitter();
    } catch (cause) {
      toast.walletError(cause, "Could not link X. Try again.");
    } finally {
      setBusy(false);
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
      setVerified(true);
      toast.success("X ownership verified.");
    } catch (cause) {
      toast.walletError(cause, "X verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl items-start px-4 py-4 text-foreground sm:px-6 md:items-center md:justify-center md:py-10">
      <section className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-line bg-surface">
        <div className="border-b border-line px-5 py-4 md:px-9 md:py-5">
          <div className="flex items-center gap-3">
            <AssetIcon src={icons.logoMark} alt="" width={36} height={36} />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Welcome to TryFolio
            </span>
          </div>
        </div>
        <div className="px-5 py-6 md:px-9 md:py-12">
          <span className="inline-flex rounded-full border border-accent-border bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            01 / Make it yours
          </span>
          <h1 className="mt-5 max-w-lg text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Connect your X profile.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Linking X proves which profile belongs to you. It lets you launch
            your own token, scout a profile, and later claim a token someone
            scouted for you. You can explore TryFolio without linking now.
          </p>
          <div className="mt-8 rounded-2xl border border-line bg-surface-raised p-4 md:p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface md:bg-canvas">
                <AssetIcon src={icons.x} width={20} height={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">Your X account</h2>
                <p className="mt-1 text-sm text-muted">
                  {identity.xAccount
                    ? `Connected as @${identity.xAccount.username}`
                    : "No X account connected yet"}
                </p>
              </div>
              {identity.xAccount && (
                <span className="text-sm font-semibold text-accent">
                  Linked ✓
                </span>
              )}
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {!identity.xAccount ? (
              <button
                type="button"
                disabled={busy || !identity.ready}
                onClick={linkX}
                className="min-h-12 flex-1 rounded-xl bg-action px-5 font-semibold text-ink disabled:opacity-50"
              >
                {busy ? "Connecting…" : "Link X account"}
              </button>
            ) : !verified ? (
              <button
                type="button"
                disabled={busy}
                onClick={verify}
                className="min-h-12 flex-1 rounded-xl bg-action px-5 font-semibold text-ink disabled:opacity-50"
              >
                {busy
                  ? "Verifying…"
                  : wallet
                    ? "Verify ownership"
                    : "Connect wallet to verify"}
              </button>
            ) : (
              <button
                type="button"
                onClick={continueToApp}
                className="min-h-12 flex-1 rounded-xl bg-action px-5 font-semibold text-ink"
              >
                Continue to TryFolio
              </button>
            )}
            <button
              type="button"
              onClick={continueToApp}
              className="min-h-12 rounded-xl border border-line px-6 font-medium text-muted hover:text-foreground"
            >
              {identity.xAccount ? "Do this later" : "Skip for now"}
            </button>
          </div>
          <p className="mt-5 text-xs text-muted">
            Launching your own profile token or scouting one will require a
            linked X account even if you skip this step.
          </p>
        </div>
      </section>
    </main>
  );
}
