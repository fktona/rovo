import {
  identityAttestations,
  launches,
  profiles,
  rewardEpochs,
  rewardProofs,
  verifiedIdentities,
  type createDatabase,
} from "@rovo/database";
import { and, desc, eq, inArray } from "drizzle-orm";
import type {
  Address,
  IdentityAttestationStore,
  LaunchView,
  ProfileView,
  RewardClaimView,
  PublicXProfile,
  RovoRepository,
  ScoutProfile,
  StoredAttestation,
  VerifiedXIdentity,
} from "./types.js";

type Database = ReturnType<typeof createDatabase>["db"];

function toLaunchView(
  row: typeof launches.$inferSelect,
  profile: { displayName: string | null; imageUrl: string | null } | null,
): Omit<LaunchView, "scout"> {
  return {
    token: address(row.token),
    handle: row.handle,
    xUserId: row.xUserId.toString(),
    pairToken: address(row.pairToken),
    feeCollector: address(row.feeCollector),
    launchType: row.type,
    rover:
      row.rover && /^0x[a-fA-F0-9]{40}$/.test(row.rover)
        ? address(row.rover)
        : null,
    claimed: row.claimed,
    creatorTaxBps: row.creatorTaxBps,
    displayName: profile?.displayName ?? null,
    imageUrl: profile?.imageUrl ?? null,
    launchedAt: row.launchedAt.toISOString(),
  };
}

function address(value: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value))
    throw new Error(`Invalid indexed address: ${value}`);
  return value as Address;
}

