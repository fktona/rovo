const BPS = 10_000n;
const SUNSET_SECONDS = 60n * 24n * 60n * 60n;

export type FeeSplitInput = {
  launchType: "scout" | "self";
  claimed: boolean;
  shareWithHolders: boolean;
  creatorToHoldersBps: number;
  launchedAt: number;
  now: number;
};

export type FeeSplit = {
  platform: bigint;
  creator: bigint;
  rover: bigint;
  holders: bigint;
};

/** Matches `RovoFeeSplitter.disperse`: 10% platform, then the launch-type buckets. Rounding dust goes to holders. */
export function splitFees(amount: bigint, input: FeeSplitInput): FeeSplit {
  if (amount <= 0n) return { platform: 0n, creator: 0n, rover: 0n, holders: 0n };
  let platform = (amount * 1_000n) / BPS;
  let holders = 0n;
  let creator = 0n;
  let rover = 0n;
  const shareBps = input.shareWithHolders
    ? BigInt(Math.max(0, Math.min(10_000, input.creatorToHoldersBps)))
    : 0n;

  if (input.launchType === "self") {
    holders = (amount * 2_000n) / BPS;
    const creatorBucket = (amount * 7_000n) / BPS;
    const shared = (creatorBucket * shareBps) / BPS;
    creator = creatorBucket - shared;
    holders += shared;
  } else {
    rover = (amount * 1_500n) / BPS;
    holders = (amount * 1_500n) / BPS;
    const creatorBucket = (amount * 6_000n) / BPS;
    const sunset =
      !input.claimed &&
      input.now >= input.launchedAt + Number(SUNSET_SECONDS);
    if (sunset) {
      const sunsetHolders = creatorBucket / 2n;
      holders += sunsetHolders;
      platform += creatorBucket - sunsetHolders;
    } else if (!input.claimed) {
      creator = creatorBucket;
    } else {
      const shared = (creatorBucket * shareBps) / BPS;
      creator = creatorBucket - shared;
      holders += shared;
    }
  }

  const accounted = platform + creator + rover + holders;
  holders += amount - accounted;
  return { platform, creator, rover, holders };
}

export function feeShareBps(part: bigint, amount: bigint): number {
  if (amount <= 0n || part <= 0n) return 0;
  return Number((part * 10_000n) / amount);
}
