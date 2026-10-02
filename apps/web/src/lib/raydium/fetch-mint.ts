import { RAYDIUM_MINT_HOST } from "./constants";

export type RaydiumMint = {
  creator: string;
  decimals: number;
  description: string;
  imgUrl: string;
  marketCap: number;
  metadataUrl: string;
  mint: string;
  mintB: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  };
  name: string;
  poolId: string;
  supply: number;
  symbol: string;
  createAt: number;
  finishingRate: number;
  volumeA: number;
  volumeB: number;
  volumeU: number;
  migrateAmmId?: string;
  initPrice?: string;
  endPrice?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
};

export async function fetchMint(mint: string): Promise<RaydiumMint | null> {
  const response = await fetch(
    `${RAYDIUM_MINT_HOST}/get/by/mints?ids=${encodeURIComponent(mint)}`,
    { next: { revalidate: 15 } },
  );
  if (!response.ok) throw new Error(`fetchMint failed: ${response.status}`);
  const data = (await response.json()) as {
    data?: { rows?: RaydiumMint[] };
  };
  const row = data.data?.rows?.[0];
  return row ?? null;
}
