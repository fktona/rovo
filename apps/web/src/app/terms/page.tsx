import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Rovo",
  description: "Terms for using the Rovo app on Solana.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-foreground sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted">Last updated 3 October 2026</p>
      <div className="mt-8 space-y-5 text-[15px] leading-7 text-muted">
        <p>
          Rovo is an interface for launching and trading tokens on Solana
          mainnet through Pump and PumpSwap. Using the app means you submit
          your own wallet transactions. You are responsible for the wallet you
          connect, the fees you pay, and the tokens you launch or buy.
        </p>
        <p>
          Nothing in the app is financial, legal, or investment advice. Token
          prices can move to zero. Profile tokens are tied to public X
          accounts; they are not issued by those accounts unless the owner
          launched them. Meme tokens are not tied to an X profile.
        </p>
        <p>
          Creator fees from coins launched on Rovo accrue in the fee vault.
          Amounts on the Rewards page are uncollected balances. They are not a
          payment to the wallet that launched the coin, and collecting them is
          a separate transaction.
        </p>
        <p>
          The software and the programs it calls can have bugs. Transactions
          cannot be reversed once they are confirmed. You use Rovo at your own
          risk.
        </p>
      </div>
    </main>
  );
}
