import {
  OnlinePumpSdk,
  PUMP_SDK,
  canonicalPumpPoolPdaWithQuote,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  normalizeQuoteMint,
} from "@pump-fun/pump-sdk";
import {
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  buyQuoteInput,
  sellBaseInput,
} from "@pump-fun/pump-swap-sdk";
import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  unpackMint,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { launchPairs } from "@/lib/raydium/pairs";
import {
  verifyTransaction,
} from "@/lib/raydium/launch-shared";
import { parseTokenAmount } from "./fees";
import {
  applySlippage,
  pumpTradeVenue,
  type PumpTradeVenue,
} from "./trade-math";

const TRADE_COMPUTE_UNITS = 500_000;
const PREVIEW_USER = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

export type PumpTradeSide = "buy" | "sell";

export type PumpTradePreview = {
  venue: PumpTradeVenue;
  side: PumpTradeSide;
  receive: bigint;
  bound: bigint;
  receiveDecimals: number;
  receiveSymbol: string;
  paySymbol: string;
  payDecimals: number;
};

export type PumpTradeRequest = {
  mint: string;
  side: PumpTradeSide;
  amount: string;
  slippagePercent: number;
  tokenSymbol?: string;
};

type CurveMarket = Awaited<ReturnType<typeof loadCurve>>;

export async function readPumpMarket(mint: string) {
  const loaded = await loadCurve(readPublicKey(mint));
  const base = await readBaseMint(loaded.connection, loaded.mint);
  return {
    venue: pumpTradeVenue(loaded.curve.complete),
    quoteSymbol: symbolForMint(loaded.resolved.mint),
    quoteDecimals: loaded.resolved.decimals,
    baseDecimals: base.decimals,
  };
}

export async function readPumpSpendBalance(input: {
  mint: string;
  side: PumpTradeSide;
  walletAddress: string;
}) {
  const loaded = await loadCurve(readPublicKey(input.mint));
  const owner = readPublicKey(input.walletAddress);
  if (input.side === "sell") {
    const base = await readBaseMint(loaded.connection, loaded.mint);
    return tokenBalance(loaded.connection, owner, loaded.mint, base.program);
  }
  if (loaded.resolved.mint.equals(NATIVE_MINT)) {
    return BigInt(await loaded.connection.getBalance(owner, "confirmed"));
  }
  return tokenBalance(
    loaded.connection,
    owner,
    loaded.resolved.mint,
    loaded.resolved.quoteTokenProgram,
  );
}

export async function previewPumpTrade(input: PumpTradeRequest) {
  return (await preparePumpTrade(input, PREVIEW_USER, false)).preview;
}

export async function buildPumpTrade(
  input: PumpTradeRequest & { walletAddress: string },
) {
  const user = readPublicKey(input.walletAddress);
  const { preview, instructions } = await preparePumpTrade(input, user, true);
  const { connection, chain } = tradeNetwork();
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({
          units: TRADE_COMPUTE_UNITS,
        }),
        ...instructions,
      ],
    }).compileToV0Message(),
  );
  return { preview, chain, transaction: transaction.serialize() };
}

export async function confirmPumpTrade(signature: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
    throw new Error("That transaction signature is not valid.");
  }
  await verifyTransaction(tradeNetwork().connection, signature);
}

async function preparePumpTrade(
  input: PumpTradeRequest,
  user: PublicKey,
  build: boolean,
) {
  const loaded = await loadCurve(readPublicKey(input.mint));
  const tokenSymbol = input.tokenSymbol?.trim() || "tokens";
  const quoteSymbol = symbolForMint(loaded.resolved.mint);
  if (loaded.curve.complete) {
    return tradeOnPumpSwap(loaded, input, user, tokenSymbol, quoteSymbol, build);
  }
  return tradeOnCurve(loaded, input, user, tokenSymbol, quoteSymbol, build);
}

