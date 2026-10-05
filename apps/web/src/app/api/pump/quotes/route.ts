import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { Connection } from "@solana/web3.js";
import { launchPairs } from "@/lib/raydium/pairs";
import { toPumpLaunchPairs } from "@/lib/pump/quotes";

export const revalidate = 300;

export async function GET() {
  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL ||
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com",
      "confirmed",
    );
    const supported = await new OnlinePumpSdk(connection).fetchSupportedQuoteMints();
    return Response.json({
      quotes: toPumpLaunchPairs(
        supported.map((quote) => ({
          mint: quote.mint.toBase58(),
          source: quote.source,
        })),
        launchPairs,
      ),
    });
  } catch (error) {
    console.error("Unable to load Pump quote mints", error);
    return Response.json(
      { error: "Unable to load Pump quote mints" },
      { status: 502 },
    );
  }
}
