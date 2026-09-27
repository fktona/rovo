"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useToast } from "@/components/toast/toast-provider";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { useRovoActions } from "@/hooks/useRovoActions";
import {
  usePendingFees,
  useTokenBalance,
  useTokenInfo,
} from "@/hooks/useRovoQueries";
import { getPairChoice, pairChoices } from "@/lib/pairs";

const usdg = pairChoices.find((pair) => pair.symbol === "USDG")?.address;

function BalanceRow({
  asset,
  account,
  onWithdraw,
  busy,
}: {
  asset: Address;
  account?: Address;
  onWithdraw: (asset: Address) => void;
  busy: boolean;
}) {
  const balance = useTokenBalance(asset, account);
  const pending = usePendingFees(asset, account);
  const info = useTokenInfo(asset === zeroAddress ? undefined : asset);
  const label =
    getPairChoice(asset)?.symbol ?? (asset === zeroAddress ? "ETH" : "Token");
  const decimals = asset === zeroAddress ? 18 : info.data?.decimals;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#333] py-5">
      <div>
        <strong>{label}</strong>
        <p className="mt-1 text-sm text-[#888]">
          Wallet:{" "}
          {balance.data === undefined || decimals === undefined
            ? "—"
            : formatUnits(balance.data, decimals)}
        </p>
        <p className="text-sm text-[#888]">
          Claimable fees:{" "}
          {pending.data === undefined || decimals === undefined
            ? "—"
            : formatUnits(pending.data, decimals)}
        </p>
      </div>
      <button
        type="button"
        disabled={busy || !pending.data || pending.data === 0n}
        onClick={() => onWithdraw(asset)}
        className="rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
      >
        Withdraw fees
      </button>
    </div>
  );
}

export default function WalletPage() {
  const identity = useRovoIdentity();
  const wallet = identity.wallets[0]?.address as Address | undefined;
  const actions = useRovoActions(wallet);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const withdraw = async (asset: Address) => {
    if (!actions) return;
    setBusy(true);
    try {
      await actions.withdrawFees(asset);
      toast.success("Withdrawal confirmed.");
      await queryClient.invalidateQueries({ queryKey: ["rovo"] });
    } catch (cause) {
      toast.walletError(cause, "Withdrawal failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-white sm:px-6">
      <h1 className="text-3xl font-bold">Wallet</h1>
      <p className="mt-2 text-[#999]">Robinhood Chain assets and Rovo fees.</p>
      <section className="mt-7 rounded-2xl border border-[#333] bg-[#191919] p-6">
        {!identity.authenticated ? (
          <button
            type="button"
            onClick={() => identity.login()}
            className="rounded-xl bg-[#ccff00] px-6 py-3 font-semibold text-black"
          >
            Log in
          </button>
        ) : !wallet ? (
          <button
            type="button"
            onClick={() => identity.connectOrCreateWallet()}
            className="rounded-xl bg-[#ccff00] px-6 py-3 font-semibold text-black"
          >
            Connect wallet
          </button>
        ) : (
          <>
            <p className="mb-4 break-all text-sm text-[#aaa]">{wallet}</p>
            <BalanceRow
              asset={zeroAddress}
              account={wallet}
              busy={busy}
              onWithdraw={withdraw}
            />
            {usdg && (
              <BalanceRow
                asset={usdg}
                account={wallet}
                busy={busy}
                onWithdraw={withdraw}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
