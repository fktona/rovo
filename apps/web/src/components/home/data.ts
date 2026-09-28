export type Pair = { label: string; icon: string };

export type Token = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  marketCap: string | null;
  price: string | null;
  created: string;
  age: string;
  marketCapUsd: number | null;
  graduated: boolean;
  launchedAt: number;
  pair: Pair;
};
