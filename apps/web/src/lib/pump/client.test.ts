import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coinsV2Body,
  fetchPumpCoin,
  fetchPumpMarketActivity,
  fetchPumpMarkets,
  fetchPumpPositions,
  fetchPumpTrades,
  PumpRequestError,
} from "./client";
import { readMints } from "./http";

const COIN = "Hg5Ja55T5wESq4vyFoiVCMeHXtGyVA69X2UHq8hgpump";
const ACTIVE = "8Y6pHi3cMhxhtHuzgGAsWgAJMyw3zaQLeFFf3qvRpump";
const CHAIN = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("pump client", () => {
  it("wraps a mint list in the coins-v2 body pump expects", () => {
    expect(coinsV2Body([COIN, ACTIVE])).toEqual({ mints: [COIN, ACTIVE] });
    expect(readMints([COIN])).toEqual([COIN]);
    expect(readMints({ mints: [ACTIVE] })).toEqual([ACTIVE]);
    expect(readMints({ mints: ["nope"] })).toBeNull();
  });

  it("loads the in-memory coin, activity, markets, trades, and positions", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/in-memory-coin/")) {
        return jsonResponse({ mint: COIN, name: "baton", ticker: "baton", marketCapUsd: 1 });
      }
      if (url.includes("/market-activity")) {
        expect(url).toContain(`chainId=${encodeURIComponent(CHAIN)}`);
        return jsonResponse({
          "5m": { volumeUSD: 1, priceChangePercent: 0 },
          "24h": { volumeUSD: 2, priceChangePercent: 3 },
        });
      }
      if (url.endsWith("/coins-v2/mints")) {
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify({ mints: [COIN] }));
        return jsonResponse([{ mint: COIN, symbol: "baton", market_cap_usd: 1 }]);
      }
      if (url.includes("/trades")) {
        expect(url).toContain("minSolAmount=0.05");
        expect(url).toContain("createdTs=1790962895000");
        return jsonResponse({
          trades: [{ tx: "sig", type: "buy" }],
          pagination: { nextCursor: "1", hasMore: true, limit: 100 },
        });
      }
      if (url.includes("/mint-positions/")) {
        expect(url).toContain("sortBy=TOP");
        expect(url).toContain("pageSize=50");
        return jsonResponse({
          positions: [{ walletAddress: "wallet", amountHeld: 1 }],
          totalCount: 1,
          hasMore: false,
        });
      }
      return jsonResponse({ error: "missing" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPumpCoin(COIN)).resolves.toMatchObject({ ticker: "baton" });
    await expect(fetchPumpMarketActivity(ACTIVE)).resolves.toMatchObject({
      "24h": { volumeUSD: 2 },
    });
    await expect(fetchPumpMarkets([COIN])).resolves.toMatchObject([
      { symbol: "baton" },
    ]);
    await expect(
      fetchPumpTrades(ACTIVE, { createdTs: "1790962895000" }),
    ).resolves.toMatchObject({ pagination: { hasMore: true } });
    await expect(fetchPumpPositions(ACTIVE)).resolves.toMatchObject({
      totalCount: 1,
    });
  });

  it("surfaces an upstream 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 404)));
    await expect(fetchPumpCoin(COIN)).rejects.toBeInstanceOf(PumpRequestError);
  });
});

const live = process.env.PUMP_LIVE === "1" ? describe : describe.skip;

live("pump sample coins", () => {
  it("matches the sample coin, activity, batch, trades, and positions shapes", async () => {
    const coin = await fetchPumpCoin(COIN);
    expect(coin.mint).toBe(COIN);
    expect(coin.name).toBe("baton");
    expect(coin.ticker).toBe("baton");
    expect(typeof coin.marketCapUsd).toBe("number");
    expect(typeof coin.numHolders).toBe("number");

    const activity = await fetchPumpMarketActivity(ACTIVE);
    for (const window of ["5m", "1h", "6h", "24h"] as const) {
      expect(typeof activity[window].volumeUSD).toBe("number");
      expect(typeof activity[window].priceChangePercent).toBe("number");
      expect(typeof activity[window].numTxs).toBe("number");
    }

    const markets = await fetchPumpMarkets([COIN, ACTIVE]);
    expect(markets.map((item) => item.mint).sort()).toEqual([ACTIVE, COIN].sort());
    expect(typeof markets[0]?.market_cap_usd).toBe("number");
    expect(typeof markets[0]?.symbol).toBe("string");

    const trades = await fetchPumpTrades(ACTIVE, {
      limit: 5,
      createdTs: "1790962895000",
    });
    expect(Array.isArray(trades.trades)).toBe(true);
    expect(trades.trades.length).toBeGreaterThan(0);
    expect(trades.trades[0]?.type === "buy" || trades.trades[0]?.type === "sell").toBe(
      true,
    );
    expect(typeof trades.pagination.hasMore).toBe("boolean");

    const positions = await fetchPumpPositions(ACTIVE, { sortBy: "TOP", pageSize: 5 });
    expect(Array.isArray(positions.positions)).toBe(true);
    expect(positions.positions.length).toBeGreaterThan(0);
    expect(typeof positions.totalCount).toBe("number");
    expect(typeof positions.positions[0]?.walletAddress).toBe("string");
    expect(typeof positions.positions[0]?.pnlUsd).toBe("number");
  }, 30_000);
});
