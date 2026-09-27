"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decodeEventLog,
  formatUnits,
  parseUnits,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { wrapperAbi } from "@/lib/contracts/abis";
import { pairChoices, type PairChoice } from "@/lib/pairs";
import { normalizeHandle } from "@/lib/validation";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { useRovoActions } from "@/hooks/useRovoActions";
import {
  useLaunchFee,
  useTokenForHandle,
  useXAccount,
  useXSearch,
} from "@/hooks/useRovoQueries";
import type { XAccountView } from "@/lib/api";
import { useToast } from "@/components/toast/toast-provider";
import { useRovoContext } from "@/providers/RovoProviders";
import { minTokensAtSlippage, quoteOpeningBuy } from "@/lib/contracts/curve-quote";
import { formatQuoteAmount, quoteEthForToken } from "@/lib/contracts/uniswap";
import { formatPriceUsd, formatUsd } from "@/lib/token-market";
import type { TokenMetadata } from "@/lib/contracts/types";

type Mode = "self" | "scout";
type PairKind = "all" | "xstocks" | "crypto";

const LAUNCH_CONFIG_ID = 0;
const CREATOR_TAX_BPS = 200;
const BUY_PRESETS = ["0.05", "0.1", "1", "5"] as const;
const ETH_BUY_PRESETS = ["0.001", "0.01", "0.05", "0.1"] as const;
const CRYPTO_SYMBOLS = new Set(["ETH", "USDG"]);
const STEPS = ["Identity", "Pair", "First Buy", "Review"] as const;

const continueButton =
  "flex h-[53px] min-w-0 flex-1 items-center justify-center rounded-[10px] bg-[#ccff00] text-base font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45";

