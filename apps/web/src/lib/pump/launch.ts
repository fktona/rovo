import {
  OnlinePumpSdk,
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
} from "@pump-fun/pump-sdk";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
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
import { creatorFeeBpsForSource, parseTokenAmount } from "./fees";
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
  const quoteUnits = parseTokenAmount(input.customBuy, resolved.decimals);

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
  const quoteAmount = new BN(quoteUnits.toString());
  const tokenAmount =
    quoteUnits === 0n
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
  input.onStatus?.("Approve the Pump launch.");
  const instructions = tokenAmount
    ? await PUMP_SDK.createV2AndBuyV2Instructions({
        ...shared,
        global,
        quoteAmount,
        amount: tokenAmount,
      })
    : [await PUMP_SDK.createV2Instruction(shared)];

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({
          units: CREATE_COMPUTE_UNITS,
        }),
        ...instructions,
      ],
    }).compileToV0Message(),
  );
  transaction.sign([mint]);
  const signature = bs58.encode(
    await input.sendTransaction(
      transaction.serialize(),
      chain,
    ),
  );
  await verifyTransaction(connection, signature);

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
