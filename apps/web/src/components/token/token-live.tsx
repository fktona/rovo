"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
} from "viem";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { useRovoActions } from "@/hooks/useRovoActions";
import {
  useFeeAdmin,
  useLaunch,
  useNottinghamClaim,
  useOnchainLaunch,
  usePonsPhase,
  useRewardClaims,
  useTokenBalance,
  useTokenInfo,
  useAllowance,
} from "@/hooks/useRovoQueries";
import { useToast } from "@/components/toast/toast-provider";
import { useRovoContext } from "@/providers/RovoProviders";
import { getPairChoice } from "@/lib/pairs";

type Tab = "Activity" | "Rewards" | "Details";
const field =
  "mt-2 w-full rounded-xl border border-line bg-surface-raised px-4 py-3 text-foreground outline-none focus:border-accent";
const primary =
  "min-h-12 rounded-xl bg-action px-6 font-semibold text-ink disabled:opacity-50";
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export function TokenLive({ token }: { token: string }) {
  const valid = isAddress(token);
  const address = valid ? (token as Address) : undefined;
  const identity = useRovoIdentity();
  const { config } = useRovoContext();
  const queryClient = useQueryClient();
  const wallet = identity.wallets[0]?.address as Address | undefined;
  const actions = useRovoActions(wallet);
  const launch = useLaunch(address);
  const onchain = useOnchainLaunch(address);
  const phase = usePonsPhase(address);
  const tokenInfo = useTokenInfo(address);
  const pairToken = launch.data?.pairToken;
  const pairInfo = useTokenInfo(
    pairToken && pairToken !== zeroAddress ? pairToken : undefined,
  );
  const pair = pairToken ? getPairChoice(pairToken) : undefined;
  const balance = useTokenBalance(pairToken, wallet);
  const allowance = useAllowance(
    pairToken && pairToken !== zeroAddress ? pairToken : undefined,
    wallet,
    config.addresses.zapRouter,
  );
  const rewards = useRewardClaims(address, wallet);
  const vault = useNottinghamClaim(address);
  const isAdmin = useFeeAdmin(wallet);
  const [tab, setTab] = useState<Tab>("Activity");
  const [amount, setAmount] = useState("");
  const [minOutput, setMinOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const decimals = pairToken === zeroAddress ? 18 : pairInfo.data?.decimals;
  let amountWei = 0n;
  let minimumWei = 0n;
  try {
    if (amount && decimals !== undefined)
      amountWei = parseUnits(amount, decimals);
  } catch {}
  try {
    if (minOutput && tokenInfo.data)
      minimumWei = parseUnits(minOutput, tokenInfo.data.decimals);
  } catch {}
  const needsApproval =
    !!pairToken &&
    pairToken !== zeroAddress &&
    amountWei > 0n &&
    (allowance.data ?? 0n) < amountWei;

  const run = async (operation: () => Promise<unknown>, label: string) => {
    setBusy(true);
    try {
      await operation();
      toast.success(label);
      await queryClient.invalidateQueries({ queryKey: ["rovo"] });
    } catch (cause) {
      toast.walletError(cause, "Transaction failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!valid)
    return (
      <main className="p-8 text-foreground">
        Invalid token address.{" "}
        <Link href="/" className="text-accent">
          Return home
        </Link>
      </main>
    );
  if (launch.isLoading || onchain.isLoading)
    return (
      <main className="p-8 text-muted">
        Loading token from Pump…
      </main>
    );
  if (launch.isError || onchain.isError || !launch.data || !onchain.data)
    return (
      <main className="p-8 text-foreground">
        <h1 className="text-2xl font-bold">Token unavailable</h1>
        <p className="mt-3 text-muted">
          This token is not indexed yet, or the API/RPC is unavailable.
        </p>
        <Link href="/" className="mt-5 inline-block text-accent">
          Return home →
        </Link>
      </main>
    );

  const tokenName = `@${launch.data.handle}`;
  const phaseLabel =
    phase.data === 0
      ? "On launch curve"
      : phase.data === 1
        ? "Graduation pending"
        : phase.data === 2
          ? "Graduated"
          : "Loading phase…";
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 text-foreground sm:px-6 sm:pb-10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-action text-3xl font-bold text-ink">
          R
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">
              {tokenName}
            </h1>
            <span className="rounded-lg bg-surface-raised px-2 py-1 text-xs text-muted">
              {phaseLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {tokenInfo.data?.symbol
              ? `$${tokenInfo.data.symbol}`
              : short(token)}{" "}
            · {launch.data.launchType === "self" ? "Self-Rove" : "Scout launch"}
          </p>
        </div>
      </div>
      <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [
            "Pair asset",
            pair?.symbol ??
              (pairToken === zeroAddress ? "ETH" : short(pairToken ?? "")),
          ],
          ["Creator tax", `${launch.data.creatorTaxBps / 100}%`],
          ["Status", launch.data.claimed ? "Claimed" : "Unclaimed"],
          ["Network", "Solana"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <p className="text-xs text-muted">{label}</p>
            <strong className="mt-2 block truncate text-sm sm:text-base">
              {value}
            </strong>
          </div>
        ))}
      </section>
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-xl font-semibold">
          Buy {tokenInfo.data?.symbol ?? "profile token"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          Trade with the token’s actual pair asset. Enter your minimum
          acceptable token output to protect against slippage.
        </p>
        {phase.data === 1 && (
          <p className="mt-3 text-sm text-warning">
            Graduation is pending. Trading is paused until graduation completes.
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            You pay ({pair?.symbol ?? "pair asset"})
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className={field}
            />
          </label>
          <label className="text-sm">
            Minimum tokens received
            <input
              value={minOutput}
              onChange={(event) => setMinOutput(event.target.value)}
              inputMode="decimal"
              placeholder="Required"
              className={field}
            />
          </label>
        </div>
        {wallet && balance.data !== undefined && decimals !== undefined && (
          <p className="mt-3 text-xs text-muted">
            Your {pair?.symbol ?? "pair"} balance:{" "}
            {formatUnits(balance.data, decimals)}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {!identity.authenticated ? (
            <button
              type="button"
              onClick={() => identity.login()}
              className={primary}
            >
              Log in to trade
            </button>
          ) : !wallet ? (
            <button
              type="button"
              onClick={() => identity.connectOrCreateWallet()}
              className={primary}
            >
              Connect wallet
            </button>
          ) : needsApproval ? (
            <button
              type="button"
              disabled={busy || !actions}
              onClick={() =>
                run(
                  () =>
                    actions!.approveToken(
                      pairToken!,
                      config.addresses.zapRouter,
                      amountWei,
                    ),
                  "Approval confirmed. You can now buy.",
                )
              }
              className={primary}
            >
              {busy ? "Confirming…" : `Approve ${pair?.symbol ?? "pair asset"}`}
            </button>
          ) : (
            <button
              type="button"
              disabled={
                busy ||
                !actions ||
                !pairToken ||
                amountWei <= 0n ||
                minimumWei <= 0n ||
                phase.data === 1
              }
              onClick={() =>
                run(
                  () =>
                    actions!.buy({
                      profileToken: address!,
                      inputToken: pairToken!,
                      amountIn: amountWei,
                      minPairOut: amountWei,
                      minProfileOut: minimumWei,
                      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
                    }),
                  "Buy confirmed on-chain.",
                )
              }
              className={primary}
            >
              {busy ? "Confirming…" : "Buy"}
            </button>
          )}
        </div>
        <p className="mt-4 text-xs text-muted">
          Selling and price quotes are not yet available in Rovo. This form will
          not send a trade without a minimum output.
        </p>
      </section>
      <div className="mt-7 flex gap-6 border-b border-line">
        {(["Activity", "Rewards", "Details"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`border-b-2 pb-3 text-sm ${tab === value ? "border-accent text-foreground" : "border-transparent text-muted"}`}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "Activity" && (
        <section className="py-10 text-sm text-muted">
          Live trade activity is not indexed yet. Contract and reward
          information below comes from the Rovo API and chain.
        </section>
      )}
      {tab === "Rewards" && (
        <section className="space-y-4 py-6">
          <h2 className="text-lg font-semibold">Your rewards</h2>
          {!wallet ? (
            <p className="text-sm text-muted">
              Connect a wallet to check rewards.
            </p>
          ) : rewards.isLoading ? (
            <p className="text-sm text-muted">Loading proofs…</p>
          ) : rewards.isError ? (
            <p className="text-sm text-danger">
              Could not load reward proofs.
            </p>
          ) : rewards.data?.claims.length ? (
            rewards.data.claims.map((claim) => (
              <div
                key={claim.epochId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"
              >
                <span className="text-sm">
                  Epoch {claim.epochId} ·{" "}
                  {decimals === undefined
                    ? claim.amount
                    : formatUnits(BigInt(claim.amount), decimals)}{" "}
                  {pair?.symbol}
                </span>
                <button
                  type="button"
                  disabled={busy || !actions}
                  onClick={() =>
                    run(
                      () => actions!.claimReward(claim),
                      "Reward claimed on-chain.",
                    )
                  }
                  className={primary}
                >
                  Claim reward
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">
              No published claims for this wallet yet.
            </p>
          )}
        </section>
      )}
      {tab === "Details" && (
        <section className="space-y-3 py-6 text-sm">
          <div className="rounded-xl bg-surface p-4">
            <p className="text-muted">Contract</p>
            <a
              href={`https://robinhoodchain.blockscout.com/address/${token}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-accent"
            >
              {token}
            </a>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="text-muted">Pair contract</p>
            <p className="mt-2 break-all">{pairToken}</p>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="text-muted">Fee collector</p>
            <p className="mt-2 break-all">{launch.data.feeCollector}</p>
          </div>
          {!launch.data.claimed && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="font-semibold">Nottingham creator vault</h3>
              <p className="mt-2 text-muted">
                Pending balance: {vault.data?.balance?.toString() ?? "—"} base
                units. The real X owner can initiate a claim; finalization
                becomes available after the contract delay.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !actions || !identity.xAccount}
                  onClick={() =>
                    run(
                      () => actions!.initiateNottinghamClaim(address!),
                      "Claim initiated on-chain.",
                    )
                  }
                  className={primary}
                >
                  Initiate claim
                </button>
                {vault.data?.pending &&
                  vault.data.pending[0] !== zeroAddress && (
                    <button
                      type="button"
                      disabled={busy || !actions}
                      onClick={() =>
                        run(
                          () => actions!.finalizeNottinghamClaim(address!),
                          "Claim finalized on-chain.",
                        )
                      }
                      className="rounded-xl border border-line px-5"
                    >
                      Finalize claim
                    </button>
                  )}
              </div>
            </div>
          )}
          {isAdmin.data && (
            <div className="rounded-xl border border-warning-border bg-surface p-4">
              <h3 className="font-semibold">Admin fee routing</h3>
              <p className="mt-2 text-muted">
                Choose where the available collector fees go for this claim.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !actions}
                  onClick={() =>
                    run(
                      () => actions!.harvest(address!),
                      "Fees routed to splitter.",
                    )
                  }
                  className={primary}
                >
                  Route through splitter
                </button>
                <button
                  type="button"
                  disabled={busy || !actions}
                  onClick={() =>
                    run(
                      () => actions!.collectToTreasury(address!),
                      "Fees routed to treasury.",
                    )
                  }
                  className="rounded-xl border border-line px-5"
                >
                  Send to treasury
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
