import { describe, expect, it } from "vitest";
import { buildServer } from "./app.js";
import { MemoryRovoRepository } from "./memory.js";
import type { IdentityVerifier } from "./types.js";
import type { IdentityAttestationService } from "./attestations.js";

const token = "0x0000000000000000000000000000000000000011" as const;
const wallet = "0x0000000000000000000000000000000000000022" as const;

function fixture() {
  const repository = new MemoryRovoRepository();
  repository.launches.set(token, {
    token,
    handle: "alice",
    xUserId: "42",
    pairToken: "0x0000000000000000000000000000000000000033",
    feeCollector: "0x0000000000000000000000000000000000000044",
    launchType: "self",
    rover: null,
    scout: null,
    claimed: true,
    creatorTaxBps: 300,
    displayName: "Alice",
    imageUrl: null,
    launchedAt: "2026-09-27T06:54:11.000Z",
  });
  repository.profiles.set("alice", {
    xUserId: "42",
    handle: "alice",
    displayName: "Alice",
    imageUrl: null,
    token,
  });
  repository.rewardClaims.set(
    `${token.toLowerCase()}:${wallet.toLowerCase()}`,
    [
      {
        profileToken: token,
        epochId: "7",
        stockToken: "0x0000000000000000000000000000000000000033",
        amount: "500",
        proof: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ],
        merkleRoot:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        snapshotBlock: "100",
        metadataUri: "ipfs://epoch",
      },
    ],
  );
  const identityVerifier: IdentityVerifier = {
    async verify(accessToken, selectedWallet) {
      if (accessToken !== "valid" || selectedWallet !== wallet)
        throw new Error("invalid");
      return {
        privyUserId: "did:privy:test",
        xUserId: "42",
        handle: "alice",
        wallet,
        verifiedAt: new Date(0),
      };
    },
  };
  const attestationService = {
    async issueSelfRove() {
      return { kind: "self_rove" };
    },
    async issueScout() {
      return { kind: "scout" };
    },
    async issueClaim() {
      return { kind: "claim" };
    },
  };
  return buildServer({
    repository,
    identityVerifier,
    attestationService: attestationService as unknown as Pick<
      IdentityAttestationService,
      "issueSelfRove" | "issueScout" | "issueClaim"
    >,
  });
}

