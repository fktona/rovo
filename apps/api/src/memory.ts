import type {
  Address,
  LaunchView,
  ProfileView,
  RewardClaimView,
  RovoRepository,
} from "./types.js";

export class MemoryRovoRepository implements RovoRepository {
  readonly launches = new Map<string, LaunchView>();
  readonly profiles = new Map<string, ProfileView>();
  readonly rewardClaims = new Map<string, RewardClaimView[]>();

  async listLaunches(limit: number) {
    return [...this.launches.values()].slice(0, limit);
  }

  async getLaunch(token: Address) {
    return this.launches.get(token.toLowerCase()) ?? null;
  }

  async getProfile(handle: string) {
    return this.profiles.get(normalizeHandle(handle)) ?? null;
  }

  async getRewardClaims(profileToken: Address, account: Address) {
    return (
      this.rewardClaims.get(
        `${profileToken.toLowerCase()}:${account.toLowerCase()}`,
      ) ?? []
    );
  }
}

export function normalizeHandle(handle: string) {
  const normalized = handle.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized))
    throw new Error("invalid X handle");
  return normalized;
}