async function tradeOnCurve(
  loaded: CurveMarket,
  input: PumpTradeRequest,
  user: PublicKey,
  tokenSymbol: string,
  quoteSymbol: string,
  build: boolean,
) {
  const base = await readBaseMint(loaded.connection, loaded.mint);
  const payDecimals =
    input.side === "buy" ? loaded.resolved.decimals : base.decimals;
  const amount = spendAmount(input.amount, payDecimals);
  const amountBn = toBn(amount);
  if (input.side === "buy") {
    const tokens = getBuyTokenAmountFromSolAmount({
      global: loaded.global,
      feeConfig: loaded.feeConfig,
      mintSupply: loaded.curve.tokenTotalSupply,
      bondingCurve: loaded.curve,
      amount: amountBn,
      quoteMint: loaded.resolved.mint,
      quoteControl: loaded.quoteControl,
    });
    if (tokens.isZero()) throw new Error("This buy is too small.");
    const instructions = build
      ? await curveBuyInstructions(loaded, user, base.program, tokens, amountBn, input.slippagePercent)
      : [];
    return {
      preview: previewOf(input.side, "pump", {
        receive: fromBn(tokens),
        bound: applySlippage(amount, input.slippagePercent, "raise"),
        receiveDecimals: base.decimals,
        receiveSymbol: tokenSymbol,
        paySymbol: quoteSymbol,
        payDecimals: loaded.resolved.decimals,
      }),
      instructions,
    };
  }
  const quoteOut = getSellSolAmountFromTokenAmount({
    global: loaded.global,
    feeConfig: loaded.feeConfig,
    mintSupply: loaded.curve.tokenTotalSupply,
    bondingCurve: loaded.curve,
    amount: amountBn,
  });
  if (quoteOut.isZero()) throw new Error("This sell is too small.");
  const instructions = build
    ? await curveSellInstructions(
        loaded,
        user,
        base.program,
        amountBn,
        quoteOut,
        input.slippagePercent,
      )
    : [];
  return {
    preview: previewOf(input.side, "pump", {
      receive: fromBn(quoteOut),
      bound: applySlippage(fromBn(quoteOut), input.slippagePercent, "lower"),
      receiveDecimals: loaded.resolved.decimals,
      receiveSymbol: quoteSymbol,
      paySymbol: tokenSymbol,
      payDecimals: base.decimals,
    }),
    instructions,
  };
}

async function curveBuyInstructions(
  loaded: CurveMarket,
  user: PublicKey,
  tokenProgram: PublicKey,
  tokens: BN,
  quote: BN,
  slippagePercent: number,
) {
  const state = await loaded.online.fetchBuyState(
    loaded.mint,
    user,
    tokenProgram,
    loaded.resolved.mint,
  );
  return PUMP_SDK.buyV2Instructions({
    global: loaded.global,
    bondingCurveAccountInfo: state.bondingCurveAccountInfo,
    bondingCurve: state.bondingCurve,
    associatedUserAccountInfo: state.associatedUserAccountInfo,
    mint: loaded.mint,
    user,
    amount: tokens,
    quoteAmount: quote,
    slippage: slippagePercent,
    tokenProgram,
    quoteTokenProgram: state.quoteTokenProgram,
  });
}

async function curveSellInstructions(
  loaded: CurveMarket,
  user: PublicKey,
  tokenProgram: PublicKey,
  tokens: BN,
  quote: BN,
  slippagePercent: number,
) {
  const state = await loaded.online.fetchSellState(
    loaded.mint,
    user,
    tokenProgram,
    loaded.resolved.mint,
  );
  const instructions = await PUMP_SDK.sellV2Instructions({
    global: loaded.global,
    bondingCurveAccountInfo: state.bondingCurveAccountInfo,
    bondingCurve: state.bondingCurve,
    mint: loaded.mint,
    user,
    amount: tokens,
    quoteAmount: quote,
    slippage: slippagePercent,
    tokenProgram,
    quoteTokenProgram: state.quoteTokenProgram,
  });
  const quoteAccount = quoteReceiveAccount(
    user,
    loaded.resolved.mint,
    state.quoteTokenProgram,
  );
  return quoteAccount ? [quoteAccount, ...instructions] : instructions;
}

