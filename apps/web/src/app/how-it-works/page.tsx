import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works | Rovo",
  description: "Launch a profile token, scout a creator, or trade on Robinhood Chain.",
};

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-white sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">How it works</h1>
      <p className="mt-3 text-base leading-7 text-[#bababa]">
        Rovo is a market for creator profiles and, separately, meme tokens on
        Robinhood Chain. A profile token uses an X account’s name and photo.
        A meme token does not.
      </p>
      <ol className="mt-8 list-decimal space-y-4 pl-5 text-[15px] leading-7 text-[#bababa]">
        <li>
          <strong className="text-white">Tokenize your X profile.</strong> Log
          in, link the X account you own, pick a trading pair, and confirm the
          launch in your wallet.
        </li>
        <li>
          <strong className="text-white">Tokenize another creator.</strong> A
          wallet is enough. Search their X account and launch their profile
          market. You earn a percentage of their fees when the normal sharing
          route is used.
        </li>
        <li>
          <strong className="text-white">Launch a meme token.</strong> This
          track is wallet-only and is not tied to an X profile.
        </li>
        <li>
          <strong className="text-white">Trade.</strong> Open a token, spend
          its pair asset, and set a minimum amount you will accept.
        </li>
      </ol>
      <p className="mt-8 text-[15px] leading-7 text-[#bababa]">
        During the contract audit, fees Rovo collects are sent to the X Money
        wallet for manual allocation. Those transfers do not automatically
        credit creator, scout, or holder shares on-chain. The percentage split
        applies when a batch uses the normal sharing route.
      </p>
      <p className="mt-6">
        <Link href="/docs" className="text-[#ccff00] underline">
          Read the full guide
        </Link>
      </p>
    </main>
  );
}
