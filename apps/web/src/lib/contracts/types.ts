import type { Address, Hex } from "viem";

export type TokenMetadata = {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
  salt: Hex;
};

export type TradeInput = {
  profileToken: Address;
  inputToken: Address;
  amountIn: bigint;
  minPairOut: bigint;
  minProfileOut: bigint;
  deadline: bigint;
  inputAdapter?: Address;
  inputAdapterData?: Hex;
  v4AdapterData?: Hex;
};

export type LaunchInput = {
  metadata: TokenMetadata;
  launchConfigId: number;
  pairToken: Address;
  openingBuy?: { quoteIn: bigint; minTokensOut: bigint };
};

export type SelfRoveInput = LaunchInput & { creatorTaxBps: number };
export type ScoutInput = LaunchInput & { handle: string };
