import { describe, expect, it } from "vitest";
import { publishRewardEpoch } from "./publication.js";
import type { RewardSnapshot } from "./snapshot.js";

const profileToken = "0x0000000000000000000000000000000000000011" as const;
const holderRewards = "0x0000000000000000000000000000000000000022" as const;
const root =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const hash =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const snapshot: RewardSnapshot = {
  profileToken,
  snapshotBlock: 100n,
  snapshotBlockHash: hash,
  metadataUri: "ipfs://epoch",
  eligibleSupply: 10n,
  excludedSupply: 0n,
  holderCount: 1,
  root,
  total: 50n,
  allocations: [
    {
      account: "0x0000000000000000000000000000000000000003",
      amount: 50n,
      proof: [],
    },
  ],
};

describe("publishRewardEpoch", () => {
  it("rechecks the snapshot hash and available pool before publishing", async () => {
    const writes: unknown[] = [];
    const tx = await publishRewardEpoch({
      publicClient: {
        getBlock: async () => ({ hash }),
        readContract: async () => [100n, 20n, 10n] as const,
        waitForTransactionReceipt: async () => ({ status: "success" as const }),
      },
      walletClient: {
        writeContract: async (request: unknown) => {
          writes.push(request);
          return hash;
        },
      },
      holderRewards,
      epochId: 7n,
      snapshot,
    });
    expect(tx).toBe(hash);
    expect(writes).toHaveLength(1);
  });

  it("refuses a changed block hash or an underfunded pool", async () => {
    const client = {
      getBlock: async () => ({ hash: root }),
      readContract: async () => [10n, 0n, 0n] as const,
      waitForTransactionReceipt: async () => ({ status: "success" as const }),
    };
    await expect(
      publishRewardEpoch({
        publicClient: client,
        walletClient: { writeContract: async () => hash },
        holderRewards,
        epochId: 7n,
        snapshot,
      }),
    ).rejects.toThrow("snapshot block hash changed");
  });
});

console.log("reward epoch publication passed");
