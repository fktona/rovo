import { describe, expect, it } from "vitest";
import { ingestRewardSnapshot } from "./snapshot.js";

const token = "0x00000000000000000000000000000000000000aa" as const;
const alice = "0x0000000000000000000000000000000000000001" as const;
const bob = "0x0000000000000000000000000000000000000002" as const;
const curve = "0x0000000000000000000000000000000000000003" as const;

describe("ingestRewardSnapshot", () => {
  it("pins a finalized block, excludes system balances, and creates claimable allocations", async () => {
    const snapshot = await ingestRewardSnapshot(
      {
        getBlock: async () => ({
          hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
        getLogs: async () => [
          {
            args: {
              from: "0x0000000000000000000000000000000000000000" as const,
              to: alice,
              value: 75n,
            },
          },
          {
            args: {
              from: "0x0000000000000000000000000000000000000000" as const,
              to: bob,
              value: 25n,
            },
          },
          { args: { from: alice, to: curve, value: 5n } },
        ],
      },
      {
        profileToken: token,
        launchBlock: 10n,
        snapshotBlock: 10n,
        pool: 100n,
        excludedAccounts: [curve],
        metadataUri: "ipfs://epoch",
      },
    );
    expect(snapshot.eligibleSupply).toBe(95n);
    expect(snapshot.excludedSupply).toBe(5n);
    expect(snapshot.allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account: alice, amount: 73n }),
        expect.objectContaining({ account: bob, amount: 27n }),
      ]),
    );
    expect(snapshot.root).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("returns an unpublished epoch when there are no eligible holders", async () => {
    await expect(
      ingestRewardSnapshot(
        {
          getBlock: async () => ({
            hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          }),
          getLogs: async () => [],
        },
        {
          profileToken: token,
          launchBlock: 1n,
          snapshotBlock: 1n,
          pool: 1n,
          excludedAccounts: [],
          metadataUri: "ipfs://epoch",
        },
      ),
    ).resolves.toMatchObject({ root: null, total: 0n });
  });
});

console.log("snapshot ingestion passed");
