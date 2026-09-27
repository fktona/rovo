import { readFile } from "node:fs/promises";
import { requireFromContracts } from "./lib/compile-contracts.mjs";

const { getAddress } = requireFromContracts("viem");

const catalogue = JSON.parse(
  await readFile(
    new URL("../packages/config/pons-pair-tokens.json", import.meta.url),
    "utf8",
  ),
);
const saved = JSON.parse(
  await readFile(
    new URL(
      "../packages/config/robinhood-stock-deployments-4663.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const responsePath = process.argv[2];
const response = responsePath
  ? JSON.parse(await readFile(responsePath, "utf8"))
  : null;
const ponsBundlePath = process.argv[3];
const ponsBundle = ponsBundlePath
  ? await readFile(ponsBundlePath, "utf8")
  : null;
const nonStockAddresses = new Map([
  ["ETH", "0x0000000000000000000000000000000000000000"],
  ["USDG", "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"],
]);
const ponsSource =
  "https://www.ponsfamily.com/_next/static/immutable/chunks/2ag-ww6xlt2tl.js";

if (
  catalogue.tokens.length !== 65 ||
  saved.chainId !== 4663 ||
  saved.sourceUrl !== "https://api.robinhood.com/rhj/assets"
) {
  throw new Error("Catalogue or Robinhood source metadata mismatch");
}
if (
  catalogue.addressSource !== saved.sourceUrl ||
  catalogue.addressFetchedAt !== saved.fetchedAt ||
  catalogue.nonStockAddressSource !== ponsSource
) {
  throw new Error("Catalogue provenance mismatch");
}
if (
  ponsBundle &&
  (!ponsBundle.includes(
    'address:i.zeroAddress,symbol:"ETH",name:"Ether",decimals:18,isNative:!0',
  ) ||
    !ponsBundle.includes(
      `address:"${nonStockAddresses.get("USDG")}",symbol:"USDG",name:"Global Dollar",decimals:6`,
    ))
) {
  throw new Error("Pons bundle ETH/USDG source mismatch");
}
const savedBySymbol = new Map(
  saved.assets.map((asset) => [asset.symbol.toUpperCase(), asset]),
);
if (savedBySymbol.size !== saved.assets.length)
  throw new Error("Duplicate Stock Token symbols");

const seen = new Set();
let resolved = 0;
for (const token of catalogue.tokens) {
  const symbol = token.symbol.toUpperCase();
  if (seen.has(symbol)) throw new Error(`Duplicate Pons symbol: ${symbol}`);
  seen.add(symbol);
  const asset = savedBySymbol.get(symbol);
  if (!asset) {
    const expected = nonStockAddresses.get(symbol);
    if (!expected || token.address !== expected)
      throw new Error(`Unverified Pons address: ${symbol}`);
    continue;
  }
  if (
    asset.status !== "ASSET_STATUS_ACTIVE" ||
    getAddress(token.address) !== getAddress(asset.address)
  ) {
    throw new Error(`Incorrect Stock Token address: ${symbol}`);
  }
  if (response) {
    const matches = response.assets.filter(
      (candidate) => candidate.tokenSymbol?.toUpperCase() === symbol,
    );
    if (matches.length !== 1 || matches[0].status !== "ASSET_STATUS_ACTIVE")
      throw new Error(`Invalid Robinhood match: ${symbol}`);
    const deployments = matches[0].deployments.filter(
      (deployment) => deployment.chainId === 4663,
    );
    if (
      deployments.length !== 1 ||
      getAddress(deployments[0].contractAddress) !==
        getAddress(asset.address) ||
      matches[0].id !== asset.id
    ) {
      throw new Error(`Invalid Robinhood deployment: ${symbol}`);
    }
  }
  resolved += 1;
}
if (resolved !== saved.assets.length)
  throw new Error("Orphaned Robinhood deployment");
console.log(
  `Pons pair address reconciliation passed: ${resolved} Robinhood Stock Tokens, ${nonStockAddresses.size} Pons native/stablecoin assets`,
);
