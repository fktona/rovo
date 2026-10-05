"use client";

import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { isAdminWallet } from "@/lib/admin-wallet";

export function useIsAdmin() {
  const { wallets, user } = useRovoIdentity();
  const address = wallets[0]?.address ?? user?.wallet?.address;
  return isAdminWallet(address);
}
