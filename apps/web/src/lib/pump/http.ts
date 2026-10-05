import { PublicKey } from "@solana/web3.js";
import { PumpRequestError } from "./client";

export function readMint(mint: string) {
  try {
    return new PublicKey(mint).toBase58();
  } catch {
    return null;
  }
}

export function pumpError(error: unknown) {
  if (error instanceof PumpRequestError && error.status === 404) {
    return Response.json({ error: "Pump coin not found" }, { status: 404 });
  }
  console.error("Pump request failed", error);
  return Response.json(
    { error: "Unable to load Pump coin data" },
    { status: 502 },
  );
}

export function readMints(body: unknown): string[] | null {
  const raw = Array.isArray(body)
    ? body
    : body && typeof body === "object" && "mints" in body
      ? (body as { mints: unknown }).mints
      : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) return null;
  const mints: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") return null;
    const mint = readMint(value);
    if (!mint) return null;
    mints.push(mint);
  }
  return mints;
}
