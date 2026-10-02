import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const launchType = pgEnum("launch_type", ["scout", "self", "meme"]);
export const revenueState = pgEnum("revenue_state", [
  "unswept",
  "swept_unclaimed",
  "distributed",
]);
export const attestationKind = pgEnum("attestation_kind", [
  "self_rove",
  "scout",
  "claim",
]);

export const profiles = pgTable(
  "profiles",
  {
    xUserId: bigint("x_user_id", { mode: "bigint" }).primaryKey(),
    handle: text("handle").notNull(),
    displayName: text("display_name"),
    imageUrl: text("image_url"),
    privyUserId: text("privy_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("profiles_handle_uidx").on(table.handle)],
);

export const launches = pgTable(
  "launches",
  {
    token: text("token").primaryKey(),
    curve: text("curve").notNull(),
    pairToken: text("pair_token").notNull(),
    feeCollector: text("fee_collector").notNull().unique(),
    ponsFactory: text("pons_factory").notNull(),
    ponsFeeEscrow: text("pons_fee_escrow").notNull(),
    ponsMemeHook: text("pons_meme_hook").notNull(),
    xUserId: bigint("x_user_id", { mode: "bigint" })
      .notNull()
      .references(() => profiles.xUserId),
    handle: text("handle").notNull(),
    type: launchType("type").notNull(),
    rover: text("rover"),
    creator: text("creator"),
    creatorTaxBps: integer("creator_tax_bps").notNull(),
    claimed: boolean("claimed").notNull(),
    launchedAt: timestamp("launched_at", { withTimezone: true }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    transactionHash: text("transaction_hash").notNull(),
  },
  (table) => [
    uniqueIndex("launches_x_user_uidx").on(table.xUserId),
    uniqueIndex("launches_handle_uidx").on(table.handle),
  ],
);

// Independent registry-event cursor for the API's launch projection. Ponder's
// on-chain tables cannot populate the richer application `launches` table.
export const launchSyncState = pgTable("launch_sync_state", {
  id: integer("id").primaryKey(),
  nextBlock: bigint("next_block", { mode: "bigint" }).notNull(),
});

export const revenueEvents = pgTable(
  "revenue_events",
  {
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    profileToken: text("profile_token").notNull(),
    asset: text("asset").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    state: revenueState("state").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    primaryKey({ columns: [table.txHash, table.logIndex] }),
    index("revenue_profile_idx").on(table.profileToken),
  ],
);

export const rewardEpochs = pgTable(
  "reward_epochs",
  {
    profileToken: text("profile_token").notNull(),
    epochId: bigint("epoch_id", { mode: "bigint" }).notNull(),
    stockToken: text("stock_token").notNull(),
    merkleRoot: text("merkle_root").notNull(),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull(),
    snapshotBlock: bigint("snapshot_block", { mode: "bigint" }).notNull(),
    snapshotBlockHash: text("snapshot_block_hash").notNull().default("0x"),
    metadataUri: text("metadata_uri").notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileToken, table.epochId] })],
);

export const rewardProofs = pgTable(
  "reward_proofs",
  {
    profileToken: text("profile_token").notNull(),
    epochId: bigint("epoch_id", { mode: "bigint" }).notNull(),
    account: text("account").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    proof: jsonb("proof").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileToken, table.epochId, table.account] }),
    index("reward_proofs_account_idx").on(table.account),
  ],
);

// Rotated on every X refresh. The row replaces .env after the first successful refresh.
export const xOauthTokens = pgTable("x_oauth_tokens", {
  id: integer("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rovoToken = pgTable("rovo_token", {
  id: integer("id").primaryKey(),
  address: text("address").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const indexerState = pgTable("indexer_state", {
  chainId: integer("chain_id").primaryKey(),
  finalizedBlock: bigint("finalized_block", { mode: "bigint" }).notNull(),
  finalizedHash: text("finalized_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verifiedIdentities = pgTable(
  "verified_identities",
  {
    privyUserId: text("privy_user_id").primaryKey(),
    xUserId: bigint("x_user_id", { mode: "bigint" }).notNull(),
    handle: text("handle").notNull(),
    wallet: text("wallet").notNull(),
    xVerifiedAt: timestamp("x_verified_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("verified_identities_x_user_uidx").on(table.xUserId)],
);

export const identityAttestations = pgTable(
  "identity_attestations",
  {
    id: text("id").primaryKey(),
    kind: attestationKind("kind").notNull(),
    nonce: text("nonce").notNull(),
    xUserId: bigint("x_user_id", { mode: "bigint" }).notNull(),
    handle: text("handle").notNull(),
    recipient: text("recipient"),
    profileToken: text("profile_token"),
    metadataHash: text("metadata_hash"),
    verifyingContract: text("verifying_contract").notNull(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    signature: text("signature").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("identity_attestations_nonce_uidx").on(table.nonce)],
);
