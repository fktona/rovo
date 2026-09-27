import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

export type HolderBalance = { account: `0x${string}`; balance: bigint };
export type RewardAllocation = {
  account: `0x${string}`;
  amount: bigint;
  proof: string[];
};

export function buildRewardEpoch(pool: bigint, balances: HolderBalance[]) {
  if (pool <= 0n) throw new Error("epoch pool must be positive");
  const eligible = balances
    .filter(({ balance }) => balance > 0n)
    .sort((a, b) =>
      a.account.toLowerCase().localeCompare(b.account.toLowerCase()),
    );
  const eligibleSupply = eligible.reduce(
    (sum, holder) => sum + holder.balance,
    0n,
  );
  if (eligibleSupply === 0n)
    return { root: null, total: 0n, allocations: [] as RewardAllocation[] };

  let allocated = 0n;
  const values = eligible.map((holder, index) => {
    const amount =
      index === eligible.length - 1
        ? pool - allocated
        : (pool * holder.balance) / eligibleSupply;
    allocated += amount;
    return [holder.account, amount.toString()] as [string, string];
  });
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
  const allocations: RewardAllocation[] = [];
  for (const [index, [account, amount]] of tree.entries()) {
    allocations.push({
      account: account as `0x${string}`,
      amount: BigInt(amount),
      proof: tree.getProof(index),
    });
  }
  allocations.sort((a, b) =>
    a.account.toLowerCase().localeCompare(b.account.toLowerCase()),
  );
  return { root: tree.root, total: allocated, allocations };
}
