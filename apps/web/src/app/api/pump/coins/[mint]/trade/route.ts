import { readMint } from "@/lib/pump/http";
import {
  buildPumpTrade,
  confirmPumpTrade,
  previewPumpTrade,
  readPumpMarket,
  readPumpSpendBalance,
  type PumpTradePreview,
  type PumpTradeSide,
} from "@/lib/pump/trade";

function tradeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not quote this trade.";
  const status = /not on Pump|does not exist|not a token mint|not open yet|too small|Enter an amount|Slippage|Solana address/.test(
    message,
  )
    ? 400
    : 502;
  return Response.json({ error: message }, { status });
}

function serializePreview(preview: PumpTradePreview) {
  return {
    venue: preview.venue,
    side: preview.side,
    receive: preview.receive.toString(),
    bound: preview.bound.toString(),
    receiveDecimals: preview.receiveDecimals,
    receiveSymbol: preview.receiveSymbol,
    paySymbol: preview.paySymbol,
    payDecimals: preview.payDecimals,
  };
}

function readSide(value: unknown): PumpTradeSide | null {
  return value === "buy" || value === "sell" ? value : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const mint = readMint((await params).mint);
  if (!mint) {
    return Response.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }
  const url = new URL(request.url);
  const side = readSide(url.searchParams.get("side")) ?? "buy";
  const wallet = url.searchParams.get("wallet");
  if (wallet && !readMint(wallet)) {
    return Response.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }
  try {
    const market = await readPumpMarket(mint);
    const balance = wallet
      ? (await readPumpSpendBalance({ mint, side, walletAddress: wallet })).toString()
      : null;
    return Response.json({ ...market, balance });
  } catch (error) {
    return tradeError(error);
  }
}

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
    return Response.json({ error: "Invalid trade request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid trade request" }, { status: 400 });
  }
  const input = body as {
    signature?: unknown;
    side?: unknown;
    amount?: unknown;
    slippagePercent?: unknown;
    tokenSymbol?: unknown;
    walletAddress?: unknown;
  };
  if (typeof input.signature === "string") {
    try {
      await confirmPumpTrade(input.signature);
      return Response.json({ ok: true });
    } catch (error) {
      return tradeError(error);
    }
  }
  const side = readSide(input.side);
  if (!side || typeof input.amount !== "string") {
    return Response.json({ error: "Invalid trade request" }, { status: 400 });
  }
  const slippagePercent = Number(input.slippagePercent);
  if (!Number.isFinite(slippagePercent)) {
    return Response.json({ error: "Slippage must be between 0 and 50 percent." }, { status: 400 });
  }
  const tokenSymbol = typeof input.tokenSymbol === "string" ? input.tokenSymbol : undefined;
  try {
    if (typeof input.walletAddress === "string") {
      if (!readMint(input.walletAddress)) {
        return Response.json({ error: "Invalid Solana wallet address" }, { status: 400 });
      }
      const built = await buildPumpTrade({
        mint,
        side,
        amount: input.amount,
        slippagePercent,
        ...(tokenSymbol ? { tokenSymbol } : {}),
        walletAddress: input.walletAddress,
      });
      return Response.json({
        preview: serializePreview(built.preview),
        chain: built.chain,
        transaction: Buffer.from(built.transaction).toString("base64"),
      });
    }
    const preview = await previewPumpTrade({
      mint,
      side,
      amount: input.amount,
      slippagePercent,
      ...(tokenSymbol ? { tokenSymbol } : {}),
    });
    return Response.json({ preview: serializePreview(preview) });
  } catch (error) {
    return tradeError(error);
  }
}
