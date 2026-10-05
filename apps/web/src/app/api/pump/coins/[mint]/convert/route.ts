import { readMint } from "@/lib/pump/http";
import { buildSolQuoteSwap, confirmPumpTrade } from "@/lib/pump/trade";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const mint = readMint((await params).mint);
  if (!mint) {
    return Response.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid conversion request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid conversion request" }, { status: 400 });
  }
  const input = body as {
    signature?: unknown;
    amount?: unknown;
    slippagePercent?: unknown;
    walletAddress?: unknown;
  };
  if (typeof input.signature === "string") {
    try {
      await confirmPumpTrade(input.signature);
      return Response.json({ ok: true });
    } catch (error) {
      return convertError(error);
    }
  }
  if (typeof input.amount !== "string" || typeof input.walletAddress !== "string") {
    return Response.json({ error: "Invalid conversion request" }, { status: 400 });
  }
  if (!readMint(input.walletAddress)) {
    return Response.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }
  const slippagePercent = Number(input.slippagePercent);
  if (!Number.isFinite(slippagePercent)) {
    return Response.json(
      { error: "Slippage must be between 0 and 50 percent." },
      { status: 400 },
    );
  }
  try {
    const built = await buildSolQuoteSwap({
      mint,
      amount: input.amount,
      slippagePercent,
      walletAddress: input.walletAddress,
    });
    return Response.json({
      chain: built.chain,
      transaction: Buffer.from(built.transaction).toString("base64"),
      buyAmount: built.buyAmount,
      quoteSymbol: built.quoteSymbol,
    });
  } catch (error) {
    return convertError(error);
  }
}

function convertError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not convert SOL.";
  const status = /CLMM|too small|Enter an amount|Slippage|Solana address|bought with SOL/.test(
    message,
  )
    ? 400
    : 502;
  return Response.json({ error: message }, { status });
}
