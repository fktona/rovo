import { NATIVE_MINT } from "@solana/spl-token";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { PublicKey } from "@solana/web3.js";
import { creatorFeeLabel, type PumpQuoteSource } from "@/lib/pump/fees";
import { getNetwork } from "@/lib/raydium/launch-shared";
import { launchPairs } from "@/lib/raydium/pairs";

export async function GET() {
  const creator = feeWallet();
  if (!creator.ok) {
    return Response.json({ error: creator.error }, { status: 503 });
  }
  try {
    const online = new OnlinePumpSdk(getNetwork().connection);
    const balances = await online.getCreatorVaultQuoteBalances(creator.wallet);
    const waiting = balances.filter((row) => !row.total.isZero());
    const quotes = await Promise.all(
      waiting.map(async (row) => {
        const resolved = await online.resolveQuoteMint(row.mint);
        const source = quoteSource(row.source);
        return {
          mint: row.mint.toBase58(),
          symbol: symbolForMint(row.mint),
          source,
          feeLabel: creatorFeeLabel(source),
          decimals: resolved.decimals,
          pump: row.pumpVault.toString(),
          pumpswap: row.ammVault.toString(),
          total: row.total.toString(),
        };
      }),
    );
    quotes.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return Response.json({ wallet: creator.wallet.toBase58(), quotes });
  } catch (error) {
    console.error("Unable to read Pump creator fees", error);
    return Response.json(
      { error: "Unable to read Pump creator fees" },
      { status: 502 },
    );
  }
}

function feeWallet():
  | { ok: true; wallet: PublicKey }
  | { ok: false; error: string } {
  const value = process.env.NEXT_PUBLIC_PUMP_FEE_WALLET?.trim();
  console.log("value", value);
  if (!value) return { ok: false, error: "Pump fee vault is not configured." };
  try {
    return { ok: true, wallet: new PublicKey(value) };
  } catch {
    return { ok: false, error: "Pump fee vault is not a Solana address." };
  }
}

function quoteSource(value: string): PumpQuoteSource {
  if (value === "sol" || value === "global" || value === "quoteControl") return value;
  return "quoteControl";
}

function symbolForMint(mint: PublicKey) {
  const id = mint.toBase58();
  return (
    launchPairs.find((pair) => pair.mint === id)?.symbol ??
    (mint.equals(NATIVE_MINT) ? "SOL" : id.slice(0, 4))
  );
}
