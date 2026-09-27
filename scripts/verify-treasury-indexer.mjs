import { readFile } from "node:fs/promises";

const abi = await readFile(
  new URL("../apps/indexer/abis/rovo.ts", import.meta.url),
  "utf8",
);
const handler = await readFile(
  new URL("../apps/indexer/src/index.ts", import.meta.url),
  "utf8",
);
const collector = await readFile(
  new URL("../packages/contracts/src/LaunchFeeCollector.sol", import.meta.url),
  "utf8",
);
const schema = await readFile(
  new URL("../apps/indexer/ponder.schema.ts", import.meta.url),
  "utf8",
);

const event = "RevenueRoutedToTreasury";
if (!collector.includes(`event ${event}(`))
  throw new Error("Collector treasury event missing");
if (!schema.includes("treasury: t.hex()"))
  throw new Error("Indexer treasury destination column missing");
if (
  !abi.includes(
    `event ${event}(address indexed profileToken, address indexed asset, address indexed treasury, uint256 amount, address admin)`,
  )
) {
  throw new Error("Indexer treasury ABI missing or mismatched");
}
const start = handler.indexOf(`ponder.on("LaunchFeeCollector:${event}"`);
const end = handler.indexOf("\n});", start);
if (start < 0 || end < 0) throw new Error("Indexer treasury handler missing");
const body = handler.slice(start, end);
for (const fragment of [
  "context.db.insert(revenue)",
  "event.args.profileToken",
  "event.args.asset",
  "event.args.amount",
  "event.args.treasury",
  'state: "treasury"',
]) {
  if (!body.includes(fragment))
    throw new Error(`Indexer treasury handler missing ${fragment}`);
}
console.log("treasury revenue indexing verified");
