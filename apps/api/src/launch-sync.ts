import { createPublicClient, http, keccak256, parseAbi, parseEventLogs, toBytes, zeroAddress, type Address, type Hex, type PublicClient, type TransactionReceipt } from "viem";
import { eq, sql } from "drizzle-orm";
import { launchSyncState, launches, profiles, type createDatabase } from "@rovo/database";
import { robinhoodChain } from "@rovo/config";
import { normalizeHandle } from "./memory.js";
import type { PublicXProfileResolver } from "./types.js";

type Database = ReturnType<typeof createDatabase>["db"];

const registryAbi = parseAbi([
  "event LaunchRegistered(address indexed token, uint64 indexed xUserId, bytes32 indexed handleHash, address collector)",
  "event CreatorClaimed(address indexed token, uint64 indexed xUserId, address indexed creator)",
  "function getLaunch(address token) view returns ((address token,address curve,address pairToken,address feeCollector,address ponsFactory,address ponsFeeEscrow,address ponsMemeHook,bytes32 handleHash,bytes32 expectedEconomics,uint64 xUserId,address rover,address creator,uint64 launchedAt,uint16 creatorTaxBps,uint16 creatorToHoldersBps,uint32 launchConfigId,uint8 launchType,bool claimed,bool shareWithHolders) launch)",
]);
const ponsFactoryAbi = parseAbi([
  "function getLaunchedToken(address token) view returns ((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))",
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

export function receiptLaunchesPonsToken(
  receipt: TransactionReceipt,
  token: Address,
  factory: Address,
) {
  if (receipt.status !== "success") return false;
  const tokenAddress = token.toLowerCase();
  const factoryAddress = factory.toLowerCase();
  const touchesToken = receipt.logs.some((log) => log.address.toLowerCase() === tokenAddress);
  const touchesFactory = receipt.logs.some((log) => log.address.toLowerCase() === factoryAddress);
  return touchesToken && touchesFactory;
}

/** High bit keeps a stand-in id out of the X snowflake range. */
export function syntheticXUserId(token: Address) {
  return (BigInt(token) & ((1n << 63n) - 1n)) | (1n << 63n);
}

function readableHandle(candidate: string | null | undefined) {
  if (!candidate) return null;
  try {
    return normalizeHandle(candidate);
  } catch {
    return null;
  }
}

function isUniqueViolation(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function tokenImageUrl(logo: string) {
  const value = logo.trim();
  if (value.startsWith("https://")) return value;
  if (!value.startsWith("ipfs://")) return null;
  const path = value.slice("ipfs://".length).replace(/^ipfs\//, "");
  return path ? `https://gateway.pinata.cloud/ipfs/${path}` : null;
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
      imageUrl: tokenImageUrl(logo),
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

async function ponsHandle(
  client: LaunchSyncClient,
  token: Address,
  hint?: string,
) {
  const explicit = readableHandle(hint);
  if (hint && !explicit) throw new LaunchIndexError(409, "invalid X handle");
  if (explicit) return explicit;
  try {
    const symbol = await client.readContract({ address: token, abi: tokenAbi, functionName: "symbol" });
    const fromSymbol = readableHandle(symbol);
    if (fromSymbol) return fromSymbol;
  } catch {
    // Symbol is only a handle hint.
  }
  try {
    const socials = await client.readContract({ address: token, abi: tokenAbi, functionName: "socials" });
    const twitter = socials[0].match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]{1,15})/i)?.[1];
    const fromSocials = readableHandle(twitter);
    if (fromSocials) return fromSocials;
  } catch {
    // Socials are only a handle hint.
  }
  throw new LaunchIndexError(409, "X handle is required for this Pons token");
}

async function xUserIdForHandle(input: {
  db: Database;
  token: Address;
  handle: string;
  xResolver?: Pick<PublicXProfileResolver, "resolve">;
}) {
  const [existing] = await input.db.select().from(profiles).where(eq(profiles.handle, input.handle)).limit(1);
  if (existing) return existing.xUserId;
  if (input.xResolver) {
    try {
      const profile = await input.xResolver.resolve(input.handle);
      if (readableHandle(profile.handle) === input.handle && /^\d+$/.test(profile.xUserId)) {
        return BigInt(profile.xUserId);
      }
    } catch {
      // A Pons token can still be saved when X lookup is unavailable.
    }
  }
  return syntheticXUserId(input.token);
}

async function persistPonsLaunch(input: {
  db: Database;
  client: LaunchSyncClient;
  receipt: TransactionReceipt;
  token: Address;
  pons: { factory: Address; feeEscrow: Address; memeHook: Address };
  handleHint?: string;
  xResolver?: Pick<PublicXProfileResolver, "resolve">;
}) {
  const { db, client, receipt, token, pons } = input;
  if (receipt.blockNumber === null || !receiptLaunchesPonsToken(receipt, token, pons.factory)) {
    throw new LaunchIndexError(409, "transaction does not launch this Pons token");
  }
  let launched: Awaited<ReturnType<LaunchSyncClient["readContract"]>> & {
    exists: boolean;
    curve: Address;
    token: Address;
    deployer: Address;
    creatorFeeRecipient: Address;
    pairToken: Address;
    creatorTaxBps: number;
  };
  try {
    launched = await client.readContract({
      address: pons.factory,
      abi: ponsFactoryAbi,
      functionName: "getLaunchedToken",
      args: [token],
    });
  } catch {
    throw new LaunchIndexError(409, "token is not on Pons");
  }
  if (!launched.exists || launched.curve === zeroAddress || launched.token.toLowerCase() !== token.toLowerCase()) {
    throw new LaunchIndexError(409, "token is not on Pons");
  }
  const handle = await ponsHandle(client, token, input.handleHint);
  const xUserId = await xUserIdForHandle({ db, token, handle, ...(input.xResolver ? { xResolver: input.xResolver } : {}) });
  const metadata = await readTokenMetadata(client, token);
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const creator = launched.deployer === zeroAddress ? launched.creatorFeeRecipient : launched.deployer;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(profiles).values({
        xUserId,
        handle,
        displayName: metadata.displayName,
        imageUrl: metadata.imageUrl,
      }).onConflictDoNothing({ target: profiles.xUserId });
      const [profile] = await tx.select().from(profiles).where(eq(profiles.xUserId, xUserId)).limit(1);
      if (!profile || profile.handle !== handle) {
        throw new LaunchIndexError(409, "this X account already has a profile");
      }
      await tx.insert(launches).values({
        token: token.toLowerCase(),
        curve: launched.curve.toLowerCase(),
        pairToken: launched.pairToken.toLowerCase(),
        // Pons does not create a Rovo collector. The curve is unique per token.
        feeCollector: launched.curve.toLowerCase(),
        ponsFactory: pons.factory.toLowerCase(),
        ponsFeeEscrow: pons.feeEscrow.toLowerCase(),
        ponsMemeHook: pons.memeHook.toLowerCase(),
        xUserId,
        handle,
        type: "self",
        rover: null,
        creator: creator === zeroAddress ? null : creator.toLowerCase(),
        creatorTaxBps: Number(launched.creatorTaxBps),
        claimed: true,
        launchedAt: new Date(Number(block.timestamp) * 1000),
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash.toLowerCase() as Hex,
      }).onConflictDoUpdate({
        target: launches.token,
        set: {
          claimed: true,
          creator: creator === zeroAddress ? null : creator.toLowerCase(),
        },
      });
    });
  } catch (error) {
    if (error instanceof LaunchIndexError) throw error;
    if (isUniqueViolation(error)) throw new LaunchIndexError(409, "this handle already has a launch");
    throw error;
  }
}

