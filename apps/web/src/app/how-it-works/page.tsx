import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works | TryFolio",
  description: "Launch and trade tokens on Pump, on Solana mainnet.",
};

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-foreground sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">How it works</h1>
      <p className="mt-3 text-base leading-7 text-muted">
        TryFolio launches creator profiles and meme tokens on Pump, on Solana
        mainnet. A profile token uses an X account’s name and photo. A meme
        token does not. You sign the launch with a Solana wallet.
      </p>
      <ol className="mt-8 list-decimal space-y-4 pl-5 text-[15px] leading-7 text-muted">
        <li>
          <strong className="text-foreground">Tokenize your X profile.</strong> Log
          in, link the X account you own, pick a Pump quote, and confirm the
          launch in your Solana wallet. An optional first buy is paid in SOL.
          If the quote is not SOL, that SOL is swapped into the quote first.
          If you leave it blank, the transaction only creates the coin.
        </li>
        <li>
          <strong className="text-foreground">Tokenize another creator.</strong> A
          Solana wallet is enough. Search their X account, pick a quote, and
          launch their profile on Pump.
        </li>
        <li>
          <strong className="text-foreground">Launch a meme token.</strong> This
          track uses a Solana wallet and is not tied to an X profile. Add an
          image, name, and ticker, then confirm the launch.
        </li>
        <li>
          <strong className="text-foreground">Trade.</strong> The token page buys
          with SOL and sells on the Pump bonding curve. If the quote is not SOL,
          the buy swaps SOL into that quote first. After the coin graduates,
          trades move to its PumpSwap pool.
        </li>
      </ol>
      <p className="mt-8 text-[15px] leading-7 text-muted">
        Creator fees accrue in the fee vault. SOL and USDC use Pump’s creator
        schedule. Any other quote locks a 2% creator fee. Pump keeps its own
        protocol fee.
      </p>
      <p className="mt-6">
        <Link href="/docs" className="text-accent underline">
          Read the full guide
        </Link>
      </p>
    </main>
  );
}
