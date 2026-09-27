import { index, onchainTable, primaryKey } from "ponder";

export const launch = onchainTable(
  "launch",
  (t) => ({
    token: t.hex().primaryKey(),
    xUserId: t.bigint().notNull(),
    handleHash: t.hex().notNull(),
    collector: t.hex().notNull(),
    creator: t.hex(),
    claimed: t.boolean().notNull().default(false),
    shareWithHolders: t.boolean().notNull().default(false),
    creatorToHoldersBps: t.integer().notNull().default(0),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    xUserIdIdx: index().on(table.xUserId),
    handleHashIdx: index().on(table.handleHash),
    collectorIdx: index().on(table.collector),
  }),
);

export const collector = onchainTable("collector", (t) => ({
  address: t.hex().primaryKey(),
  launchKey: t.hex().notNull(),
  quoteToken: t.hex().notNull(),
  profileToken: t.hex(),
  createdAtBlock: t.bigint().notNull(),
}));

export const revenue = onchainTable(
  "revenue",
  (t) => ({
    txHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    profileToken: t.hex().notNull(),
    asset: t.hex().notNull(),
    amount: t.bigint().notNull(),
    platform: t.bigint(),
    creatorOrVault: t.bigint(),
    rover: t.bigint(),
    holders: t.bigint(),
    treasury: t.hex(),
    state: t.text().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.txHash, table.logIndex] }),
    profileIdx: index().on(table.profileToken),
  }),
);

export const claim = onchainTable("claim", (t) => ({
  profileToken: t.hex().primaryKey(),
  recipient: t.hex().notNull(),
  effectiveAt: t.bigint(),
  finalized: t.boolean().notNull().default(false),
  amount: t.bigint(),
}));

export const rewardEpoch = onchainTable(
  "reward_epoch",
  (t) => ({
    profileToken: t.hex().notNull(),
    epochId: t.bigint().notNull(),
    root: t.hex().notNull(),
    total: t.bigint().notNull(),
    claimed: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.profileToken, table.epochId] }),
  }),
);
