import { PublicKey } from "@solana/web3.js";
import { TokenPage } from "@/components/token/token-page";

function isSolanaMint(value: string) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

export default async function TokenAddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!isSolanaMint(address)) {
    return (
      <main className="px-6 py-16 text-foreground">
        <p>This token address is not a Solana mint.</p>
      </main>
    );
  }
  return <TokenPage token={address} />;
}
