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

// The catalogue is a display list, not an on-chain approval oracle. Check
// Pons approvedPairTokens/pairTokenEconomics immediately before launching.
