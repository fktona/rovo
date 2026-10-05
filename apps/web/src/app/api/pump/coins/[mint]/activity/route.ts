import { fetchPumpMarketActivity, PUMP_MAINNET_CHAIN_ID } from "@/lib/pump/client";
import { pumpError, readMint } from "@/lib/pump/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const mint = readMint((await params).mint);
  if (!mint) {
    return Response.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }
  const chainId =
    new URL(request.url).searchParams.get("chainId") || PUMP_MAINNET_CHAIN_ID;
  if (!/^solana:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(chainId)) {
    return Response.json({ error: "Invalid chain id" }, { status: 400 });
  }
  try {
    return Response.json(await fetchPumpMarketActivity(mint, chainId));
  } catch (error) {
    return pumpError(error);
  }
}
