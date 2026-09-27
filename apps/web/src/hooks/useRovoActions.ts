"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { createRovoActions } from "../lib/contracts/actions";
import { useRovoContext } from "../providers/RovoProviders";
import { useRovoIdentity } from "./useRovoIdentity";

export function useRovoActions(walletAddress?: Address) {
  const context = useRovoContext();
  const { publicClient, api } = context;
  const addresses = context.config.addresses;
  const { wallets: evm, getAccessToken } = useRovoIdentity();
  const wallet = walletAddress
    ? evm.find(
        (item) => item.address.toLowerCase() === walletAddress.toLowerCase(),
      )
    : evm.length === 1
      ? evm[0]
      : undefined;
  return wallet
    ? createRovoActions({
        wallet,
        client: publicClient,
        addresses,
        api,
        getAccessToken,
      })
    : null;
}

export function useRovoTransaction<T>(
  run: (
    actions: NonNullable<ReturnType<typeof useRovoActions>>,
    input: T,
  ) => Promise<unknown>,
  walletAddress?: Address,
) {
  const actions = useRovoActions(walletAddress);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      if (!actions) throw new Error("Connect or select one EVM wallet first");
      return run(actions, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rovo"] });
    },
  });
}
