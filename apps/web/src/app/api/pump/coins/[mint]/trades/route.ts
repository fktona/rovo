import { fetchPumpTrades } from "@/lib/pump/client";
import { pumpError, readMint } from "@/lib/pump/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const mint = readMint((await params).mint);
  if (!mint) {
    return Response.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }
  const query = new URL(request.url).searchParams;
  const limit = Number(query.get("limit") ?? 100);
  const minSolAmount = Number(query.get("minSolAmount") ?? 0.05);
  const cursor = query.get("cursor") ?? "0";
  const createdTs = query.get("createdTs") ?? undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return Response.json({ error: "Invalid trade limit" }, { status: 400 });
  }
  if (!Number.isFinite(minSolAmount) || minSolAmount < 0 || minSolAmount > 1_000_000) {
    return Response.json({ error: "Invalid minimum SOL amount" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cursor)) {
    return Response.json({ error: "Invalid trade cursor" }, { status: 400 });
  }
  if (createdTs && !/^\d{10,16}$/.test(createdTs)) {
    return Response.json({ error: "Invalid created timestamp" }, { status: 400 });
  }
  try {
    return Response.json(
      await fetchPumpTrades(mint, {
        limit,
        minSolAmount,
        cursor,
        ...(createdTs ? { createdTs } : {}),
      }),
    );
  } catch (error) {
    return pumpError(error);
  }
}
