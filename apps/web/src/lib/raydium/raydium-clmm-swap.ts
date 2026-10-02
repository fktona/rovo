import {
  PoolFetchType,
  PoolUtils,
  Raydium,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import { verifyTransaction, type SolanaChain } from "./launch-shared";

type ClmmSwapInput = {
  raydium: Raydium;
  connection: Connection;
  owner: PublicKey;
  quoteMint: PublicKey;
  ticker: string;
  buyLamports: string;
  chain: SolanaChain;
  sendTransaction: (
    transaction: Uint8Array,
    chain: SolanaChain,
  ) => Promise<Uint8Array>;
};

export type ClmmSwapResult = {
  amount: BN;
  signature: string;
};

export async function swapSolForTokenB({
  raydium,
  connection,
  owner,
  quoteMint,
  ticker,
  buyLamports,
  chain,
  sendTransaction,
}: ClmmSwapInput): Promise<ClmmSwapResult> {
  let pools: Awaited<ReturnType<typeof raydium.api.fetchPoolByMints>>;
  try {
    pools = await raydium.api.fetchPoolByMints({
      mint1: NATIVE_MINT.toBase58(),
      mint2: quoteMint.toBase58(),
      type: PoolFetchType.Concentrated,
      sort: "liquidity",
      order: "desc",
    });
  } catch {
    throw new Error(`Unable to find a Raydium CLMM pool for SOL/${ticker}.`);
  }

  const pool = pools.data[0];
  if (!pool)
    throw new Error(`No direct Raydium CLMM pool exists for SOL/${ticker}.`);

  const poolData = await raydium.clmm.getPoolInfoFromRpc(pool.id);
  const poolMints = [
    poolData.poolInfo.mintA.address,
    poolData.poolInfo.mintB.address,
  ];
  if (
    !poolMints.includes(NATIVE_MINT.toBase58()) ||
    !poolMints.includes(quoteMint.toBase58())
  )
    throw new Error(
      `The selected Raydium CLMM pool does not match SOL/${ticker}.`,
    );

  const solAmount = new BN(buyLamports);
  const currentSlot = await connection.getSlot("confirmed");
  const [epochInfo, chainBlockTime] = await Promise.all([
    raydium.fetchEpochInfo(),
    connection.getBlockTime(currentSlot),
  ]);
  const tickArrayCache = poolData.tickData[pool.id];
  if (!tickArrayCache)
    throw new Error(`Raydium returned no tick data for SOL/${ticker}.`);
  const quote = PoolUtils.computeAmountOut({
    poolInfo: poolData.computePoolInfo,
    tickarrayBitmapExtension: poolData.computePoolInfo.exBitmapInfo,
    tickArrayCache,
    baseMint: NATIVE_MINT,
    amountIn: solAmount,
    slippage: 0.01,
    epochInfo,
    catchLiquidityInsufficient: false,
    blockTimestamp: chainBlockTime ?? Math.floor(Date.now() / 1000),
  });
  const minimumReceived = new BN(
    (
      BigInt(quote.minAmountOut.amount.toString()) -
      BigInt(quote.minAmountOut.fee?.toString() || "0")
    ).toString(),
  );
  if (!quote.allTrade || minimumReceived.toString() === "0")
    throw new Error(
      `Insufficient SOL/${ticker} CLMM liquidity for this initial buy.`,
    );

  const built = await raydium.clmm.swap({
    poolInfo: poolData.poolInfo,
    poolKeys: poolData.poolKeys,
    inputMint: NATIVE_MINT,
    amountIn: solAmount,
    amountOutMin: quote.minAmountOut.amount,
    observationId: poolData.computePoolInfo.observationId,
    ownerInfo: { useSOLBalance: true, feePayer: owner },
    remainingAccounts: quote.remainingAccounts,
    associatedOnly: true,
    checkCreateATAOwner: false,
    txVersion: TxVersion.V0,
    feePayer: owner,
  });
  if (!(built.transaction instanceof VersionedTransaction))
    throw new Error("Raydium CLMM did not return a versioned transaction.");
  built.transaction.sign(built.signers);
  const signature = bs58.encode(
    await sendTransaction(built.transaction.serialize(), chain),
  );
  await verifyTransaction(connection, signature);

  return { amount: minimumReceived, signature };
}
