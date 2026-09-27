export type Pair = { label: string; icon: string };

export type Token = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  marketCap: string | null;
  // volume24h: string;
  created: string;
  age: string;
  // change24h: string;
  creatorFee: string | null;
  marketCapUsd: number | null;
  creatorFeeUsd: number | null;
  graduated: boolean;
  launchedAt: number;
  pair: Pair;
};
