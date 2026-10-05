import {
  OnlinePumpSdk,
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
} from "@pump-fun/pump-sdk";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
  type TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import {
  getNetwork,
  uploadTokenMetadata,
  verifyTransaction,
  type LaunchInput,
  type LaunchResult,
} from "@/lib/raydium/launch-shared";
import { swapSolForTokenB } from "@/lib/raydium/raydium-clmm-swap";
import { creatorFeeBpsForSource, parseTokenAmount } from "./fees";
import { ensureLaunchLookupTable, sharedAccountKeys } from "./lookup-table";
import type { PumpLaunchPair } from "./quotes";

const CREATE_COMPUTE_UNITS = 600_000;

export type PumpLaunchResult = LaunchResult & {
  indexed: boolean;
  creatorFeeBps: number;
};

type PumpLaunchInput = LaunchInput & {
  pair: PumpLaunchPair;
  onStatus?: (message: string) => void;
};

function feeWallet() {
  const value = process.env.NEXT_PUBLIC_PUMP_FEE_WALLET;
  if (!value) throw new Error("Pump fee vault is not configured.");
  try {
    return new PublicKey(value);
  } catch {
    throw new Error("Pump fee vault is not a Solana address.");
  }
}

export async function launchPumpToken(
  input: PumpLaunchInput,
): Promise<PumpLaunchResult> {
  const { connection, chain } = getNetwork();
  const user = new PublicKey(input.walletAddress);
  const creator = feeWallet();
  const symbol = input.ticker.replace(/^\$/, "").trim();
  const name = input.name.trim();
  if (!name || name.length > 32) {
    throw new Error("Token names can be at most 32 characters.");
  }
  if (symbol.length < 1 || symbol.length > 13) {
    throw new Error("Symbols can be at most 13 characters.");
  }

  const online = new OnlinePumpSdk(connection);
  const quoteMint = new PublicKey(input.pair.mint);
  const [global, feeConfig, quoteControl, resolved] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
    online.fetchQuoteControl(),
    online.resolveQuoteMint(quoteMint),
  ]);
  if (!global.createV2Enabled) {
    throw new Error("Pump token creation is turned off.");
  }
  const creatorFeeBps = creatorFeeBpsForSource(resolved.source);
  if (creatorFeeBps !== undefined) {
    if (!global.creatorFeeConfigurable) {
      throw new Error("Pump is not accepting a custom creator fee right now.");
    }
    if (global.maxConfigurableCreatorFeeBps.ltn(creatorFeeBps)) {
      throw new Error("Pump's creator fee cap is below 2%.");
    }
  }
  const feeBps = creatorFeeBps === undefined ? undefined : new BN(creatorFeeBps);
  const solLamports = parseTokenAmount(input.customBuy, 9);

  input.onStatus?.("Uploading token metadata.");
  const uploaded = await uploadTokenMetadata(input.imageFile, {
    ...input,
    symbol,
    pairedAsset: input.pair,
  });
  if (uploaded.metadataUri.length > 200) {
    throw new Error("Token metadata link is too long for Pump.");
  }

  const mint = Keypair.generate();
  const shared = {
    mint: mint.publicKey,
    name,
    symbol,
    uri: uploaded.metadataUri,
    creator,
    user,
    mayhemMode: false,
    cashback: false,
    quoteMint: resolved.mint,
    quoteTokenProgram: resolved.quoteTokenProgram,
    ...(feeBps ? { creatorFeeBps: feeBps } : {}),
    holderReward: false,
  };
  let quoteAmount = new BN(solLamports.toString());
  if (solLamports > 0n && input.pair.source !== "sol") {
    input.onStatus?.(
      `Approve the SOL to ${input.pair.symbol} conversion.`,
    );
    const raydium = await Raydium.load({
      connection,
      cluster: "mainnet",
      owner: user,
      disableFeatureCheck: true,
      disableLoadToken: true,
    });
    const swap = await swapSolForTokenB({
      raydium,
      connection,
      owner: user,
      quoteMint: resolved.mint,
      ticker: input.pair.symbol,
      buyLamports: solLamports.toString(),
      chain,
      sendTransaction: input.sendTransaction,
    });
    quoteAmount = swap.amount;
    input.onStatus?.(
      `Conversion ${swap.signature.slice(0, 12)}… confirmed. Approve the Pump launch.`,
    );
  }
  const tokenAmount =
    solLamports === 0n
      ? null
      : getBuyTokenAmountFromSolAmount({
          global,
          feeConfig,
          mintSupply: global.tokenTotalSupply,
          bondingCurve: null,
          amount: quoteAmount,
          quoteMint: resolved.mint,
          quoteControl,
          ...(feeBps ? { creatorFeeBps: feeBps } : {}),
        });
  if (tokenAmount?.isZero()) {
    throw new Error("That first buy is too small for this pair.");
  }
  const solBuy = tokenAmount && input.pair.source === "sol";
  const instructions = tokenAmount
    ? solBuy
      ? await PUMP_SDK.createV2AndBuyInstructions({
          global,
          mint: mint.publicKey,
          name,
          symbol,
          uri: uploaded.metadataUri,
          creator,
          user,
          amount: tokenAmount,
          solAmount: quoteAmount,
          mayhemMode: false,
          holderReward: false,
          ...(feeBps ? { creatorFeeBps: feeBps } : {}),
        })
      : await PUMP_SDK.createV2AndBuyV2Instructions({
          ...shared,
          global,
          quoteAmount,
          amount: tokenAmount,
        })
    : [await PUMP_SDK.createV2Instruction(shared)];

  const sendInstructions = async (
    batch: TransactionInstruction[],
    signers: Keypair[],
    lookupTables: AddressLookupTableAccount[] = [],
  ) => {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: user,
        recentBlockhash: blockhash,
        instructions: batch,
      }).compileToV0Message(lookupTables),
    );
    if (signers.length > 0) transaction.sign(signers);
    const signature = bs58.encode(
      await input.sendTransaction(transaction.serialize(), chain),
    );
    await verifyTransaction(connection, signature);
    return signature;
  };
  const withBudget = (batch: TransactionInstruction[]) => [
    ComputeBudgetProgram.setComputeUnitLimit({ units: CREATE_COMPUTE_UNITS }),
    ...batch,
  ];

  let signature: string;
  if (solBuy) {
    input.onStatus?.("Approve the Pump launch.");
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const legacyBytes = (batch: TransactionInstruction[]) => {
      const transaction = new Transaction({
        feePayer: user,
        recentBlockhash: blockhash,
      }).add(...batch);
      transaction.partialSign(mint);
      return transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    };
    const budget = ComputeBudgetProgram.setComputeUnitLimit({
      units: CREATE_COMPUTE_UNITS,
    });
    let bytes: Uint8Array;
    try {
      bytes = legacyBytes([budget, ...instructions]);
    } catch (cause) {
      if (!isTransactionTooLarge(cause)) throw cause;
      bytes = legacyBytes(instructions);
    }
    signature = bs58.encode(await input.sendTransaction(bytes, chain));
    await verifyTransaction(connection, signature);
  } else {
    let lookupTables: AddressLookupTableAccount[] = [];
    if (tokenAmount) {
      const decoy = await PUMP_SDK.createV2AndBuyV2Instructions({
        ...shared,
        mint: Keypair.generate().publicKey,
        global,
        quoteAmount,
        amount: tokenAmount,
      });
      lookupTables = [
        await ensureLaunchLookupTable({
          connection,
          user,
          addresses: [
            ComputeBudgetProgram.programId,
            ...sharedAccountKeys(instructions, decoy),
          ],
          ...(input.onStatus ? { onStatus: input.onStatus } : {}),
          send: (setup) => sendInstructions(setup, []).then(() => undefined),
        }),
      ];
    }
    input.onStatus?.("Approve the Pump launch.");
    signature = await sendInstructions(
      withBudget(instructions),
      [mint],
      lookupTables,
    );
  }

  const indexed = await saveCreatedCoin({
    mint: mint.publicKey.toBase58(),
    name,
    symbol,
    imageUrl: uploaded.imageUri,
    metadataUri: uploaded.metadataUri,
    quoteMint: resolved.mint.toBase58(),
    launcherWallet: user.toBase58(),
    signature,
  });

  return {
    mint: mint.publicKey.toBase58(),
    signature,
    metadataUri: uploaded.metadataUri,
    indexed,
    creatorFeeBps: creatorFeeBps ?? 0,
  };
}

function isTransactionTooLarge(cause: unknown) {
  return (
    cause instanceof Error &&
    (cause.message.startsWith("Transaction too large") ||
      cause.message.includes("encoding overruns"))
  );
}

async function saveCreatedCoin(body: {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  metadataUri: string;
  quoteMint: string;
  launcherWallet: string;
  signature: string;
}) {
  const base = process.env.NEXT_PUBLIC_ROVO_API_URL?.replace(/\/+$/, "");
  if (!base) return false;
  try {
    const response = await fetch(`${base}/v1/pump/coins`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}
