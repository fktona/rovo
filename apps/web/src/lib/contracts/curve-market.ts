import type { Address, PublicClient } from "viem";
import { curveAbi } from "./abis";
import { quoteCurveBuy, quoteCurveSell, type CurveBuyQuote } from "./curve-quote";

export async function readCurveState(
  client: PublicClient,
  curve: Address,
  recipient: Address,
) {
  const [reserves, sellable, feeBps, creatorTaxBps, snipeBps, readyToGraduate] =
    await Promise.all([
      client.readContract({ address: curve, abi: curveAbi, functionName: "getReserves" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "sellableTokens" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "feeBps" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "creatorTaxBps" }),
      client.readContract({
        address: curve,
        abi: curveAbi,
        functionName: "currentSnipeTaxBps",
        args: [recipient],
      }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "readyToGraduate" }),
    ]);
  return {
    quoteReserve: reserves[0],
    tokenReserve: reserves[1],
    sellable,
    feeBps,
    creatorTaxBps,
    snipeBps,
    readyToGraduate,
  };
}

export async function quoteCurveBuyFromChain(
  client: PublicClient,
  curve: Address,
  quoteIn: bigint,
  recipient: Address,
): Promise<CurveBuyQuote & { readyToGraduate: boolean }> {
  const state = await readCurveState(client, curve, recipient);
  return {
    ...quoteCurveBuy({ quoteIn, ...state }),
    readyToGraduate: state.readyToGraduate,
  };
}

export async function quoteCurveSellFromChain(
  client: PublicClient,
  curve: Address,
  tokensIn: bigint,
  recipient: Address,
) {
  const state = await readCurveState(client, curve, recipient);
  return {
    quoteOut: quoteCurveSell({ tokensIn, ...state }),
    readyToGraduate: state.readyToGraduate,
    sellable: state.sellable,
  };
}
