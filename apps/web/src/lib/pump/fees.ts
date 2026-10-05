export const PUMP_CREATOR_FEE_BPS = 200;

export type PumpQuoteSource = "sol" | "global" | "quoteControl";

/** 2% only on QuoteControl mints. SOL and the global whitelist (USDC) use Pump's schedule. */
export function creatorFeeBpsForSource(source: PumpQuoteSource) {
  return source === "quoteControl" ? PUMP_CREATOR_FEE_BPS : undefined;
}

export function creatorFeeLabel(source: PumpQuoteSource | undefined) {
  if (!source) return "—";
  return source === "quoteControl" ? "2%" : "Pump schedule";
}

export function parseTokenAmount(value: string, decimals: number) {
  const amount = value.trim() || "0";
  if (!/^\d+(?:\.\d+)?$/.test(amount)) {
    throw new Error("Enter a valid buy amount.");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("This pair has an unsupported decimal count.");
  }
  const [whole = "0", fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new Error(
      decimals === 0
        ? "This pair does not use decimal places."
        : `This pair supports at most ${decimals} decimal places.`,
    );
  }
  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  );
}
