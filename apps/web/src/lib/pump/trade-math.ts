export type PumpTradeVenue = "pump" | "pumpswap";

/** Leaves room for the network fee and a new token account when buying with SOL. */
export const SOL_BUY_RESERVE = 10_000_000n;

/** Bonding curve until the coin is marked complete, then its canonical PumpSwap pool. */
export function pumpTradeVenue(complete: boolean): PumpTradeVenue {
  return complete ? "pumpswap" : "pump";
}

/**
 * Same percent slippage the Pump and PumpSwap SDKs apply:
 * `amount * floor(percent * 10) / 1000`.
 */
export function applySlippage(
  amount: bigint,
  slippagePercent: number,
  direction: "raise" | "lower",
) {
  assertSlippage(slippagePercent);
  const delta = (amount * BigInt(Math.floor(slippagePercent * 10))) / 1000n;
  const next = direction === "raise" ? amount + delta : amount - delta;
  return next < 0n ? 0n : next;
}

/** Largest quote spend whose slippage-raised maximum still fits in `balance`. */
export function maxSpendForSlippage(balance: bigint, slippagePercent: number) {
  assertSlippage(slippagePercent);
  if (balance <= 0n) return 0n;
  const factor = 1000n + BigInt(Math.floor(slippagePercent * 10));
  return (balance * 1000n) / factor;
}

export function formatTokenAmount(amount: bigint, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("This pair has an unsupported decimal count.");
  }
  const negative = amount < 0n;
  const value = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

function assertSlippage(slippagePercent: number) {
  if (
    !Number.isFinite(slippagePercent) ||
    slippagePercent < 0 ||
    slippagePercent >= 50
  ) {
    throw new Error("Slippage must be between 0 and 50 percent.");
  }
}
