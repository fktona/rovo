import { describe, expect, it } from "vitest";
import { creatorFeeBpsForSource, creatorFeeLabel, parseTokenAmount } from "./fees";
import { toPumpLaunchPairs } from "./quotes";
import type { LaunchPair } from "@/lib/raydium/pairs";

const catalog: LaunchPair[] = [
  {
    symbol: "SOL",
    name: "Wrapped SOL",
    mint: "So11111111111111111111111111111111111111112",
    iconUrl: "/sol.png",
    kind: "crypto",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    iconUrl: "/usdc.png",
    kind: "crypto",
  },
];

describe("pump creator fee", () => {
  it("charges 2% only on quote-control pairs", () => {
    expect(creatorFeeBpsForSource("quoteControl")).toBe(200);
    expect(creatorFeeBpsForSource("sol")).toBeUndefined();
    expect(creatorFeeBpsForSource("global")).toBeUndefined();
    expect(creatorFeeLabel("quoteControl")).toBe("2%");
    expect(creatorFeeLabel("sol")).toBe("Pump schedule");
  });

  it("keeps catalog names and drops mints Pump does not list", () => {
    const pairs = toPumpLaunchPairs(
      [
        { mint: catalog[0]!.mint, source: "sol" },
        { mint: catalog[1]!.mint, source: "global" },
        {
          mint: "Hg5Ja55T5wESq4vyFoiVCMeHXtGyVA69X2UHq8hgpump",
          source: "quoteControl",
        },
      ],
      catalog,
    );
    expect(pairs.map((pair) => [pair.symbol, pair.creatorFeeBps])).toEqual([
      ["SOL", 0],
      ["USDC", 0],
      ["Hg5J", 200],
    ]);
    expect(pairs[2]?.source).toBe("quoteControl");
  });

  it("parses a quote amount in the mint's decimals", () => {
    expect(parseTokenAmount("1.5", 6)).toBe(1_500_000n);
    expect(parseTokenAmount("0", 9)).toBe(0n);
    expect(() => parseTokenAmount("1.0000001", 6)).toThrow(/decimal/);
  });
});
