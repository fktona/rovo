import { createDatabase } from "@rovo/database";
import { createLaunchSyncClient, syncLaunchesOnce } from "./launch-sync.js";

const databaseUrl = process.env.DATABASE_URL;
const rpcUrl = process.env.PONDER_RPC_URL_4663 ?? process.env.ROBINHOOD_RPC_URL;
const registry = process.env.ROVO_REGISTRY_ADDRESS;
const startBlock = process.env.ROVO_START_BLOCK;
if (!databaseUrl || !rpcUrl || !registry || !/^0x[a-fA-F0-9]{40}$/.test(registry) || !startBlock || !/^\d+$/.test(startBlock)) {
  throw new Error("DATABASE_URL, ROBINHOOD_RPC_URL, ROVO_REGISTRY_ADDRESS and ROVO_START_BLOCK are required");
}

const { db, pool } = createDatabase(databaseUrl);
const input = {
  db,
  client: createLaunchSyncClient(rpcUrl),
  registry: registry as `0x${string}`,
  startBlock: BigInt(startBlock),
};
try {
  for (;;) {
    const result = await syncLaunchesOnce(input);
    console.info(`Launch sync: indexed ${result.indexed}, next block ${result.nextBlock}, chain head ${result.head}`);
    if (result.nextBlock > result.head - 12n) break;
  }
} finally {
  await pool.end();
}
