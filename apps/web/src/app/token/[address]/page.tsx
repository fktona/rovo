import { isAddress } from "viem";
import { TokenPage } from "@/components/token/token-page";

export default async function TokenAddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!isAddress(address)) {
    return (
      <main className="px-6 py-16 text-white">
        <p>This token address is not valid.</p>
      </main>
    );
  }
  return <TokenPage token={address} />;
}
