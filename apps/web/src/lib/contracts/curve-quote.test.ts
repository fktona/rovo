import { describe, expect, it } from "vitest";
import {
  minTokensAtSlippage,
  quoteCurveBuy,
  quoteCurveSell,
  quoteOpeningBuy,
} from "./curve-quote";

const live = {
  supply: 1_000_000_000_000_000_000_000_000_000n,
  phantomQuote: 1_680_000_000_000_000_000n,
  graduationThreshold: 4_200_000_000_000_000_000n,
  feeBps: 100n,
  creatorTaxBps: 100n,
};

describe("quoteOpeningBuy", () => {
  it("quotes an unclamped opening buy with fees removed first", () => {
    expect(quoteOpeningBuy({ ...live, quoteIn: 10n ** 18n })).toBe(
      368_421_052_631_578_947_368_421_052n,
    );
  });

  it("clamps a buy that would pass the sellable allocation", () => {
    expect(quoteOpeningBuy({ ...live, quoteIn: 100n * 10n ** 18n })).toBe(
      714_285_714_285_714_285_714_285_715n,
    );
  });

  it("returns zero when the curve cannot price the trade", () => {
    expect(quoteOpeningBuy({ ...live, quoteIn: 0n })).toBe(0n);
    expect(
      quoteOpeningBuy({ ...live, quoteIn: 10n ** 18n, feeBps: 9_900n, creatorTaxBps: 200n }),
    ).toBe(0n);
  });
});

describe("minTokensAtSlippage", () => {
  it("keeps 98% of the quoted tokens", () => {
    expect(minTokensAtSlippage(368_421_052_631_578_947_368_421_052n)).toBe(
      361_052_631_578_947_368_421_052_630n,
    );
  });

  it("returns zero when 2% rounds the output away", () => {
    expect(minTokensAtSlippage(1n)).toBe(0n);
  });
});

describe("quoteCurveBuy", () => {
  const reserves = {
    quoteReserve: 1_000n,
    tokenReserve: 1_000n,
    sellable: 500n,
    feeBps: 100n,
    creatorTaxBps: 100n,
    snipeBps: 0n,
  };

  it("takes fees off the input before pricing", () => {
    expect(quoteCurveBuy({ ...reserves, quoteIn: 1_000n })).toEqual({
      tokensOut: 494n,
      spent: 1_000n,
      refund: 0n,
    });
  });

  it("clamps a buy at the sellable allocation and refunds the unused quote", () => {
    expect(quoteCurveBuy({ ...reserves, quoteIn: 1_000n, sellable: 100n })).toEqual({
      tokensOut: 100n,
      spent: 115n,
      refund: 885n,
    });
  });

  it("caps the snipe tax so the buyer still nets at least 1%", () => {
    const quoted = quoteCurveBuy({ ...reserves, quoteIn: 10_000n, snipeBps: 9_900n });
    expect(quoted.tokensOut).toBeGreaterThan(0n);
  });
});

describe("quoteCurveSell", () => {
  it("prices the sell and then takes fees from the output", () => {
    expect(
      quoteCurveSell({
        tokensIn: 100n,
        quoteReserve: 1_000n,
        tokenReserve: 1_000n,
        feeBps: 1_000n,
        creatorTaxBps: 1_000n,
      }),
    ).toBe(72n);
  });
});
