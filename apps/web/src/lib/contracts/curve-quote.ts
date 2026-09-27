const BPS = 10_000n;

/** Opening buys protect the quoted output with 2% slippage. */
export const OPENING_BUY_SLIPPAGE_BPS = 200n;

/**
 * Tokens a fresh Pons v2 curve pays for `quoteIn`.
 * Mirrors `PonsV2BondingCurve.buy` on an empty curve: base fee and creator
 * tax come off the quote, the constant-product fill uses the remainder, and
 * a buy past the sellable allocation is clamped to that allocation. The
 * opening-buy recipient is snipe-tax exempt, so that tax is zero here.
 */
export function quoteOpeningBuy(input: {
  quoteIn: bigint;
  supply: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
}): bigint {
  const { quoteIn, supply, phantomQuote, graduationThreshold, feeBps, creatorTaxBps } = input;
  if (
    quoteIn <= 0n ||
    supply <= 0n ||
    phantomQuote <= 0n ||
    graduationThreshold <= 0n ||
    feeBps < 0n ||
    creatorTaxBps < 0n ||
    feeBps + creatorTaxBps >= BPS
  ) {
    return 0n;
  }

  const net = quoteIn - (quoteIn * feeBps) / BPS - (quoteIn * creatorTaxBps) / BPS;
  if (net <= 0n) return 0n;

  const unclamped = (net * supply) / (phantomQuote + net);
  const reserved = (supply * phantomQuote) / (phantomQuote + graduationThreshold);
  if (reserved === 0n || reserved >= supply) return 0n;
  const sellable = supply - reserved;
  return unclamped > sellable ? sellable : unclamped;
}

export function minTokensAtSlippage(
  tokensOut: bigint,
  slippageBps = OPENING_BUY_SLIPPAGE_BPS,
): bigint {
  if (tokensOut <= 0n || slippageBps < 0n || slippageBps >= BPS) return 0n;
  return (tokensOut * (BPS - slippageBps)) / BPS;
}

const ceilDiv = (numerator: bigint, denominator: bigint) =>
  denominator <= 0n ? 0n : (numerator + denominator - 1n) / denominator;

/** Constant product in the curve's integer order. Fees are applied outside this step. */
export function curveAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  return (amountIn * reserveOut) / (reserveIn + amountIn);
}

function curveAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint) {
  if (amountOut <= 0n || reserveOut <= amountOut || reserveIn <= 0n) return 0n;
  return (amountOut * reserveIn) / (reserveOut - amountOut) + 1n;
}

export type CurveBuyQuote = {
  tokensOut: bigint;
  spent: bigint;
  refund: bigint;
};

/**
 * Quote asset in, launch token out. Matches the Pons v2 curve: fees and the
 * snipe tax come off the input, then a buy past `sellable` is clamped and the
 * unused quote is refunded.
 */
export function quoteCurveBuy(input: {
  quoteIn: bigint;
  quoteReserve: bigint;
  tokenReserve: bigint;
  sellable: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
  snipeBps: bigint;
}): CurveBuyQuote {
  const { quoteIn, quoteReserve, tokenReserve, sellable, feeBps, creatorTaxBps } = input;
  if (quoteIn <= 0n || sellable <= 0n) {
    return { tokensOut: 0n, spent: 0n, refund: quoteIn > 0n ? quoteIn : 0n };
  }
  let snipeBps = input.snipeBps > 0n ? input.snipeBps : 0n;
  if (snipeBps > 0n) {
    const maxSnipeBps = BPS - feeBps - creatorTaxBps - 100n;
    const cap = maxSnipeBps > 0n ? maxSnipeBps : 0n;
    if (snipeBps > cap) snipeBps = cap;
  }
  const feeRate = feeBps + creatorTaxBps + snipeBps;
  if (feeRate < 0n || feeRate >= BPS) {
    return { tokensOut: 0n, spent: 0n, refund: quoteIn };
  }
  const fee = (quoteIn * feeBps) / BPS;
  const tax = (quoteIn * creatorTaxBps) / BPS;
  const snipeTax = (quoteIn * snipeBps) / BPS;
  const netIn = quoteIn - fee - tax - snipeTax;
  let tokensOut = curveAmountOut(netIn, quoteReserve, tokenReserve);
  let spent = quoteIn;
  if (tokensOut > sellable) {
    tokensOut = sellable;
    const net = curveAmountIn(sellable, quoteReserve, tokenReserve);
    if (net <= 0n) return { tokensOut: 0n, spent: 0n, refund: quoteIn };
    const grossed = ceilDiv(net * BPS, BPS - feeRate);
    spent = grossed < quoteIn ? grossed : quoteIn;
  }
  if (tokensOut <= 0n) return { tokensOut: 0n, spent: 0n, refund: quoteIn };
  return { tokensOut, spent, refund: quoteIn - spent };
}

/** Launch token in, quote asset out. The curve prices the sell, then takes fees from the output. */
export function quoteCurveSell(input: {
  tokensIn: bigint;
  quoteReserve: bigint;
  tokenReserve: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
}): bigint {
  const { tokensIn, quoteReserve, tokenReserve, feeBps, creatorTaxBps } = input;
  if (tokensIn <= 0n || feeBps < 0n || creatorTaxBps < 0n || feeBps + creatorTaxBps >= BPS) {
    return 0n;
  }
  const gross = curveAmountOut(tokensIn, tokenReserve, quoteReserve);
  const fee = (gross * feeBps) / BPS;
  const tax = (gross * creatorTaxBps) / BPS;
  const out = gross - fee - tax;
  return out > 0n ? out : 0n;
}
