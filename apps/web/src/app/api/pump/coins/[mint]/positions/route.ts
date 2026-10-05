import { fetchPumpPositions } from "@/lib/pump/client";
import { pumpError, readMint } from "@/lib/pump/http";

const SORTS = new Set(["TOP"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const mint = readMint((await params).mint);
  if (!mint) {
    return Response.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }
  const query = new URL(request.url).searchParams;
  const sortBy = query.get("sortBy") ?? "TOP";
  const pageSize = Number(query.get("pageSize") ?? 50);
  if (!SORTS.has(sortBy)) {
    return Response.json({ error: "Invalid position sort" }, { status: 400 });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return Response.json({ error: "Invalid page size" }, { status: 400 });
  }
  try {
    return Response.json(await fetchPumpPositions(mint, { sortBy, pageSize }));
  } catch (error) {
    return pumpError(error);
  }
}