async function tradeOnPumpSwap(
  loaded: CurveMarket,
  input: PumpTradeRequest,
  user: PublicKey,
  tokenSymbol: string,
  quoteSymbol: string,
  build: boolean,
) {
  const pool = canonicalPumpPoolPdaWithQuote(loaded.mint, loaded.resolved.mint);
  const poolInfo = await loaded.connection.getAccountInfo(pool, "confirmed");
  if (!poolInfo) {
    throw new Error("This coin has graduated and its PumpSwap pool is not open yet.");
  }
  const state = await new OnlinePumpAmmSdk(loaded.connection).swapSolanaState(pool, user);
  const pricing = {
    baseReserve: state.poolBaseAmount,
    quoteReserve: state.poolQuoteAmount,
    virtualQuoteReserves: state.pool.virtualQuoteReserves,
    globalConfig: state.globalConfig,
    baseMintAccount: state.baseMintAccount,
    baseMint: state.baseMint,
    coinCreator: state.pool.coinCreator,
    creator: state.pool.creator,
    feeConfig: state.feeConfig,
    quoteMint: state.pool.quoteMint,
    isMayhemMode: state.pool.isMayhemMode,
    creatorFeeBps: state.pool.creatorFeeBps,
  };
  const payDecimals =
    input.side === "buy"
      ? loaded.resolved.decimals
      : state.baseMintAccount.decimals;
  const amount = spendAmount(input.amount, payDecimals);
  const amountBn = toBn(amount);
  if (input.side === "buy") {
    const priced = buyQuoteInput({
      quote: amountBn,
      slippage: input.slippagePercent,
      ...pricing,
    });
    if (priced.base.isZero()) throw new Error("This buy is too small.");
    const instructions = build
      ? await PUMP_AMM_SDK.buyQuoteInput(state, amountBn, input.slippagePercent)
      : [];
    return {
      preview: previewOf(input.side, "pumpswap", {
        receive: fromBn(priced.base),
        bound: fromBn(priced.maxQuote),
        receiveDecimals: state.baseMintAccount.decimals,
        receiveSymbol: tokenSymbol,
        paySymbol: quoteSymbol,
        payDecimals: loaded.resolved.decimals,
      }),
      instructions,
    };
  }
  const priced = sellBaseInput({
    base: amountBn,
    slippage: input.slippagePercent,
    ...pricing,
  });
  if (priced.uiQuote.isZero()) throw new Error("This sell is too small.");
  const instructions = build
    ? await PUMP_AMM_SDK.sellBaseInput(state, amountBn, input.slippagePercent)
    : [];
  return {
    preview: previewOf(input.side, "pumpswap", {
      receive: fromBn(priced.uiQuote),
      bound: fromBn(priced.minQuote),
      receiveDecimals: loaded.resolved.decimals,
      receiveSymbol: quoteSymbol,
      paySymbol: tokenSymbol,
      payDecimals: state.baseMintAccount.decimals,
    }),
    instructions,
  };
}

function previewOf(
  side: PumpTradeSide,
  venue: PumpTradeVenue,
  amounts: Omit<PumpTradePreview, "side" | "venue">,
): PumpTradePreview {
  return { side, venue, ...amounts };
}

function tradeNetwork() {
  return {
    chain: "solana:mainnet" as const,
    connection: new Connection(
      process.env.SOLANA_RPC_URL ||
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com",
      "confirmed",
    ),
  };
}

async function loadCurve(mint: PublicKey) {
  const { connection } = tradeNetwork();
  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig, quoteControl, curve] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
    online.fetchQuoteControl(),
    online.fetchBondingCurve(mint).catch(missingCurve),
  ]);
  const resolved = await online.resolveQuoteMint(normalizeQuoteMint(curve.quoteMint));
  return { connection, online, global, feeConfig, quoteControl, curve, mint, resolved };
}

async function readBaseMint(connection: Connection, mint: PublicKey) {
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new Error("This token mint does not exist.");
  const program = info.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : info.owner;
  try {
    const decoded = unpackMint(mint, info, program);
    return { program, decimals: decoded.decimals };
  } catch {
    throw new Error("This account is not a token mint.");
  }
}

async function tokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  program: PublicKey,
) {
  const account = getAssociatedTokenAddressSync(mint, owner, false, program);
  try {
    return (await getAccount(connection, account, "confirmed", program)).amount;
  } catch {
    return 0n;
  }
}

function quoteReceiveAccount(
  user: PublicKey,
  quoteMint: PublicKey,
  quoteTokenProgram: PublicKey,
) {
  if (quoteMint.equals(NATIVE_MINT)) return null;
  const account = getAssociatedTokenAddressSync(
    quoteMint,
    user,
    false,
    quoteTokenProgram,
  );
  return createAssociatedTokenAccountIdempotentInstruction(
    user,
    account,
    user,
    quoteMint,
    quoteTokenProgram,
  );
}

function spendAmount(value: string, decimals: number) {
  let amount: bigint;
  try {
    amount = parseTokenAmount(value, decimals);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Enter an amount.");
  }
  if (amount <= 0n) throw new Error("Enter an amount.");
  return amount;
}

function symbolForMint(mint: PublicKey) {
  const id = mint.toBase58();
  return (
    launchPairs.find((pair) => pair.mint === id)?.symbol ??
    (mint.equals(NATIVE_MINT) ? "SOL" : id.slice(0, 4))
  );
}

function readPublicKey(value: string) {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error("Enter a Solana address.");
  }
}

function missingCurve(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/does not exist|has no data|AccountNotFound|not found/i.test(message)) {
    throw new Error("This token is not on Pump.");
  }
  throw error instanceof Error ? error : new Error(message);
}

function toBn(amount: bigint) {
  return new BN(amount.toString());
}

function fromBn(amount: BN) {
  return BigInt(amount.toString());
}
