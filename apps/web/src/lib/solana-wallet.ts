import type { SolanaStandardWallet } from "@privy-io/react-auth/solana";

export function preferredSolanaWallet<
  T extends { standardWallet: { name: string } },
>(wallets: readonly T[]) {
  return (
    wallets.find((wallet) => !isPrivyWalletName(wallet.standardWallet.name)) ??
    wallets[0]
  );
}

export function hasExternalSolanaWallet(
  wallets: readonly { name: string }[],
) {
  return wallets.some((wallet) => !isPrivyWalletName(wallet.name));
}

export async function connectExternalSolanaWallet(
  wallets: readonly SolanaStandardWallet[],
) {
  const wallet = externalSolanaWallet(wallets);
  const connect = wallet?.features["standard:connect"]?.connect;
  if (!wallet || !connect) return false;
  await connect();
  return true;
}

function externalSolanaWallet(wallets: readonly SolanaStandardWallet[]) {
  return (
    wallets.find((wallet) => /metamask/i.test(wallet.name)) ??
    wallets.find((wallet) => !isPrivyWalletName(wallet.name))
  );
}

function isPrivyWalletName(name: string) {
  return /privy/i.test(name);
}