export async function indexLaunchImmediately(input: {
  db: Database;
  client: LaunchSyncClient;
  registry: Address;
  token: Address;
  transactionHash: Hex;
  handle?: string;
  pons?: { factory: Address; feeEscrow: Address; memeHook: Address };
  xResolver?: Pick<PublicXProfileResolver, "resolve">;
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
  let registered: ReturnType<typeof launchRegistrationFromReceipt> | null = null;
  try {
    registered = launchRegistrationFromReceipt(receipt, input.token, input.registry);
  } catch (error) {
    if (!(error instanceof LaunchIndexError) || error.status !== 409 || !input.pons) throw error;
  }
  if (registered) {
    await persistRegisteredLaunch({
      db: input.db,
      client: input.client,
      registry: input.registry,
      token: registered.token,
      transactionHash: registered.transactionHash,
      blockNumber: registered.blockNumber,
      ...(input.handle ? { handleHint: input.handle } : {}),
    });
    return;
  }
  if (!input.pons) throw new LaunchIndexError(409, "transaction does not register this token");
  await persistPonsLaunch({
    db: input.db,
    client: input.client,
    receipt,
    token: input.token,
    pons: input.pons,
    ...(input.handle ? { handleHint: input.handle } : {}),
    ...(input.xResolver ? { xResolver: input.xResolver } : {}),
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
