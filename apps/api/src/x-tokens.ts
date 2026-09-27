import { xOauthTokens, type createDatabase } from "@rovo/database";
import { eq } from "drizzle-orm";
import type { StoredXTokens } from "./x-auth.js";

type Database = ReturnType<typeof createDatabase>["db"];

const rowId = 1;

export async function loadXOauthTokens(db: Database): Promise<StoredXTokens | null> {
  const [row] = await db.select().from(xOauthTokens).where(eq(xOauthTokens.id, rowId)).limit(1);
  if (!row) return null;
  return {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt.getTime(),
  };
}

export async function saveXOauthTokens(db: Database, tokens: StoredXTokens) {
  const expiresAt = new Date(tokens.expiresAt);
  const updatedAt = new Date();
  await db
    .insert(xOauthTokens)
    .values({
      id: rowId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: xOauthTokens.id,
      set: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        updatedAt,
      },
    });
}
