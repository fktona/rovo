import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works | Rovo",
  description: "Launch a profile or meme token on Raydium Launchpad.",
};

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-foreground sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">How it works</h1>
      <p className="mt-3 text-base leading-7 text-muted">
        Rovo launches creator profiles and meme tokens on Raydium Launchpad.
        A profile token uses an X account’s name and photo. A meme token does
        not. The launch signs with a Solana wallet.
      </p>
      <ol className="mt-8 list-decimal space-y-4 pl-5 text-[15px] leading-7 text-muted">
        <li>
          <strong className="text-foreground">Tokenize your X profile.</strong> Log
          in, link the X account you own, pick a Solana quote token, and confirm
          the Raydium launch in your Solana wallet. An optional first buy is
          paid in SOL.
        </li>
        <li>
          <strong className="text-foreground">Tokenize another creator.</strong> A
          Solana wallet is enough. Search their X account, pick a quote token,
          and launch their profile on Raydium.
        </li>
        <li>
          <strong className="text-foreground">Launch a meme token.</strong> This
          track uses a Solana wallet and is not tied to an X profile. Add an
          image, name, and ticker, then confirm the Raydium launch.
        </li>
        <li>
          <strong className="text-foreground">Trade.</strong> A finished launch
          opens on Solscan. Buying that mint inside Rovo is separate from the
          Raydium launch.
        </li>
      </ol>
      <p className="mt-8 text-[15px] leading-7 text-muted">
        Raydium collects launchpad trading fees on the new token. The previous
        Robinhood Chain splitter, Nottingham vault, and holder-reward
        contracts are not part of this launch.
      </p>
      <p className="mt-6">
        <Link href="/docs" className="text-accent underline">
          Read the full guide
        </Link>
      </p>
    </main>
  );
}