function parseAmount(amount: string, decimals: number) {
  try {
    const value = parseUnits(amount.trim(), decimals);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

function queryText(value: string) {
  return value.trim().replace(/^@+/, "");
}

function safeHandle(value: string) {
  try {
    return normalizeHandle(value);
  } catch {
    return undefined;
  }
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

function isCryptoPair(symbol: string) {
  return CRYPTO_SYMBOLS.has(symbol);
}

type ExistingMarket = {
  available?: boolean;
  marketCapUsd?: number;
  priceUsd?: number | null;
};

type ExistingFee = {
  earnedForToken?: string;
  quoteAsset?: { symbol?: string; decimals?: number };
  usdValue?: number;
};

function formatExistingFee(fee: ExistingFee) {
  if (typeof fee.usdValue === "number") return formatUsd(fee.usdValue);
  return "—";
}

function ExistingTokenDetails({ token }: { token: Address }) {
  const [market, setMarket] = useState<ExistingMarket | null>(null);
  const [fee, setFee] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setMarket(null);
    setFee(null);
    void Promise.all([
      fetch(`/api/market/${token}`).then((response) =>
        response.ok ? response.json() : null,
      ),
      fetch(`/api/creator-fees/${token}`).then((response) =>
        response.ok ? response.json() : null,
      ),
    ])
      .then(([marketBody, feeBody]: [ExistingMarket | null, ExistingFee | null]) => {
        if (cancelled) return;
        setMarket(marketBody ?? { available: false });
        setFee(feeBody ? formatExistingFee(feeBody) : "—");
      })
      .catch(() => {
        if (!cancelled) {
          setMarket({ available: false });
          setFee("—");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  const stats = [
    ["MCAP", market == null ? null : typeof market.marketCapUsd === "number" ? formatUsd(market.marketCapUsd) : "—"],
    ["Price", market == null ? null : typeof market.priceUsd === "number" ? formatPriceUsd(market.priceUsd) : "—"],
    ["Creator fee", fee],
  ] as const;
  return (
    <div className="mt-6 grid grid-cols-3 gap-3" aria-busy={market == null || fee == null}>
      {stats.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs text-[#737373]">{label}</p>
          {value == null ? (
            <span className="shimmer mt-2 block h-4 w-16 rounded" />
          ) : (
            <p className="mt-1 text-sm font-semibold text-[#ccff00]">{value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

type LaunchedToken = {
  name: string;
  symbol: string;
  mint: Address | null;
  txHash: Hex;
};

function tokenFromReceipt(receipt: TransactionReceipt): Address | null {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: wrapperAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "RovoLaunchCreated") return decoded.args.token;
    } catch {
      continue;
    }
  }
  return null;
}

export function LaunchLive() {
  const router = useRouter();
  const identity = useRovoIdentity();
  const { api, reads, config, publicClient } = useRovoContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const wallet = identity.wallets[0]?.address as Address | undefined;
  const actions = useRovoActions(wallet);
  const [mode, setMode] = useState<Mode>("self");
  const [step, setStep] = useState(1);
  const [scoutQuery, setScoutQuery] = useState("");
  const [scoutProfile, setScoutProfile] = useState<XAccountView | null>(null);
  const [debouncedScout, setDebouncedScout] = useState("");
  const [search, setSearch] = useState("");
  const [pairKind, setPairKind] = useState<PairKind>("all");
  const [pairToken, setPairToken] = useState<Address | undefined>();
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingAsset, setOpeningAsset] = useState<"pair" | "eth">("eth");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Confirming…");
  const [error, setError] = useState("");
  const [launched, setLaunched] = useState<LaunchedToken | null>(null);
  const fee = useLaunchFee();
  const ownHandle = identity.xAccount?.username ?? "";
  const scoutText = queryText(scoutQuery);
  const scoutSelected =
    scoutProfile != null && scoutText.toLowerCase() === scoutProfile.handle;
  const targetHandle = mode === "self" ? ownHandle : (scoutProfile?.handle ?? "");
  const handle = safeHandle(targetHandle);
  const xProfile = useXAccount(handle);
  const xSearch = useXSearch(
    mode === "scout" && !scoutSelected ? debouncedScout : undefined,
  );
  const existing = useTokenForHandle(handle);
  const displayName =
    xProfile.data?.displayName?.trim() ||
    (mode === "self"
      ? identity.xAccount?.name?.trim()
      : scoutProfile?.displayName?.trim()) ||
    handle ||
    "";
  const symbol = handle ?? "";
  const avatar = xAvatarUrl(
    xProfile.data?.imageUrl ||
      (mode === "self"
        ? identity.xAccount?.profilePictureUrl
        : scoutProfile?.imageUrl),
  );
  const followers =
    xProfile.data?.followers ??
    (mode === "scout" ? (scoutProfile?.followers ?? null) : null);
  const visiblePairs = useMemo(() => {
    const query = search.toLowerCase().trim();
    return pairChoices.filter((pair) => {
      const kindMatches =
        pairKind === "all" ||
        (pairKind === "crypto"
          ? isCryptoPair(pair.symbol)
          : !isCryptoPair(pair.symbol));
      const textMatches = `${pair.symbol} ${pair.name}`
        .toLowerCase()
        .includes(query);
      return kindMatches && textMatches;
    });
  }, [pairKind, search]);
  const selectedPair = pairChoices.find(
    (pair) => pair.address.toLowerCase() === pairToken?.toLowerCase(),
  );
  const openingValue = Number(openingAmount);
  const hasOpeningBuy =
    openingAmount.trim() !== "" &&
    Number.isFinite(openingValue) &&
    openingValue > 0;
  const payInEth = Boolean(
    pairToken && pairToken !== zeroAddress && openingAsset === "eth",
  );
  const paySymbol = payInEth ? "ETH" : (selectedPair?.symbol ?? "ETH");
  const buyPresets = payInEth ? ETH_BUY_PRESETS : BUY_PRESETS;
  const ethIn = payInEth && hasOpeningBuy ? parseAmount(openingAmount, 18) : null;
  const stockQuote = useQuery({
    queryKey: ["rovo", "eth-stock-quote", pairToken, ethIn?.toString() ?? "0"],
    enabled: ethIn != null && !!pairToken,
    queryFn: () => quoteEthForToken(publicClient, pairToken as Address, ethIn as bigint),
  });

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedScout(queryText(scoutQuery)),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [scoutQuery]);
  const switchMode = (next: Mode) => {
    setMode(next);
    setStep(1);
    setError("");
    setScoutQuery("");
    setScoutProfile(null);
  };
  const selectScout = (account: XAccountView) => {
    setScoutProfile(account);
    setScoutQuery(`@${account.handle}`);
    setError("");
  };
  const continueIdentity = async () => {
    setError("");
    if (!identity.authenticated) {
      identity.login();
      return;
    }
    if (!wallet) {
      await identity.connectOrCreateWallet();
      return;
    }
    if (!identity.xAccount) {
      router.push("/onboarding");
      return;
    }
    if (mode === "scout" && !scoutProfile) {
      setError("Select an X account from the list.");
      return;
    }
    if (existing.isLoading) {
      setError("Checking whether this profile already has a token.");
      return;
    }
    if (existing.isError) {
      setError("Could not check this profile on-chain. Try again.");
      return;
    }
    if (existing.data && existing.data !== zeroAddress) {
      setError("This X profile already has a Rovo token.");
      return;
    }
    setStep(2);
  };
  const submit = async () => {
    setError("");
    if (!identity.xAccount) {
      setError("Link your X account before launching a token.");
      return;
    }
    if (mode === "scout" && !scoutProfile) {
      setError("Select an X account from the list.");
      return;
    }
    if (!actions || !pairToken || !symbol || !displayName) return;
    const metadata: TokenMetadata = {
      name: displayName,
      symbol,
      logo: avatar ?? "",
      description: "",
      socials: {
        twitter: `https://x.com/${symbol}`,
        telegram: "",
        discord: "",
        website: "",
        farcaster: "",
      },
      salt: toHex(crypto.getRandomValues(new Uint8Array(32))),
    };
    setBusy(true);
    setBusyLabel("Confirming…");
    let swappedInto: { amount: bigint; decimals: number; symbol: string } | null = null;
    try {
      if (openingAmount.trim() && !hasOpeningBuy)
        throw new Error("Enter a positive opening buy amount or leave it blank to skip.");
      let openingBuy: { quoteIn: bigint; minTokensOut: bigint } | undefined;
      if (hasOpeningBuy) {
        try {
          await reads.atomicLaunchRouter();
        } catch {
          throw new Error("Atomic launch is not deployed yet. Switch Rovo to the upgraded launch wrapper before launching.");
        }
        let quoteIn: bigint;
        let decimals: number;
        if (payInEth) {
          const ethAmount = parseAmount(openingAmount, 18);
          if (ethAmount == null)
            throw new Error("Enter a positive ETH amount for the first buy.");
          const pairInfo = await reads.tokenInfo(pairToken);
          decimals = pairInfo.decimals;
          const pairSymbol = pairInfo.symbol;
          if (wallet) {
            const balance = await reads.tokenBalance(zeroAddress, wallet);
            const required = ethAmount + (fee.data ?? 0n);
            if (balance < required) {
              throw new Error(
                `This first buy needs ${formatUnits(required, 18)} ETH, including the launch fee, but the wallet has ${formatUnits(balance, 18)} ETH.`,
              );
            }
          }
          setBusyLabel("Swapping ETH…");
          const quoted = await quoteEthForToken(publicClient, pairToken, ethAmount);
          const minStockOut = minTokensAtSlippage(quoted.amountOut);
          if (minStockOut <= 0n)
            throw new Error(`This ETH amount is too small to swap into ${pairSymbol}.`);
          const received = await actions.swapEthForToken({
            tokenOut: pairToken,
            amountIn: ethAmount,
            fee: quoted.fee,
            minAmountOut: minStockOut,
          });
          swappedInto = { amount: received, decimals, symbol: pairSymbol };
          quoteIn = received;
          setBusyLabel("Confirming…");
        } else {
          decimals =
            pairToken === zeroAddress
              ? 18
              : (await reads.tokenInfo(pairToken)).decimals;
          quoteIn = parseUnits(openingAmount.trim(), decimals);
          if (quoteIn > 0n && wallet) {
            const balance = await reads.tokenBalance(pairToken, wallet);
            const required = pairToken === zeroAddress ? quoteIn + (fee.data ?? 0n) : quoteIn;
            if (balance < required) {
              const symbolName = pairToken === zeroAddress ? "ETH" : (await reads.tokenInfo(pairToken)).symbol;
              const hint =
                pairToken === zeroAddress
                  ? `Add ${symbolName} or launch without a first buy.`
                  : `Pay the first buy in ETH, add ${symbolName}, or launch without a first buy.`;
              throw new Error(
                `This first buy needs ${formatUnits(required, decimals)} ${symbolName}, but the wallet has ${formatUnits(balance, decimals)} ${symbolName}. ${hint}`,
              );
            }
          }
        }
        if (quoteIn > 0n) {
          const curve = await reads.launchCurve(LAUNCH_CONFIG_ID, pairToken);
          const creatorTaxBps =
            mode === "self" ? BigInt(CREATOR_TAX_BPS) : BigInt(await reads.scoutCreatorTaxBps());
          const minTokensOut = minTokensAtSlippage(
            quoteOpeningBuy({
              quoteIn,
              supply: curve.supply,
              phantomQuote: curve.phantomQuote,
              graduationThreshold: curve.graduationThreshold,
              feeBps: curve.feeBps,
              creatorTaxBps,
            }),
          );
          if (minTokensOut <= 0n) {
            throw new Error("This opening buy is too small to receive profile tokens.");
          }
          if (pairToken !== zeroAddress && wallet) {
            const allowance = await reads.allowance(
              pairToken,
              wallet,
              config.addresses.wrapper,
            );
            if (allowance < quoteIn) {
              await actions.approveToken(
                pairToken,
                config.addresses.wrapper,
                quoteIn,
              );
            }
          }
          openingBuy = { quoteIn, minTokensOut };
        }
      }
      const receipt =
        mode === "self"
          ? await actions.launchSelfRove({
              metadata,
              launchConfigId: LAUNCH_CONFIG_ID,
              pairToken,
              creatorTaxBps: CREATOR_TAX_BPS,
              ...(openingBuy ? { openingBuy } : {}),
            })
          : await actions.launchScout({
              metadata,
              launchConfigId: LAUNCH_CONFIG_ID,
              pairToken,
              handle: symbol,
              ...(openingBuy ? { openingBuy } : {}),
            });
      const fromReceipt = tokenFromReceipt(receipt);
      const fromRegistry = fromReceipt ?? (await reads.tokenForHandle(symbol));
      const mint =
        fromRegistry && fromRegistry !== zeroAddress ? fromRegistry : null;
      if (mint) {
        try {
          await api.recordLaunch({
            token: mint,
            transactionHash: receipt.transactionHash,
            handle: symbol,
          });
          await queryClient.invalidateQueries({
            queryKey: ["rovo", "chain", "launches"],
          });
          await queryClient.invalidateQueries({
            queryKey: ["rovo", "chain", "api-launch", mint.toLowerCase()],
          });
        } catch {
          // The background launch sync still records the row after confirmations.
        }
      }
      setLaunched({
        name: displayName,
        symbol,
        mint,
        txHash: receipt.transactionHash,
      });
    } catch (cause) {
      if (swappedInto) {
        setOpeningAsset("pair");
        setOpeningAmount(formatQuoteAmount(swappedInto.amount, swappedInto.decimals));
        setError(
          `ETH was swapped into ${formatQuoteAmount(swappedInto.amount, swappedInto.decimals)} ${swappedInto.symbol}, but the launch did not finish. The first buy is now that ${swappedInto.symbol} amount, so you can launch again without another swap.`,
        );
      }
      toast.walletError(cause, "The launch did not finish.");
    } finally {
      setBusy(false);
      setBusyLabel("Confirming…");
    }
  };

  const launchedToken =
    existing.data && existing.data !== zeroAddress ? existing.data : null;

  const identityLabel = !identity.authenticated
    ? "Log in to continue"
    : !wallet
      ? "Connect wallet"
      : !identity.xAccount
        ? "Link X account"
        : "Continue";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 text-white sm:px-6 sm:py-10">
      <section className="md:rounded-[20px] md:bg-[#191919] md:p-10">
        <div className="inline-flex h-[43px] items-center rounded-[5px] bg-[#212121] p-1">
          {(["self", "scout"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              aria-pressed={mode === value}
              className={`flex h-[33px] w-[118px] items-center justify-center rounded-[5px] text-base ${
                mode === value
                  ? "border border-[#e1ff1f] bg-[#ccff00] font-medium text-black"
                  : "bg-[#383838] text-[#7f7f7f]"
              }`}
            >
              {value === "self" ? "Self-Rove" : "Scout"}
            </button>
          ))}
        </div>

        <h1 className="mt-8 text-[32px] font-bold leading-[1.05] tracking-[-1.2px] sm:text-[40px] sm:leading-[41px]">
          Put a person
          <br />
          on the market.
        </h1>
        <p className="mt-1 text-base tracking-[0.32px]">
          Launch yourself or discover someone before they do.
        </p>

        <div className="mt-8 flex flex-wrap gap-6 text-sm">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={
                index + 1 === step ? "text-[#ccff00]" : "text-[#737373]"
              }
            >
              {`0${index + 1}`} {label}
            </span>
          ))}
        </div>

        {step === 1 && (
          <div className="mt-6">
            <h2 className="text-[23px] font-bold tracking-[-0.69px]">
              {mode === "self" ? "Verify your identity" : "Scout an X profile"}
            </h2>
            {mode === "scout" && (
              <p className="mt-1 text-base tracking-[0.32px] text-[#737373]">
                The token uses their X name, photo, and username.
              </p>
            )}
            <div className="mt-4 h-px bg-[#383838]" />
            {mode === "self" ? (
              identity.xAccount && ownHandle ? (
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <ProfileFace
                    name={displayName}
                    handle={ownHandle}
                    avatar={avatar}
                    followers={followers}
                  />
                  <p className="text-sm text-[#34c759]">Identity verified ✓</p>
                </div>
              ) : (
                <p className="mt-8 text-sm text-[#7f7f7f]">
                  Link your X account. Its photo, name, and username become
                  the token.
                </p>
              )
            ) : !identity.xAccount ? (
              <p className="mt-8 text-sm text-[#7f7f7f]">
                Link your X account before you scout a profile.
              </p>
            ) : (
              <div className="mt-8">
                <label className="block text-base" htmlFor="scout-handle">
                  X account
                  <input
                    id="scout-handle"
                    value={scoutQuery}
                    onChange={(event) => {
                      const next = event.target.value;
                      setScoutQuery(next);
                      const text = queryText(next).toLowerCase();
                      setScoutProfile((current) =>
                        current && current.handle === text ? current : null,
                      );
                    }}
                    placeholder="Search a name or @username"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={scoutText.length >= 2 && !scoutSelected}
                    aria-controls="scout-results"
                    autoComplete="off"
                    className="mt-2 h-[50px] w-full rounded-[10px] border border-[#383838] bg-[#191919] px-3 text-sm text-white outline-none placeholder:text-[#7f7f7f] focus:border-[#ccff00]"
                  />
                </label>
                {scoutText.length >= 2 && !scoutSelected && (
                  <div
                    id="scout-results"
                    className="mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-[10px] border border-[#383838] bg-[#191919]"
                  >
                    {xSearch.isPending ? (
                      <p className="px-3 py-3 text-sm text-[#7f7f7f]">
                        Searching X…
                      </p>
                    ) : xSearch.isError ? (
                      <p className="px-3 py-3 text-sm text-[#ffaaaa]">
                        X search is unavailable.
                      </p>
                    ) : (xSearch.data?.accounts.length ?? 0) === 0 ? (
                      <p className="px-3 py-3 text-sm text-[#7f7f7f]">
                        No X accounts match that search.
                      </p>
                    ) : (
                      <ul role="listbox" aria-label="X accounts">
                        {(xSearch.data?.accounts ?? []).map((account) => (
                          <li key={account.handle}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={false}
                              onClick={() => selectScout(account)}
                              className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[#212121]"
                            >
                              <Avatar
                                src={xAvatarUrl(account.imageUrl)}
                                label={account.displayName || account.handle}
                                size={36}
                              />
                              <span className="min-w-0">
                                <strong className="flex min-w-0 items-center gap-1 text-sm font-medium">
                                  <span className="truncate">
                                    {account.displayName || account.handle}
                                  </span>
                                  {account.verified ? <VerifiedMark /> : null}
                                </strong>
                                <small className="block truncate text-sm text-[#7f7f7f]">
                                  @{account.handle}
                                  {account.followers != null
                                    ? ` · ${formatFollowers(account.followers)} followers`
                                    : ""}
                                </small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {scoutSelected && scoutProfile && (
                  <div className="mt-6">
                    <ProfileFace
                      name={scoutProfile.displayName || displayName}
                      handle={scoutProfile.handle}
                      avatar={xAvatarUrl(scoutProfile.imageUrl) || avatar}
                      followers={scoutProfile.followers ?? followers}
                      verified={
                        scoutProfile.verified || xProfile.data?.verified === true
                      }
                    />
                  </div>
                )}
              </div>
            )}
            {launchedToken && <ExistingTokenDetails token={launchedToken} />}
            {launchedToken ? (
              <Link
                href={`/token/${launchedToken}`}
                className={`${continueButton} mt-10 w-full`}
              >
                View token
              </Link>
            ) : (
              <button
                type="button"
                onClick={continueIdentity}
                disabled={
                  mode === "scout" &&
                  identity.authenticated &&
                  !!wallet &&
                  !!identity.xAccount &&
                  !scoutProfile
                }
                className={`${continueButton} mt-10 w-full`}
              >
                {identityLabel}
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="mt-8">
            <h2 className="text-[23px] font-bold tracking-[-0.69px]">
              Choose your Stock Token
            </h2>
            <p className="text-base tracking-[0.32px] text-[#737373]">
              Your profile token will trade against this asset.
            </p>
            <p className="mt-6 text-base">Pair with</p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex h-[55px] items-center gap-3 rounded-[10px] bg-[#191919] px-3">
                {(
                  [
                    ["all", "All"],
                    ["xstocks", "xStocks"],
                    ["crypto", "Crypto"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={pairKind === value}
                    onClick={() => setPairKind(value)}
                    className={`flex h-8 items-center justify-center rounded-[5px] bg-[#212121] px-5 text-base text-[#7f7f7f] ${
                      pairKind === value ? "border border-[#e1ff1f]" : ""
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex h-10 w-full items-center gap-1 rounded-[10px] bg-[#212121] px-3 lg:w-[259px]">
                <img src="/figma-launch/search.svg" alt="" className="size-4" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  aria-label="Search pair tokens"
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#7f7f7f]"
                />
              </label>
            </div>
            <div className="mt-6 grid max-h-[280px] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {visiblePairs.map((pair) => (
                <PairCard
                  key={pair.address}
                  pair={pair}
                  selected={
                    pairToken?.toLowerCase() === pair.address.toLowerCase()
                  }
                  onSelect={() => {
                    if (pair.address.toLowerCase() !== pairToken?.toLowerCase())
                      setOpeningAsset("eth");
                    setPairToken(pair.address);
                  }}
                />
              ))}
            </div>
            {visiblePairs.length === 0 && (
              <p className="mt-4 text-sm text-[#7f7f7f]">
                No pair tokens match.
              </p>
            )}
            <StepFooter
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
              continueDisabled={!pairToken}
            />
          </div>
        )}

        {step === 3 && (
          <div className="mt-8">
            <h2 className="text-[23px] font-bold tracking-[-0.69px]">
              Start your market
            </h2>
            <p className="text-base tracking-[0.32px] text-[#737373]">
              Optional first buy.
            </p>
            {pairToken && pairToken !== zeroAddress && (
              <div className="mt-6">
                <p className="text-base" id="opening-currency-label">
                  Pay with
                </p>
                <div
                  className="mt-2 flex h-[55px] w-fit items-center gap-3 rounded-[10px] bg-[#191919] px-3"
                  role="group"
                  aria-labelledby="opening-currency-label"
                >
                  {(
                    [
                      ["eth", "ETH"],
                      ["pair", selectedPair?.symbol ?? "Token"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={openingAsset === value}
                      onClick={() => setOpeningAsset(value)}
                      className={`flex h-8 items-center justify-center rounded-[5px] bg-[#212121] px-5 text-base ${
                        openingAsset === value
                          ? "border border-[#e1ff1f] text-white"
                          : "text-[#7f7f7f]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="mt-8 block text-base" htmlFor="opening-buy">
              Initial Buy
              <input
                id="opening-buy"
                inputMode="decimal"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                placeholder={`e.g 0.01 ${paySymbol}`}
                className="mt-3 h-[50px] w-full rounded-[10px] border border-[#383838] bg-[#191919] px-3 text-sm text-white outline-none placeholder:text-[#7f7f7f] focus:border-[#ccff00]"
              />
            </label>
            {payInEth && hasOpeningBuy && (
              <p className="mt-3 text-sm text-[#737373]" aria-live="polite">
                {stockQuote.isPending
                  ? "Checking the Uniswap price…"
                  : stockQuote.data
                    ? `Uniswap converts this to about ${formatQuoteAmount(stockQuote.data.amountOut, stockQuote.data.decimals)} ${selectedPair?.symbol ?? "tokens"}. The launch fee stays in ETH.`
                    : "Uniswap has no ETH pool for this token. Pay in the token itself, or pick another pair."}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {buyPresets.map((amount) => {
                const selected =
                  hasOpeningBuy && Number(amount) === openingValue;
                return (
                  <button
                    key={amount}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setOpeningAmount(amount)}
                    className={`flex h-[50px] w-[104px] items-center justify-center rounded-[10px] border bg-[#212121] text-sm text-[#7f7f7f] ${
                      selected ? "border-[#ccff00]" : "border-[#383838]"
                    }`}
                  >
                    {amount} {paySymbol}
                  </button>
                );
              })}
            </div>
            <StepFooter onBack={() => setStep(2)} onContinue={() => setStep(4)} />
          </div>
        )}

        {step === 4 && (
          <div className="mt-8">
            <div className="flex items-center gap-5">
              <Avatar src={avatar} label={symbol || displayName} size={58} />
              <p className="text-[27px] font-bold tracking-[-0.81px]">
                @{symbol || "profile"}
              </p>
            </div>
            <div className="mt-6 h-px bg-[#383838]" />
            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-16">
              <div className="flex items-center gap-6">
                <p className="text-base tracking-[0.32px] text-[#737373]">
                  Pair
                </p>
                <div className="flex items-center gap-2">
                  {selectedPair?.iconUrl && (
                    <img
                      src={selectedPair.iconUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-contain"
                    />
                  )}
                  <p className="text-xl">{selectedPair?.symbol}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <p className="text-base tracking-[0.32px] text-[#737373]">
                  First buy
                </p>
                <p className="text-xl">
                  {hasOpeningBuy
                    ? payInEth
                      ? `${openingAmount.trim()} ETH → ${selectedPair?.symbol ?? "token"}`
                      : `${openingAmount.trim()} ${selectedPair?.symbol ?? ""}`.trim()
                    : "Skipped"}
                </p>
              </div>
            </div>
            <div className="mt-6 h-px bg-[#383838]" />
            <div className="mt-6 rounded-[10px] bg-[#212121] px-6 py-5">
              <p className="text-base">Fee distribution</p>
              <div className="mt-6 flex h-2.5 overflow-hidden rounded-full">
                <div className="h-full w-[70%] bg-[#43e660]" />
                <div className="h-full w-[20%] bg-[#9945ff]" />
                <div className="h-full w-[10%] bg-[#fbad15]" />
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-[#737373]">
                <Legend color="#43e660" label="Creators 70%" />
                <Legend color="#9945ff" label="Holders 20%" />
                <Legend color="#fbad15" label="Platform 10%" />
              </div>
            </div>
            {fee.isError && (
              <p className="mt-4 text-sm text-[#ffaaaa]">
                The launch fee could not be loaded. Continue stays unavailable
                until it is.
              </p>
            )}
            <StepFooter
              onBack={() => setStep(3)}
              onContinue={submit}
              continueDisabled={
                busy ||
                fee.isLoading ||
                fee.isError ||
                !pairToken ||
                !displayName ||
                !symbol
              }
              continueLabel={busy ? busyLabel : "Continue"}
            />
          </div>
        )}

        {launched && (
          <LaunchSuccessDialog
            launch={launched}
            onClose={() => setLaunched(null)}
            onView={() => {
              if (launched.mint) router.push(`/token/${launched.mint}`);
            }}
          />
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-[#6a3030] bg-[#2a1717] p-3 text-sm text-[#ffaaaa]"
          >
            {error}
          </p>
        )}
      </section>
    </main>
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

function ProfileFace({
  name,
  handle,
  avatar,
  followers,
  verified = false,
}: {
  name: string;
  handle: string;
  avatar: string | null;
  followers: number | null;
  verified?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar src={avatar} label={name || handle} size={58} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-lg font-medium tracking-[-0.54px]">
          <span className="truncate">{name || handle}</span>
          {verified ? <VerifiedMark /> : null}
        </p>
        <p className="truncate text-sm text-[#7f7f7f]">
          @{handle}
          {followers != null ? ` · ${formatFollowers(followers)} followers` : ""}
        </p>
      </div>
    </div>
  );
}

function Avatar({
  src,
  label,
  size,
}: {
  src: string | null;
  label: string;
  size: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#3a3a3a] text-sm font-semibold uppercase"
      style={{ width: size, height: size }}
    >
      {(label || "?").slice(0, 1)}
    </span>
  );
}

function PairCard({
  pair,
  selected,
  onSelect,
}: {
  pair: PairChoice;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-[79px] items-center gap-3 rounded-[10px] bg-[#212121] px-4 text-left ${
        selected ? "border border-[#e1ff1f]" : "border border-transparent"
      }`}
    >
      <img
        src={pair.iconUrl}
        alt=""
        width={34}
        height={34}
        className="size-[34px] shrink-0 rounded-full object-contain"
      />
      <span className="min-w-0">
        <strong className="block truncate text-base font-normal">
          {pair.symbol}
        </strong>
        <small className="block truncate text-base text-[#7f7f7f]">
          {pair.name}
        </small>
      </span>
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="size-[9px] rounded-[1px]"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function StepFooter({
  onBack,
  onContinue,
  continueDisabled,
  continueLabel = "Continue",
}: {
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
}) {
  return (
    <div className="mt-8 flex items-center gap-6">
      <button type="button" onClick={onBack} className="text-base text-white">
        Back
      </button>
      <button
        type="button"
        disabled={continueDisabled}
        onClick={onContinue}
        className={continueButton}
      >
        {continueLabel}
      </button>
    </div>
  );
}

function LaunchSuccessDialog({
  launch,
  onClose,
  onView,
}: {
  launch: LaunchedToken;
  onClose: () => void;
  onView: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      data-open="true"
      className="motion-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <button
        type="button"
        aria-label="Close launch details"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-success-title"
        className="motion-panel relative w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#141414] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-xl text-[#8a8a8a] hover:bg-white/5 hover:text-white"
        >
          ×
        </button>
        <div className="flex size-12 items-center justify-center rounded-full bg-[#ccff00] text-black">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
            <path
              d="M5 12.5 9.2 17 19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 id="launch-success-title" className="mt-4 text-[28px] font-semibold tracking-[-0.6px]">
          Launch successful
        </h2>
        <p className="mt-1 text-sm text-[#8a8a8a]">Your profile token is live.</p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-[#0e0e0e]">
          <CopyRow label="Name" value={launch.name} />
          <CopyRow label="Symbol" value={launch.symbol} />
          <CopyRow label="Mint" value={launch.mint} mono last />
        </div>
        <a
          href={`https://robinhoodchain.blockscout.com/tx/${launch.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex h-11 items-center justify-center rounded-xl border border-[#333] text-sm font-medium text-white"
        >
          View transaction
        </a>
        <button
          type="button"
          disabled={!launch.mint}
          onClick={onView}
          className="mt-3 flex h-[52px] w-full items-center justify-center rounded-xl bg-[#ccff00] text-base font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          View token
        </button>
      </section>
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  last?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = value ?? "Waiting for the token address";

  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 ${last ? "" : "border-b border-white/8"}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#737373]">{label}</p>
        <p className={`mt-1 truncate text-sm text-white ${mono ? "font-mono" : ""}`}>{text}</p>
      </div>
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          if (!value) return;
          void navigator.clipboard.writeText(value).then(
            () => setCopied(true),
            () => setCopied(true),
          );
          window.setTimeout(() => setCopied(false), 1500);
        }}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        className="shrink-0 text-sm font-semibold text-[#ccff00] disabled:text-[#555]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
