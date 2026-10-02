import { PublicKey } from "@solana/web3.js";

type JsonRecord = Record<string, unknown>;

export interface TradeHistory {
  txid: string;
  owner: string;
  blockTime: number;
  poolId: string;
  side: "buy" | "sell";
  amountA: number;
  amountB: number;
}

const HISTORY_API = "https://launch-history-v1.raydium.io/trade";

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const poolId = params.get("poolId") || "";
  const nextPageKey = params.get("nextPageKey") || "";

  try {
    new PublicKey(poolId);
  } catch {
    return Response.json({ error: "Invalid Raydium pool address" }, { status: 400 });
  }
  if (nextPageKey && !/^[A-Za-z0-9_-]{1,256}$/.test(nextPageKey))
    return Response.json({ error: "Invalid trade page key" }, { status: 400 });

  const upstream = new URL(HISTORY_API);
  upstream.searchParams.set("poolId", poolId);
  if (nextPageKey) upstream.searchParams.set("nextPageKey", nextPageKey);

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Raydium history failed (${response.status})`);
    const payload = record(await response.json());
    const data = record(payload?.data);
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const trades = rows.flatMap((value) => {
      const row = record(value);
      const txid = typeof row?.txid === "string" ? row.txid : "";
      const owner = typeof row?.owner === "string" ? row.owner : "";
      const rowPoolId = typeof row?.poolId === "string" ? row.poolId : "";
      const side = row?.side === "buy" || row?.side === "sell" ? row.side : null;
      const blockTime = finite(row?.blockTime);
      const amountA = finite(row?.amountA);
      const amountB = finite(row?.amountB);
      if (
        !txid ||
        !owner ||
        !side ||
        blockTime == null ||
        amountA == null ||
        amountB == null ||
        amountA <= 0 ||
        amountB < 0
      )
        return [];
      return [{
        signature: txid,
        time: blockTime,
        trader: owner,
        side,
        tokenAmount: amountA,
        pairedAmount: amountB,
        price: amountB / amountA,
        poolId: rowPoolId,
      }];
    });
    const returnedNextPageKey =
      typeof data?.nextPageKey === "string" && data.nextPageKey
        ? data.nextPageKey
        : null;
    return Response.json({ trades, nextPageKey: returnedNextPageKey });
  } catch (error) {
    console.error("Unable to fetch Raydium trade history", error);
    return Response.json(
      { error: "Unable to load Raydium trade history", trades: [], nextPageKey: null },
      { status: 502 },
    );
  }
}
