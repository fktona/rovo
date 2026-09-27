import { randomBytes, randomUUID } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import type {
  Address,
  IdentityAttestationStore,
  IdentityVerifier,
  PublicXProfileResolver,
  RovoRepository,
  StoredAttestation,
} from "./types.js";

const domainName = "Rovo Identity";
const domainVersion = "1";
const MAX_TTL_SECONDS = 600;

export const selfRoveTypes = {
  SelfRoveAttestation: [
    { name: "xUserId", type: "uint64" },
    { name: "handle", type: "string" },
    { name: "metadataHash", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const scoutTypes = {
  ScoutProfileAttestation: [
    { name: "xUserId", type: "uint64" },
    { name: "handle", type: "string" },
    { name: "metadataHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const claimTypes = {
  ClaimAttestation: [
    { name: "xUserId", type: "uint64" },
    { name: "handle", type: "string" },
    { name: "recipient", type: "address" },
    { name: "profileToken", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export type IssuedAttestation = {
  id: string;
  kind: StoredAttestation["kind"];
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  primaryType:
    "SelfRoveAttestation" | "ScoutProfileAttestation" | "ClaimAttestation";
  types: typeof selfRoveTypes | typeof scoutTypes | typeof claimTypes;
  message: Record<string, string>;
  signature: `0x${string}`;
};

export class IdentityAttestationService {
  private readonly account;

  constructor(
    private readonly deps: {
      privateKey: `0x${string}`;
      chainId: number;
      wrapper: Address;
      nottingham: Address;
      identityVerifier: IdentityVerifier;
      xResolver: PublicXProfileResolver;
      repository: RovoRepository;
      store: IdentityAttestationStore;
      ttlSeconds?: number;
      now?: () => number;
    },
  ) {
    this.account = privateKeyToAccount(deps.privateKey);
    const ttl = deps.ttlSeconds ?? MAX_TTL_SECONDS;
    if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL_SECONDS)
      throw new Error("Attestation TTL must be 1-600 seconds");
  }

  signerAddress(): Address {
    return this.account.address;
  }

  async issueSelfRove(
    accessToken: string,
    wallet: Address,
    metadataHash: `0x${string}`,
  ) {
    const identity = await this.deps.identityVerifier.verify(
      accessToken,
      wallet,
    );
    await this.deps.store.saveIdentity(identity);
    const common = this.common(
      identity.xUserId,
      identity.handle,
      this.deps.wrapper,
      "self_rove",
    );
    const message = {
      xUserId: BigInt(identity.xUserId),
      handle: identity.handle,
      metadataHash,
      recipient: wallet,
      nonce: BigInt(common.nonce),
      deadline: BigInt(common.deadline),
    };
    const signature = await this.account.signTypedData({
      domain: common.domain,
      types: selfRoveTypes,
      primaryType: "SelfRoveAttestation",
      message,
    });
    return this.persist(common, {
      recipient: wallet,
      metadataHash,
      profileToken: null,
      signature,
    });
  }

  async issueScout(handle: string, metadataHash: `0x${string}`) {
    const profile = await this.deps.xResolver.resolve(handle);
    await this.deps.store.savePublicProfile(profile);
    const common = this.common(
      profile.xUserId,
      profile.handle,
      this.deps.wrapper,
      "scout",
    );
    const message = {
      xUserId: BigInt(profile.xUserId),
      handle: profile.handle,
      metadataHash,
      nonce: BigInt(common.nonce),
      deadline: BigInt(common.deadline),
    };
    const signature = await this.account.signTypedData({
      domain: common.domain,
      types: scoutTypes,
      primaryType: "ScoutProfileAttestation",
      message,
    });
    return this.persist(common, {
      recipient: null,
      metadataHash,
      profileToken: null,
      signature,
    });
  }

  async issueClaim(
    accessToken: string,
    wallet: Address,
    profileToken: Address,
  ) {
    const identity = await this.deps.identityVerifier.verify(
      accessToken,
      wallet,
    );
    const launch = await this.deps.repository.getLaunch(profileToken);
    if (!launch || launch.claimed || launch.xUserId !== identity.xUserId) {
      throw new Error(
        "Authenticated X identity does not own this unclaimed launch",
      );
    }
    await this.deps.store.saveIdentity(identity);
    // The stable X ID proves ownership. The signed handle remains the launch-time
    // handle because Nottingham verifies the immutable on-chain handle hash.
    const common = this.common(
      identity.xUserId,
      launch.handle,
      this.deps.nottingham,
      "claim",
    );
    const message = {
      xUserId: BigInt(identity.xUserId),
      handle: launch.handle,
      recipient: wallet,
      profileToken,
      nonce: BigInt(common.nonce),
      deadline: BigInt(common.deadline),
    };
    const signature = await this.account.signTypedData({
      domain: common.domain,
      types: claimTypes,
      primaryType: "ClaimAttestation",
      message,
    });
    return this.persist(common, {
      recipient: wallet,
      metadataHash: null,
      profileToken,
      signature,
    });
  }

  private common(
    xUserId: string,
    handle: string,
    verifyingContract: Address,
    kind: StoredAttestation["kind"],
  ) {
    const nonce = BigInt(`0x${randomBytes(32).toString("hex")}`).toString();
    const deadline =
      Math.floor((this.deps.now?.() ?? Date.now()) / 1_000) +
      (this.deps.ttlSeconds ?? MAX_TTL_SECONDS);
    return {
      id: randomUUID(),
      kind,
      nonce,
      deadline,
      xUserId,
      handle,
      domain: {
        name: domainName,
        version: domainVersion,
        chainId: this.deps.chainId,
        verifyingContract,
      },
    };
  }

  private async persist(
    common: ReturnType<IdentityAttestationService["common"]>,
    fields: Pick<
      StoredAttestation,
      "recipient" | "profileToken" | "metadataHash" | "signature"
    >,
  ): Promise<IssuedAttestation> {
    await this.deps.store.saveAttestation({
      id: common.id,
      kind: common.kind,
      nonce: common.nonce,
      xUserId: common.xUserId,
      handle: common.handle,
      recipient: fields.recipient,
      profileToken: fields.profileToken,
      metadataHash: fields.metadataHash,
      verifyingContract: common.domain.verifyingContract,
      deadline: new Date(common.deadline * 1_000),
      signature: fields.signature,
    });
    const message: Record<string, string> = {
      xUserId: common.xUserId,
      handle: common.handle,
      nonce: common.nonce,
      deadline: String(common.deadline),
    };
    if (fields.recipient) message.recipient = fields.recipient;
    if (fields.profileToken) message.profileToken = fields.profileToken;
    if (fields.metadataHash) message.metadataHash = fields.metadataHash;
    const typed =
      common.kind === "self_rove"
        ? { primaryType: "SelfRoveAttestation" as const, types: selfRoveTypes }
        : common.kind === "scout"
          ? {
              primaryType: "ScoutProfileAttestation" as const,
              types: scoutTypes,
            }
          : { primaryType: "ClaimAttestation" as const, types: claimTypes };
    return {
      id: common.id,
      kind: common.kind,
      domain: common.domain,
      ...typed,
      message,
      signature: fields.signature,
    };
  }
}
