import { describe, expect, it, vi } from "vitest";
import {
  decodeFunctionData,
  encodeFunctionData,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { RovoApiClient, RovoApiError, type IssuedAttestation } from "./api";
import { normalizeHandle, asUint, asBytes32 } from "./validation";
import {
  hashTokenMetadata,
  selfRoveAttestationArgs,
  claimAttestationArgs,
  tradeValue,
} from "./contracts/helpers";
import { validateRewardClaim } from "./contracts/actions";
import { registryAbi, wrapperAbi, zapRouterAbi } from "./contracts/abis";
import { collectorAbi, splitterAbi } from "./contracts/abis";
import { createRovoActions } from "./contracts/actions";
import type { RovoPublicClient } from "./contracts/reads";
import type { BaseConnectedEthereumWallet } from "@privy-io/react-auth";
import { robinhoodChainWithRpc, type RovoAddresses } from "./chain";
import { getPairChoice, pairChoices } from "./pairs";
import { formatBps, parseTokenAmount } from "./format";
import type { TokenMetadata } from "./contracts/types";

const wrapper = "0x0000000000000000000000000000000000001111" as Address;
const account = "0x0000000000000000000000000000000000002222" as Address;
const token = "0x0000000000000000000000000000000000003333" as Address;
const bytes32 = `0x${"12".repeat(32)}` as Hex;
const metadata: TokenMetadata = {
  name: "Rovo Scout",
  symbol: "SCOUT",
  logo: "https://example.com/logo.png",
  description: "Profile token",
  socials: {
    twitter: "x",
    telegram: "",
    discord: "",
    website: "",
    farcaster: "",
  },
  salt: bytes32,
};
const future = String(Math.floor(Date.now() / 1000) + 300);
function selfAttestation(): IssuedAttestation {
  return {
    id: "test",
    kind: "self_rove",
    primaryType: "SelfRoveAttestation",
    types: {},
    domain: {
      name: "Rovo Identity",
      version: "1",
      chainId: 4663,
      verifyingContract: wrapper,
    },
    message: {
      xUserId: "123",
      handle: "rovo",
      metadataHash: hashTokenMetadata(metadata),
      recipient: account,
      nonce: "1",
      deadline: future,
    },
    signature: "0x1234",
  };
}

describe("web integration validation", () => {
  it("uses the configured Robinhood RPC for the wallet chain", () => {
    const endpoint = "https://robinhood.example.test/v2/app";
    const chain = robinhoodChainWithRpc(endpoint);
    expect(chain.id).toBe(4663);
    expect(chain.rpcUrls.default.http[0]).toBe(endpoint);
  });
  it("normalizes X handles and rejects malformed or unsafe values", () => {
    expect(normalizeHandle(" @Rovo_User ")).toBe("rovo_user");
    expect(() => normalizeHandle("@not/a/handle")).toThrow();
    expect(() => asUint(Number.MAX_SAFE_INTEGER + 1, 64, "ID")).toThrow();
    expect(() => asBytes32("0x12")).toThrow();
  });

  it("exposes the curated pair catalogue and handles token units without floating point", () => {
    expect(pairChoices.length).toBe(65);
    expect(getPairChoice(zeroAddress)?.symbol).toBe("ETH");
    expect(
      pairChoices.every((choice) =>
        choice.iconUrl.startsWith("https://www.ponsfamily.com/"),
      ),
    ).toBe(true);
    expect(parseTokenAmount("1.000001", 6)).toBe(1_000_001n);
    expect(() => parseTokenAmount("1.0000001", 6)).toThrow();
    expect(formatBps(500)).toBe("5.00%");
  });

  it("uses real callable selectors for launch, registry, and Zap functions", () => {
    const checked = selfRoveAttestationArgs(
      selfAttestation(),
      wrapper,
      metadata,
      account,
    );
    const call = encodeFunctionData({
      abi: wrapperAbi,
      functionName: "launchSelfRove",
      args: [
        metadata,
        1,
        zeroAddress,
        100,
        {
          xUserId: checked.xUserId,
          handle: checked.handle,
          metadataHash: checked.metadataHash,
          recipient: checked.recipient,
          nonce: checked.nonce,
          deadline: checked.deadline,
        },
        checked.signature,
      ],
    });
    expect(call).toMatch(/^0x[0-9a-f]+$/);
    expect(call.length).toBeGreaterThan(10);
    expect(
      encodeFunctionData({
        abi: registryAbi,
        functionName: "setShareWithHolders",
        args: [token, true, 500],
      }),
    ).toMatch(/^0x[0-9a-f]+$/);
    expect(
      encodeFunctionData({
        abi: zapRouterAbi,
        functionName: "completeGraduation",
        args: [token],
      }),
    ).toMatch(/^0x[0-9a-f]+$/);
  });

  it("rejects attestations for another wallet, metadata, contract, or an expired deadline", () => {
    const valid = selfAttestation();
    expect(
      selfRoveAttestationArgs(valid, wrapper, metadata, account).xUserId,
    ).toBe(123n);
    expect(() =>
      selfRoveAttestationArgs(valid, wrapper, metadata, token),
    ).toThrow();
    expect(() =>
      selfRoveAttestationArgs(valid, token, metadata, account),
    ).toThrow();
    expect(() =>
      selfRoveAttestationArgs(
        valid,
        wrapper,
        { ...metadata, name: "changed" },
        account,
      ),
    ).toThrow();
    expect(() =>
      selfRoveAttestationArgs(
        { ...valid, message: { ...valid.message, deadline: "1" } },
        wrapper,
        metadata,
        account,
      ),
    ).toThrow();
    expect(() =>
      claimAttestationArgs(valid, wrapper, token, account),
    ).toThrow();
  });

  it("uses ETH value only for native input and checks positive trade/reward amounts", () => {
    const base = {
      profileToken: token,
      inputToken: zeroAddress,
      amountIn: 100n,
      minPairOut: 1n,
      minProfileOut: 1n,
      deadline: BigInt(future),
    };
    expect(tradeValue(base)).toBe(100n);
    expect(tradeValue({ ...base, inputToken: token })).toBe(0n);
    expect(() => tradeValue({ ...base, minProfileOut: 0n })).toThrow();
    const reward = {
      profileToken: token,
      epochId: "2",
      stockToken: token,
      amount: "100",
      proof: [bytes32],
      merkleRoot: bytes32,
      snapshotBlock: "1",
      metadataUri: "",
    };
    expect(validateRewardClaim(reward, token)).toEqual({
      epochId: 2n,
      amount: 100n,
      proof: [bytes32],
    });
    expect(() =>
      validateRewardClaim({ ...reward, amount: "0" }, token),
    ).toThrow();
    expect(() =>
      validateRewardClaim({ ...reward, proof: ["0x12"] }, token),
    ).toThrow();
  });
});

describe("Rovo API client", () => {
  it("sends public paths and authenticated attestation requests without leaking tokens into URLs", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url || !init) throw new Error("Missing request details");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const api = new RovoApiClient(
      "https://api.example/",
      fetcher as typeof fetch,
    );
    await api.profile("@Rovo_User");
    await api.selfRoveAttestation("private-access-token", account, bytes32);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api.example/v1/profiles/rovo_user",
    );
    const [url, options] = fetcher.mock.calls[1]!;
    expect(url).toBe("https://api.example/v1/attestations/self-rove");
    expect(url).not.toContain("private-access-token");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer private-access-token",
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      wallet: account,
      metadataHash: bytes32,
    });
  });

  it("surfaces API status and error without accepting a failed response", async () => {
    const api = new RovoApiClient(
      "https://api.example",
      async () =>
        new Response(JSON.stringify({ error: "launch not found" }), {
          status: 404,
        }),
    );
    await expect(api.launch(token)).rejects.toEqual(
      new RovoApiError(404, "launch not found"),
    );
  });
});

