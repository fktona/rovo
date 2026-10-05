import { describe, expect, it } from "vitest";
import {
  applySlippage,
  formatTokenAmount,
  maxSpendForSlippage,
  pumpTradeVenue,
} from "./trade-math";

describe("pump trade math", () => {
  it("uses the bonding curve until the coin graduates", () => {
    expect(pumpTradeVenue(false)).toBe("pump");
    expect(pumpTradeVenue(true)).toBe("pumpswap");
  });

  it("matches the SDK percent slippage", () => {
    expect(applySlippage(1000n, 2, "raise")).toBe(1020n);
    expect(applySlippage(1000n, 2, "lower")).toBe(980n);
    expect(applySlippage(1000n, 0.5, "raise")).toBe(1005n);
    expect(maxSpendForSlippage(1000n, 2)).toBe(980n);
    expect(applySlippage(maxSpendForSlippage(1000n, 2), 2, "raise") <= 1000n).toBe(
      true,
    );
  });

  it("formats raw token amounts without rounding up", () => {
    expect(formatTokenAmount(1_500_000n, 6)).toBe("1.5");
    expect(formatTokenAmount(10n, 6)).toBe("0.00001");
    expect(formatTokenAmount(0n, 9)).toBe("0");
  });
});
