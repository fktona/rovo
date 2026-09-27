import { createPublicClient, http, keccak256, parseAbi, parseEventLogs, toBytes, zeroAddress, type Address, type Hex, type PublicClient, type TransactionReceipt } from "viem";
import { eq, sql } from "drizzle-orm";
import { launchSyncState, launches, profiles, type createDatabase } from "@rovo/database";
import { robinhoodChain } from "@rovo/config";
import { normalizeHandle } from "./memory.js";

type Database = ReturnType<typeof createDatabase>["db"];

const registryAbi = parseAbi([
  "event LaunchRegistered(address indexed token, uint64 indexed xUserId, bytes32 indexed handleHash, address collector)",
  "event CreatorClaimed(address indexed token, uint64 indexed xUserId, address indexed creator)",
  "function getLaunch(address token) view returns ((address token,address curve,address pairToken,address feeCollector,address ponsFactory,address ponsFeeEscrow,address ponsMemeHook,bytes32 handleHash,bytes32 expectedEconomics,uint64 xUserId,address rover,address creator,uint64 launchedAt,uint16 creatorTaxBps,uint16 creatorToHoldersBps,uint32 launchConfigId,uint8 launchType,bool claimed,bool shareWithHolders) launch)",
]);
const tokenAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "function getTokenInfo() view returns (address tokenDeployer, string tokenLogo, string tokenDescription, Socials tokenSocials)",
  "function socials() view returns (string twitter,string telegram,string discord,string website,string farcaster)",
]);

export type LaunchSyncClient = PublicClient;

export function createLaunchSyncClient(rpcUrl: string): LaunchSyncClient {
  return createPublicClient({ chain: robinhoodChain, transport: http(rpcUrl, { retryCount: 2 }) });
}

export class LaunchIndexError extends Error {
  constructor(
    readonly status: 404 | 409 | 503,
    message: string,
  ) {
    super(message);
    this.name = "LaunchIndexError";
  }
}

export function matchingHandle(candidate: string | null | undefined, handleHash: `0x${string}`) {
  if (!candidate) return null;
  try {
    const handle = normalizeHandle(candidate);
    return keccak256(toBytes(handle)).toLowerCase() === handleHash.toLowerCase() ? handle : null;
  } catch {
    return null;
  }
}

export function launchRegistrationFromReceipt(
  receipt: TransactionReceipt,
  token: Address,
  registry: Address,
) {
  if (receipt.status !== "success") {
    throw new LaunchIndexError(409, "transaction does not register this token");
  }
  const registered = parseEventLogs({
    abi: registryAbi,
    logs: receipt.logs,
    eventName: "LaunchRegistered",
    strict: false,
  }).find(
    (log) =>
      log.address.toLowerCase() === registry.toLowerCase() &&
      log.args.token?.toLowerCase() === token.toLowerCase(),
  );
  if (!registered?.args.token || registered.blockNumber === null || !registered.args.xUserId) {
    throw new LaunchIndexError(409, "transaction does not register this token");
  }
  return {
    token: registered.args.token,
    transactionHash: receipt.transactionHash,
    blockNumber: registered.blockNumber,
  };
}

async function readTokenMetadata(client: LaunchSyncClient, token: Address) {
  try {
    const [name, info] = await Promise.all([
      client.readContract({ address: token, abi: tokenAbi, functionName: "name" }),
      client.readContract({ address: token, abi: tokenAbi, functionName: "getTokenInfo" }),
    ]);
    const displayName = name.trim();
    const logo = info[1].trim();
    return {
      displayName: displayName || null,
      imageUrl: logo.startsWith("https://") ? logo : null,
    };
  } catch {
    return { displayName: null, imageUrl: null };
  }
}

async function recoverHandle(
  client: LaunchSyncClient,
  token: Address,
  handleHash: Hex,
  candidates: Array<string | null | undefined>,
) {
  for (const candidate of candidates) {
    const handle = matchingHandle(candidate, handleHash);
    if (handle) return handle;
  }
  const symbol = await client.readContract({ address: token, abi: tokenAbi, functionName: "symbol" });
  const fromSymbol = matchingHandle(symbol, handleHash);
  if (fromSymbol) return fromSymbol;
  const socials = await client.readContract({ address: token, abi: tokenAbi, functionName: "socials" });
  const twitter = socials[0].match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]{1,15})/i)?.[1];
  const fromSocials = matchingHandle(twitter, handleHash);
  if (fromSocials) return fromSocials;
  throw new LaunchIndexError(503, "launch could not be saved");
}

