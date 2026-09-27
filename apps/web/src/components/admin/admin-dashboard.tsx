"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, isAddress, zeroAddress, type Address, type TransactionReceipt } from "viem";
import { useRovoActions } from "@/hooks/useRovoActions";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import {
  useFeeAdmin,
  useFeeEscrowBalance,
  useLaunches,
  useOnchainLaunch,
  useTokenInfo,
  useTreasury,
} from "@/hooks/useRovoQueries";
import { useToast } from "@/components/toast/toast-provider";
import { useRovoContext } from "@/providers/RovoProviders";
import { robinhoodChain } from "@/lib/chain";

type Route = "splitter" | "treasury";

const panel = "rounded-[24px] border border-[#303030] bg-[#191919]";
const muted = "text-[#999]";

function shortAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function amountLabel(amount: bigint, decimals: number, symbol: string) {
  const full = formatUnits(amount, decimals);
  const [whole, fraction = ""] = full.split(".");
  const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
  return `${whole}${trimmed ? `.${trimmed}` : ""}${fraction.length > 6 && /[1-9]/.test(fraction.slice(6)) ? "+" : ""} ${symbol}`;
}

export function AdminDashboard() {
  const identity = useRovoIdentity();
  const toast = useToast();
  const { reads } = useRovoContext();
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState<Address | undefined>();
  const selectedWallet = walletAddress && identity.wallets.some((wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase())
    ? walletAddress
    : identity.wallets[0]?.address as Address | undefined;
  const admin = useFeeAdmin(selectedWallet);
  const actions = useRovoActions(selectedWallet);
  const launches = useLaunches();
  const treasury = useTreasury();
  const [customAddress, setCustomAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState<Address | undefined>();
  const [pendingRoute, setPendingRoute] = useState<Route | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ hash: string; route: Route } | null>(null);

  const knownLaunches = launches.data?.launches ?? [];
  const activeToken = selectedToken ?? knownLaunches[0]?.token;
  const selected = knownLaunches.find((item) => item.token.toLowerCase() === activeToken?.toLowerCase());
  const onchain = useOnchainLaunch(admin.data ? activeToken : undefined);
  const collectorBinding = useQuery({
    queryKey: ["rovo", "chain", "collector-binding", onchain.data?.feeCollector.toLowerCase()],
    queryFn: () => reads.collectorToken(onchain.data!.feeCollector),
    enabled: !!admin.data && !!onchain.data && onchain.data.feeCollector !== zeroAddress,
  });
  const escrow = useFeeEscrowBalance(admin.data && onchain.data?.token !== zeroAddress ? activeToken : undefined);
  const pair = onchain.data?.pairToken;
  const pairInfo = useTokenInfo(admin.data && pair && pair !== zeroAddress ? pair : undefined);
  const quoteSymbol = pair === zeroAddress ? "ETH" : pairInfo.data?.symbol ?? "tokens";
  const quoteDecimals = pair === zeroAddress ? 18 : pairInfo.data?.decimals ?? 18;
  const collectorMatches = !!onchain.data && !!activeToken && onchain.data.token.toLowerCase() === activeToken.toLowerCase()
    && collectorBinding.data?.toLowerCase() === activeToken.toLowerCase()
    && (!selected || selected.feeCollector.toLowerCase() === onchain.data.feeCollector.toLowerCase());
  const claimable = escrow.data ?? 0n;
  const canRoute = !!admin.data && collectorMatches && !!actions && claimable > 0n && !busy && !escrow.isFetching;

  const walletOptions = useMemo(() => identity.wallets.filter((wallet) => wallet.type === "ethereum"), [identity.wallets]);

  function selectToken(token: Address) {
    setSelectedToken(token);
    setPendingRoute(null);
    setSuccess(null);
  }

  async function confirmRoute() {
    if (!pendingRoute || !activeToken || !canRoute || !actions) return;
    const route = pendingRoute;
    setPendingRoute(null);
    setBusy(true);
    setSuccess(null);
    try {
      const receipt: TransactionReceipt = route === "splitter"
        ? await actions.harvest(activeToken)
        : await actions.collectToTreasury(activeToken);
      setSuccess({ hash: receipt.transactionHash, route });
      toast.success(route === "splitter" ? "Fees released to the splitter." : "Fees sent to treasury.");
      await queryClient.invalidateQueries({ queryKey: ["rovo"] });
    } catch (cause) {
      toast.walletError(cause, "The transaction could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-7 text-white sm:px-7 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#303030] pb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.24em] text-[#ccff00]">Rovo operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Admin console</h1>
          <p className={`mt-3 max-w-2xl text-sm leading-6 ${muted}`}>
            Review launch fees and choose where each collection goes. Every release is an on-chain transaction.
          </p>
        </div>
        <span className="rounded-full border border-[#3b4721] bg-[#242c13] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.15em] text-[#ccff00]">
          Robinhood Chain
        </span>
      </div>

      {!identity.ready ? (
        <p className={`mt-8 ${muted}`}>Checking your wallet…</p>
      ) : !identity.authenticated ? (
        <div className={`${panel} mt-8 max-w-xl p-7`}>
          <h2 className="text-xl font-semibold">Sign in to continue</h2>
          <p className={`mt-2 text-sm leading-6 ${muted}`}>Admin permissions are checked against the fee splitter contract.</p>
          <button onClick={() => identity.login()} className="mt-6 rounded-xl bg-[#ccff00] px-6 py-3 font-semibold text-black">Log in</button>
        </div>
      ) : !selectedWallet ? (
        <div className={`${panel} mt-8 max-w-xl p-7`}>
          <h2 className="text-xl font-semibold">Connect an admin wallet</h2>
          <p className={`mt-2 text-sm leading-6 ${muted}`}>Use the wallet that holds the fee splitter admin role.</p>
          <button onClick={() => identity.connectOrCreateWallet()} className="mt-6 rounded-xl bg-[#ccff00] px-6 py-3 font-semibold text-black">Connect wallet</button>
        </div>
      ) : admin.isLoading ? (
        <p className={`mt-8 ${muted}`}>Checking on-chain admin permission…</p>
      ) : admin.isError ? (
        <div role="alert" className={`${panel} mt-8 max-w-xl p-7 text-[#ffaaaa]`}>Could not verify the admin role. Check the Robinhood RPC connection and try again.</div>
      ) : !admin.data ? (
        <div className={`${panel} mt-8 max-w-xl p-7`}>
          <h2 className="text-xl font-semibold">No admin access</h2>
          <p className={`mt-2 text-sm leading-6 ${muted}`}>
            {shortAddress(selectedWallet)} does not hold the fee splitter admin role. Connect the authorized wallet to manage fees.
          </p>
          {walletOptions.length > 1 && (
            <select value={selectedWallet} onChange={(event) => setWalletAddress(event.target.value as Address)} className="mt-5 w-full rounded-xl border border-[#444] bg-[#222] p-3 text-sm">
              {walletOptions.map((wallet) => <option key={wallet.address} value={wallet.address}>{wallet.address}</option>)}
            </select>
          )}
          <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-[#ccff00]">Back to home →</Link>
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className={`${panel} p-5`}>
              <p className="text-xs uppercase tracking-[.16em] text-[#999]">Admin wallet</p>
              <p className="mt-3 font-mono text-lg font-semibold">{shortAddress(selectedWallet)}</p>
              {walletOptions.length > 1 && (
                <select aria-label="Admin wallet" value={selectedWallet} onChange={(event) => setWalletAddress(event.target.value as Address)} className="mt-3 w-full rounded-lg border border-[#444] bg-[#242424] p-2 text-xs">
                  {walletOptions.map((wallet) => <option key={wallet.address} value={wallet.address}>{wallet.address}</option>)}
                </select>
              )}
            </div>
            <div className={`${panel} p-5`}>
              <p className="text-xs uppercase tracking-[.16em] text-[#999]">Tracked launches</p>
              <p className="mt-3 text-2xl font-semibold">{launches.isLoading ? "—" : knownLaunches.length}</p>
              <p className="mt-1 text-xs text-[#777]">Latest {knownLaunches.length} from the API</p>
            </div>
            <div className={`${panel} p-5`}>
              <p className="text-xs uppercase tracking-[.16em] text-[#999]">Treasury destination</p>
              <p className="mt-3 break-all font-mono text-sm font-semibold">{treasury.data ?? "Checking…"}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
            <section className={`${panel} min-w-0 p-5 sm:p-6`} aria-labelledby="launches-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="launches-heading" className="text-lg font-semibold">Launches</h2>
                <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["rovo"] })} className="text-sm font-medium text-[#ccff00]">Refresh</button>
              </div>
              <p className={`mt-1 text-sm ${muted}`}>Select a token to inspect its unclaimed fees.</p>
              <div className="mt-5 flex gap-2">
                <input aria-label="Token contract address" value={customAddress} onChange={(event) => setCustomAddress(event.target.value.trim())} placeholder="Paste token address" className="min-w-0 flex-1 rounded-xl border border-[#414141] bg-[#222] px-3 py-3 font-mono text-xs outline-none focus:border-[#ccff00]" />
                <button type="button" disabled={!isAddress(customAddress)} onClick={() => { selectToken(customAddress as Address); setCustomAddress(""); }} className="rounded-xl bg-[#ccff00] px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Open</button>
              </div>
              {launches.isError && <p role="alert" className="mt-4 text-sm text-[#ffaaaa]">Could not load the launch list. You can still paste a token address above.</p>}
              <div className="mt-5 max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {launches.isLoading && <p className={`py-5 text-sm ${muted}`}>Loading launches…</p>}
                {!launches.isLoading && knownLaunches.length === 0 && <p className={`py-5 text-sm ${muted}`}>No launches in the API yet.</p>}
                {knownLaunches.map((launch) => (
                  <button key={launch.token} type="button" onClick={() => selectToken(launch.token)} aria-pressed={activeToken?.toLowerCase() === launch.token.toLowerCase()} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left ${activeToken?.toLowerCase() === launch.token.toLowerCase() ? "border-[#ccff00] bg-[#242c13]" : "border-[#353535] bg-[#222] hover:border-[#666]"}`}>
                    <span className="min-w-0"><span className="block truncate font-semibold">@{launch.handle}</span><span className="mt-1 block font-mono text-xs text-[#999]">{shortAddress(launch.token)}</span></span>
                    <span className="shrink-0 rounded-full border border-[#454545] px-2.5 py-1 text-xs capitalize text-[#aaa]">{launch.launchType}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={`${panel} min-w-0 p-5 sm:p-6`} aria-labelledby="routing-heading">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.15em] text-[#ccff00]">Fee release</p>
                  <h2 id="routing-heading" className="mt-1 text-xl font-semibold">{selected ? `@${selected.handle}` : activeToken ? shortAddress(activeToken) : "Select a launch"}</h2>
                </div>
                {activeToken && <Link href={`/token/${activeToken}`} className="text-sm font-semibold text-[#ccff00]">View token ↗</Link>}
              </div>
              {!activeToken ? (
                <p className={`mt-8 text-sm ${muted}`}>Choose a launch from the list or paste its contract address.</p>
              ) : onchain.isLoading || collectorBinding.isLoading ? (
                <p className={`mt-8 text-sm ${muted}`}>Verifying the launch on-chain…</p>
              ) : onchain.isError || collectorBinding.isError || !collectorMatches ? (
                <p role="alert" className="mt-8 text-sm text-[#ffaaaa]">This address is not a valid Rovo launch or its collector does not match the registry. No fee action is available.</p>
              ) : (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#383838] bg-[#222] p-4">
                      <p className="text-xs uppercase tracking-[.13em] text-[#999]">Claimable from Pons escrow</p>
                      <p className="mt-2 text-2xl font-semibold text-[#ccff00]">{escrow.isLoading ? "Checking…" : escrow.isError ? "Unavailable" : amountLabel(claimable, quoteDecimals, quoteSymbol)}</p>
                    </div>
                    <div className="rounded-xl border border-[#383838] bg-[#222] p-4">
                      <p className="text-xs uppercase tracking-[.13em] text-[#999]">Collector</p>
                      <p className="mt-3 break-all font-mono text-sm">{onchain.data.feeCollector}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#888]">Funds remain in the Pons escrow until an admin chooses a route. Fees arriving later require another release.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col rounded-xl border border-[#424242] bg-[#202020] p-4">
                      <h3 className="font-semibold">Split through Rovo</h3>
                      <p className={`mt-2 flex-1 text-sm leading-5 ${muted}`}>Claim the current fees and distribute them under the fee splitter’s on-chain rules.</p>
                      <button type="button" disabled={!canRoute} onClick={() => setPendingRoute("splitter")} className="mt-5 rounded-xl bg-[#ccff00] px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Release to splitter</button>
                    </div>
                    <div className="flex flex-col rounded-xl border border-[#424242] bg-[#202020] p-4">
                      <h3 className="font-semibold">Send to treasury</h3>
                      <p className={`mt-2 flex-1 text-sm leading-5 ${muted}`}>Claim the current fees directly to the configured treasury for manual allocation. This bypasses the splitter.</p>
                      <button type="button" disabled={!canRoute || !treasury.data} onClick={() => setPendingRoute("treasury")} className="mt-5 rounded-xl border border-[#ccff00] px-4 py-3 text-sm font-semibold text-[#ccff00] disabled:cursor-not-allowed disabled:opacity-40">Send to treasury</button>
                    </div>
                  </div>
                  {escrow.data === 0n && <p className={`mt-4 text-sm ${muted}`}>There are no claimable fees for this launch right now.</p>}
                </>
              )}
              {busy && <p role="status" className="mt-5 text-sm text-[#ccff00]">Waiting for wallet and chain confirmation…</p>}
              {success && <p role="status" className="mt-5 rounded-xl border border-[#50612a] bg-[#242c13] p-3 text-sm text-[#ccff00]">Fee release confirmed to {success.route === "splitter" ? "the splitter" : "treasury"}. <a className="underline" href={`${robinhoodChain.blockExplorers.default.url}/tx/${success.hash}`} target="_blank" rel="noreferrer">View transaction ↗</a></p>}
            </section>
          </div>
        </>
      )}

      {pendingRoute && activeToken && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingRoute(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" className="w-full max-w-md rounded-[24px] border border-[#454545] bg-[#1c1c1c] p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[.17em] text-[#ccff00]">Confirm on-chain action</p>
            <h2 id="admin-confirm-title" className="mt-2 text-xl font-semibold">{pendingRoute === "splitter" ? "Release to Rovo splitter?" : "Send fees to treasury?"}</h2>
            <p className="mt-4 text-sm leading-6 text-[#aaa]">This will claim approximately <span className="font-semibold text-white">{amountLabel(claimable, quoteDecimals, quoteSymbol)}</span> for {selected ? `@${selected.handle}` : shortAddress(activeToken)}.</p>
            {pendingRoute === "treasury" && <p className="mt-3 break-all rounded-lg bg-[#292929] p-3 font-mono text-xs text-[#ddd]">Destination: {treasury.data}</p>}
            <p className="mt-3 text-xs leading-5 text-[#888]">The amount can change before confirmation. This transaction cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPendingRoute(null)} className="flex-1 rounded-xl border border-[#555] px-4 py-3 text-sm font-semibold">Cancel</button>
              <button type="button" disabled={!canRoute} onClick={() => void confirmRoute()} className="flex-1 rounded-xl bg-[#ccff00] px-4 py-3 text-sm font-semibold text-black disabled:opacity-40">Confirm release</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