describe("Rovo API", () => {
  it("serves health and launch records", async () => {
    const app = fixture();
    expect(
      (await app.inject({ method: "GET", url: "/health" })).statusCode,
    ).toBe(200);
    const response = await app.inject({
      method: "GET",
      url: `/v1/launches/${token}`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().creatorTaxBps).toBe(300);
    const list = await app.inject({
      method: "GET",
      url: "/v1/launches?limit=10",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().launches).toMatchObject([{ token, handle: "alice" }]);
    const invalid = await app.inject({
      method: "GET",
      url: "/v1/launches?limit=101",
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("saves a launch from its receipt without waiting for background sync", async () => {
    const repository = new MemoryRovoRepository();
    const saved = {
      token,
      handle: "alice",
      xUserId: "42",
      pairToken: "0x0000000000000000000000000000000000000033" as const,
      feeCollector: "0x0000000000000000000000000000000000000044" as const,
      launchType: "self" as const,
      rover: null,
      scout: null,
      claimed: true,
      creatorTaxBps: 300,
      displayName: "Alice",
      imageUrl: null,
      launchedAt: "2026-09-27T06:54:11.000Z",
    };
    const app = buildServer({
      repository,
      identityVerifier: { async verify() { throw new Error("unused"); } },
      attestationService: { async issueSelfRove() { throw new Error("unused"); }, async issueScout() { throw new Error("unused"); }, async issueClaim() { throw new Error("unused"); } } as unknown as Pick<IdentityAttestationService, "issueSelfRove" | "issueScout" | "issueClaim">,
      recordLaunch: async (input) => {
        expect(input.transactionHash).toBe(`0x${"ab".repeat(32)}`);
        expect(input.handle).toBe("alice");
        repository.launches.set(input.token.toLowerCase(), saved);
        return saved;
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/launches/index",
      payload: {
        token,
        transactionHash: `0x${"ab".repeat(32)}`,
        handle: "alice",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ token, handle: "alice", feeCollector: saved.feeCollector });
    const missing = await app.inject({
      method: "POST",
      url: "/v1/launches/index",
      payload: { token: "not-an-address" },
    });
    expect(missing.statusCode).toBe(400);
  });

  it("deletes a saved launch record", async () => {
    const app = fixture();
    const removed = await app.inject({
      method: "DELETE",
      url: `/v1/launches/${token}`,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ deleted: true, token });
    const missing = await app.inject({
      method: "GET",
      url: `/v1/launches/${token}`,
    });
    expect(missing.statusCode).toBe(404);
    const again = await app.inject({
      method: "DELETE",
      url: `/v1/launches/${token}`,
    });
    expect(again.statusCode).toBe(404);
    const invalid = await app.inject({
      method: "DELETE",
      url: "/v1/launches/not-an-address",
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("allows the configured web origin to call identity routes", async () => {
    const response = await fixture().inject({
      method: "OPTIONS",
      url: "/v1/identity/x/verify",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });

  it("allows each configured web origin", async () => {
    const previous = process.env.ROVO_WEB_ORIGIN;
    process.env.ROVO_WEB_ORIGIN = "https://rovo.fun,https://www.rovo.fun";
    try {
      const app = fixture();
      const apex = await app.inject({
        method: "OPTIONS",
        url: "/v1/identity/x/verify",
        headers: {
          origin: "https://rovo.fun",
          "access-control-request-method": "POST",
        },
      });
      expect(apex.headers["access-control-allow-origin"]).toBe(
        "https://rovo.fun",
      );
      const www = await app.inject({
        method: "OPTIONS",
        url: "/v1/identity/x/verify",
        headers: {
          origin: "https://www.rovo.fun",
          "access-control-request-method": "POST",
        },
      });
      expect(www.headers["access-control-allow-origin"]).toBe(
        "https://www.rovo.fun",
      );
      const other = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://example.com" },
      });
      expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.ROVO_WEB_ORIGIN;
      else process.env.ROVO_WEB_ORIGIN = previous;
    }
  });

  it("normalizes profile handles", async () => {
    const response = await fixture().inject({
      method: "GET",
      url: "/v1/profiles/@ALICE",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().xUserId).toBe("42");
  });

  it("returns the stored proof and claim arguments for a holder", async () => {
    const app = fixture();
    const response = await app.inject({
      method: "GET",
      url: `/v1/rewards/${token}/${wallet}`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().claims[0]).toMatchObject({
      epochId: "7",
      amount: "500",
      metadataUri: "ipfs://epoch",
    });
  });

  it("lets an authorized admin replace the X token pair", async () => {
    const saved: Array<{ accessToken: string; refreshToken: string }> = [];
    const app = buildServer({
      repository: new MemoryRovoRepository(),
      identityVerifier: { async verify() { throw new Error("unused"); } },
      attestationService: {
        async issueSelfRove() { throw new Error("unused"); },
        async issueScout() { throw new Error("unused"); },
        async issueClaim() { throw new Error("unused"); },
      } as unknown as Pick<IdentityAttestationService, "issueSelfRove" | "issueScout" | "issueClaim">,
      authorizeAdmin: async (accessToken, selectedWallet) => {
        if (accessToken !== "valid" || selectedWallet !== wallet) throw new Error("no");
      },
      replaceXTokens: async (input) => {
        saved.push(input);
        return { expiresAt: "2026-09-28T00:00:00.000Z" };
      },
    });
    const missing = await app.inject({
      method: "POST",
      url: "/v1/admin/x-tokens",
      payload: { wallet, accessToken: "a".repeat(20), refreshToken: "b".repeat(20) },
    });
    expect(missing.statusCode).toBe(401);
    const denied = await app.inject({
      method: "POST",
      url: "/v1/admin/x-tokens",
      headers: { authorization: "Bearer other" },
      payload: { wallet, accessToken: "a".repeat(20), refreshToken: "b".repeat(20) },
    });
    expect(denied.statusCode).toBe(403);
    const savedResponse = await app.inject({
      method: "POST",
      url: "/v1/admin/x-tokens",
      headers: { authorization: "Bearer valid" },
      payload: { wallet, accessToken: "access-token-value-ok", refreshToken: "refresh-token-value-ok" },
    });
    expect(savedResponse.statusCode).toBe(200);
    expect(savedResponse.json()).toEqual({ updated: true, expiresAt: "2026-09-28T00:00:00.000Z" });
    expect(saved).toEqual([{ accessToken: "access-token-value-ok", refreshToken: "refresh-token-value-ok" }]);
    expect(JSON.stringify(savedResponse.json())).not.toContain("access-token-value-ok");
    const solana = await app.inject({
      method: "POST",
      url: "/v1/admin/x-tokens",
      headers: { authorization: "Bearer valid" },
      payload: {
        wallet: "7iMWJf5osYpuon6oDjtmZ2DvxJqRDnsZrbSBnmcuverD",
        accessToken: "access-token-value-ok",
        refreshToken: "refresh-token-value-ok",
      },
    });
    expect(solana.statusCode).toBe(403);
  });

  it("returns n/a until an admin saves the Rovo token address", async () => {
    let address: typeof token | null = null;
    const app = buildServer({
      repository: new MemoryRovoRepository(),
      identityVerifier: { async verify() { throw new Error("unused"); } },
      attestationService: {
        async issueSelfRove() { throw new Error("unused"); },
        async issueScout() { throw new Error("unused"); },
        async issueClaim() { throw new Error("unused"); },
      } as unknown as Pick<IdentityAttestationService, "issueSelfRove" | "issueScout" | "issueClaim">,
      authorizeAdmin: async (accessToken, selectedWallet) => {
        if (accessToken !== "valid" || selectedWallet !== wallet) throw new Error("no");
      },
      getRovoToken: async () => address,
      setRovoToken: async (next) => {
        address = next;
      },
    });
    const empty = await app.inject({ method: "GET", url: "/v1/rovo-token" });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ address: null });
    const missing = await app.inject({
      method: "POST",
      url: "/v1/admin/rovo-token",
      payload: { wallet, address: token },
    });
    expect(missing.statusCode).toBe(401);
    const saved = await app.inject({
      method: "POST",
      url: "/v1/admin/rovo-token",
      headers: { authorization: "Bearer valid" },
      payload: { wallet, address: token },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ updated: true, address: token });
    const filled = await app.inject({ method: "GET", url: "/v1/rovo-token" });
    expect(filled.json()).toEqual({ address: token });
  });

  it("requires a valid Privy bearer token", async () => {
    const app = fixture();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/identity/x/verify",
          payload: { wallet },
        })
      ).statusCode,
    ).toBe(401);
    const valid = await app.inject({
      method: "POST",
      url: "/v1/identity/x/verify",
      headers: { authorization: "Bearer valid" },
      payload: { wallet },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().xUserId).toBe("42");
  });

  it("exposes Self-Rove, Scout and claim attestation routes", async () => {
    const app = fixture();
    const metadataHash = `0x${"11".repeat(32)}`;
    const self = await app.inject({
      method: "POST",
      url: "/v1/attestations/self-rove",
      headers: { authorization: "Bearer valid" },
      payload: { wallet, metadataHash },
    });
    expect(self.statusCode).toBe(200);
    expect(self.json().kind).toBe("self_rove");
    const scout = await app.inject({
      method: "POST",
      url: "/v1/attestations/scout",
      payload: { handle: "alice", metadataHash },
    });
    expect(scout.statusCode).toBe(200);
    const claim = await app.inject({
      method: "POST",
      url: "/v1/attestations/claim",
      headers: { authorization: "Bearer valid" },
      payload: { wallet, profileToken: token },
    });
    expect(claim.statusCode).toBe(200);
  });

  it("saves a created Pump mint and lists it", async () => {
    const mint = "Hg5Ja55T5wESq4vyFoiVCMeHXtGyVA69X2UHq8hgpump";
    const coins = new Map<string, {
      mint: string;
      name: string | null;
      symbol: string | null;
      imageUrl: string | null;
      metadataUri: string | null;
      quoteMint: string | null;
      launcherWallet: string | null;
      signature: string | null;
      createdAt: string;
      updatedAt: string;
    }>();
    const app = buildServer({
      repository: new MemoryRovoRepository(),
      identityVerifier: { async verify() { throw new Error("unused"); } },
      attestationService: {
        async issueSelfRove() { throw new Error("unused"); },
        async issueScout() { throw new Error("unused"); },
        async issueClaim() { throw new Error("unused"); },
      } as unknown as Pick<IdentityAttestationService, "issueSelfRove" | "issueScout" | "issueClaim">,
      listPumpCoins: async (limit) => [...coins.values()].slice(0, limit),
      getPumpCoin: async (address) => coins.get(address) ?? null,
      savePumpCoin: async (input) => {
        const now = "2026-10-03T06:10:00.000Z";
        const saved = {
          mint: input.mint,
          name: input.name ?? coins.get(input.mint)?.name ?? null,
          symbol: input.symbol ?? null,
          imageUrl: input.imageUrl ?? null,
          metadataUri: input.metadataUri ?? null,
          quoteMint: input.quoteMint ?? null,
          launcherWallet: input.launcherWallet ?? null,
          signature: input.signature ?? null,
          createdAt: coins.get(input.mint)?.createdAt ?? now,
          updatedAt: now,
        };
        coins.set(input.mint, saved);
        return saved;
      },
    });
    const missing = await app.inject({ method: "GET", url: `/v1/pump/coins/${mint}` });
    expect(missing.statusCode).toBe(404);
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/pump/coins",
      payload: { mint: "not-a-mint" },
    });
    expect(invalid.statusCode).toBe(400);
    const saved = await app.inject({
      method: "POST",
      url: "/v1/pump/coins",
      payload: {
        mint,
        name: "baton",
        symbol: "baton",
        quoteMint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().mint).toBe(mint);
    const listed = await app.inject({ method: "GET", url: "/v1/pump/coins" });
    expect(listed.json().coins).toHaveLength(1);
    expect(listed.json().coins[0].symbol).toBe("baton");
  });
});
