import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { ponsFactoryAbi } from "./abis";

/** Uniswap v4 on Robinhood Chain (4663). */
export const UNISWAP_V4_ROUTER =
  "0x8876789976decbfcbbbe364623c63652db8c0904" as Address;
export const UNISWAP_V4_QUOTER =
  "0x8dc178efb8111bb0973dd9d722ebeff267c98f94" as Address;
export const PERMIT2 =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
/** Shared Pons hook on every graduated pool. */
export const PONS_MEME_HOOK =
  "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as Address;

const UINT128_MAX = 2n ** 128n - 1n;
const SWAP_EXACT_IN_SINGLE = 6;
const SETTLE_ALL = 12;
const TAKE_ALL = 15;
const V4_SWAP_COMMAND = "0x10" as Hex;

const poolKeyComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

export const v4QuoterAbi = parseAbi([
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)",
]);

export const universalRouterAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);

export const permit2Abi = parseAbi([
  "function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);

export type V4PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export function graduatedPoolKey(input: {
  token: Address;
  pairToken: Address;
  poolFee: number;
  tickSpacing: number;
  hooks: Address;
}): V4PoolKey {
  const hooks = input.hooks === zeroAddress ? PONS_MEME_HOOK : input.hooks;
  const tokenFirst = input.token.toLowerCase() < input.pairToken.toLowerCase();
  const [currency0, currency1] = tokenFirst
    ? [input.token, input.pairToken]
    : [input.pairToken, input.token];
  return {
    currency0,
    currency1,
    fee: input.poolFee,
    tickSpacing: input.tickSpacing,
    hooks,
  };
}

/** Universal Router calldata for one exact-input v4 swap. */
export function encodeV4ExactInputSwap(input: {
  poolKey: V4PoolKey;
  tokenIn: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
}) {
  if (input.amountIn <= 0n || input.amountIn > UINT128_MAX)
    throw new Error("Trade amount is too large for a Uniswap swap.");
  if (input.amountOutMinimum < 0n || input.amountOutMinimum > UINT128_MAX)
    throw new Error("Minimum output is too large for a Uniswap swap.");
  const zeroForOne =
    input.tokenIn.toLowerCase() === input.poolKey.currency0.toLowerCase();
  if (
    input.tokenIn.toLowerCase() !== input.poolKey.currency0.toLowerCase() &&
    input.tokenIn.toLowerCase() !== input.poolKey.currency1.toLowerCase()
  ) {
    throw new Error("Swap input is not in this pool.");
  }
  const tokenOut = zeroForOne ? input.poolKey.currency1 : input.poolKey.currency0;
  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL],
  );
  // abi.encode(ExactInputSingleParams). The router treats the first word as an
  // offset because hookData makes the struct dynamic.
  const swapParams = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: [...poolKeyComponents] },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    [
      {
        poolKey: input.poolKey,
        zeroForOne,
        amountIn: input.amountIn,
        amountOutMinimum: input.amountOutMinimum,
        hookData: "0x",
      },
    ],
  );
  const settle = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [input.tokenIn, input.amountIn],
  );
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [tokenOut, input.amountOutMinimum],
  );
  const payload = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [swapParams, settle, take]],
  );
  return {
    commands: V4_SWAP_COMMAND,
    inputs: [payload] as Hex[],
    value: input.tokenIn === zeroAddress ? input.amountIn : 0n,
  };
}

export function v4SwapCalldata(input: {
  poolKey: V4PoolKey;
  tokenIn: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  deadline: bigint;
}) {
  const encoded = encodeV4ExactInputSwap(input);
  return {
    to: UNISWAP_V4_ROUTER,
    data: encodeFunctionData({
      abi: universalRouterAbi,
      functionName: "execute",
      args: [encoded.commands, encoded.inputs, input.deadline],
    }),
    value: encoded.value,
  };
}

export async function readGraduatedPool(
  client: PublicClient,
  factory: Address,
  token: Address,
  hooks: Address,
  pairToken: Address,
) {
  const launched = await client.readContract({
    address: factory,
    abi: ponsFactoryAbi,
    functionName: "getLaunchedToken",
    args: [token],
  });
  if (Number(launched.phase) !== 2)
    throw new Error("This token has not migrated to Uniswap yet.");
  return graduatedPoolKey({
    token,
    pairToken,
    poolFee: Number(launched.poolFee),
    tickSpacing: Number(launched.tickSpacing),
    hooks,
  });
}

export async function quoteV4ExactInput(
  client: PublicClient,
  poolKey: V4PoolKey,
  tokenIn: Address,
  amountIn: bigint,
) {
  if (amountIn <= 0n || amountIn > UINT128_MAX)
    throw new Error("Trade amount is too large for a Uniswap swap.");
  const zeroForOne = tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();
  const result = await client.simulateContract({
    address: UNISWAP_V4_QUOTER,
    abi: v4QuoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey,
        zeroForOne,
        exactAmount: amountIn,
        hookData: "0x",
      },
    ],
    account: "0x0000000000000000000000000000000000000001",
  });
  const amountOut = result.result[0];
  if (amountOut <= 0n) throw new Error("Uniswap has no output for this trade.");
  return amountOut;
}
