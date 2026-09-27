import { describe, expect, it } from "vitest";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { buildRewardEpoch } from "./epoch.js";

const alice = "0x0000000000000000000000000000000000000001" as const;
const bob = "0x0000000000000000000000000000000000000002" as const;

describe("buildRewardEpoch", () => {
  it("allocates pro rata, preserves dust, and produces valid proofs", () => {
    const epoch = buildRewardEpoch(101n, [
      { account: bob, balance: 1n },
      { account: alice, balance: 3n },
    ]);
    expect(epoch.total).toBe(101n);
    expect(epoch.allocations.map((item) => item.amount)).toEqual([75n, 26n]);
    for (const allocation of epoch.allocations) {
      expect(
        StandardMerkleTree.verify(
          epoch.root!,
          ["address", "uint256"],
          [allocation.account, allocation.amount.toString()],
          allocation.proof,
        ),
      ).toBe(true);
    }
  });

  it("rolls forward a pool with no eligible holders", () => {
    expect(buildRewardEpoch(100n, []).root).toBeNull();
  });
});
