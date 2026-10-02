import { Curve } from "@raydium-io/raydium-sdk-v2";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchMint } from "@/lib/raydium/fetch-mint";

type JsonRecord = Record<string, unknown>;

const RAYDIUM_API = "https://api-v3.raydium.io";
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { next: { revalidate: 15 } });
  if (!response.ok) throw new Error(`Raydium request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

function unwrapPools(payload: unknown) {
  const root = asRecord(payload);
  const data = root?.data;
  if (Array.isArray(data)) return data as JsonRecord[];
  const nested = asRecord(data)?.data;
  return Array.isArray(nested) ? (nested as JsonRecord[]) : [];
}

async function fetchPools(mint: string, pairedMint?: string) {
  const mints = [mint, pairedMint].filter((value): value is string => Boolean(value)).sort();
  const quoteMint = mints[0];
  if (!quoteMint) return [];
  const params = new URLSearchParams({
    size: "20",
    mint1: quoteMint,
    poolType: "all",
    sortField: "liquidity",
    sortType: "desc",
  });
  if (mints[1]) params.set("mint2", mints[1]);
  try {
    return unwrapPools(
      await fetchJson(`${RAYDIUM_API}/pools/info/list-v2?${params}`),
    );
  } catch {
    return [];
  }
}

async function fetchPrices(mints: string[]) {
  try {
    const payload = asRecord(
      await fetchJson(
        `${RAYDIUM_API}/mint/price?mints=${encodeURIComponent(mints.join(","))}`,
      ),
    );
    return (asRecord(payload?.data) || {}) as Record<string, number | string>;
  } catch {
    return {};
  }
}

async function exactHolderCount(rpcUrl: string, mint: string, tokenProgram: string) {
  if (!process.env.NEXT_PUBLIC_SOLANA_RPC_URL && !process.env.SOLANA_RPC_URL)
    return null;
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "stoqs-holders",
        method: "getProgramAccounts",
        params: [
          tokenProgram,
          {
            commitment: "confirmed",
            encoding: "base64",
            filters: [{ memcmp: { offset: 0, bytes: mint } }],
            dataSlice: { offset: 32, length: 40 },
          },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: { account?: { data?: [string, string] } }[];
    };
    const owners = new Set<string>();
    for (const item of payload.result || []) {
      const encoded = item.account?.data?.[0];
      if (!encoded) continue;
      const data = Buffer.from(encoded, "base64");
      if (data.length < 40 || data.readBigUInt64LE(32) === BigInt(0)) continue;
      owners.add(new PublicKey(data.subarray(0, 32)).toBase58());
    }
    return owners.size;
  } catch {
    return null;
  }
}

async function holderData(connection: Connection, rpcUrl: string, mint: string) {
  try {
    const mintKey = new PublicKey(mint);
    const [mintAccount, supply, largest] = await Promise.all([
      connection.getAccountInfo(mintKey, "confirmed"),
      connection.getTokenSupply(mintKey, "confirmed"),
      connection.getTokenLargestAccounts(mintKey, "confirmed"),
    ]);
    if (!mintAccount) throw new Error("Mint account not found");
    const accounts = await connection.getMultipleParsedAccounts(
      largest.value.map((item) => item.address),
      { commitment: "confirmed" },
    );
    const totalSupply = Number(supply.value.uiAmountString || 0);
    const byOwner = new Map<string, { amount: number; accounts: string[] }>();
    accounts.value.forEach((account, index) => {
      const parsed = account?.data;
      const info =
        parsed && "parsed" in parsed
          ? asRecord(asRecord(parsed.parsed)?.info)
          : null;
      const owner = typeof info?.owner === "string" ? info.owner : "Unknown";
      const largestAccount = largest.value[index];
      if (!largestAccount) return;
      const amount = Number(largestAccount.uiAmountString || 0);
      const current = byOwner.get(owner) || { amount: 0, accounts: [] };
      current.amount += amount;
      current.accounts.push(largestAccount.address.toBase58());
      byOwner.set(owner, current);
    });
    const holders = [...byOwner.entries()]
      .map(([owner, item]) => ({
        owner,
        accounts: item.accounts,
        amount: item.amount,
        percentage: totalSupply ? (item.amount / totalSupply) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);
    const count = await exactHolderCount(
      rpcUrl,
      mint,
      mintAccount.owner.toBase58(),
    );
    return {
      count: count == null ? null : Math.max(count, holders.length),
      topAccountCount: largest.value.length,
      totalSupply,
      tokenProgram: mintAccount.owner.toBase58(),
      top10Percentage: holders
        .slice(0, 10)
        .reduce((total, holder) => total + holder.percentage, 0),
      holders,
    };
  } catch {
    return {
      count: null,
      topAccountCount: 0,
      totalSupply: null,
      tokenProgram: null,
      top10Percentage: null,
      holders: [],
    };
  }
}

async function curveState(
  connection: Connection,
  poolId: string,
  tokenDecimals: number,
  pairedDecimals: number,
) {
  try {
    const { Raydium } = await import("@raydium-io/raydium-sdk-v2");
    const raydium = await Raydium.load({
      connection,
      disableFeatureCheck: true,
      disableLoadToken: true,
    });
    const poolInfo = await raydium.launchpad.getRpcPoolInfo({
      poolId: new PublicKey(poolId),
    });
    return {
      price: Curve.getPrice({
        poolInfo,
        curveType: poolInfo.configInfo.curveType,
        decimalA: tokenDecimals,
        decimalB: pairedDecimals,
      }).toNumber(),
      vaultA: poolInfo.vaultA.toBase58(),
      vaultB: poolInfo.vaultB.toBase58(),
      status: poolInfo.status,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const { mint } = await params;
  try {
    new PublicKey(mint);
  } catch {
    return Response.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }

  try {
    const token = await fetchMint(mint);
    if (!token)
      return Response.json({ error: "Raydium token not found" }, { status: 404 });

    const pairedMint = token.mintB.address;
    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      DEFAULT_RPC;
    const connection = new Connection(rpcUrl, "confirmed");
    const [pools, prices, holderResult, liveCurve] = await Promise.all([
      fetchPools(mint, pairedMint),
      fetchPrices([...new Set([mint, pairedMint, WSOL_MINT])]),
      holderData(connection, rpcUrl, mint),
      curveState(
        connection,
        token.poolId,
        token.decimals,
        token.mintB.decimals,
      ),
    ]);
    const primaryPool = pools[0] || null;
    const primaryPoolPrice = finite(primaryPool?.price);
    const primaryMintA = asRecord(primaryPool?.mintA)?.address;
    const pairedPoolPrice = primaryPoolPrice
      ? primaryMintA === mint
        ? primaryPoolPrice
        : 1 / primaryPoolPrice
      : null;
    const referencePrice = liveCurve?.price || pairedPoolPrice;
    const holders = {
      ...holderResult,
      holders: holderResult.holders.map((holder) => ({
        ...holder,
        label: holder.accounts.includes(liveCurve?.vaultA || "")
          ? "Bonding curve"
          : undefined,
      })),
    };
    const usdPrice =
      finite(prices[mint]) ||
      (token.supply > 0 ? token.marketCap / token.supply : null);

    return Response.json({
      token,
      market: {
        usdPrice,
        pairedPrice: referencePrice,
        pairedUsdPrice: finite(prices[pairedMint]),
        solUsdPrice: finite(prices[WSOL_MINT]),
        primaryPool,
        pools,
      },
      holders,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Unable to build Raydium token detail", error);
    return Response.json(
      { error: "Unable to load Raydium token details" },
      { status: 502 },
    );
  }
}
