import { describe, expect, it } from "vitest";
import { formatWalletMessage } from "./wallet-message";

const metamaskRejection = `User rejected the request.

Request Arguments:
  from: 0x9C54D390fA59B921b4d4f0e55b19758DA81bDD22
  to: 0x438B14E75016346cF4e940cB8a7908c4332e970a
  value: 0.0001 ETH
  data: 0x59a87bc100000000000000000000000000000000000000000000000000000000

Details: MetaMask Tx Signature: User denied transaction signature.
Version: viem@2.56.9`;

describe("formatWalletMessage", () => {
  it("turns a MetaMask rejection dump into a short cancellation", () => {
    const error = new Error(metamaskRejection);
    error.name = "UserRejectedRequestError";
    expect(formatWalletMessage(error)).toBe("You cancelled this in your wallet.");
  });

  it("reads a rejection nested under another error", () => {
    const inner = new Error("User rejected the request.");
    inner.name = "UserRejectedRequestError";
    const outer = new Error("Transaction failed.", { cause: inner });
    expect(formatWalletMessage(outer)).toBe("You cancelled this in your wallet.");
  });

  it("explains an empty wallet", () => {
    expect(
      formatWalletMessage(new Error("insufficient funds for gas * price + value")),
    ).toBe("Your wallet doesn't have enough to cover this and the network fee.");
  });

  it("keeps a message the app already wrote", () => {
    expect(
      formatWalletMessage(new Error("This opening buy is too small to receive profile tokens.")),
    ).toBe("This opening buy is too small to receive profile tokens.");
  });

  it("keeps a contract reason and drops the viem wrapper", () => {
    const error = new Error(
      'The contract function "buy" reverted.\n\nDetails: execution reverted: Selling is closed\nVersion: viem@2.56.9',
    );
    error.name = "ContractFunctionRevertedError";
    expect(formatWalletMessage(error)).toBe("Selling is closed.");
  });

  it("explains a Robinhood RPC outage without the raw endpoint error", () => {
    expect(
      formatWalletMessage(
        new Error("RPC endpoint returned too many errors: eth_getBlockByNumber"),
        "The launch did not finish.",
      ),
    ).toBe(
      "Robinhood Chain is temporarily unavailable. Check your wallet before retrying. The transaction may not have been sent.",
    );
  });

  it("uses the caller fallback when the error has no readable text", () => {
    expect(formatWalletMessage(new Error(`0x${"ab".repeat(40)}`), "Withdrawal failed.")).toBe(
      "Withdrawal failed.",
    );
    expect(formatWalletMessage(null, "Claim failed.")).toBe("Claim failed.");
  });
});
