import {
  AddressLookupTableProgram,
  type Connection,
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";

const CACHE_PREFIX = "rovo.pump-lookup-table.";
const EXTEND_CHUNK = 27;

export function sharedAccountKeys(
  left: readonly TransactionInstruction[],
  right: readonly TransactionInstruction[],
) {
  const rightKeys = new Set(
    accountKeys(right).map((key) => key.toBase58()),
  );
  return accountKeys(left).filter((key) => rightKeys.has(key.toBase58()));
}

export function missingLookupAddresses(
  present: readonly PublicKey[],
  required: readonly PublicKey[],
) {
  const have = new Set(present.map((key) => key.toBase58()));
  return required.filter((key) => !have.has(key.toBase58()));
}

export async function ensureLaunchLookupTable({
  connection,
  user,
  addresses,
  send,
  onStatus,
}: {
  connection: Connection;
  user: PublicKey;
  addresses: readonly PublicKey[];
  send: (instructions: TransactionInstruction[]) => Promise<void>;
  onStatus?: (message: string) => void;
}) {
  const required = uniqueKeys(addresses);
  const cached = readCachedTable(user);
  const loaded = cached
    ? (await connection.getAddressLookupTable(cached)).value
    : null;
  const canExtend = loaded?.state.authority?.equals(user) ?? false;
  const reusable =
    loaded &&
    loaded.isActive() &&
    (canExtend ||
      missingLookupAddresses(loaded.state.addresses, required).length === 0)
      ? loaded
      : null;
  const missing = reusable
    ? missingLookupAddresses(reusable.state.addresses, required)
    : required;

  let tableAddress = reusable?.key;
  if (!tableAddress || missing.length > 0) {
    onStatus?.("Approve the one-time wallet setup.");
    if (!reusable || !canExtend) {
      const slot = await connection.getSlot("confirmed");
      const [create, created] = AddressLookupTableProgram.createLookupTable({
        authority: user,
        payer: user,
        recentSlot: slot,
      });
      const [first, ...rest] = chunk(missing, EXTEND_CHUNK);
      await send([
        create,
        ...(first
          ? [
              AddressLookupTableProgram.extendLookupTable({
                lookupTable: created,
                authority: user,
                payer: user,
                addresses: first,
              }),
            ]
          : []),
      ]);
      for (const addresses of rest) {
        await send([
          AddressLookupTableProgram.extendLookupTable({
            lookupTable: created,
            authority: user,
            payer: user,
            addresses,
          }),
        ]);
      }
      tableAddress = created;
    } else {
      for (const addresses of chunk(missing, EXTEND_CHUNK)) {
        await send([
          AddressLookupTableProgram.extendLookupTable({
            lookupTable: reusable.key,
            authority: user,
            payer: user,
            addresses,
          }),
        ]);
      }
      tableAddress = reusable.key;
    }
    rememberTable(user, tableAddress);
  }

  if (!tableAddress) {
    throw new Error("The launch lookup table is not ready yet. Try again.");
  }
  return waitUntilActive(connection, tableAddress);
}

function chunk<T>(values: readonly T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function accountKeys(instructions: readonly TransactionInstruction[]) {
  const keys = new Map<string, PublicKey>();
  for (const instruction of instructions) {
    keys.set(instruction.programId.toBase58(), instruction.programId);
    for (const meta of instruction.keys) {
      keys.set(meta.pubkey.toBase58(), meta.pubkey);
    }
  }
  return [...keys.values()];
}

function uniqueKeys(keys: readonly PublicKey[]) {
  return [...new Map(keys.map((key) => [key.toBase58(), key])).values()];
}

function readCachedTable(user: PublicKey) {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(CACHE_PREFIX + user.toBase58());
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function rememberTable(user: PublicKey, table: PublicKey) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CACHE_PREFIX + user.toBase58(), table.toBase58());
}

async function waitUntilActive(connection: Connection, table: PublicKey) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const [slot, loaded] = await Promise.all([
      connection.getSlot("confirmed"),
      connection.getAddressLookupTable(table),
    ]);
    const account = loaded.value;
    if (
      account &&
      account.isActive() &&
      slot > account.state.lastExtendedSlot
    ) {
      return account;
    }
    await delay(500);
  }
  throw new Error("The launch lookup table is not ready yet. Try again.");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
