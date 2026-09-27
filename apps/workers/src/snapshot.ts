import { parseAbiItem, type Address, type Hex } from "viem";
import { buildRewardEpoch, type HolderBalance } from "./epoch.js";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const zeroAddress = "0x0000000000000000000000000000000000000000" as Address;

export type SnapshotClient = {
  getBlock: (args: { blockNumber: bigint }) => Promise<{ hash: Hex | null }>;
  getLogs: (args: {
    address: Address;
    event: typeof transferEvent;
    fromBlock: bigint;
    toBlock: bigint;
  }) => Promise<
    Array<{
      args: {
        from?: Address | undefined;
        to?: Address | undefined;
        value?: bigint | undefined;
      };
    }>
  >;
};

export type RewardSnapshotRequest = {
  profileToken: Address;
  snapshotBlock: bigint;
  launchBlock: bigint;
  pool: bigint;
  /** Contracts and wallets that must never receive holder rewards. */
  excludedAccounts: Address[];
  metadataUri: string;
  blockRange?: bigint;
};

export type RewardSnapshot = {
  profileToken: Address;
  snapshotBlock: bigint;
  snapshotBlockHash: Hex;
  metadataUri: string;
  eligibleSupply: bigint;
  excludedSupply: bigint;
  holderCount: number;
  root: Hex | null;
  total: bigint;
  allocations: ReturnType<typeof buildRewardEpoch>["allocations"];
};

function normalized(address: Address) {
  return address.toLowerCase() as Address;
}

/**
 * Reconstructs ERC-20 balances using Transfer logs through a finalized, pinned block.
 * The source range starts at the profile-token deployment block; callers must use an RPC
 * provider that can serve that historical range. The returned block hash makes reorg checks explicit.
 */
export async function ingestRewardSnapshot(
  client: SnapshotClient,
  request: RewardSnapshotRequest,
): Promise<RewardSnapshot> {
  if (
    request.pool <= 0n ||
    request.launchBlock > request.snapshotBlock ||
    !request.metadataUri
  ) {
    throw new Error("invalid reward snapshot request");
  }
  const block = await client.getBlock({ blockNumber: request.snapshotBlock });
  if (!block.hash) throw new Error("snapshot block is unavailable");
  const balances = new Map<string, bigint>();
  const chunk = request.blockRange ?? 50_000n;
  for (
    let fromBlock = request.launchBlock;
    fromBlock <= request.snapshotBlock;
    fromBlock += chunk
  ) {
    const toBlock =
      fromBlock + chunk - 1n > request.snapshotBlock
        ? request.snapshotBlock
        : fromBlock + chunk - 1n;
    const logs = await client.getLogs({
      address: request.profileToken,
      event: transferEvent,
      fromBlock,
      toBlock,
    });
    for (const log of logs) {
      const { from, to, value } = log.args;
      if (!from || !to || value === undefined)
        throw new Error("malformed ERC-20 Transfer log");
      if (normalized(from) !== zeroAddress)
        balances.set(
          normalized(from),
          (balances.get(normalized(from)) ?? 0n) - value,
        );
      if (normalized(to) !== zeroAddress)
        balances.set(
          normalized(to),
          (balances.get(normalized(to)) ?? 0n) + value,
        );
    }
  }

  const exclusions = new Set([
    zeroAddress,
    normalized(request.profileToken),
    ...request.excludedAccounts.map(normalized),
  ]);
  let excludedSupply = 0n;
  const holders: HolderBalance[] = [];
  for (const [account, balance] of balances) {
    if (balance < 0n)
      throw new Error(`negative reconstructed balance for ${account}`);
    if (balance === 0n) continue;
    if (exclusions.has(account as Address)) excludedSupply += balance;
    else holders.push({ account: account as Address, balance });
  }
  const eligibleSupply = holders.reduce(
    (sum, holder) => sum + holder.balance,
    0n,
  );
  const epoch = buildRewardEpoch(request.pool, holders);
  return {
    profileToken: request.profileToken,
    snapshotBlock: request.snapshotBlock,
    snapshotBlockHash: block.hash,
    metadataUri: request.metadataUri,
    eligibleSupply,
    excludedSupply,
    holderCount: holders.length,
    root: epoch.root as Hex | null,
    total: epoch.total,
    allocations: epoch.allocations,
  };
}