describe("admin fee release destinations", () => {
  const addresses: RovoAddresses = {
    registry: "0x0000000000000000000000000000000000000001",
    wrapper,
    zapRouter: "0x0000000000000000000000000000000000000002",
    splitter: "0x0000000000000000000000000000000000000003",
    nottingham: "0x0000000000000000000000000000000000000004",
    holderRewards: "0x0000000000000000000000000000000000000005",
  };
  const collector = "0x0000000000000000000000000000000000000006" as Address;
  const txHash = `0x${"ab".repeat(32)}` as Hex;

  function fixture(isAdmin: boolean) {
    const rpc = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_chainId") return "0x1237";
      if (method === "wallet_addEthereumChain") return null;
      if (method === "eth_sendTransaction") return txHash;
      throw new Error(`Unexpected wallet RPC: ${method}`);
    });
    const wallet = {
      address: account,
      switchChain: vi.fn(async () => {}),
      getEthereumProvider: vi.fn(async () => ({ request: rpc })),
    } as unknown as BaseConnectedEthereumWallet;
    const client = {
      readContract: vi.fn(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === "hasRole") return isAdmin;
          if (functionName === "getLaunch") return { feeCollector: collector };
          if (functionName === "profileToken") return token;
          throw new Error(`Unexpected read: ${functionName}`);
        },
      ),
      waitForTransactionReceipt: vi.fn(async () => ({
        status: "success",
        transactionHash: txHash,
      })),
    } as unknown as RovoPublicClient;
    const actions = createRovoActions({
      wallet,
      client,
      addresses,
      api: new RovoApiClient("https://api.example"),
      getAccessToken: async () => null,
    });
    return { actions, rpc };
  }

  it("routes ordinary harvest to splitter and diversion to that launch's collector", async () => {
    const { actions, rpc } = fixture(true);
    await actions.harvest(token);
    await actions.collectToTreasury(token);
    const sent = rpc.mock.calls.filter(
      ([request]) => request.method === "eth_sendTransaction",
    );
    expect(sent).toHaveLength(2);
    const normal = (
      sent[0]![0] as unknown as { params: [{ to: Address; data: Hex }] }
    ).params[0];
    const treasury = (
      sent[1]![0] as unknown as { params: [{ to: Address; data: Hex }] }
    ).params[0];
    expect(normal.to.toLowerCase()).toBe(addresses.splitter.toLowerCase());
    expect(
      decodeFunctionData({ abi: splitterAbi, data: normal.data }).functionName,
    ).toBe("harvest");
    expect(treasury.to.toLowerCase()).toBe(collector.toLowerCase());
    expect(
      decodeFunctionData({ abi: collectorAbi, data: treasury.data })
        .functionName,
    ).toBe("collectToTreasury");
  });

  it("rejects non-admin fee release before wallet transaction RPC", async () => {
    const { actions, rpc } = fixture(false);
    await expect(actions.harvest(token)).rejects.toThrow(
      "not a Rovo fee admin",
    );
    await expect(actions.collectToTreasury(token)).rejects.toThrow(
      "not a Rovo fee admin",
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});
