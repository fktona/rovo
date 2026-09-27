import { describe, expect, it } from "vitest";
import { feeShareBps, splitFees, type FeeSplitInput } from "./fee-split";

const now = 1_790_500_000;
const base: FeeSplitInput = {
  launchType: "self",
  claimed: false,
  shareWithHolders: false,
  creatorToHoldersBps: 0,
  launchedAt: now,
  now,
};

describe("splitFees", () => {
  it("splits a self-rove fee 70/20/10", () => {
    expect(splitFees(10_000n, base)).toEqual({
      platform: 1_000n,
      creator: 7_000n,
      rover: 0n,
      holders: 2_000n,
    });
  });

  it("moves a shared slice of the creator bucket to holders", () => {
    const split = splitFees(10_000n, {
      ...base,
      shareWithHolders: true,
      creatorToHoldersBps: 2_500,
    });
    expect(split.creator).toBe(5_250n);
    expect(split.holders).toBe(3_750n);
    expect(split.platform).toBe(1_000n);
  });

  it("splits an unclaimed scout fee across creator, rover, holders, and platform", () => {
    expect(splitFees(10_000n, { ...base, launchType: "scout" })).toEqual({
      platform: 1_000n,
      creator: 6_000n,
      rover: 1_500n,
      holders: 1_500n,
    });
  });

  it("sends a sunset scout creator bucket half to holders and half to the platform", () => {
    const split = splitFees(10_000n, {
      ...base,
      launchType: "scout",
      launchedAt: now - 60 * 24 * 60 * 60 - 1,
    });
    expect(split.creator).toBe(0n);
    expect(split.holders).toBe(4_500n);
    expect(split.platform).toBe(4_000n);
    expect(split.rover).toBe(1_500n);
  });

  it("gives rounding dust to holders", () => {
    const split = splitFees(10_001n, base);
    expect(split.platform + split.creator + split.rover + split.holders).toBe(10_001n);
    expect(feeShareBps(split.creator, 10_001n)).toBe(6999);
  });
});
