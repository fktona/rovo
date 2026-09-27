import { recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { IdentityAttestationService, selfRoveTypes } from "./attestations.js";
import { MemoryRovoRepository } from "./memory.js";
import type {
  IdentityAttestationStore,
  StoredAttestation,
  VerifiedXIdentity,
} from "./types.js";

const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const wrapper = "0x1111111111111111111111111111111111111111" as const;
const nottingham = "0x2222222222222222222222222222222222222222" as const;
const wallet = "0x3333333333333333333333333333333333333333" as const;
const profileToken = "0x4444444444444444444444444444444444444444" as const;
const metadataHash = `0x${"55".repeat(32)}` as const;
const now = 1_700_000_000_000;

function fixture(ttlSeconds = 600) {
  const saved: StoredAttestation[] = [];
  const identities: VerifiedXIdentity[] = [];
  const store: IdentityAttestationStore = {
    async saveIdentity(identity) {
      identities.push(identity);
    },
    async savePublicProfile() {},
    async saveAttestation(attestation) {
      saved.push(attestation);
    },
  };
  const repository = new MemoryRovoRepository();
  repository.launches.set(profileToken, {
    token: profileToken,
    handle: "alice",
    xUserId: "42",
    pairToken: "0x5555555555555555555555555555555555555555",
    feeCollector: "0x6666666666666666666666666666666666666666",
    launchType: "scout",
    rover: wallet,
    scout: null,
    claimed: false,
    creatorTaxBps: 100,
    displayName: null,
    imageUrl: null,
    launchedAt: "2026-09-27T06:54:11.000Z",
  });
  const identity: VerifiedXIdentity = {
    privyUserId: "did:privy:alice",
    xUserId: "42",
    handle: "alice",
    wallet,
    verifiedAt: new Date(now),
  };
  const service = new IdentityAttestationService({
    privateKey,
    chainId: 4663,
    wrapper,
    nottingham,
    identityVerifier: {
      async verify() {
        return identity;
      },
    },
    xResolver: {
      async resolve() {
        return {
          xUserId: "84",
          handle: "bob",
          displayName: "Bob",
          imageUrl: null,
        };
      },
      async search() {
        return [];
      },
    },
    repository,
    store,
    now: () => now,
    ttlSeconds,
  });
  return { service, saved, identities, repository, store };
}

describe("IdentityAttestationService", () => {
  it("signs and persists a wallet-bound Self-Rove attestation", async () => {
    const { service, saved, identities } = fixture();
    const issued = await service.issueSelfRove(
      "access-token",
      wallet,
      metadataHash,
    );
    const recovered = await recoverTypedDataAddress({
      domain: issued.domain,
      types: selfRoveTypes,
      primaryType: "SelfRoveAttestation",
      message: {
        xUserId: BigInt(issued.message.xUserId!),
        handle: issued.message.handle!,
        metadataHash: issued.message.metadataHash as `0x${string}`,
        recipient: issued.message.recipient as `0x${string}`,
        nonce: BigInt(issued.message.nonce!),
        deadline: BigInt(issued.message.deadline!),
      },
      signature: issued.signature,
    });
    expect(recovered).toBe(privateKeyToAccount(privateKey).address);
    expect(issued.domain).toMatchObject({
      chainId: 4663,
      verifyingContract: wrapper,
    });
    expect(issued.message).toMatchObject({
      xUserId: "42",
      handle: "alice",
      recipient: wallet,
      metadataHash,
    });
    expect(Number(issued.message.deadline) - now / 1_000).toBe(600);
    expect(saved).toHaveLength(1);
    expect(identities).toHaveLength(1);
  });

  it("resolves a stable X ID for Scout and never reuses a nonce", async () => {
    const { service, saved } = fixture();
    const first = await service.issueScout("@BOB", metadataHash);
    const second = await service.issueScout("bob", metadataHash);
    expect(first.message).toMatchObject({ xUserId: "84", handle: "bob" });
    expect(first.message.nonce).not.toBe(second.message.nonce);
    expect(new Set(saved.map((item) => item.nonce)).size).toBe(2);
  });

  it("signs a claim only when the authenticated X ID owns the unclaimed launch", async () => {
    const { service, repository } = fixture();
    const issued = await service.issueClaim(
      "access-token",
      wallet,
      profileToken,
    );
    expect(issued.domain.verifyingContract).toBe(nottingham);
    expect(issued.message.profileToken).toBe(profileToken);
    const launch = await repository.getLaunch(profileToken);
    repository.launches.set(profileToken, { ...launch!, xUserId: "999" });
    await expect(
      service.issueClaim("access-token", wallet, profileToken),
    ).rejects.toThrow("does not own");
  });

  it("allows an owner to claim after renaming by signing the original launch handle", async () => {
    const { repository, store } = fixture();
    const renamedIdentity: VerifiedXIdentity = {
      privyUserId: "did:privy:alice",
      xUserId: "42",
      handle: "alice_new",
      wallet,
      verifiedAt: new Date(now),
    };
    const renamed = new IdentityAttestationService({
      privateKey,
      chainId: 4663,
      wrapper,
      nottingham,
      identityVerifier: {
        async verify() {
          return renamedIdentity;
        },
      },
      xResolver: {
        async resolve() {
          throw new Error("unused");
        },
        async search() {
          return [];
        },
      },
      repository,
      store,
      now: () => now,
    });
    const issued = await renamed.issueClaim(
      "access-token",
      wallet,
      profileToken,
    );
    expect(issued.message.handle).toBe("alice");
  });

  it("rejects an attestation lifetime longer than the contract maximum", () => {
    expect(() => fixture(601)).toThrow("1-600");
  });
});
