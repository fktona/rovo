import { describe, expect, it } from "vitest";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { missingLookupAddresses, sharedAccountKeys } from "./lookup-table";

const program = new PublicKey("11111111111111111111111111111111");
const shared = new PublicKey("So11111111111111111111111111111111111111112");
const leftOnly = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const rightOnly = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

function instruction(accounts: PublicKey[]) {
  return new TransactionInstruction({
    programId: program,
    keys: accounts.map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    })),
    data: Buffer.alloc(0),
  });
}

describe("launch lookup tables", () => {
  it("keeps accounts that both instruction sets use", () => {
    const keys = sharedAccountKeys(
      [instruction([shared, leftOnly])],
      [instruction([shared, rightOnly])],
    ).map((key) => key.toBase58());

    expect(keys).toContain(shared.toBase58());
    expect(keys).toContain(program.toBase58());
    expect(keys).not.toContain(leftOnly.toBase58());
    expect(keys).not.toContain(rightOnly.toBase58());
  });

  it("reports addresses the table still needs", () => {
    const missing = missingLookupAddresses([shared], [shared, leftOnly]);
    expect(missing.map((key) => key.toBase58())).toEqual([leftOnly.toBase58()]);
  });
});
