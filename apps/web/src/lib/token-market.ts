import { formatUnits } from "viem";

/** Quote amount times a USD price for one whole quote token. */
export function quoteAmountUsd(
  amount: bigint,
  decimals: number,
  priceUsd: number,
): number | null {
  if (
    amount < 0n ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255 ||
    !Number.isFinite(priceUsd) ||
    priceUsd <= 0
  ) {
    return null;
  }
  const units = Number(formatUnits(amount, decimals));
  return Number.isFinite(units) ? units * priceUsd : null;
}

/** Quote-asset market cap from the curve spot price: quoteReserve / tokenReserve × supply. */
export function marketCapInQuote(
  quoteReserve: bigint,
  tokenReserve: bigint,
  totalSupply: bigint,
): bigint | null {
  if (quoteReserve < 0n || tokenReserve <= 0n || totalSupply <= 0n) return null;
  return (quoteReserve * totalSupply) / tokenReserve;
}

export type DexscreenerPair = {
  chainId?: string;
  baseToken?: { address?: string };
  marketCap?: number | null;
  fdv?: number | null;
  priceUsd?: string | number | null;
  liquidity?: { usd?: number | null } | null;
};

/** Quote paid for one whole token: quoteReserve / tokenReserve, scaled to token decimals. */
export function spotPriceInQuote(
  quoteReserve: bigint,
  tokenReserve: bigint,
  tokenDecimals: number,
): bigint | null {
  if (
    quoteReserve < 0n ||
    tokenReserve <= 0n ||
    !Number.isInteger(tokenDecimals) ||
    tokenDecimals < 0 ||
    tokenDecimals > 255
  ) {
    return null;
  }
  return (quoteReserve * 10n ** BigInt(tokenDecimals)) / tokenReserve;
}

function rankedRobinhoodPairs(pairs: DexscreenerPair[], token: string) {
  return pairs
    .filter(
      (pair) =>
        pair.chainId === "robinhood" &&
        pair.baseToken?.address?.toLowerCase() === token.toLowerCase(),
    )
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
}

function pairPriceUsd(pair: DexscreenerPair) {
  const price =
    typeof pair.priceUsd === "number" ? pair.priceUsd : Number(pair.priceUsd);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

/** Market cap and price from the deepest Robinhood pool for this token. */
export function dexscreenerStats(
  pairs: DexscreenerPair[],
  token: string,
): { marketCap: number; priceUsd: number | null } | null {
  const ranked = rankedRobinhoodPairs(pairs, token);
  const pair =
    ranked.find(
      (item) => typeof item.marketCap === "number" && Number.isFinite(item.marketCap),
    ) ??
    ranked.find((item) => typeof item.fdv === "number" && Number.isFinite(item.fdv));
  if (!pair) return null;
  const marketCap =
    typeof pair.marketCap === "number" && Number.isFinite(pair.marketCap)
      ? pair.marketCap
      : pair.fdv;
  if (typeof marketCap !== "number") return null;
  return { marketCap, priceUsd: pairPriceUsd(pair) };
}

/** USD market cap from DexScreener pairs, preferring the deepest pool for this token. */
export function dexscreenerMarketCap(
  pairs: DexscreenerPair[],
  token: string,
): number | null {
  return dexscreenerStats(pairs, token)?.marketCap ?? null;
}

/** USD price of one whole token from the deepest Robinhood pool where it is the base. */
export function dexscreenerTokenPriceUsd(
  pairs: DexscreenerPair[],
  token: string,
): number | null {
  for (const pair of rankedRobinhoodPairs(pairs, token)) {
    const price = pairPriceUsd(pair);
    if (price != null && price > 0) return price;
  }
  return null;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const units = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ] as const;
  for (const [size, suffix] of units) {
    if (value >= size) {
      const scaled = value / size;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `$${scaled.toFixed(digits).replace(/\.0+$/, "")}${suffix}`;
    }
  }
  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toPrecision(2)}`;
}

const PRICE_SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

function subscript(value: number) {
  return String(value)
    .split("")
    .map((digit) => PRICE_SUBSCRIPTS[Number(digit)])
    .join("");
}

export function formatPriceUsd(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value === 0) return "$0";
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.0001) return `$${value.toFixed(value >= 0.01 ? 4 : 6).replace(/\.?0+$/, "")}`;
  const match = value.toFixed(20).match(/^0\.(0+)(\d+)/);
  if (!match?.[1] || !match[2]) return `$${value.toPrecision(2)}`;
  const zeros = match[1].length;
  let digits = match[2].slice(0, 4).padEnd(4, "0");
  if (Number(match[2][4] ?? "0") >= 5) {
    const rounded = String(Number(digits) + 1).padStart(4, "0");
    if (rounded.length > 4) return `$0.0${subscript(zeros - 1)}1000`;
    digits = rounded;
  }
  return `$0.0${subscript(zeros)}${digits}`;
}
