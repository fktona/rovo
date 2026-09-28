import { isAddress, type Address } from "viem";
import catalogue from "../../../../packages/config/pons-pair-tokens.json";

export type PairChoice = {
  symbol: string;
  name: string;
  address: Address;
  iconUrl: string;
};

export const pairChoices: readonly PairChoice[] = catalogue.tokens.map(
  (token) => {
    if (!isAddress(token.address))
      throw new Error(`Invalid curated pair address: ${token.symbol}`);
    return Object.freeze({
      symbol: token.symbol,
      name: token.name,
      address: token.address as Address,
      iconUrl: new URL(token.iconPath, catalogue.iconBaseUrl).toString(),
    });
  },
);

export function getPairChoice(address: Address): PairChoice | undefined {
  return pairChoices.find(
    (choice) => choice.address.toLowerCase() === address.toLowerCase(),
  );
}

const catalogueOrigin = new URL(catalogue.iconBaseUrl).origin;
const catalogueIconPaths = new Set(catalogue.tokens.map((token) => token.iconPath));

/** Same-origin proxy for catalogue icons so pair filters work when the icon host is blocked. */
export function pairIconSrc(iconUrl: string): string {
  try {
    const url = new URL(iconUrl);
    if (url.origin === catalogueOrigin && catalogueIconPaths.has(url.pathname)) {
      return `/api/pair-icon?path=${encodeURIComponent(url.pathname)}`;
    }
  } catch {
    return iconUrl;
  }
  return iconUrl;
}

export function isCatalogueIconPath(path: string): boolean {
  return catalogueIconPaths.has(path);
}

// The catalogue is a display list, not an on-chain approval oracle. Check
// Pons approvedPairTokens/pairTokenEconomics immediately before launching.