export class PostgresRovoRepository
  implements RovoRepository, IdentityAttestationStore
{
  constructor(private readonly db: Database) {}

  async listLaunches(limit: number): Promise<LaunchView[]> {
    const rows = await this.db
      .select({ launch: launches, profile: profiles })
      .from(launches)
      .leftJoin(profiles, eq(profiles.xUserId, launches.xUserId))
      .orderBy(desc(launches.launchedAt))
      .limit(limit);
    return this.withScouts(rows.map((row) => toLaunchView(row.launch, row.profile)));
  }

  async getLaunch(token: Address): Promise<LaunchView | null> {
    const [row] = await this.db
      .select({ launch: launches, profile: profiles })
      .from(launches)
      .leftJoin(profiles, eq(profiles.xUserId, launches.xUserId))
      .where(eq(launches.token, token.toLowerCase()))
      .limit(1);
    if (!row) return null;
    const [view] = await this.withScouts([toLaunchView(row.launch, row.profile)]);
    return view ?? null;
  }

  async deleteLaunch(token: Address): Promise<boolean> {
    const deleted = await this.db
      .delete(launches)
      .where(eq(launches.token, token.toLowerCase()))
      .returning({ token: launches.token });
    return deleted.length > 0;
  }

  private async withScouts(views: Omit<LaunchView, "scout">[]): Promise<LaunchView[]> {
    const wallets = [
      ...new Set(
        views
          .filter((view) => view.launchType === "scout" && view.rover)
          .map((view) => view.rover!.toLowerCase()),
      ),
    ];
    const scouts = await this.scoutProfiles(wallets);
    return views.map((view) => ({
      ...view,
      scout:
        view.launchType === "scout" && view.rover
          ? (scouts.get(view.rover.toLowerCase()) ?? null)
          : null,
    }));
  }

  private async scoutProfiles(wallets: string[]): Promise<Map<string, ScoutProfile>> {
    const found = new Map<string, ScoutProfile>();
    if (wallets.length === 0) return found;
    const identities = await this.db
      .select({
        wallet: verifiedIdentities.wallet,
        handle: profiles.handle,
        displayName: profiles.displayName,
        imageUrl: profiles.imageUrl,
        token: launches.token,
      })
      .from(verifiedIdentities)
      .innerJoin(profiles, eq(profiles.xUserId, verifiedIdentities.xUserId))
      .leftJoin(launches, eq(launches.xUserId, verifiedIdentities.xUserId))
      .where(inArray(verifiedIdentities.wallet, wallets));
    for (const row of identities) {
      const wallet = row.wallet.toLowerCase();
      if (found.has(wallet)) continue;
      found.set(wallet, {
        handle: row.handle,
        displayName: row.displayName,
        imageUrl: row.imageUrl,
        token: row.token && /^0x[a-fA-F0-9]{40}$/.test(row.token) ? address(row.token) : null,
      });
    }
    const missing = wallets.filter((wallet) => !found.has(wallet));
    if (missing.length === 0) return found;
    const selfLaunches = await this.db
      .select({
        creator: launches.creator,
        handle: profiles.handle,
        displayName: profiles.displayName,
        imageUrl: profiles.imageUrl,
        token: launches.token,
      })
      .from(launches)
      .innerJoin(profiles, eq(profiles.xUserId, launches.xUserId))
      .where(and(eq(launches.type, "self"), inArray(launches.creator, missing)));
    for (const row of selfLaunches) {
      if (!row.creator) continue;
      const wallet = row.creator.toLowerCase();
      if (found.has(wallet)) continue;
      found.set(wallet, {
        handle: row.handle,
        displayName: row.displayName,
        imageUrl: row.imageUrl,
        token: address(row.token),
      });
    }
    return found;
  }

  async getProfile(handle: string): Promise<ProfileView | null> {
    const [row] = await this.db
      .select({ profile: profiles, token: launches.token })
      .from(profiles)
      .innerJoin(launches, eq(launches.xUserId, profiles.xUserId))
      .where(eq(profiles.handle, handle))
      .limit(1);
    if (!row) return null;
    return {
      xUserId: row.profile.xUserId.toString(),
      handle: row.profile.handle,
      displayName: row.profile.displayName,
      imageUrl: row.profile.imageUrl,
      token: address(row.token),
    };
  }

  async getRewardClaims(
    profileToken: Address,
    account: Address,
  ): Promise<RewardClaimView[]> {
    const rows = await this.db
      .select({ epoch: rewardEpochs, proof: rewardProofs })
      .from(rewardProofs)
      .innerJoin(
        rewardEpochs,
        and(
          eq(rewardProofs.profileToken, rewardEpochs.profileToken),
          eq(rewardProofs.epochId, rewardEpochs.epochId),
        ),
      )
      .where(
        and(
          eq(rewardProofs.profileToken, profileToken.toLowerCase()),
          eq(rewardProofs.account, account.toLowerCase()),
        ),
      );
    return rows.map(({ epoch, proof }) => ({
      profileToken: address(epoch.profileToken),
      epochId: epoch.epochId.toString(),
      stockToken: address(epoch.stockToken),
      amount: proof.amount.toString(),
      proof: proof.proof as `0x${string}`[],
      merkleRoot: epoch.merkleRoot as `0x${string}`,
      snapshotBlock: epoch.snapshotBlock.toString(),
      metadataUri: epoch.metadataUri,
    }));
  }

  async saveIdentity(identity: VerifiedXIdentity): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(verifiedIdentities)
        .values({
          privyUserId: identity.privyUserId,
          xUserId: BigInt(identity.xUserId),
          handle: identity.handle,
          wallet: identity.wallet.toLowerCase(),
          xVerifiedAt: identity.verifiedAt,
        })
        .onConflictDoUpdate({
          target: verifiedIdentities.privyUserId,
          set: {
            xUserId: BigInt(identity.xUserId),
            handle: identity.handle,
            wallet: identity.wallet.toLowerCase(),
            xVerifiedAt: identity.verifiedAt,
            updatedAt: new Date(),
          },
        });
      await tx
        .insert(profiles)
        .values({
          xUserId: BigInt(identity.xUserId),
          handle: identity.handle,
          privyUserId: identity.privyUserId,
        })
        .onConflictDoUpdate({
          target: profiles.xUserId,
          set: {
            handle: identity.handle,
            privyUserId: identity.privyUserId,
            updatedAt: new Date(),
          },
        });
    });
  }

  async savePublicProfile(profile: PublicXProfile): Promise<void> {
    await this.db
      .insert(profiles)
      .values({
        xUserId: BigInt(profile.xUserId),
        handle: profile.handle,
        displayName: profile.displayName,
        imageUrl: profile.imageUrl,
      })
      .onConflictDoUpdate({
        target: profiles.xUserId,
        set: {
          handle: profile.handle,
          displayName: profile.displayName,
          imageUrl: profile.imageUrl,
          updatedAt: new Date(),
        },
      });
  }

  async saveAttestation(attestation: StoredAttestation): Promise<void> {
    await this.db.insert(identityAttestations).values({
      id: attestation.id,
      kind: attestation.kind,
      nonce: attestation.nonce,
      xUserId: BigInt(attestation.xUserId),
      handle: attestation.handle,
      recipient: attestation.recipient,
      profileToken: attestation.profileToken,
      metadataHash: attestation.metadataHash,
      verifyingContract: attestation.verifyingContract,
      deadline: attestation.deadline,
      signature: attestation.signature,
    });
  }
}
