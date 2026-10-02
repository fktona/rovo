"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { AssetIcon, icons } from "./assets";
import type { Pair, Token } from "./data";
import { useLaunches } from "@/hooks/useRovoQueries";
import { pairChoices, pairIconSrc } from "@/lib/pairs";
import { formatPriceUsd, formatUsd } from "@/lib/token-market";
import { styles } from "./styles";
import { useAppSearch } from "../shell/app-shell";

const views = [
  { label: "Trending", icon: icons.trending, width: 22, height: 12 },
  { label: "New", icon: icons.new, width: 19, height: 19 },
  { label: "Graduated", icon: icons.graduated, width: 19, height: 19 },
] as const;

type View = (typeof views)[number]["label"];

const creatorsPair: Pair = { label: "Creators", icon: icons.creators };
const memesPair: Pair = { label: "Memes", icon: icons.launch };
const featuredPairs: Pair[] = pairChoices.slice(0, 10).map((choice) => ({
  label: choice.symbol,
  icon: choice.iconUrl,
}));

function PairIcon({ pair }: { pair: Pair }) {
  const [failed, setFailed] = useState(false);
  const src = pairIconSrc(pair.icon);
  if (failed) {
    return (
      <span
        aria-hidden
        className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold text-foreground"
      >
        {pair.label.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={22}
      height={22}
      onError={() => setFailed(true)}
      className={`${pair.label === "Creators" ? "size-7" : "size-[22px]"} shrink-0 object-contain`}
    />
  );
}

function PairFilters({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const extra =
    selected &&
    selected !== "Creators" &&
    selected !== "Memes" &&
    !featuredPairs.some((pair) => pair.label === selected)
      ? {
          label: selected,
          icon:
            pairChoices.find((choice) => choice.symbol === selected)?.iconUrl ??
            icons.logoMark,
        }
      : null;
  const chips = extra
    ? [creatorsPair, memesPair, ...featuredPairs, extra]
    : [creatorsPair, memesPair, ...featuredPairs];
  const matches = pairChoices.filter((choice) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      choice.symbol.toLowerCase().includes(needle) ||
      choice.name.toLowerCase().includes(needle)
    );
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (symbol: string) => {
    onSelect(symbol);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 items-center gap-1 border-r border-line pr-3 text-base font-medium md:border-0 md:pr-0"
        >
          All
          <AssetIcon src={icons.caret} width={16} height={16} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-2 shadow-xl">
            <label className="sr-only" htmlFor={searchId}>
              Search pair tokens
            </label>
            <input
              id={searchId}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pair tokens"
              className="h-10 w-full rounded-[10px] bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted"
            />
            <ul
              role="listbox"
              aria-label="Pair tokens"
              className="mt-2 max-h-72 overflow-y-auto"
            >
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected === "" || selected === "Creators"}
                  onClick={() => choose("Creators")}
                  className={`flex w-full items-center rounded-lg px-2 py-2 text-left text-sm ${selected === "" || selected === "Creators" ? "bg-surface text-accent" : "hover:bg-surface"}`}
                >
                  All pairs
                </button>
              </li>
              {matches.map((choice) => (
                <li key={choice.address}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected === choice.symbol}
                    onClick={() => choose(choice.symbol)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${selected === choice.symbol ? "bg-surface text-accent" : "hover:bg-surface"}`}
                  >
                    <PairIcon
                      pair={{ label: choice.symbol, icon: choice.iconUrl }}
                    />
                    <span className="font-medium">{choice.symbol}</span>
                    <span className="truncate text-muted">
                      {choice.name}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="px-2 py-3 text-sm text-muted">
                  No pair tokens match.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      <div
        className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Paired asset filters"
      >
        {chips.map((pair) => (
          <button
            key={pair.label}
            type="button"
            aria-pressed={selected === pair.label}
            onClick={() => onSelect(selected === pair.label ? "" : pair.label)}
            className={`flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-sm ${selected === pair.label ? "bg-surface-raised text-accent" : "text-foreground/80"}`}
          >
            <PairIcon pair={pair} />
            {pair.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ViewTabs({
  selected,
  onSelect,
}: {
  selected: View;
  onSelect: (value: View) => void;
}) {
  return (
    <div className={styles.viewTabs} role="tablist" aria-label="Token views">
      {views.map((view) => (
        <button
          key={view.label}
          type="button"
          role="tab"
          aria-selected={selected === view.label}
          className={`${styles.viewTab} ${selected === view.label ? styles.viewTabActive : ""}`}
          onClick={() => onSelect(view.label)}
        >
          <AssetIcon src={view.icon} width={view.width} height={view.height} />
          {view.label}
        </button>
      ))}
    </div>
  );
}

function formatCreated(value: string | undefined) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { created: "—", age: "" };
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const created =
    minutes < 1 ? "just now"
    : minutes < 60 ? `${minutes} ${minutes === 1 ? "min" : "mins"} ago`
    : hours < 24 ? `${hours} ${hours === 1 ? "hr" : "hrs"} ago`
    : days < 30 ? `${days} ${days === 1 ? "day" : "days"} ago`
    : `${months} ${months === 1 ? "mo" : "mos"} ago`;
  return { created, age: created };
}

function formatQuote(amount: string, decimals: number, symbol: string) {
  if (
    !/^\d+$/.test(amount) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255 ||
    !symbol
  ) {
    return "—";
  }
  const [whole, fraction = ""] = formatUnits(BigInt(amount), decimals).split(".");
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return `${trimmed ? `${whole}.${trimmed}` : whole} ${symbol}`;
}

type MarketResponse = {
  available?: boolean;
  marketCap?: string;
  quoteDecimals?: number;
  quoteSymbol?: string;
  marketCapUsd?: number;
  priceUsd?: number | null;
  phase?: number;
};

type MarketSnapshot = {
  label: string;
  usd: number | null;
  phase: number | null;
  price: string;
};

const emptyMarket: MarketSnapshot = {
  label: "—",
  usd: null,
  phase: null,
  price: "—",
};

function formatMarket(market: MarketResponse) {
  if (!market.available) return "—";
  if (typeof market.marketCapUsd === "number") return formatUsd(market.marketCapUsd);
  if (
    market.marketCap == null ||
    market.quoteDecimals == null ||
    !market.quoteSymbol
  ) {
    return "—";
  }
  return formatQuote(market.marketCap, market.quoteDecimals, market.quoteSymbol);
}

function useLoadedValues<T>(
  tokens: string[],
  load: (token: string) => Promise<T>,
  fallback: T,
) {
  const key = tokens.join(",");
  const [values, setValues] = useState<Record<string, T>>({});
  const [settledKey, setSettledKey] = useState("");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void Promise.all(key.split(",").map(async (token) => {
      try {
        return [token.toLowerCase(), await load(token)] as const;
      } catch {
        return [token.toLowerCase(), fallback] as const;
      }
    })).then((rows) => {
      if (!cancelled) {
        setValues(Object.fromEntries(rows));
        setSettledKey(key);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, load, fallback]);
  return { values, loading: key !== "" && key !== settledKey };
}

function priceLabel(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatPriceUsd(value) : "—";
}

function useTokenMarkets(tokens: string[]) {
  const load = useMemo(
    () => async (token: string): Promise<MarketSnapshot> => {
      const response = await fetch(`/api/market/${token}`);
      if (!response.ok) return emptyMarket;
      const market = (await response.json()) as MarketResponse;
      return {
        label: formatMarket(market),
        usd: typeof market.marketCapUsd === "number" ? market.marketCapUsd : null,
        phase: typeof market.phase === "number" ? market.phase : null,
        price: priceLabel(market.priceUsd),
      };
    },
    [],
  );
  return useLoadedValues(tokens, load, emptyMarket);
}

function rankValue(value: number | null) {
  return value == null || !Number.isFinite(value) ? Number.NEGATIVE_INFINITY : value;
}

function arrangeTokens(tokens: Token[], view: View) {
  const ranked = [...tokens];
  if (view === "New") {
    ranked.sort((a, b) => b.launchedAt - a.launchedAt);
    return ranked;
  }
  if (view === "Graduated") {
    return ranked
      .filter((token) => token.graduated)
      .sort((a, b) => rankValue(b.marketCapUsd) - rankValue(a.marketCapUsd));
  }
  ranked.sort((a, b) => rankValue(b.marketCapUsd) - rankValue(a.marketCapUsd));
  return ranked;
}

function MetricValue({
  value,
  className,
}: {
  value: string | null;
  className?: string;
}) {
  if (value == null) {
    return <span className="shimmer inline-block h-4 w-16 rounded" aria-hidden />;
  }
  return <strong className={className}>{value}</strong>;
}

function LoadingRows() {
  return (
    <div className={styles.tableBody} role="rowgroup" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={styles.tokenRow} role="row">
          <div className={styles.tokenIdentity} role="cell">
            <span className="shimmer size-16 shrink-0 rounded-[10px] sm:size-20 lg:size-24" />
            <span className="flex min-w-0 flex-col gap-2">
              <span className="shimmer h-4 w-28 rounded" />
              <span className="shimmer h-3 w-16 rounded" />
            </span>
          </div>
          <span className="shimmer h-4 w-16 rounded" role="cell" />
          <span className="shimmer h-4 w-16 rounded" role="cell" />
          <span className="shimmer h-4 w-20 rounded" role="cell" />
          <span className="shimmer h-4 w-14 rounded" role="cell" />
        </div>
      ))}
    </div>
  );
}

function TokenRow({ token }: { token: Token }) {
  return (
    <Link href={`/token/${token.id}`} className={styles.tokenRow} role="row">
      <div className={styles.tokenIdentity} role="cell">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={token.image}
          alt=""
          className={styles.tokenImage}
          width={97}
          height={97}
          referrerPolicy="no-referrer"
        />
        <div className={styles.tokenNames}>
          <strong>{token.name}</strong>
          <span>{token.symbol}</span>
        </div>
      </div>
      <div className={styles.metric} role="cell">
        <span className={styles.metricLabel}>MCAP</span>
        <MetricValue value={token.marketCap} className={styles.marketCap} />
      </div>
      <div className={styles.metric} role="cell">
        <span className={styles.metricLabel}>Price</span>
        <MetricValue value={token.price} className={styles.metricValue} />
      </div>
      <div className={styles.metric} role="cell">
        <span className={styles.metricLabel}>Age</span>
        <strong className={styles.metricValue}>{token.age}</strong>
      </div>
      {/*
      <div className={styles.metric} role="cell">
        <span className={styles.metricLabel}>24h</span>
        <strong className={styles.change}>{token.change24h}</strong>
      </div>
      */}
      <div className={styles.metric} role="cell">
        <span className={styles.metricLabel}>Paired with</span>
        <div className={styles.pairCell}>
          <PairIcon pair={token.pair} />
          <span>{token.pair.label}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyTokens({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface [&_img]:size-8">
        <AssetIcon src={icons.logoMark} width={32} height={32} />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-foreground">
        {filtered ? "No tokens match" : "No tokens yet"}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
        {filtered
          ? "Nothing in this view matches your search or filters."
          : "Profile tokens launched on Rovo will show up here."}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 rounded-[10px] border border-line bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-accent hover:text-accent"
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/launch"
          className="mt-6 rounded-[10px] bg-action px-4 py-2 text-sm font-medium text-ink hover:bg-action-hover"
        >
          Launch a token
        </Link>
      )}
    </div>
  );
}

function MobileHome({
  tokens,
  selectedPair,
  onPairSelect,
  view,
  onView,
  filtered,
  onClear,
  loading,
}: {
  tokens: Token[];
  selectedPair: string;
  onPairSelect: (value: string) => void;
  view: View;
  onView: (value: View) => void;
  filtered: boolean;
  onClear: () => void;
  loading: boolean;
}) {
  return (
    <main className="min-h-full bg-canvas px-4 pb-8 text-foreground md:hidden">
      <div className="flex items-center gap-3 pt-6">
        <PairFilters selected={selectedPair} onSelect={onPairSelect} />
        <Link
          href="/launch"
          aria-label="Launch a token"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-3xl font-light leading-none text-ink"
        >
          +
        </Link>
      </div>

      <div className="mt-4">
        <ViewTabs selected={view} onSelect={onView} />
      </div>

      <div key={view} aria-label="Tokens" className="motion-content mt-2">
        {loading &&
          tokens.length === 0 &&
          Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex min-h-[86px] items-center gap-3 border-b border-line py-3"
              aria-hidden
            >
              <span className="shimmer size-[54px] shrink-0 rounded-xl" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="shimmer h-4 w-28 rounded" />
                <span className="shimmer h-3 w-16 rounded" />
              </span>
              <span className="flex shrink-0 flex-col items-end gap-2">
                <span className="shimmer h-4 w-16 rounded" />
                <span className="shimmer h-3 w-12 rounded" />
              </span>
            </div>
          ))}
        {tokens.map((token) => (
          <Link
            key={token.id}
            href={`/token/${token.id}`}
            className="flex min-h-[86px] items-center gap-3 border-b border-line py-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={token.image}
              alt=""
              width={54}
              height={54}
              className="size-[54px] shrink-0 rounded-xl object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-base leading-tight">
                {token.name}
              </strong>
              <span className="mt-1 block truncate text-sm text-muted">
                {token.symbol}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <MetricValue
                value={token.marketCap}
                className="block text-base leading-tight text-accent"
              />
              <span className="mt-1 block text-sm font-medium text-muted">
                MCAP
              </span>
              <MetricValue value={token.price} className="mt-1 block text-sm leading-tight" />
              <span className="block text-xs font-medium text-muted">Price</span>
            </div>
          </Link>
        ))}
        {tokens.length === 0 && !loading && (
          <EmptyTokens filtered={filtered} onClear={onClear} />
        )}
      </div>
    </main>
  );
}

function TokenTable({
  tokens,
  view,
  onView,
  filtered,
  onClear,
  loading,
}: {
  tokens: Token[];
  view: View;
  onView: (value: View) => void;
  filtered: boolean;
  onClear: () => void;
  loading: boolean;
}) {
  return (
    <section className={styles.tablePanel} aria-label="Tokens">
      <ViewTabs selected={view} onSelect={onView} />
      {tokens.length === 0 && !loading ? (
        <EmptyTokens filtered={filtered} onClear={onClear} />
      ) : (
        <div key={view} className={`${styles.tableScroller} motion-content`}>
          <div
            className={styles.table}
            role="table"
            aria-label="Token market overview"
          >
            <div className={styles.tableHeader} role="row">
              {["Token", "MCAP", "Price", "Age", "Paired with"].map((label) => (
                <span key={label} role="columnheader">
                  {label}
                </span>
              ))}
            </div>
            {loading && tokens.length === 0 ? (
              <LoadingRows />
            ) : (
              <div className={styles.tableBody} role="rowgroup">
                {tokens.map((token) => (
                  <TokenRow key={token.id} token={token} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function HomeDashboard() {
  const { search, setSearch } = useAppSearch();
  const launches = useLaunches();
  const [selectedPair, setSelectedPair] = useState("Creators");
  const [view, setView] = useState<View>("Trending");
  const launchesData = launches.data?.launches;
  const launchTokens = (launchesData ?? []).map((launch) => launch.token);
  const markets = useTokenMarkets(launchTokens);
  const listLoading = launches.isPending;
  const tokens = useMemo(() => {
    const liveTokens = (launchesData ?? []).map((launch) => {
      const choice = pairChoices.find(
        (pair) =>
          pair.address.toLowerCase() === launch.pairToken.toLowerCase(),
      );
      const market = markets.values[launch.token.toLowerCase()];
      const launchedAt = new Date(launch.launchedAt).getTime();
      const meme = launch.launchType === "meme";
      return {
        id: launch.token,
        name: meme
          ? launch.displayName || launch.handle
          : `@${launch.handle}`,
        symbol: meme
          ? launch.handle.toUpperCase()
          : launch.launchType === "self"
            ? "Self-Rove"
            : "Scout",
        image: launch.imageUrl || "/figma-home/rovo-token.png",
        marketCap: markets.loading ? null : (market?.label ?? "—"),
        marketCapUsd: market?.usd ?? null,
        price: markets.loading ? null : (market?.price ?? "—"),
        ...formatCreated(launch.launchedAt),
        launchedAt: Number.isNaN(launchedAt) ? 0 : launchedAt,
        graduated: market?.phase != null && market.phase !== 0,
        pair: choice
          ? { label: choice.symbol, icon: choice.iconUrl }
          : { label: "Pair", icon: "/figma-home/rovo-mark.svg" },
        meme,
      };
    });
    const matched = liveTokens.filter((token) => {
      const matchesSearch = `${token.name} ${token.symbol}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesPair =
        selectedPair === "Memes"
          ? token.meme
          : !selectedPair ||
            selectedPair === "Creators" ||
            token.pair.label === selectedPair;
      return matchesSearch && matchesPair;
    });
    return arrangeTokens(matched, view);
  }, [launchesData, markets, search, selectedPair, view]);
  const launched = launches.data?.launches.length ?? 0;
  const waitingForPhase = view === "Graduated" && markets.loading;
  const filtered =
    tokens.length === 0 &&
    launched > 0 &&
    !waitingForPhase &&
    (search.trim() !== "" ||
      (selectedPair !== "" && selectedPair !== "Creators") ||
      view === "Graduated");
  const clearFilters = () => {
    setSearch("");
    setSelectedPair("Creators");
    setView("Trending");
  };
  return (
    <div className={styles.dashboard}>
      {launches.isError && (
        <p role="alert" className="px-4 pt-5 text-sm text-danger">
          Could not load launches from the Rovo API. Check that the API and
          indexer are running.
        </p>
      )}
      <MobileHome
        tokens={tokens}
        selectedPair={selectedPair}
        onPairSelect={setSelectedPair}
        view={view}
        onView={setView}
        filtered={filtered}
        onClear={clearFilters}
        loading={listLoading || waitingForPhase}
      />
      <main className={`${styles.main} hidden md:flex`}>
        <div className={styles.assetBar}>
          <PairFilters selected={selectedPair} onSelect={setSelectedPair} />
        </div>
        <TokenTable
          tokens={tokens}
          view={view}
          onView={setView}
          filtered={filtered}
          onClear={clearFilters}
          loading={listLoading || waitingForPhase}
        />
      </main>
    </div>
  );
}
