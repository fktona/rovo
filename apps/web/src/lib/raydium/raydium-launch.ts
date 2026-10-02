import {
  CpmmCreatorFeeOn,
  DEVNET_PROGRAM_ID,
  getPdaLaunchpadAuth,
  getPdaLaunchpadConfigId,
  LAUNCHPAD_PROGRAM,
  LaunchpadConfig,
  Raydium,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import { RAYDIUM_PLATFORM_ID } from "./constants";
import {
  getNetwork,
  uploadTokenMetadata,
  verifyTransaction,
  type LaunchInput,
  type LaunchResult,
} from "./launch-shared";
import { swapSolForTokenB } from "./raydium-clmm-swap";

type RaydiumLaunchInput = LaunchInput & {
  quoteMintAddress: string;
  onStatus?: (message: string) => void;
};

function parseSolToLamports(value: string) {
  const amount = value.trim() || "0";
  if (!/^\d+(?:\.\d+)?$/.test(amount))
    throw new Error("Enter a valid initial SOL buy amount.");
  const [whole = "0", fraction = ""] = amount.split(".");
  if (fraction.length > 9)
    throw new Error("SOL supports at most 9 decimal places.");
  return (
    BigInt(whole) * BigInt(10) ** BigInt(9) +
    BigInt(fraction.padEnd(9, "0") || "0")
  ).toString();
}

export async function launchRaydiumToken(
  input: RaydiumLaunchInput,
): Promise<LaunchResult> {
  const { connection, devnet, chain } = getNetwork();
  const defaultProgramId = devnet
    ? DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM
    : LAUNCHPAD_PROGRAM;
  const programId = new PublicKey(
    process.env.NEXT_PUBLIC_RAYDIUM_LAUNCHPAD_PROGRAM_ID ||
      defaultProgramId.toBase58(),
  );
  const authProgramId = getPdaLaunchpadAuth(programId).publicKey;
  const platformId = new PublicKey(
    process.env.NEXT_PUBLIC_RAYDIUM_LAUNCHPAD_PLATFORM_ID ||
      (devnet
        ? DEVNET_PROGRAM_ID.LAUNCHPAD_PLATFORM.toBase58()
        : RAYDIUM_PLATFORM_ID),
  );
  const quoteMint = new PublicKey(input.quoteMintAddress);
  const configAddress = process.env.NEXT_PUBLIC_RAYDIUM_LAUNCHPAD_CONFIG_ID
    ? new PublicKey(process.env.NEXT_PUBLIC_RAYDIUM_LAUNCHPAD_CONFIG_ID)
    : getPdaLaunchpadConfigId(programId, quoteMint, 0, 0).publicKey;
  const owner = new PublicKey(input.walletAddress);
  const buyLamports = parseSolToLamports(input.customBuy);
  const symbol = input.ticker.replace(/^\$/, "");
  if (symbol.length > 10)
    throw new Error("Raydium symbols can be at most 10 characters.");

  const raydium = await Raydium.load({
    connection,
    cluster: devnet ? "devnet" : "mainnet",
    owner,
    disableFeatureCheck: true,
    disableLoadToken: true,
  });
  const configData = await connection.getAccountInfo(configAddress);
  if (!configData || !configData.owner.equals(programId))
    throw new Error(
      `No launchpad config for ${input.pairedAsset.symbol} on ${devnet ? "devnet" : "mainnet"}.`,
    );
  const configInfo = LaunchpadConfig.decode(configData.data);
  if (!configInfo.mintB.equals(quoteMint))
    throw new Error(
      "The launchpad config does not match the selected quote token.",
    );
  const mintBInfo = await raydium.token.getTokenInfo(configInfo.mintB);

  const { metadataUri: uri } = await uploadTokenMetadata(input.imageFile, {
    ...input,
    symbol,
  });

  let buyAmount = new BN(buyLamports);
  if (buyLamports !== "0" && !quoteMint.equals(NATIVE_MINT)) {
    if (devnet)
      throw new Error("Raydium CLMM conversion is only available on mainnet.");
    input.onStatus?.(
      `Approve the SOL to ${input.pairedAsset.symbol} conversion.`,
    );
    const swap = await swapSolForTokenB({
      raydium,
      connection,
      owner,
      quoteMint,
      ticker: input.pairedAsset.symbol,
      buyLamports,
      chain,
      sendTransaction: input.sendTransaction,
    });
    buyAmount = swap.amount;
    input.onStatus?.(
      `Conversion ${swap.signature.slice(0, 12)}… confirmed. Approve the Raydium launch.`,
    );
  } else {
    input.onStatus?.("Approve the Raydium launch.");
  }

  const mintA = Keypair.generate();
  const built = await raydium.launchpad.createLaunchpad({
    programId,
    authProgramId,
    mintA: mintA.publicKey,
    name: input.name,
    symbol,
    uri,
    mintBDecimals: mintBInfo.decimals,
    decimals: 6,
    configId: configAddress,
    configInfo,
    platformId,
    migrateType: "cpmm",
    creatorFeeOn: CpmmCreatorFeeOn.OnlyTokenB,
    supply: new BN("1000000000000000"),
    totalSellA: new BN("793100000000000"),
    totalFundRaisingB: new BN(
      (BigInt(85) * BigInt(10) ** BigInt(mintBInfo.decimals)).toString(),
    ),
    transferFeeExtensionParams: {
      transferFeeBasePoints: 0,
      maxinumFee: new BN(0),
    },
    txVersion: TxVersion.V0,
    buyAmount,
    extraSigners: [mintA],
    slippage: new BN(100),
    feePayer: owner,
    createOnly: buyAmount.toString() === "0",
  });

  let signature = "";
  for (let i = 0; i < built.transactions.length; i++) {
    const transaction = built.transactions[i] as
      | VersionedTransaction
      | Transaction;
    const signers = built.signers[i] || [];
    if (transaction instanceof VersionedTransaction)
      transaction.sign(signers);
    else transaction.partialSign(...signers);
    signature = bs58.encode(
      await input.sendTransaction(transaction.serialize(), chain),
    );
    await verifyTransaction(connection, signature);
  }
  if (!signature) throw new Error("Raydium returned no transaction signature.");

  return {
    mint: mintA.publicKey.toBase58(),
    signature,
    metadataUri: uri,
  };
}
