import type { LaunchPair } from "@/lib/raydium/pairs";
import {
  creatorFeeBpsForSource,
  type PumpQuoteSource,
} from "./fees";

export type PumpLaunchPair = LaunchPair & {
  source: PumpQuoteSource;
  creatorFeeBps: number;
};

export function toPumpLaunchPairs(
  supported: readonly { mint: string; source: PumpQuoteSource }[],
  catalog: readonly LaunchPair[],
): PumpLaunchPair[] {
  const known = new Map(catalog.map((pair) => [pair.mint, pair]));
  const seen = new Set<string>();
  const pairs: PumpLaunchPair[] = [];
  for (const quote of supported) {
    if (seen.has(quote.mint)) continue;
    seen.add(quote.mint);
    const match = known.get(quote.mint);
    const creatorFeeBps = creatorFeeBpsForSource(quote.source) ?? 0;
    pairs.push({
      mint: quote.mint,
      symbol:
        match?.symbol ?? (quote.source === "sol" ? "SOL" : quote.mint.slice(0, 4)),
      name:
        match?.name ?? (quote.source === "sol" ? "Solana" : "Pump quote"),
      iconUrl: match?.iconUrl ?? "",
      kind: match?.kind ?? "other",
      source: quote.source,
      creatorFeeBps,
    });
  }
  return pairs;
}
