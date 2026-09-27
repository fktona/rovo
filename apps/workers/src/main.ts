import { z } from "zod";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createDatabase } from "@rovo/database";
import { buildRewardEpoch } from "./epoch.js";
import { ingestRewardSnapshot } from "./snapshot.js";
import { persistPublishedEpoch, publishRewardEpoch } from "./publication.js";
import { createWorkers } from "./queues.js";

const redisUrl = z.url().parse(process.env.REDIS_URL);
const connection = { url: redisUrl };
const databaseUrl = z.url().parse(process.env.DATABASE_URL);
const { db, pool } = createDatabase(databaseUrl);

const workers = createWorkers(connection, {
  epochs: async (job) => {
    const legacyInput = z
      .object({
        pool: z.string().regex(/^\d+$/),
        balances: z.array(
          z.object({
            account: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            balance: z.string().regex(/^\d+$/),
          }),
        ),
      })
      .safeParse(job.data);
    if (legacyInput.success)
      return buildRewardEpoch(
        BigInt(legacyInput.data.pool),
        legacyInput.data.balances.map((item) => ({
          account: item.account as `0x${string}`,
          balance: BigInt(item.balance),
        })),
      );
    const input = z
      .object({
        profileToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        stockToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        epochId: z.string().regex(/^\d+$/),
        launchBlock: z.string().regex(/^\d+$/),
        snapshotBlock: z.string().regex(/^\d+$/),
        pool: z.string().regex(/^\d+$/),
        excludedAccounts: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
        metadataUri: z.string().min(1),
      })
      .parse(job.data);
    const rpcUrl = z.url().parse(process.env.ROBINHOOD_RPC_URL);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const snapshot = await ingestRewardSnapshot(publicClient, {
      profileToken: input.profileToken as `0x${string}`,
      launchBlock: BigInt(input.launchBlock),
      snapshotBlock: BigInt(input.snapshotBlock),
      pool: BigInt(input.pool),
      excludedAccounts: input.excludedAccounts as `0x${string}`[],
      metadataUri: input.metadataUri,
    });
    const publisherKey = z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .parse(process.env.EPOCH_PUBLISHER_PRIVATE_KEY);
    const holderRewards = z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .parse(process.env.ROVO_HOLDER_REWARDS_ADDRESS) as `0x${string}`;
    const walletClient = createWalletClient({
      account: privateKeyToAccount(publisherKey as `0x${string}`),
      transport: http(rpcUrl),
    });
    const transactionHash = await publishRewardEpoch({
      publicClient,
      walletClient,
      holderRewards,
      epochId: BigInt(input.epochId),
      snapshot,
    });
    await persistPublishedEpoch(db, {
      epochId: BigInt(input.epochId),
      stockToken: input.stockToken as `0x${string}`,
      snapshot,
    });
    return { ...snapshot, transactionHash };
  },
  buybacks: async (job) =>
    z
      .object({
        stockToken: z.string(),
        amount: z.string(),
        minRovoOut: z.string(),
      })
      .parse(job.data),
  monitoring: async (job) =>
    z
      .object({
        kind: z.enum(["unswept-fees", "stuck-buyback", "missed-epoch"]),
        subject: z.string(),
      })
      .parse(job.data),
});

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
