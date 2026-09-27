export const BPS = 10_000n;
export const SCOUT_PLATFORM_BPS = 1_000n;
export const SCOUT_CREATOR_BPS = 6_000n;
export const SCOUT_ROVER_BPS = 1_500n;
export const SCOUT_HOLDER_BPS = 1_500n;
export const SELF_PLATFORM_BPS = 1_000n;
export const SELF_CREATOR_BPS = 7_000n;
export const SELF_HOLDER_BPS = 2_000n;
export const SUNSET_SECONDS = 60n * 24n * 60n * 60n;

export type SplitInput = {
  amount: bigint;
  launchType: "scout" | "self";
  claimed: boolean;
  launchedAt: bigint;
  timestamp: bigint;
  shareWithHolders: boolean;
  creatorToHoldersBps: bigint;
};

export type FeeSplit = {
  platform: bigint;
  nottingham: bigint;
  creator: bigint;
  rover: bigint;
  holders: bigint;
};

const portion = (amount: bigint, bps: bigint) => (amount * bps) / BPS;

export function calculateFeeSplit(input: SplitInput): FeeSplit {
  if (input.amount < 0n) throw new Error("amount cannot be negative");
  if (input.creatorToHoldersBps < 0n || input.creatorToHoldersBps > BPS) {
    throw new Error("creator holder share is outside basis-point range");
  }

  const split: FeeSplit = {
    platform: 0n,
    nottingham: 0n,
    creator: 0n,
    rover: 0n,
    holders: 0n,
  };

  if (input.launchType === "self") {
    split.platform = portion(input.amount, SELF_PLATFORM_BPS);
    split.holders = portion(input.amount, SELF_HOLDER_BPS);
    const creatorBucket = portion(input.amount, SELF_CREATOR_BPS);
    const shared = input.shareWithHolders
      ? portion(creatorBucket, input.creatorToHoldersBps)
      : 0n;
    split.creator = creatorBucket - shared;
    split.holders += shared;
  } else {
    split.platform = portion(input.amount, SCOUT_PLATFORM_BPS);
    split.rover = portion(input.amount, SCOUT_ROVER_BPS);
    split.holders = portion(input.amount, SCOUT_HOLDER_BPS);
    const creatorBucket = portion(input.amount, SCOUT_CREATOR_BPS);

    if (
      !input.claimed &&
      input.timestamp >= input.launchedAt + SUNSET_SECONDS
    ) {
      const holderSunset = creatorBucket / 2n;
      split.holders += holderSunset;
      split.platform += creatorBucket - holderSunset;
    } else if (!input.claimed) {
      split.nottingham = creatorBucket;
    } else {
      const shared = input.shareWithHolders
        ? portion(creatorBucket, input.creatorToHoldersBps)
        : 0n;
      split.creator = creatorBucket - shared;
      split.holders += shared;
    }
  }

  const accounted = Object.values(split).reduce(
    (sum, value) => sum + value,
    0n,
  );
  split.holders += input.amount - accounted;
  return split;
}
