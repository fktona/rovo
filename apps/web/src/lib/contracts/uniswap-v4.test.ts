import { decodeAbiParameters, decodeFunctionData, zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import {
  encodeV4ExactInputSwap,
  graduatedPoolKey,
  universalRouterAbi,
  v4SwapCalldata,
} from "./uniswap-v4";

const TOKEN = "0x00000000000000000000000000000000000000b0" as Address;
const STOCK = "0x00000000000000000000000000000000000000aa" as Address;
const HOOK = "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as Address;

describe("graduatedPoolKey", () => {
  it("sorts the quote and the token by address and keeps native ETH first", () => {
    const stockPool = graduatedPoolKey({
      token: TOKEN,
      pairToken: STOCK,
      poolFee: 0,
      tickSpacing: 200,
      hooks: HOOK,
    });
    expect(stockPool.currency0).toBe(STOCK);
    expect(stockPool.currency1).toBe(TOKEN);
    expect(stockPool.fee).toBe(0);
    expect(stockPool.tickSpacing).toBe(200);

    const ethPool = graduatedPoolKey({
      token: TOKEN,
      pairToken: zeroAddress,
      poolFee: 0,
      tickSpacing: 200,
      hooks: zeroAddress,
    });
    expect(ethPool.currency0).toBe(zeroAddress);
    expect(ethPool.hooks).toBe(HOOK);
  });
});

describe("encodeV4ExactInputSwap", () => {
  const poolKey = graduatedPoolKey({
    token: TOKEN,
    pairToken: zeroAddress,
    poolFee: 0,
    tickSpacing: 200,
    hooks: HOOK,
  });

  it("pays native ETH into the router and asks for the token", () => {
    const encoded = encodeV4ExactInputSwap({
      poolKey,
      tokenIn: zeroAddress,
      amountIn: 10n ** 16n,
      amountOutMinimum: 5n,
    });
    expect(encoded.commands).toBe("0x10");
    expect(encoded.value).toBe(10n ** 16n);
    const [actions, params] = decodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes[]" }],
      encoded.inputs[0]!,
    );
    expect(actions).toBe("0x060c0f");
    const [swap] = decodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            {
              name: "poolKey",
              type: "tuple",
              components: [
                { name: "currency0", type: "address" },
                { name: "currency1", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "tickSpacing", type: "int24" },
                { name: "hooks", type: "address" },
              ],
            },
            { name: "zeroForOne", type: "bool" },
            { name: "amountIn", type: "uint128" },
            { name: "amountOutMinimum", type: "uint128" },
            { name: "hookData", type: "bytes" },
          ],
        },
      ],
      params[0]!,
    );
    expect(swap.zeroForOne).toBe(true);
    expect(swap.amountIn).toBe(10n ** 16n);
    expect(swap.poolKey.currency1.toLowerCase()).toBe(TOKEN.toLowerCase());
  });

  it("builds a router execute call with no value when selling the token", () => {
    const call = v4SwapCalldata({
      poolKey,
      tokenIn: TOKEN,
      amountIn: 1_000n,
      amountOutMinimum: 1n,
      deadline: 1_800_000_000n,
    });
    const decoded = decodeFunctionData({ abi: universalRouterAbi, data: call.data });
    expect(decoded.functionName).toBe("execute");
    expect(decoded.args[0]).toBe("0x10");
    expect(decoded.args[2]).toBe(1_800_000_000n);
    expect(call.value).toBe(0n);
  });
});
