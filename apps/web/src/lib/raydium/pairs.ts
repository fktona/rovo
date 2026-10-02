import currencyPairs from "./pairs/currency-pairs.json";
import solanaPairs from "./pairs/solana-pairs.json";
import stonkfunPairs from "./pairs/stonkfun-pairs.json";
import xstocksPairs from "./pairs/xstocks-pairs.json";

export type LaunchPairKind = "xstocks" | "crypto" | "other";

export type LaunchPair = {
  symbol: string;
  name: string;
  mint: string;
  iconUrl: string;
  kind: LaunchPairKind;
};

type RawPair = {
  ticker: string;
  name: string;
  mint: string;
  image?: string;
  sourceImageUrl?: string;
};

function mapPairs(rows: readonly RawPair[], kind: LaunchPairKind): LaunchPair[] {
  return rows.map((row) => ({
    symbol: row.ticker,
    name: row.name,
    mint: row.mint,
    iconUrl: row.sourceImageUrl || row.image || "",
    kind,
  }));
}

export const launchPairs: readonly LaunchPair[] = [
  ...mapPairs(xstocksPairs, "xstocks"),
  ...mapPairs(solanaPairs, "crypto"),
  ...mapPairs(currencyPairs, "crypto"),
  ...mapPairs(stonkfunPairs, "other"),
];
