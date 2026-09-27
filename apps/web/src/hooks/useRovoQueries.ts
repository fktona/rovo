"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { normalizeHandle } from "../lib/validation";
import { useRovoContext } from "../providers/RovoProviders";

export const rovoKeys = {
  launch: (token: Address) =>
    ["rovo", "api", "launch", token.toLowerCase()] as const,
  profile: (handle: string) =>
    ["rovo", "api", "profile", normalizeHandle(handle)] as const,
  rewards: (token: Address, account: Address) =>
    [
      "rovo",
      "api",
      "rewards",
      token.toLowerCase(),
      account.toLowerCase(),
    ] as const,
  chain: (...parts: (string | number | bigint | undefined)[]) =>
    ["rovo", "chain", ...parts] as const,
};

export function useLaunch(token?: Address) {
  const { api } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("api-launch", token?.toLowerCase()),
    queryFn: ({ signal }) => api.launch(token!, signal),
    enabled: !!token,
  });
}
export function useLaunches(limit = 50) {
  const { api } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("launches", limit),
    queryFn: ({ signal }) => api.launches(limit, signal),
  });
}
export function useXSearch(query?: string) {
  const { api } = useRovoContext();
  const text = query?.trim().replace(/^@+/, "") ?? "";
  return useQuery({
    queryKey: rovoKeys.chain("x-search", text.toLowerCase()),
    queryFn: ({ signal }) => api.searchXAccounts(text, signal),
    enabled: text.length >= 2,
    staleTime: 30_000,
  });
}
export function useXAccount(handle?: string) {
  const { api } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("x-account", handle?.toLowerCase()),
    queryFn: ({ signal }) => api.xAccount(handle!, signal),
    enabled: !!handle,
    staleTime: 60_000,
  });
}
export function useProfile(handle?: string) {
  const { api } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("profile", handle?.toLowerCase()),
    queryFn: ({ signal }) => api.profile(handle!, signal),
    enabled: !!handle,
  });
}
export function useRewardClaims(token?: Address, account?: Address) {
  const { api } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain(
      "rewards",
      token?.toLowerCase(),
      account?.toLowerCase(),
    ),
    queryFn: ({ signal }) => api.rewards(token!, account!, signal),
    enabled: !!token && !!account,
  });
}
export function useOnchainLaunch(token?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("launch", token?.toLowerCase()),
    queryFn: () => reads.getLaunch(token!),
    enabled: !!token,
  });
}
export function useTokenForHandle(handle?: string) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("token-for-handle", handle?.toLowerCase()),
    queryFn: () => reads.tokenForHandle(handle!),
    enabled: !!handle,
  });
}
export function useLaunchFee() {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("launch-fee"),
    queryFn: () => reads.launchFee(),
  });
}
export function usePairEconomics(pairToken?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("pair-economics", pairToken?.toLowerCase()),
    queryFn: () => reads.pairEconomics(pairToken!),
    enabled: !!pairToken,
  });
}
export function usePonsPhase(token?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("phase", token?.toLowerCase()),
    queryFn: () => reads.ponsPhase(token!),
    enabled: !!token,
  });
}
export function useFeeEscrowBalance(token?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("fee-escrow", token?.toLowerCase()),
    queryFn: () => reads.feeEscrowBalance(token!),
    enabled: !!token,
  });
}
export function usePendingFees(asset?: Address, account?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain(
      "pending-fees",
      asset?.toLowerCase(),
      account?.toLowerCase(),
    ),
    queryFn: () => reads.pendingFee(asset!, account!),
    enabled: !!asset && !!account,
  });
}
export function useTreasury() {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("treasury"),
    queryFn: () => reads.treasury(),
  });
}
export function useFeeAdmin(account?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("fee-admin", account?.toLowerCase()),
    queryFn: () => reads.isFeeAdmin(account!),
    enabled: !!account,
  });
}
export function useNottinghamClaim(token?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("nottingham", token?.toLowerCase()),
    queryFn: async () => ({
      balance: await reads.vaultBalance(token!),
      pending: await reads.pendingClaim(token!),
    }),
    enabled: !!token,
  });
}
export function useRewardPool(token?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("reward-pool", token?.toLowerCase()),
    queryFn: () => reads.rewardPool(token!),
    enabled: !!token,
  });
}
export function useRewardEpoch(token?: Address, epochId?: bigint) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("reward-epoch", token?.toLowerCase(), epochId),
    queryFn: () => reads.rewardEpoch(token!, epochId!),
    enabled: !!token && epochId !== undefined,
  });
}
export function useRewardClaimed(
  token?: Address,
  epochId?: bigint,
  account?: Address,
) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain(
      "reward-claimed",
      token?.toLowerCase(),
      epochId,
      account?.toLowerCase(),
    ),
    queryFn: () => reads.rewardClaimed(token!, epochId!, account!),
    enabled: !!token && epochId !== undefined && !!account,
  });
}
export function useTokenBalance(token?: Address, account?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain(
      "balance",
      token?.toLowerCase(),
      account?.toLowerCase(),
    ),
    queryFn: () => reads.tokenBalance(token!, account!),
    enabled: !!token && !!account,
  });
}
export function useAllowance(
  token?: Address,
  owner?: Address,
  spender?: Address,
) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain(
      "allowance",
      token?.toLowerCase(),
      owner?.toLowerCase(),
      spender?.toLowerCase(),
    ),
    queryFn: () => reads.allowance(token!, owner!, spender!),
    enabled: !!token && !!owner && !!spender,
  });
}
export function useTokenInfo(token?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("token-info", token?.toLowerCase()),
    queryFn: () => reads.tokenInfo(token!),
    enabled: !!token,
  });
}
export function useV4Adapter(token?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("v4-adapter", token?.toLowerCase()),
    queryFn: () => reads.v4Adapter(token!),
    enabled: !!token,
  });
}
export function useInputAdapterAllowed(adapter?: Address) {
  const { reads } = useRovoContext();
  return useQuery({
    queryKey: rovoKeys.chain("input-adapter", adapter?.toLowerCase()),
    queryFn: () => reads.inputAdapterAllowed(adapter!),
    enabled: !!adapter,
  });
}
