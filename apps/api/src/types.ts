export type Address = `0x${string}`;

export type ScoutProfile = {
  handle: string;
  displayName: string | null;
  imageUrl: string | null;
  token: Address | null;
};

export type LaunchView = {
  token: Address;
  handle: string;
  xUserId: string;
  pairToken: Address;
  feeCollector: Address;
  launchType: "scout" | "self";
  rover: Address | null;
  scout: ScoutProfile | null;
  claimed: boolean;
  creatorTaxBps: number;
  displayName: string | null;
  imageUrl: string | null;
  launchedAt: string;
};

export type ProfileView = {
  xUserId: string;
  handle: string;
  displayName: string | null;
  imageUrl: string | null;
  token: Address;
};

export type RewardClaimView = {
  profileToken: Address;
  epochId: string;
  stockToken: Address;
  amount: string;
  proof: `0x${string}`[];
  merkleRoot: `0x${string}`;
  snapshotBlock: string;
  metadataUri: string;
};

export interface RovoRepository {
  listLaunches(limit: number): Promise<LaunchView[]>;
  getLaunch(token: Address): Promise<LaunchView | null>;
  deleteLaunch(token: Address): Promise<boolean>;
  getProfile(handle: string): Promise<ProfileView | null>;
  getRewardClaims(
    profileToken: Address,
    account: Address,
  ): Promise<RewardClaimView[]>;
}

export type VerifiedXIdentity = {
  privyUserId: string;
  xUserId: string;
  handle: string;
  wallet: Address;
  verifiedAt: Date;
};

export interface IdentityVerifier {
  verify(accessToken: string, wallet: Address): Promise<VerifiedXIdentity>;
}

export type PublicXProfile = {
  xUserId: string;
  handle: string;
  displayName: string | null;
  imageUrl: string | null;
  followers?: number | null;
  verified?: boolean;
};

export interface PublicXProfileResolver {
  resolve(handle: string): Promise<PublicXProfile>;
  search(query: string): Promise<PublicXProfile[]>;
}

export type StoredAttestation = {
  id: string;
  kind: "self_rove" | "scout" | "claim";
  nonce: string;
  xUserId: string;
  handle: string;
  recipient: Address | null;
  profileToken: Address | null;
  metadataHash: `0x${string}` | null;
  verifyingContract: Address;
  deadline: Date;
  signature: `0x${string}`;
};

export interface IdentityAttestationStore {
  saveIdentity(identity: VerifiedXIdentity): Promise<void>;
  savePublicProfile(profile: PublicXProfile): Promise<void>;
  saveAttestation(attestation: StoredAttestation): Promise<void>;
}