async function persistRegisteredLaunch(input: {
  db: Database;
  client: LaunchSyncClient;
  registry: Address;
  token: Address;
  transactionHash: Hex;
  blockNumber: bigint;
  handleHint?: string;
}) {
  const { db, client, registry, token, transactionHash, blockNumber } = input;
  const launch = await client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: "getLaunch",
    args: [token],
  });
  if (launch.token.toLowerCase() !== token.toLowerCase()) {
    throw new LaunchIndexError(409, "transaction does not register this token");
  }
  const [profile] = await db.select().from(profiles).where(eq(profiles.xUserId, launch.xUserId)).limit(1);
  const handle = await recoverHandle(client, token, launch.handleHash, [input.handleHint, profile?.handle]);
  const metadata = await readTokenMetadata(client, token);
  await db.transaction(async (tx) => {
    await tx.insert(profiles).values({
      xUserId: launch.xUserId,
      handle,
      displayName: metadata.displayName,
      imageUrl: metadata.imageUrl,
    }).onConflictDoUpdate({
      target: profiles.xUserId,
      set: {
        handle,
        updatedAt: new Date(),
        ...(metadata.displayName ? { displayName: metadata.displayName } : {}),
        ...(metadata.imageUrl ? { imageUrl: metadata.imageUrl } : {}),
      },
    });
    await tx.insert(launches).values({
      token: token.toLowerCase(),
      curve: launch.curve.toLowerCase(),
      pairToken: launch.pairToken.toLowerCase(),
      feeCollector: launch.feeCollector.toLowerCase(),
      ponsFactory: launch.ponsFactory.toLowerCase(),
      ponsFeeEscrow: launch.ponsFeeEscrow.toLowerCase(),
      ponsMemeHook: launch.ponsMemeHook.toLowerCase(),
      xUserId: launch.xUserId,
      handle,
      type: launch.launchType === 1 ? "self" : "scout",
      rover: launch.rover === zeroAddress ? null : launch.rover.toLowerCase(),
      creator: launch.creator === zeroAddress ? null : launch.creator.toLowerCase(),
      creatorTaxBps: launch.creatorTaxBps,
      claimed: launch.claimed,
      launchedAt: new Date(Number(launch.launchedAt) * 1000),
      blockNumber,
      transactionHash: transactionHash.toLowerCase() as Hex,
    }).onConflictDoUpdate({
      target: launches.token,
      set: { claimed: launch.claimed, creator: launch.creator === zeroAddress ? null : launch.creator.toLowerCase() },
    });
  });
}

const receiptDelayMs = 750;

export async function indexLaunchImmediately(input: {
  db: Database;
  client: LaunchSyncClient;
  registry: Address;
  token: Address;
  transactionHash: Hex;
  handle?: string;
}) {
  if ((await input.client.getChainId()) !== 4663) {
    throw new LaunchIndexError(503, "launch could not be saved");
  }
  let receipt: TransactionReceipt | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      receipt = await input.client.getTransactionReceipt({ hash: input.transactionHash });
      break;
    } catch {
      if (attempt === 4) throw new LaunchIndexError(404, "launch receipt not found");
      await new Promise((resolve) => setTimeout(resolve, receiptDelayMs));
    }
  }
  if (!receipt) throw new LaunchIndexError(404, "launch receipt not found");
  const registered = launchRegistrationFromReceipt(receipt, input.token, input.registry);
  await persistRegisteredLaunch({
    db: input.db,
    client: input.client,
    registry: input.registry,
    token: registered.token,
    transactionHash: registered.transactionHash,
    blockNumber: registered.blockNumber,
    ...(input.handle ? { handleHint: input.handle } : {}),
  });
}

export async function syncLaunchesOnce(input: {
  db: Database;
  client: LaunchSyncClient;
  registry: Address;
  startBlock: bigint;
  confirmations?: bigint;
  batchSize?: bigint;
  maxBatches?: number;
}) {
  const { db, client, registry, startBlock } = input;
  if ((await client.getChainId()) !== 4663) throw new Error("Launch sync RPC is not Robinhood Chain");
  const confirmations = input.confirmations ?? 12n;
  const batchSize = input.batchSize ?? 10_000n;
  if (batchSize < 1n) throw new Error("Launch sync batch size must be positive");
  const head = await client.getBlockNumber();
  if (head < confirmations) return { nextBlock: startBlock, head, indexed: 0 };
  const safeHead = head - confirmations;
  const [state] = await db.select().from(launchSyncState).where(eq(launchSyncState.id, 1)).limit(1);
  let nextBlock = state?.nextBlock ?? startBlock;
  let indexed = 0;
  let batches = 0;

  while (nextBlock <= safeHead && batches < (input.maxBatches ?? 50)) {
    const toBlock = nextBlock + batchSize - 1n < safeHead ? nextBlock + batchSize - 1n : safeHead;
    const logs = await client.getLogs({
      address: registry,
      events: [registryAbi[0], registryAbi[1]],
      fromBlock: nextBlock,
      toBlock,
    });
    for (const log of logs) {
      if (log.eventName === "CreatorClaimed") {
        if (!log.args.token || !log.args.creator) throw new Error("Incomplete CreatorClaimed log");
        await db.update(launches).set({ claimed: true, creator: log.args.creator.toLowerCase() })
          .where(eq(launches.token, log.args.token.toLowerCase()));
        continue;
      }
      const token = log.args.token;
      const txHash = log.transactionHash;
      const blockNumber = log.blockNumber;
      if (!token || !log.args.xUserId || !txHash || blockNumber === null) {
        throw new Error("Incomplete LaunchRegistered log");
      }
      await persistRegisteredLaunch({
        db,
        client,
        registry,
        token,
        transactionHash: txHash,
        blockNumber,
      });
      indexed++;
    }
    nextBlock = toBlock + 1n;
    await db.insert(launchSyncState).values({ id: 1, nextBlock }).onConflictDoUpdate({
      target: launchSyncState.id,
      set: { nextBlock: sql`greatest(${launchSyncState.nextBlock}, ${nextBlock})` },
    });
    batches++;
  }
  return { nextBlock, head, indexed };
}

export async function runLaunchSync(input: Parameters<typeof syncLaunchesOnce>[0], signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const result = await syncLaunchesOnce(input);
      if (result.indexed > 0) console.info(`Launch sync indexed ${result.indexed} launch(es); next block ${result.nextBlock}`);
    } catch (error) {
      console.error("Launch sync failed; retrying without advancing cursor", error);
    }
    await new Promise<void>((resolve) => {
      const onAbort = () => { clearTimeout(timeout); resolve(); };
      const timeout = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 15_000);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
