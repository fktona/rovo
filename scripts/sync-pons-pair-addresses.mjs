import { readFile, writeFile } from "node:fs/promises";
import { requireFromContracts } from "./lib/compile-contracts.mjs";

const { getAddress } = requireFromContracts("viem");
const nonStockAddresses = new Map([
  ["ETH", "0x0000000000000000000000000000000000000000"],
  ["USDG", "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"],
]);

const inputPath = process.argv[2];
if (!inputPath)
  throw new Error(
    "Usage: node scripts/sync-pons-pair-addresses.mjs <robinhood-assets-response.json>",
  );

const cataloguePath = new URL(
  "../packages/config/pons-pair-tokens.json",
  import.meta.url,
);
const deploymentsPath = new URL(
  "../packages/config/robinhood-stock-deployments-4663.json",
  import.meta.url,
);
const response = JSON.parse(await readFile(inputPath, "utf8"));
const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
if (!Array.isArray(response.assets) || !Array.isArray(catalogue.tokens))
  throw new Error("Invalid asset catalogue");

const bySymbol = new Map();
for (const asset of response.assets) {
  if (
    typeof asset.tokenSymbol !== "string" ||
    !Array.isArray(asset.deployments)
  )
    continue;
  const deployments = asset.deployments.filter(
    (deployment) => deployment.chainId === 4663,
  );
  if (deployments.length === 0) continue;
  const symbol = asset.tokenSymbol.toUpperCase();
  const current = bySymbol.get(symbol) ?? [];
  current.push({ asset, deployments });
  bySymbol.set(symbol, current);
}

const resolved = [];
const unresolved = [];
for (const token of catalogue.tokens) {
  const matches = bySymbol.get(token.symbol.toUpperCase()) ?? [];
  const active = matches.filter(
    ({ asset, deployments }) =>
      asset.status === "ASSET_STATUS_ACTIVE" && deployments.length === 1,
  );
  if (active.length !== 1) {
    const nonStockAddress = nonStockAddresses.get(token.symbol.toUpperCase());
    if (nonStockAddress) {
      if (token.address !== nonStockAddress)
        throw new Error(`Incorrect Pons address for ${token.symbol}`);
      continue;
    }
    if (token.address !== null)
      throw new Error(
        `Previously resolved ${token.symbol} is absent or ambiguous in Robinhood response`,
      );
    unresolved.push(token.symbol);
    continue;
  }
  const { asset, deployments } = active[0];
  const address = getAddress(deployments[0].contractAddress);
  if (token.address !== null && getAddress(token.address) !== address) {
    throw new Error(
      `Address changed for ${token.symbol}: ${token.address} vs ${address}`,
    );
  }
  token.address = address;
  resolved.push({
    id: asset.id,
    symbol: token.symbol,
    address,
    status: asset.status,
  });
}

const fetchedAt = new Date().toISOString();
catalogue.addressSource = "https://api.robinhood.com/rhj/assets";
catalogue.addressFetchedAt = fetchedAt;
const deployments = {
  sourceUrl: catalogue.addressSource,
  fetchedAt,
  chainId: 4663,
  assets: resolved,
};
await writeFile(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);
await writeFile(deploymentsPath, `${JSON.stringify(deployments, null, 2)}\n`);
console.log(
  `Resolved ${resolved.length} Pons pairs from Robinhood Chain; unresolved: ${unresolved.join(", ")}`,
);
