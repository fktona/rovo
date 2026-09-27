import { describe, expect, it } from "vitest";
import { bestUniswapQuote, formatQuoteAmount } from "./uniswap";

describe("bestUniswapQuote", () => {
  it("keeps the fee tier that returns the most tokens", () => {
    expect(
      bestUniswapQuote([
        null,
        { fee: 100, amountOut: 0n },
        { fee: 500, amountOut: 12n },
        { fee: 3000, amountOut: 11n },
      ]),
    ).toEqual({ fee: 500, amountOut: 12n });
  });

  it("returns null when every pool quote failed", () => {
    expect(bestUniswapQuote([null, { fee: 100, amountOut: 0n }])).toBeNull();
  });
});

describe("formatQuoteAmount", () => {
  it("trims a normal quote and keeps leading zeros on a tiny quote", () => {
    expect(formatQuoteAmount(12_041_603_723_935_685n, 18)).toBe("0.012041");
    expect(formatQuoteAmount(1_000_000_000_000_000_000n, 18)).toBe("1");
    expect(formatQuoteAmount(1000n, 18)).toBe("0.000000000000001");
  });
});
