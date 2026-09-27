import { dexscreenerTokenPriceUsd } from "./token-market";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

/** USD price of one whole token, from the deepest Robinhood DexScreener pool. */
export async function fetchTokenPriceUsd(token: string): Promise<number | null> {
  if (!addressPattern.test(token)) return null;
  try {
    const response = await fetch(
      `https://api.dexscreener.com/tokens/v1/robinhood/${token}`,
      { next: { revalidate: 60 } },
    );
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return dexscreenerTokenPriceUsd(Array.isArray(body) ? body : [], token);
  } catch {
    return null;
  }
}
