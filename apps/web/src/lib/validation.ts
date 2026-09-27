import { isAddress, type Address, type Hex } from "viem";

export function asAddress(value: string, label = "address"): Address {
  if (!isAddress(value)) throw new Error(`Invalid ${label}`);
  return value as Address;
}

export function asBytes32(value: string, label = "bytes32"): Hex {
  if (!/^0x[\da-fA-F]{64}$/.test(value)) throw new Error(`Invalid ${label}`);
  return value as Hex;
}

export function asSignature(value: string): Hex {
  if (!/^0x(?:[\da-fA-F]{2})+$/.test(value))
    throw new Error("Invalid signature");
  return value as Hex;
}

export function asUint(
  value: string | number | bigint,
  bits: number,
  label: string,
): bigint {
  if (!Number.isInteger(bits) || bits < 1 || bits > 256)
    throw new Error("Invalid bit width");
  if (typeof value === "number" && !Number.isSafeInteger(value))
    throw new Error(`Invalid ${label}`);
  if (typeof value === "string" && !/^(0|[1-9]\d*)$/.test(value))
    throw new Error(`Invalid ${label}`);
  const result = BigInt(value);
  if (result < 0n || result >= 1n << BigInt(bits))
    throw new Error(`Invalid ${label}`);
  return result;
}

export function assertPositive(value: bigint, label: string): bigint {
  if (value <= 0n) throw new Error(`${label} must be positive`);
  return value;
}

export function normalizeHandle(handle: string): string {
  const normalized = handle.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized))
    throw new Error("Invalid X handle");
  return normalized;
}

export function requireDeadline(
  deadline: bigint,
  now = Math.floor(Date.now() / 1000),
): bigint {
  if (deadline <= BigInt(now))
    throw new Error("Attestation or trade deadline has expired");
  return deadline;
}
