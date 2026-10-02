import { rovoToken, type createDatabase } from "@rovo/database";
import { eq } from "drizzle-orm";

type Database = ReturnType<typeof createDatabase>["db"];

const rowId = 1;

export async function loadRovoToken(db: Database): Promise<`0x${string}` | null> {
  const [row] = await db
    .select()
    .from(rovoToken)
    .where(eq(rovoToken.id, rowId))
    .limit(1);
  if (!row || !/^0x[a-fA-F0-9]{40}$/.test(row.address)) return null;
  return row.address as `0x${string}`;
}

export async function saveRovoToken(db: Database, address: `0x${string}`) {
  const updatedAt = new Date();
  await db
    .insert(rovoToken)
    .values({ id: rowId, address, updatedAt })
    .onConflictDoUpdate({
      target: rovoToken.id,
      set: { address, updatedAt },
    });
}
