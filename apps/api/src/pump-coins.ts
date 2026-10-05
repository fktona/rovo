import { pumpCoins, type createDatabase } from "@rovo/database";
import { desc, eq } from "drizzle-orm";

type Database = ReturnType<typeof createDatabase>["db"];

export interface PumpCoinInput {
  mint: string;
  name?: string | undefined;
  symbol?: string | undefined;
  imageUrl?: string | undefined;
  metadataUri?: string | undefined;
  quoteMint?: string | undefined;
  launcherWallet?: string | undefined;
  signature?: string | undefined;
}

export interface PumpCoinRecord {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  metadataUri: string | null;
  quoteMint: string | null;
  launcherWallet: string | null;
  signature: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRecord(row: typeof pumpCoins.$inferSelect): PumpCoinRecord {
  return {
    mint: row.mint,
    name: row.name,
    symbol: row.symbol,
    imageUrl: row.imageUrl,
    metadataUri: row.metadataUri,
    quoteMint: row.quoteMint,
    launcherWallet: row.launcherWallet,
    signature: row.signature,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function savePumpCoin(db: Database, input: PumpCoinInput) {
  const updatedAt = new Date();
  const [row] = await db
    .insert(pumpCoins)
    .values({
      mint: input.mint,
      name: input.name ?? null,
      symbol: input.symbol ?? null,
      imageUrl: input.imageUrl ?? null,
      metadataUri: input.metadataUri ?? null,
      quoteMint: input.quoteMint ?? null,
      launcherWallet: input.launcherWallet ?? null,
      signature: input.signature ?? null,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: pumpCoins.mint,
      set: {
        updatedAt,
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.symbol != null ? { symbol: input.symbol } : {}),
        ...(input.imageUrl != null ? { imageUrl: input.imageUrl } : {}),
        ...(input.metadataUri != null ? { metadataUri: input.metadataUri } : {}),
        ...(input.quoteMint != null ? { quoteMint: input.quoteMint } : {}),
        ...(input.launcherWallet != null
          ? { launcherWallet: input.launcherWallet }
          : {}),
        ...(input.signature != null ? { signature: input.signature } : {}),
      },
    })
    .returning();
  if (!row) throw new Error("Pump coin was not saved");
  return toRecord(row);
}

export async function listPumpCoins(db: Database, limit: number) {
  const rows = await db
    .select()
    .from(pumpCoins)
    .orderBy(desc(pumpCoins.createdAt))
    .limit(limit);
  return rows.map(toRecord);
}

export async function getPumpCoin(db: Database, mint: string) {
  const [row] = await db
    .select()
    .from(pumpCoins)
    .where(eq(pumpCoins.mint, mint))
    .limit(1);
  return row ? toRecord(row) : null;
}
