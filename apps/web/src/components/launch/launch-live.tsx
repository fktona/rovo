"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCreateWallet,
  useSignAndSendTransaction,
  useStandardWallets,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { MemeLaunchForm } from "./meme-launch-form";
import { normalizeHandle } from "@/lib/validation";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { useXAccount, useXSearch } from "@/hooks/useRovoQueries";
import type { XAccountView } from "@/lib/api";
import { useToast } from "@/components/toast/toast-provider";
import { creatorFeeLabel } from "@/lib/pump/fees";
import { launchPumpToken } from "@/lib/pump/launch";
import {
  connectExternalSolanaWallet,
  hasExternalSolanaWallet,
  preferredSolanaWallet,
} from "@/lib/solana-wallet";
import type { PumpLaunchPair } from "@/lib/pump/quotes";

type Mode = "self" | "scout" | "meme";
type PairKind = "all" | "xstocks" | "crypto";

const BUY_PRESETS = ["0.5", "1", "2", "5"] as const;
const STEPS = ["Identity", "Pair", "First Buy", "Review"] as const;

const continueButton =
  "flex h-[53px] min-w-0 flex-1 items-center justify-center rounded-[10px] bg-action text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45";

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

function pumpSymbol(handle: string) {
  const compact = handle.replace(/[^A-Za-z0-9]/g, "");
  return (compact || handle).slice(0, 13);
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

type LaunchedToken = {
  name: string;
  symbol: string;
  mint: string;
  signature: string;
  kind: Mode;
  pair: string;
  creatorFee: string;
};

export function LaunchLive() {
  const router = useRouter();
  const identity = useRovoIdentity();
  const toast = useToast();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { wallets: standardWallets } = useStandardWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { createWallet } = useCreateWallet();
  const externalWalletAvailable = hasExternalSolanaWallet(standardWallets);
  const solanaWallet = externalWalletAvailable
    ? solanaWallets.find(
        (wallet) => !/privy/i.test(wallet.standardWallet.name),
      )
    : preferredSolanaWallet(solanaWallets);
  const [mode, setMode] = useState<Mode>("self");
  const [step, setStep] = useState(1);
  const [scoutQuery, setScoutQuery] = useState("");
  const [scoutProfile, setScoutProfile] = useState<XAccountView | null>(null);
  const [debouncedScout, setDebouncedScout] = useState("");
  const [search, setSearch] = useState("");
  const [pairKind, setPairKind] = useState<PairKind>("all");
  const [pairToken, setPairToken] = useState<string | undefined>();
  const [openingAmount, setOpeningAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Confirming…");
  const [error, setError] = useState("");
  const [launched, setLaunched] = useState<LaunchedToken | null>(null);
  const [memeName, setMemeName] = useState("");
  const [memeSymbol, setMemeSymbol] = useState("");
  const [memeFile, setMemeFile] = useState<File | null>(null);
  const [memePreview, setMemePreview] = useState<string | null>(null);
  const [pumpPairs, setPumpPairs] = useState<PumpLaunchPair[]>([]);
  const [pairsStatus, setPairsStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [memeDescription, setMemeDescription] = useState("");
  const [memeWebsite, setMemeWebsite] = useState("");
  const [memeTelegram, setMemeTelegram] = useState("");
  const [memeTwitter, setMemeTwitter] = useState("");
  const ownHandle = identity.xAccount?.username ?? "";
  const scoutText = queryText(scoutQuery);
  const scoutSelected =
    scoutProfile != null && scoutText.toLowerCase() === scoutProfile.handle;
  const targetHandle = mode === "self" ? ownHandle : mode === "scout" ? (scoutProfile?.handle ?? "") : "";
  const handle = safeHandle(targetHandle);
  const xProfile = useXAccount(handle);
  const xSearch = useXSearch(
    mode === "scout" && !scoutSelected ? debouncedScout : undefined,
  );
  const displayName =
    mode === "meme"
      ? memeName.trim()
      : xProfile.data?.displayName?.trim() ||
        (mode === "self"
          ? identity.xAccount?.name?.trim()
          : scoutProfile?.displayName?.trim()) ||
        handle ||
        "";
  const symbol = mode === "meme" ? memeSymbol.trim() : pumpSymbol(handle ?? "");
  const avatar = mode === "meme"
    ? memePreview
    : xAvatarUrl(
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
    return pumpPairs.filter((pair) => {
      const kindMatches = pairKind === "all" || pair.kind === pairKind;
      const textMatches = `${pair.symbol} ${pair.name}`
        .toLowerCase()
        .includes(query);
      return kindMatches && textMatches;
    });
  }, [pairKind, pumpPairs, search]);
  const selectedPair = pumpPairs.find((pair) => pair.mint === pairToken);
  const openingValue = Number(openingAmount);
  const hasOpeningBuy =
    openingAmount.trim() !== "" &&
    Number.isFinite(openingValue) &&
    openingValue > 0;
  const creatorFee = creatorFeeLabel(selectedPair?.source);
  const buyPresets = BUY_PRESETS;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pump/quotes")
      .then(async (response) => {
        const data = (await response.json()) as {
          quotes?: PumpLaunchPair[];
          error?: string;
        };
        if (!response.ok || !data.quotes) {
          throw new Error(data.error || "Pump quotes are unavailable.");
        }
        if (!cancelled) {
          setPumpPairs(data.quotes);
          setPairsStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setPairsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const ensureSolanaWallet = async () => {
    if (solanaWallet) return true;
    if (externalWalletAvailable) {
      try {
        return await connectExternalSolanaWallet(standardWallets);
      } catch (cause) {
        toast.walletError(
          cause,
          "Could not connect MetaMask. Enable its Solana account, then try again.",
        );
        return false;
      }
    }
    try {
      await createWallet();
    } catch (cause) {
      toast.walletError(cause, "Could not create a Solana wallet.");
    }
    return false;
  };
  const continueIdentity = async () => {
    setError("");
    if (!identity.authenticated) {
      identity.login();
      return;
    }
    if (!(await ensureSolanaWallet())) return;
    if (mode === "self" && !identity.xAccount) {
      router.push("/onboarding");
      return;
    }
    if (mode === "scout" && !scoutProfile) {
      setError("Select an X account from the list.");
      return;
    }
    if (!handle) {
      setError(
        mode === "scout"
          ? "Select an X account from the list."
          : "Link your X account.",
      );
      return;
    }
    if (mode === "meme" && symbol.replace(/^\$/, "").length > 13) {
      setError("Symbols can be at most 13 characters.");
      return;
    }
    setStep(2);
  };
  const submit = async () => {
    setError("");
    if (mode === "self" && !identity.xAccount) {
      setError("Link your X account before launching your profile token.");
      return;
    }
    if (mode === "scout" && !scoutProfile) {
      setError("Select an X account from the list.");
      return;
    }
    if (!solanaWallet || !selectedPair || !symbol || !displayName) return;
    if (mode === "meme" && !memeFile) {
      setError("Add a token image before launching.");
      return;
    }
    if (mode !== "meme" && !avatar) {
      setError("This profile has no photo to use as the token image.");
      return;
    }
    setBusy(true);
    setBusyLabel("Preparing the Pump launch…");
    try {
      const result = await launchPumpToken({
        walletAddress: solanaWallet.address,
        name: displayName.slice(0, 32),
        ticker: symbol,
        description:
          mode === "meme"
            ? memeDescription.trim()
            : `${displayName} was launched on TryFolio`,
        xLink: mode === "meme" ? memeTwitter.trim() : `https://x.com/${handle}`,
        website: mode === "meme" ? memeWebsite.trim() : "",
        telegram: mode === "meme" ? memeTelegram.trim() : "",
        customBuy: hasOpeningBuy ? openingAmount.trim() : "",
        imageFile: mode === "meme" ? memeFile : null,
        ...(mode !== "meme" && avatar ? { imageUrl: avatar } : {}),
        pairedAsset: selectedPair,
        pair: selectedPair,
        onStatus: setBusyLabel,
        sendTransaction: async (transaction, chain) =>
          (
            await signAndSendTransaction({
              transaction,
              wallet: solanaWallet,
              chain,
            })
          ).signature,
      });
      if (!result.indexed) {
        toast.error(
          "Token launched",
          "It was not saved to the platform list.",
        );
      }
      setLaunched({
        name: displayName,
        symbol: mode === "meme" ? symbol : (handle ?? symbol),
        mint: result.mint,
        signature: result.signature,
        kind: mode,
        pair: selectedPair.symbol,
        creatorFee,
      });
    } catch (cause) {
      toast.walletError(cause, "The launch did not finish.");
    } finally {
      setBusy(false);
      setBusyLabel("Confirming…");
    }
  };

  const identityLabel = !identity.authenticated
    ? "Log in to continue"
    : !solanaWallet
      ? "Connect wallet"
        : mode === "self" && !identity.xAccount
        ? "Link X account"
        : "Continue";

  return (
    <main className={`mx-auto w-full px-4 py-6 text-foreground sm:px-6 sm:py-10 ${mode === "meme" ? "max-w-6xl" : "max-w-4xl"}`}>
      <section className="rounded-[20px] bg-surface p-4 md:p-10">
        <div className="inline-flex h-auto max-w-full items-center gap-1 overflow-x-auto rounded-[5px] bg-surface-raised p-1">
          {(
            [
              ["self", "Your X profile"],
              ["scout", "Another creator"],
              ["meme", "Meme token"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              aria-pressed={mode === value}
              className={`flex h-[33px] shrink-0 items-center justify-center rounded-[5px] px-3 text-sm ${
                mode === value
                  ? "border border-accent bg-action font-medium text-ink"
                  : "bg-surface-raised text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <h1 className="mt-8 text-[32px] font-bold leading-[1.05] tracking-[-1.2px] sm:text-[40px] sm:leading-[41px]">
          {mode === "self"
            ? "Tokenize your X profile"
            : mode === "scout"
              ? "Tokenize another creator"
              : "Launch a meme token"}
        </h1>
        <p className="mt-1 text-base tracking-[0.32px]">
          {mode === "self"
            ? "Launch a market for your verified X account."
            : mode === "scout"
              ? "Launch their profile market and earn a percentage of their fees."
              : "A wallet is enough. This track is not tied to an X profile."}
        </p>

        {mode !== "meme" && (
        <div className="mt-8 flex flex-wrap gap-6 text-sm">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={
                index + 1 === step ? "text-accent" : "text-muted"
              }
            >
              {`0${index + 1}`} {label}
            </span>
          ))}
        </div>
        )}

        {mode === "meme" && (
          <MemeLaunchForm
            name={memeName}
            onName={setMemeName}
            symbol={memeSymbol}
            onSymbol={setMemeSymbol}
            description={memeDescription}
            onDescription={setMemeDescription}
            website={memeWebsite}
            onWebsite={setMemeWebsite}
            telegram={memeTelegram}
            onTelegram={setMemeTelegram}
            twitter={memeTwitter}
            onTwitter={setMemeTwitter}
            creatorFee={creatorFee}
            preview={memePreview}
            onImage={(file) => {
              setError("");
              if (!file) return;
              if (!file.type.startsWith("image/")) {
                setError("Choose an image file.");
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                setError("Image must be 5 MB or smaller.");
                return;
              }
              setMemePreview((current) => {
                if (current) URL.revokeObjectURL(current);
                return URL.createObjectURL(file);
              });
              setMemeFile(file);
            }}
            pairs={visiblePairs}
            pairsMessage={pairListMessage(pairsStatus)}
            pairKind={pairKind}
            onPairKind={setPairKind}
            search={search}
            onSearch={setSearch}
            pairToken={pairToken}
            onPair={(mint) => setPairToken(mint)}
            selectedPair={selectedPair}
            openingAmount={openingAmount}
            onOpeningAmount={setOpeningAmount}
            hasOpeningBuy={hasOpeningBuy}
            openingValue={openingValue}
            buyPresets={buyPresets}
            busy={busy}
            launchLabel={!identity.authenticated ? "Log in" : !solanaWallet ? "Connect wallet" : busy ? busyLabel : "Launch"}
            onLaunch={async () => {
              setError("");
              if (!identity.authenticated) {
                identity.login();
                return;
              }
              if (!(await ensureSolanaWallet())) return;
              if (!memeName.trim() || !memeSymbol.trim()) {
                setError("Enter a name and a ticker.");
                return;
              }
              if (!/^[A-Za-z][A-Za-z0-9]{0,12}$/.test(memeSymbol.trim())) {
                setError("Use a ticker of up to 13 letters and numbers, starting with a letter.");
                return;
              }
              if (!pairToken) {
                setError("Choose what this token is paired with.");
                return;
              }
              await submit();
            }}
          />
        )}

        {step === 1 && mode !== "meme" && (
          <div className="mt-6">
            <h2 className="text-[23px] font-bold tracking-[-0.69px]">
              {mode === "self" ? "Your X account" : "Choose a creator"}
            </h2>
            {mode === "scout" && (
              <p className="mt-1 text-base tracking-[0.32px] text-muted">
                The token uses their X name, photo, and username.
              </p>
            )}
            <div className="mt-4 h-px bg-surface-raised" />
            {mode === "self" ? (
              identity.xAccount && ownHandle ? (
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <ProfileFace
                    name={displayName}
                    handle={ownHandle}
                    avatar={avatar}
                    followers={followers}
                  />
                  <p className="text-sm text-positive">Identity verified ✓</p>
                </div>
              ) : (
                <p className="mt-8 text-sm text-muted">
                  Link your X account. Its photo, name, and username become
                  the token.
                </p>
              )
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
                    className="mt-2 h-[50px] w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
                  />
                </label>
                {scoutText.length >= 2 && !scoutSelected && (
                  <div
                    id="scout-results"
                    className="mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-[10px] border border-line bg-surface"
                  >
                    {xSearch.isPending ? (
                      <p className="px-3 py-3 text-sm text-muted">
                        Searching X…
                      </p>
                    ) : xSearch.isError ? (
                      <p className="px-3 py-3 text-sm text-danger">
                        X search is unavailable.
                      </p>
                    ) : (xSearch.data?.accounts.length ?? 0) === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted">
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
                              className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-raised"
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
                                <small className="block truncate text-sm text-muted">
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
            <button
                type="button"
                onClick={continueIdentity}
                disabled={
                  mode === "scout" &&
                  identity.authenticated &&
                  !!solanaWallet &&
                  !scoutProfile
                }
                className={`${continueButton} mt-10 w-full`}
              >
                {identityLabel}
              </button>
          </div>
        )}

        {mode !== "meme" && step === 2 && (
          <div className="mt-8">
            <h2 className="text-[23px] font-bold tracking-[-0.69px]">
              Choose your Stock Token
            </h2>
            <p className="text-base tracking-[0.32px] text-muted">
              {mode === "self"
                ? "Your profile token will trade against this asset."
                : mode === "scout"
                  ? "Their profile token will trade against this asset."
                  : "This token will trade against this asset."}
            </p>
            <p className="mt-6 text-base">Pair with</p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex h-[55px] items-center gap-3 rounded-[10px] bg-surface px-3">
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
                    className={`flex h-8 items-center justify-center rounded-[5px] bg-surface-raised px-5 text-base text-muted ${
                      pairKind === value ? "border border-accent" : ""
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex h-10 w-full items-center gap-1 rounded-[10px] bg-surface-raised px-3 lg:w-[259px]">
                <img src="/figma-launch/search.svg" alt="" className="size-4" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  aria-label="Search pair tokens"
                  className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
                />
              </label>
            </div>
            <div className="mt-6 grid max-h-[280px] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {visiblePairs.map((pair) => (
                <PairCard
                  key={pair.mint}
                  pair={pair}
                  selected={pairToken === pair.mint}
                  onSelect={() => setPairToken(pair.mint)}
                />
              ))}
            </div>
            {visiblePairs.length === 0 && (
              <p className="mt-4 text-sm text-muted">
                {pairListMessage(pairsStatus)}
              </p>
            )}
            <StepFooter
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
              continueDisabled={!pairToken}
            />
          </div>
        )}

        {mode !== "meme" && step === 3 && (
          <div className="mt-8">
            <h2 className="text-[23px] font-bold tracking-[-0.69px]">
              Start your market
            </h2>
            <p className="text-base tracking-[0.32px] text-muted">
              Optional first buy in SOL. If this pair is not SOL, that SOL is swapped into the pair before the coin is created. A blank amount creates the coin only.
            </p>
            <label className="mt-8 block text-base" htmlFor="opening-buy">
              Initial buy
              <input
                id="opening-buy"
                inputMode="decimal"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                placeholder="e.g 0.5 SOL"
                className="mt-3 h-[50px] w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
              />
            </label>
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
                    className={`flex h-[50px] w-[104px] items-center justify-center rounded-[10px] border bg-surface-raised text-sm text-muted ${
                      selected ? "border-accent" : "border-line"
                    }`}
                  >
                    {amount} SOL
                  </button>
                );
              })}
            </div>
            <StepFooter onBack={() => setStep(2)} onContinue={() => setStep(4)} />
          </div>
        )}

        {mode !== "meme" && step === 4 && (
          <div className="mt-8">
            <div className="flex items-center gap-5">
              <Avatar src={avatar} label={symbol || displayName} size={58} />
              <p className="text-[27px] font-bold tracking-[-0.81px]">
                @{handle || "profile"}
              </p>
            </div>
            <div className="mt-6 h-px bg-surface-raised" />
            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-16">
              <div className="flex items-center gap-6">
                <p className="text-base tracking-[0.32px] text-muted">
                  Pair
                </p>
                <div className="flex items-center gap-2">
                  {selectedPair?.iconUrl ? (
                    <img
                      src={selectedPair.iconUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-contain"
                    />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-surface-raised text-sm font-semibold uppercase">
                      {selectedPair?.symbol.slice(0, 1)}
                    </span>
                  )}
                  <p className="text-xl">{selectedPair?.symbol}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <p className="text-base tracking-[0.32px] text-muted">
                  First buy
                </p>
                <p className="text-xl">
                  {hasOpeningBuy
                    ? `${openingAmount.trim()} SOL`
                    : "Skipped"}
                </p>
              </div>
            </div>
            <div className="mt-6 h-px bg-surface-raised" />
            <div className="mt-6 rounded-[10px] bg-surface-raised px-6 py-5">
              <p className="text-base">Creator fee</p>
              <p className="mt-2 text-[32px] font-bold leading-none tracking-[-1px] text-accent">
                {creatorFee}
              </p>
              <p className="mt-3 text-sm text-muted">
                Quote pairs other than SOL and USDC lock a 2% creator fee in the fee vault. SOL and USDC use Pump&apos;s schedule.
              </p>
            </div>
            <StepFooter
              onBack={() => setStep(3)}
              onContinue={submit}
              continueDisabled={
                busy || !pairToken || !displayName || !symbol
              }
              continueLabel={busy ? busyLabel : "Launch on Pump"}
            />
          </div>
        )}

        {launched && (
          <LaunchSuccessDialog
            launch={launched}
            onClose={() => setLaunched(null)}
            onView={() => {
              if (!launched.mint) return;
              window.open(
                `https://solscan.io/token/${launched.mint}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          />
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger"
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
        <p className="truncate text-sm text-muted">
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
      className="flex shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-semibold uppercase"
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
  pair: PumpLaunchPair;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-[79px] items-center gap-3 rounded-[10px] bg-surface-raised px-4 text-left ${
        selected ? "border border-accent" : "border border-transparent"
      }`}
    >
      {pair.iconUrl ? (
        <img
          src={pair.iconUrl}
          alt=""
          width={34}
          height={34}
          className="size-[34px] shrink-0 rounded-full object-contain"
        />
      ) : (
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold uppercase">
          {pair.symbol.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0">
        <strong className="block truncate text-base font-normal">
          {pair.symbol}
        </strong>
        <small className="block truncate text-base text-muted">
          {pair.name}
        </small>
      </span>
    </button>
  );
}

function pairListMessage(status: "loading" | "ready" | "error") {
  if (status === "loading") return "Loading Pump pairs…";
  if (status === "error") return "Pump pairs are unavailable.";
  return "No pair tokens match.";
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
      <button type="button" onClick={onBack} className="text-base text-foreground">
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

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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
  const [copied, setCopied] = useState(false);
  const profile = launch.kind !== "meme";
  const handle = profile ? `@${launch.symbol}` : launch.symbol.toUpperCase();
  const headline = profile
    ? `${handle} is now live on ROVO`
    : `${launch.name} is now live on ROVO`;
  const stat = { label: "Creator fee", value: launch.creatorFee };
  const shareText = profile ? `Share with ${handle}` : `Share ${launch.name}`;
  const share = () => {
    const page = launch.mint
      ? `https://solscan.io/token/${launch.mint}`
      : window.location.href;
    const href = `https://x.com/intent/tweet?text=${encodeURIComponent(headline)}&url=${encodeURIComponent(page)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

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
        className="motion-panel relative w-full max-w-[720px] rounded-[20px] bg-surface px-6 py-7 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:px-11 sm:py-8"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-xl text-muted hover:bg-foreground/5 hover:text-foreground"
        >
          ×
        </button>
        {profile ? (
          <div className="inline-flex items-center gap-1 rounded-[5px] bg-surface-raised p-1">
            <span
              className={`flex h-[33px] w-[118px] items-center justify-center rounded-[5px] text-base ${launch.kind === "self" ? "border border-accent bg-action font-medium text-ink" : "bg-surface-raised text-muted"}`}
            >
              Self-Rove
            </span>
            <span
              className={`flex h-[33px] w-[119px] items-center justify-center rounded-[5px] text-base ${launch.kind === "scout" ? "border border-accent bg-action font-medium text-ink" : "bg-surface-raised text-muted"}`}
            >
              Scout
            </span>
          </div>
        ) : (
          <span className="inline-flex h-[33px] items-center justify-center rounded-[5px] border border-accent bg-action px-5 text-base font-medium text-ink">
            Meme
          </span>
        )}
        <p className="mt-6 text-base tracking-[0.32px]">
          {launch.kind === "scout" ? "Unclaimed" : "Live"}
        </p>
        <h2
          id="launch-success-title"
          className="mt-2 max-w-[685px] text-[32px] font-bold leading-[41px] tracking-[-1.2px] sm:text-[40px]"
        >
          {headline}
        </h2>
        <p className="mt-2 text-base tracking-[0.32px]">
          <span className="font-bold">{handle}</span>
          <span> / {launch.pair}</span>
        </p>
        <p className="mt-6 text-base tracking-[0.32px]">{stat.label}</p>
        <p className="mt-1 text-[40px] font-bold leading-[41px] tracking-[-1.2px] text-accent">
          {stat.value}
        </p>
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base tracking-[0.32px]">Token address</p>
            <p className="mt-1 truncate font-mono text-sm">
              {launch.mint ? shortAddress(launch.mint) : "Waiting for the token address"}
            </p>
          </div>
          <button
            type="button"
            disabled={!launch.mint}
            onClick={() => {
              if (!launch.mint) return;
              void navigator.clipboard.writeText(launch.mint).then(
                () => setCopied(true),
                () => setCopied(true),
              );
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 text-base font-semibold text-accent disabled:text-muted"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          disabled={!launch.mint}
          onClick={onView}
          className="mt-8 flex h-[53px] w-full items-center justify-center rounded-[10px] bg-action text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45"
        >
          View market
        </button>
        <button
          type="button"
          onClick={share}
          className="mt-6 block w-full text-center text-base font-semibold"
        >
          {shareText}
        </button>
      </section>
    </div>
  );
}
