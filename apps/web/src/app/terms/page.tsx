import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Rovo",
  description: "Terms for using the Rovo app on Robinhood Chain.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-foreground sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted">Last updated 27 September 2026</p>
      <div className="mt-8 space-y-5 text-[15px] leading-7 text-muted">
        <p>
          Rovo is an interface for launching and trading tokens on Robinhood
          Chain. Using the app means you submit your own wallet transactions.
          You are responsible for the wallet you connect, the gas you pay, and
          the tokens you launch or buy.
        </p>
        <p>
          Nothing in the app is financial, legal, or investment advice. Token
          prices can move to zero. Profile tokens are tied to public X
          accounts; they are not issued by those accounts unless the owner
          launched or claimed them. Meme tokens are not tied to an X profile.
        </p>
        <p>
          During the contract audit, fees the protocol collects may be sent to
          the X Money wallet. That transfer does not by itself pay creators,
          scouts, or holders. Later payments from that wallet are manual and
          separate from an on-chain split. Estimated shares in the app are not
          a promise of payment.
        </p>
        <p>
          The software and the contracts it calls can have bugs. Transactions
          cannot be reversed once they are confirmed. You use Rovo at your own
          risk.
        </p>
      </div>
    </main>
  );
}
