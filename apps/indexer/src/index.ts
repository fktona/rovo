import { ponder } from "ponder:registry";
import { claim, collector, launch, revenue, rewardEpoch } from "ponder:schema";

ponder.on("CollectorFactory:CollectorCreated", async ({ event, context }) => {
  await context.db.insert(collector).values({
    address: event.args.collector,
    launchKey: event.args.launchKey,
    quoteToken: event.args.quoteToken,
    createdAtBlock: event.block.number,
  });
});

ponder.on(
  "LaunchFeeCollector:ProfileTokenBound",
  async ({ event, context }) => {
    await context.db
      .update(collector, { address: event.log.address })
      .set({ profileToken: event.args.profileToken });
  },
);

ponder.on("RovoRegistry:LaunchRegistered", async ({ event, context }) => {
  await context.db.insert(launch).values({
    token: event.args.token,
    xUserId: event.args.xUserId,
    handleHash: event.args.handleHash,
    collector: event.args.collector,
    claimed: false,
    shareWithHolders: false,
    creatorToHoldersBps: 0,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });
});

ponder.on("RovoRegistry:CreatorClaimed", async ({ event, context }) => {
  await context.db
    .update(launch, { token: event.args.token })
    .set({ claimed: true, creator: event.args.creator });
});

ponder.on(
  "RovoRegistry:ShareWithHoldersUpdated",
  async ({ event, context }) => {
    await context.db.update(launch, { token: event.args.token }).set({
      shareWithHolders: event.args.enabled,
      creatorToHoldersBps: event.args.bps,
    });
  },
);

ponder.on("LaunchFeeCollector:RevenueCollected", async ({ event, context }) => {
  await context.db.insert(revenue).values({
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    profileToken: event.args.profileToken,
    asset: event.args.asset,
    amount: event.args.amount,
    state: "claimed",
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });
});

ponder.on(
  "LaunchFeeCollector:RevenueRoutedToTreasury",
  async ({ event, context }) => {
    await context.db.insert(revenue).values({
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      profileToken: event.args.profileToken,
      asset: event.args.asset,
      amount: event.args.amount,
      treasury: event.args.treasury,
      state: "treasury",
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    });
  },
);

ponder.on("RovoFeeSplitter:FeesDispersed", async ({ event, context }) => {
  await context.db.insert(revenue).values({
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    profileToken: event.args.profileToken,
    asset: event.args.asset,
    amount: event.args.amount,
    platform: event.args.platform,
    creatorOrVault: event.args.creatorOrVault,
    rover: event.args.rover,
    holders: event.args.holders,
    state: "distributed",
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });
});

ponder.on("NottinghamVault:ClaimInitiated", async ({ event, context }) => {
  await context.db
    .insert(claim)
    .values({
      profileToken: event.args.profileToken,
      recipient: event.args.recipient,
      effectiveAt: event.args.effectiveAt,
      finalized: false,
    })
    .onConflictDoUpdate({
      recipient: event.args.recipient,
      effectiveAt: event.args.effectiveAt,
      finalized: false,
    });
});

ponder.on("NottinghamVault:ClaimFinalized", async ({ event, context }) => {
  await context.db
    .update(claim, { profileToken: event.args.profileToken })
    .set({ finalized: true, amount: event.args.amount });
});

ponder.on("HolderRewards:EpochPublished", async ({ event, context }) => {
  await context.db.insert(rewardEpoch).values({
    profileToken: event.args.profileToken,
    epochId: event.args.epochId,
    root: event.args.root,
    total: event.args.total,
    claimed: 0n,
  });
});

ponder.on("HolderRewards:RewardClaimed", async ({ event, context }) => {
  await context.db
    .update(rewardEpoch, {
      profileToken: event.args.profileToken,
      epochId: event.args.epochId,
    })
    .set((row) => ({ claimed: row.claimed + event.args.amount }));
});
