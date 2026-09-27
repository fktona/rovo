import { existsSync } from "node:fs";

const required = [
  "packages/contracts/src/RovoFactoryWrapper.sol",
  "packages/contracts/src/RovoRegistry.sol",
  "packages/contracts/src/LaunchFeeCollector.sol",
  "packages/contracts/src/RovoFeeSplitter.sol",
  "packages/contracts/src/NottinghamVault.sol",
  "packages/contracts/src/HolderRewardDistributor.sol",
  "packages/contracts/src/PlatformFeeReservoir.sol",
  "apps/indexer/ponder.config.ts",
  "apps/api/src/server.ts",
  "apps/api/src/privy.ts",
  "apps/workers/src/main.ts",
  "packages/database/src/schema.ts",
];

const missing = required.filter((path) => !existsSync(path));
if (missing.length)
  throw new Error(`Missing foundation files: ${missing.join(", ")}`);
if (existsSync("apps/web"))
  throw new Error(
    "apps/web exists, but this delivery explicitly excludes web work",
  );
console.log("foundation structure verified");
