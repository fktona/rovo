import { http, type Transport } from "viem";

const PUBLIC_ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com";

/**
 * Public Robinhood RPC is rate-limited and has no WebSocket.
 * Ponder otherwise opens many block requests at once and then raises its own
 * limit, which gets this endpoint dropped.
 */
export function indexerRpc(url: string): string | Transport {
  const maxPerSecond = rpcMaxPerSecond(url);
  if (maxPerSecond === 0) return url;
  return pacedHttp(url, maxPerSecond);
}

function rpcMaxPerSecond(url: string): number {
  const raw = process.env.PONDER_RPC_MAX_RPS;
  if (raw !== undefined && raw !== "") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("PONDER_RPC_MAX_RPS must be a non-negative number");
    }
    return parsed;
  }
  return url === PUBLIC_ROBINHOOD_RPC ? 5 : 0;
}

function pacedHttp(url: string, maxPerSecond: number): Transport {
  const gapMs = Math.ceil(1000 / maxPerSecond);
  let nextAt = 0;
  let tail: Promise<void> = Promise.resolve();

  const fetchFn: typeof fetch = (input, init) => {
    const task = tail.then(async () => {
      const delay = Math.max(0, nextAt - Date.now());
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      nextAt = Date.now() + gapMs;
      return fetch(input, init);
    });
    tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };

  return http(url, {
    fetchFn,
    retryCount: 0,
    timeout: 20_000,
  });
}
