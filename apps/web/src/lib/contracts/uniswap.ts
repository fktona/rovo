import {
  formatUnits,
  parseAbi,
  type Address,
  type PublicClient,
} from "viem";
import { erc20Abi } from "./abis";

/** Official Uniswap v3 deployment on Robinhood Chain (4663). */
export const UNISWAP_WETH =
  "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address;
export const UNISWAP_SWAP_ROUTER =
  "0xCaf681a66D020601342297493863E78C959E5cb2" as Address;
export const UNISWAP_QUOTER_V2 =
  "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7" as Address;

const FEE_TIERS = [100, 500, 3000, 10000] as const;
const QUOTE_CALLER = "0x0000000000000000000000000000000000000001" as Address;

export const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

export const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

export type UniswapQuote = { fee: number; amountOut: bigint };

export function bestUniswapQuote(
  quotes: Array<UniswapQuote | null>,
): UniswapQuote | null {
  return quotes.reduce<UniswapQuote | null>((best, quote) => {
    if (!quote || quote.amountOut <= 0n) return best;
    if (!best || quote.amountOut > best.amountOut) return quote;
    return best;
  }, null);
}

/** Display a quoted token amount without trailing zeros. */
export function formatQuoteAmount(amount: bigint, decimals: number) {
  const raw = formatUnits(amount, decimals);
  const dot = raw.indexOf(".");
  if (dot === -1) return raw;
  const whole = raw.slice(0, dot);
  const frac = raw.slice(dot + 1).replace(/0+$/, "");
  if (!frac) return whole;
  const head = frac.slice(0, 6).replace(/0+$/, "");
  if (head && /[1-9]/.test(head)) return `${whole}.${head}`;
  const leadingZeros = frac.match(/^0*/)?.[0].length ?? 0;
  return `0.${"0".repeat(leadingZeros)}${frac.slice(leadingZeros, leadingZeros + 6)}`;
}

/** Best single-hop Uniswap v3 quote for native ETH into `tokenOut`. */
export async function quoteEthForToken(
  client: PublicClient,
  tokenOut: Address,
  amountIn: bigint,
) {
  if (amountIn <= 0n) throw new Error("Enter an ETH amount to swap.");
  const quotes = await Promise.all(
    FEE_TIERS.map(async (fee) => {
      try {
        const result = await client.simulateContract({
          address: UNISWAP_QUOTER_V2,
          abi: quoterV2Abi,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: UNISWAP_WETH,
              tokenOut,
              amountIn,
              fee,
              sqrtPriceLimitX96: 0n,
            },
          ],
          account: QUOTE_CALLER,
        });
        const amountOut = result.result[0];
        return amountOut > 0n ? { fee, amountOut } : null;
      } catch {
        return null;
      }
    }),
  );
  const best = bestUniswapQuote(quotes);
  if (!best) throw new Error("Uniswap has no ETH pool for this token.");
  const decimals = await client.readContract({
    address: tokenOut,
    abi: erc20Abi,
    functionName: "decimals",
  });
  return { ...best, decimals };
}
