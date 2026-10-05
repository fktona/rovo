import { fetchPumpCoin } from "@/lib/pump/client";
import { pumpError, readMint } from "@/lib/pump/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const mint = readMint((await params).mint);
  if (!mint) {
    return Response.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }
  try {
    return Response.json(await fetchPumpCoin(mint));
  } catch (error) {
    return pumpError(error);
  }
}
