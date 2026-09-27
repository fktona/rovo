import { formatUnits, parseUnits, type Address } from "viem";
import { robinhoodChain } from "./chain";

export function parseTokenAmount(value: string, decimals: number): bigint {
  if (
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255
  ) {
    throw new Error("Invalid token amount");
  }
  if ((value.split(".")[1]?.length ?? 0) > decimals)
    throw new Error("Token amount has too many decimal places");
  const parsed = parseUnits(value, decimals);
  if (parsed <= 0n) throw new Error("Token amount must be positive");
  return parsed;
}

export function formatTokenAmount(value: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255)
    throw new Error("Invalid token decimals");
  return formatUnits(value, decimals);
}

export function formatBps(bps: number): string {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000)
    throw new Error("Invalid basis points");
  return `${(bps / 100).toFixed(2)}%`;
}

export function explorerAddress(address: Address): string {
  return `${robinhoodChain.blockExplorers.default.url}/address/${address}`;
}

export function explorerTransaction(hash: `0x${string}`): string {
  if (!/^0x[\da-fA-F]{64}$/.test(hash))
    throw new Error("Invalid transaction hash");
  return `${robinhoodChain.blockExplorers.default.url}/tx/${hash}`;
}
