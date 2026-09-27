import { describe, expect, it } from "vitest";
import {
  dexscreenerMarketCap,
  formatPriceUsd,
  dexscreenerTokenPriceUsd,
  formatUsd,
  marketCapInQuote,
  quoteAmountUsd,
  spotPriceInQuote,
} from "./token-market";

describe("marketCapInQuote", () => {
  it("prices the full supply from curve reserves", () => {
    expect(
      marketCapInQuote(
        1869803888004922544n,
        898489949014148774444562620n,
        1000000000000000000000000000n,
      ),
    ).toBe(2081051535475193407n);
  });

  it("returns null when the curve holds no tokens", () => {
    expect(marketCapInQuote(1n, 0n, 1n)).toBeNull();
  });
});

describe("dexscreenerMarketCap", () => {
  const token = "0xFAd17D7cc41D9C9CA4A459Da798a4446dD217974";

  it("uses the deepest Robinhood pool where this token is the base", () => {
    expect(
      dexscreenerMarketCap(
        [
          {
            chainId: "robinhood",
            baseToken: { address: token },
            marketCap: 100,
            liquidity: { usd: 10 },
          },
          {
            chainId: "robinhood",
            baseToken: { address: token },
            marketCap: 430082,
            liquidity: { usd: 63279 },
          },
          {
            chainId: "base",
            baseToken: { address: token },
            marketCap: 9,
            liquidity: { usd: 1_000_000 },
          },
          {
            chainId: "robinhood",
            baseToken: { address: "0x1111111111111111111111111111111111111111" },
            marketCap: 999999,
            liquidity: { usd: 1_000_000 },
          },
        ],
        token.toLowerCase(),
      ),
    ).toBe(430082);
  });

  it("falls back to fdv when market cap is missing", () => {
    expect(
      dexscreenerMarketCap(
        [
          {
            chainId: "robinhood",
            baseToken: { address: token },
            marketCap: null,
            fdv: 12_500,
            liquidity: { usd: 1 },
          },
        ],
        token,
      ),
    ).toBe(12_500);
  });
});

describe("dexscreenerTokenPriceUsd", () => {
  const googl = "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3";

  it("uses the deepest pool price for the quote token", () => {
    expect(
      dexscreenerTokenPriceUsd(
        [
          {
            chainId: "robinhood",
            baseToken: { address: googl },
            priceUsd: "100",
            liquidity: { usd: 10 },
          },
          {
            chainId: "robinhood",
            baseToken: { address: googl },
            priceUsd: "344.44",
            liquidity: { usd: 968452 },
          },
        ],
        googl,
      ),
    ).toBe(344.44);
  });
});

describe("spotPriceInQuote", () => {
  it("prices one whole token from the curve reserves", () => {
    expect(
      spotPriceInQuote(2_000n * 10n ** 18n, 1_000n * 10n ** 18n, 18),
    ).toBe(2n * 10n ** 18n);
  });
});

describe("quoteAmountUsd", () => {
  it("converts a whole ether amount at the live ETH price", () => {
    expect(quoteAmountUsd(10n ** 18n, 18, 2714.65)).toBeCloseTo(2714.65);
  });
});

describe("formatUsd", () => {
  it("compacts dollar market caps", () => {
    expect(formatUsd(430082)).toBe("$430K");
    expect(formatUsd(1_250_000)).toBe("$1.25M");
    expect(formatUsd(12.5)).toBe("$12.50");
  });

  it("writes tiny prices with a subscript zero count", () => {
    expect(formatPriceUsd(0.0000792)).toBe("$0.0₄7920");
    expect(formatPriceUsd(0.00000564019)).toBe("$0.0₅5640");
  });
});
