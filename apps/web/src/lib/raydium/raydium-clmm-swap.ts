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

export async function quoteSolForTokenB(input: {
  raydium: Raydium;
  connection: Connection;
  quoteMint: PublicKey;
  ticker: string;
  buyLamports: string;
}) {
  const pool = await solQuotePool(input);
  const solAmount = new BN(input.buyLamports);
  const currentSlot = await input.connection.getSlot("confirmed");
  const [epochInfo, chainBlockTime] = await Promise.all([
    input.raydium.fetchEpochInfo(),
    input.connection.getBlockTime(currentSlot),
  ]);
  const quote = PoolUtils.computeAmountOut({
    poolInfo: pool.poolData.computePoolInfo,
    tickarrayBitmapExtension: pool.poolData.computePoolInfo.exBitmapInfo,
    tickArrayCache: pool.tickArrayCache,
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
  if (!quote.allTrade || minimumReceived.toString() === "0") {
    throw new Error(
      `Insufficient SOL/${input.ticker} CLMM liquidity for this buy.`,
    );
  }
  return { pool, solAmount, quote, minimumReceived };
}

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
  const { pool, solAmount, quote, minimumReceived } = await quoteSolForTokenB({
    raydium,
    connection,
    quoteMint,
    ticker,
    buyLamports,
  });
  const built = await buildClmmSwap({
    raydium,
    owner,
    pool,
    solAmount,
    quote,
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

export async function buildSolToQuoteSwap(input: {
  connection: Connection;
  owner: PublicKey;
  quoteMint: PublicKey;
  ticker: string;
  buyLamports: string;
}) {
  const raydium = await Raydium.load({
    connection: input.connection,
    cluster: "mainnet",
    owner: input.owner,
    disableFeatureCheck: true,
    disableLoadToken: true,
  });
  const quoted = await quoteSolForTokenB({ raydium, ...input });
  const built = await buildClmmSwap({
    raydium,
    owner: input.owner,
    pool: quoted.pool,
    solAmount: quoted.solAmount,
    quote: quoted.quote,
  });
  built.transaction.sign(built.signers);
  return {
    transaction: built.transaction.serialize(),
    minimumReceived: quoted.minimumReceived,
  };
}

async function solQuotePool(input: {
  raydium: Raydium;
  quoteMint: PublicKey;
  ticker: string;
}) {
  let pools: Awaited<ReturnType<typeof input.raydium.api.fetchPoolByMints>>;
  try {
    pools = await input.raydium.api.fetchPoolByMints({
      mint1: NATIVE_MINT.toBase58(),
      mint2: input.quoteMint.toBase58(),
      type: PoolFetchType.Concentrated,
      sort: "liquidity",
      order: "desc",
    });
  } catch {
    throw new Error(
      `Unable to find a Raydium CLMM pool for SOL/${input.ticker}.`,
    );
  }
  const pool = pools.data[0];
  if (!pool) {
    throw new Error(
      `No direct Raydium CLMM pool exists for SOL/${input.ticker}.`,
    );
  }
  const poolData = await input.raydium.clmm.getPoolInfoFromRpc(pool.id);
  const poolMints = [
    poolData.poolInfo.mintA.address,
    poolData.poolInfo.mintB.address,
  ];
  if (
    !poolMints.includes(NATIVE_MINT.toBase58()) ||
    !poolMints.includes(input.quoteMint.toBase58())
  ) {
    throw new Error(
      `The selected Raydium CLMM pool does not match SOL/${input.ticker}.`,
    );
  }
  const tickArrayCache = poolData.tickData[pool.id];
  if (!tickArrayCache) {
    throw new Error(`Raydium returned no tick data for SOL/${input.ticker}.`);
  }
  return { poolData, tickArrayCache };
}

async function buildClmmSwap(input: {
  raydium: Raydium;
  owner: PublicKey;
  pool: Awaited<ReturnType<typeof solQuotePool>>;
  solAmount: BN;
  quote: { minAmountOut: { amount: BN }; remainingAccounts: PublicKey[] };
}) {
  const built = await input.raydium.clmm.swap({
    poolInfo: input.pool.poolData.poolInfo,
    poolKeys: input.pool.poolData.poolKeys,
    inputMint: NATIVE_MINT,
    amountIn: input.solAmount,
    amountOutMin: input.quote.minAmountOut.amount,
    observationId: input.pool.poolData.computePoolInfo.observationId,
    ownerInfo: { useSOLBalance: true, feePayer: input.owner },
    remainingAccounts: input.quote.remainingAccounts,
    associatedOnly: true,
    checkCreateATAOwner: false,
    txVersion: TxVersion.V0,
    feePayer: input.owner,
  });
  if (!(built.transaction instanceof VersionedTransaction)) {
    throw new Error("Raydium CLMM did not return a versioned transaction.");
  }
  return built;
}
