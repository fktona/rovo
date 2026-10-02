import { Connection } from "@solana/web3.js";
import type { LaunchPair } from "./pairs";

export type SolanaChain = "solana:devnet" | "solana:mainnet";

export type LaunchResult = {
  mint: string;
  signature: string;
  metadataUri?: string;
};

export type LaunchInput = {
  walletAddress: string;
  name: string;
  ticker: string;
  description: string;
  xLink: string;
  website: string;
  telegram: string;
  customBuy: string;
  imageFile: File | null;
  imageUrl?: string;
  pairedAsset: LaunchPair;
  sendTransaction: (
    transaction: Uint8Array,
    chain: SolanaChain,
  ) => Promise<Uint8Array>;
};

export async function verifyTransaction(
  connection: Connection,
  signature: string,
) {
  const result = await connection.confirmTransaction(signature, "confirmed");
  if (result.value.err)
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
}

export async function uploadTokenMetadata(
  image: File | null,
  input: Pick<
    LaunchInput,
    | "name"
    | "description"
    | "xLink"
    | "website"
    | "telegram"
    | "pairedAsset"
    | "imageUrl"
  > & { symbol: string },
) {
  if (!image && !input.imageUrl)
    throw new Error("Add a token image before launching.");
  const form = new FormData();
  if (image) form.append("image", image);
  if (input.imageUrl) form.append("imageUrl", input.imageUrl);
  form.append("name", input.name);
  form.append("symbol", input.symbol);
  form.append("description", input.description);
  form.append("xLink", input.xLink);
  form.append("website", input.website);
  form.append("telegram", input.telegram);
  form.append(
    "pairedAsset",
    JSON.stringify({
      ticker: input.pairedAsset.symbol,
      name: input.pairedAsset.name,
      mint: input.pairedAsset.mint,
      image: input.pairedAsset.iconUrl,
    }),
  );
  const response = await fetch("/api/uploads/pinata", {
    method: "POST",
    body: form,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to upload token metadata");
  return data as { metadataUri: string; imageUri: string };
}

export function getNetwork() {
  const devnet = process.env.NEXT_PUBLIC_RAYDIUM_CLUSTER === "devnet";
  return {
    devnet,
    chain: (devnet ? "solana:devnet" : "solana:mainnet") as SolanaChain,
    connection: new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com",
      "confirmed",
    ),
  };
}
