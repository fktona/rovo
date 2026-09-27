import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, keccak256, toBytes, type Address, type TransactionReceipt } from "viem";
import { launchRegistrationFromReceipt, matchingHandle } from "./launch-sync.js";

describe("launch handle recovery", () => {
  const handleHash = keccak256(toBytes("bluupdotfun"));

  it("accepts only the on-chain handle, normalizing case and @", () => {
    expect(matchingHandle("@BluupDotFun", handleHash)).toBe("bluupdotfun");
    expect(matchingHandle("someone_else", handleHash)).toBeNull();
  });

  it("rejects missing or invalid X handles", () => {
    expect(matchingHandle(null, handleHash)).toBeNull();
    expect(matchingHandle("not a handle", handleHash)).toBeNull();
  });
});

describe("immediate launch receipt", () => {
  const registry = "0x00000000000000000000000000000000000000aa" as const;
  const token = "0x00000000000000000000000000000000000000bb" as const;
  const collector = "0x00000000000000000000000000000000000000cc" as const;
  const transactionHash = `0x${"ab".repeat(32)}` as const;
  const event = {
    type: "event",
    name: "LaunchRegistered",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "xUserId", type: "uint64", indexed: true },
      { name: "handleHash", type: "bytes32", indexed: true },
      { name: "collector", type: "address", indexed: false },
    ],
  } as const;
  const encoded = {
    topics: encodeEventTopics({
      abi: [event],
      eventName: "LaunchRegistered",
      args: {
        token,
        xUserId: 7n,
        handleHash: keccak256(toBytes("bluupdotfun")),
      },
    }),
    data: encodeAbiParameters([{ type: "address" }], [collector]),
  };

  function receipt(status: "success" | "reverted", address: Address = registry): TransactionReceipt {
    return {
      status,
      transactionHash,
      blockNumber: 42n,
      logs: [
        {
          address,
          data: encoded.data,
          topics: encoded.topics,
          blockNumber: 42n,
          transactionHash,
          logIndex: 1,
          transactionIndex: 0,
          blockHash: `0x${"11".repeat(32)}`,
          removed: false,
        },
      ],
    } as unknown as TransactionReceipt;
  }

  it("reads the registered token from a successful receipt", () => {
    expect(launchRegistrationFromReceipt(receipt("success"), token, registry)).toMatchObject({
      token,
      transactionHash,
      blockNumber: 42n,
    });
  });

  it("rejects a receipt that did not register this token", () => {
    expect(() => launchRegistrationFromReceipt(receipt("reverted"), token, registry)).toThrow(
      "transaction does not register this token",
    );
    expect(() =>
      launchRegistrationFromReceipt(
        receipt("success", "0x00000000000000000000000000000000000000dd"),
        token,
        registry,
      ),
    ).toThrow("transaction does not register this token");
  });
});
