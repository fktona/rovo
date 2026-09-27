import {
  rewardEpochs,
  rewardProofs,
  type createDatabase,
} from "@rovo/database";
import { and, eq } from "drizzle-orm";
import { parseAbi, type Address, type Hex } from "viem";
import type { RewardSnapshot } from "./snapshot.js";

const holderRewardsAbi = parseAbi([
  "function pools(address profileToken) view returns (uint256 funded, uint256 reserved, uint256 claimed)",
  "function setEpochRoot(address profileToken, uint256 epochId, bytes32 root, uint256 total)",
]);

type Database = ReturnType<typeof createDatabase>["db"];
type PublicClient = {
  getBlock: (args: { blockNumber: bigint }) => Promise<{ hash: Hex | null }>;
  readContract: any;
  waitForTransactionReceipt: (args: {
    hash: Hex;
  }) => Promise<{ status: "success" | "reverted" }>;
};
type WalletClient = {
  writeContract: any;
};

export async function publishRewardEpoch(args: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  holderRewards: Address;
  epochId: bigint;
  snapshot: RewardSnapshot;
}): Promise<Hex> {
  const { publicClient, walletClient, holderRewards, epochId, snapshot } = args;
  const root = snapshot.root;
  if (!root || snapshot.total === 0n)
    throw new Error("cannot publish an empty reward epoch");
  const block = await publicClient.getBlock({
    blockNumber: snapshot.snapshotBlock,
  });
  if (block.hash?.toLowerCase() !== snapshot.snapshotBlockHash.toLowerCase())
    throw new Error("snapshot block hash changed");
  const [funded, reserved, claimed] = await publicClient.readContract({
    address: holderRewards,
    abi: holderRewardsAbi,
    functionName: "pools",
    args: [snapshot.profileToken],
  });
  const available = funded - reserved - claimed;
  if (available < snapshot.total)
    throw new Error("insufficient on-chain reward pool");
  const hash = await walletClient.writeContract({
    address: holderRewards,
    abi: holderRewardsAbi,
    functionName: "setEpochRoot",
    args: [snapshot.profileToken, epochId, root, snapshot.total],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error("reward epoch publication reverted");
  return hash;
}

/** Stores only a successfully published epoch and its exact on-chain proof inputs. */
export async function persistPublishedEpoch(
  db: Database,
  args: {
    epochId: bigint;
    stockToken: Address;
    snapshot: RewardSnapshot;
  },
) {
  const { epochId, stockToken, snapshot } = args;
  const root = snapshot.root;
  if (!root || snapshot.total === 0n)
    throw new Error("cannot persist an empty reward epoch");
  await db.transaction(async (tx) => {
    await tx
      .insert(rewardEpochs)
      .values({
        profileToken: snapshot.profileToken.toLowerCase(),
        epochId,
        stockToken: stockToken.toLowerCase(),
        merkleRoot: root,
        totalAmount: snapshot.total,
        snapshotBlock: snapshot.snapshotBlock,
        snapshotBlockHash: snapshot.snapshotBlockHash,
        metadataUri: snapshot.metadataUri,
      })
      .onConflictDoUpdate({
        target: [rewardEpochs.profileToken, rewardEpochs.epochId],
        set: {
          merkleRoot: root,
          totalAmount: snapshot.total,
          snapshotBlock: snapshot.snapshotBlock,
          snapshotBlockHash: snapshot.snapshotBlockHash,
          metadataUri: snapshot.metadataUri,
        },
      });
    await tx
      .delete(rewardProofs)
      .where(
        and(
          eq(rewardProofs.profileToken, snapshot.profileToken.toLowerCase()),
          eq(rewardProofs.epochId, epochId),
        ),
      );
    await tx.insert(rewardProofs).values(
      snapshot.allocations.map((allocation) => ({
        profileToken: snapshot.profileToken.toLowerCase(),
        epochId,
        account: allocation.account.toLowerCase(),
        amount: allocation.amount,
        proof: allocation.proof,
      })),
    );
  });
}
