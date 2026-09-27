import { describe, expect, it } from "vitest";
import { BPS, SUNSET_SECONDS, calculateFeeSplit } from "./fees.js";

const base = {
  amount: 100n,
  launchedAt: 1_000n,
  timestamp: 1_001n,
  shareWithHolders: false,
  creatorToHoldersBps: 0n,
} as const;

describe("calculateFeeSplit", () => {
  it("routes an unclaimed Scout before sunset", () => {
    expect(
      calculateFeeSplit({ ...base, launchType: "scout", claimed: false }),
    ).toEqual({
      platform: 10n,
      nottingham: 60n,
      creator: 0n,
      rover: 15n,
      holders: 15n,
    });
  });

  it("routes an unclaimed Scout after sunset", () => {
    expect(
      calculateFeeSplit({
        ...base,
        launchType: "scout",
        claimed: false,
        timestamp: base.launchedAt + SUNSET_SECONDS,
      }),
    ).toEqual({
      platform: 40n,
      nottingham: 0n,
      creator: 0n,
      rover: 15n,
      holders: 45n,
    });
  });

  it("routes Self-Rove with sharing off", () => {
    expect(
      calculateFeeSplit({ ...base, launchType: "self", claimed: true }),
    ).toEqual({
      platform: 10n,
      nottingham: 0n,
      creator: 70n,
      rover: 0n,
      holders: 20n,
    });
  });

  it("routes Self-Rove with half of creator bucket shared", () => {
    expect(
      calculateFeeSplit({
        ...base,
        launchType: "self",
        claimed: true,
        shareWithHolders: true,
        creatorToHoldersBps: 5_000n,
      }),
    ).toEqual({
      platform: 10n,
      nottingham: 0n,
      creator: 35n,
      rover: 0n,
      holders: 55n,
    });
  });

  it("keeps the persistent Rover royalty after claim", () => {
    expect(
      calculateFeeSplit({
        ...base,
        launchType: "scout",
        claimed: true,
        shareWithHolders: true,
        creatorToHoldersBps: BPS,
      }),
    ).toEqual({
      platform: 10n,
      nottingham: 0n,
      creator: 0n,
      rover: 15n,
      holders: 75n,
    });
  });

  it("splits the combined creator allocation and creator tax", () => {
    expect(
      calculateFeeSplit({
        ...base,
        amount: 150n,
        launchType: "scout",
        claimed: false,
      }),
    ).toEqual({
      platform: 15n,
      nottingham: 90n,
      creator: 0n,
      rover: 22n,
      holders: 23n,
    });
  });

  it("assigns all integer rounding remainder to holders", () => {
    const result = calculateFeeSplit({
      ...base,
      amount: 101n,
      launchType: "self",
      claimed: true,
    });
    expect(Object.values(result).reduce((sum, value) => sum + value, 0n)).toBe(
      101n,
    );
  });
});
