import type { Metadata } from "next";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { RovoWordmark } from "@/components/home/assets";

export const metadata: Metadata = {
  title: "How to use TryFolio | TryFolio Docs",
  description: "Learn how to launch and trade tokens on Pump, on Solana mainnet.",
};

const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PUMPSWAP_PROGRAM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";

const nav: { group: string; items: [string, string][] }[] = [
  { group: "Use TryFolio", items: [["Welcome", "overview"], ["Launch yourself", "self-rove"], ["Scout a profile", "scout"], ["Buy and sell", "buy"]] },
  { group: "Economics", items: [["Who earns what", "earnings"], ["Fee vault", "fee-vault"], ["Graduation", "graduation"]] },
  { group: "Reference", items: [["What works today", "availability"], ["Addresses", "addresses"]] },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24 border-b border-foreground/10 py-12 first:pt-0 last:border-0">
    <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-accent">{eyebrow}</p>
    <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
    <div className="mt-6 space-y-5 text-[15px] leading-7 text-muted">{children}</div>
  </section>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="overflow-x-auto rounded-xl border border-foreground/10">
    <table className="w-full min-w-[580px] border-collapse text-left text-sm">
      <thead className="bg-surface text-foreground"><tr>{headers.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} className="border-t border-foreground/10 align-top">{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

function solscan(address: string) {
  return `https://solscan.io/account/${address}`;
}

export default function DocsPage() {
  const feeVault = feeVaultAddress();
  const addresses: [string, string][] = [
    ["Pump", PUMP_PROGRAM],
    ["PumpSwap", PUMPSWAP_PROGRAM],
  ];
  if (feeVault) addresses.push(["Fee vault", feeVault]);

  return <main className="min-h-full bg-surface text-foreground">
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-foreground/10 bg-surface/95 px-5 backdrop-blur sm:px-9">
      <a href="/docs" className="flex items-center gap-3 text-lg font-bold tracking-tight">
        <RovoWordmark />
        Docs
      </a>
      <Link href="/" className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium text-muted hover:border-accent hover:text-foreground">Back to app ↗</Link>
    </header>
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[250px_minmax(0,1fr)_190px]">
      <aside className="border-b border-foreground/10 bg-surface px-5 py-7 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <nav aria-label="Documentation" className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:block lg:space-y-7">
          {nav.map((section) => <div key={section.group}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-muted">{section.group}</p>
            <ul className="space-y-1">{section.items.map(([label, id]) => <li key={id}><a className="block rounded-md px-2 py-1.5 text-sm text-muted hover:bg-foreground/5 hover:text-foreground" href={`#${id}`}>{label}</a></li>)}</ul>
          </div>)}
        </nav>
      </aside>

      <article className="min-w-0 px-5 py-10 sm:px-9 lg:px-12 lg:py-14">
        <div className="mb-4 inline-flex rounded-full border border-accent-border bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Solana mainnet · Pump</div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Launch and trade on Pump</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Launch your own profile token, launch a token for another creator, or launch a meme. Every coin is created on Pump and signed with a Solana wallet.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href="/launch" className="rounded-xl border border-accent-border bg-accent-soft p-4 text-sm font-semibold text-accent hover:border-accent">Launch a token <span aria-hidden="true">↗</span></Link>
          <Link href="/" className="rounded-xl border border-foreground/10 bg-surface p-4 text-sm font-semibold hover:border-accent">Explore tokens <span aria-hidden="true">↗</span></Link>
          <Link href="/rewards" className="rounded-xl border border-foreground/10 bg-surface p-4 text-sm font-semibold hover:border-accent">View rewards <span aria-hidden="true">↗</span></Link>
        </div>

        <Section id="overview" eyebrow="01 / Use TryFolio" title="Welcome">
          <p>TryFolio lets people launch tokens on Solana mainnet. Choose <strong className="text-foreground">Your X profile</strong> to launch the account you own, or <strong className="text-foreground">Another creator</strong> to launch a token for a profile. The quote is one of Pump’s allowed assets: SOL, USDC, or another mint Pump lists. Meme tokens are a separate wallet-only track and are not tied to an X account.</p>
          <p>Log in and use a Solana wallet. Privy can create one if you do not already have one. Profile launches use the X photo as the token image. An optional first buy is paid in SOL. If the quote is not SOL, that SOL is swapped into the quote before the coin is created. Leave the buy blank to create the coin without buying it.</p>
        </Section>

        <Section id="self-rove" eyebrow="02 / Use TryFolio" title="Launch yourself">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open <Link href="/launch" className="text-accent underline">Launch</Link> and choose <strong className="text-foreground">Your X profile</strong>.</li>
            <li>Log in, create or connect a Solana wallet, and link the X profile you own.</li>
            <li>Choose the quote this token trades against.</li>
            <li>Optionally enter a first buy in SOL. If the quote is not SOL, confirm the swap, then confirm the Pump transaction.</li>
          </ol>
          <p>Your profile is the token name and image. Pump creates the mint and the bonding curve. The success dialog opens the mint on Solscan.</p>
        </Section>

        <Section id="scout" eyebrow="03 / Use TryFolio" title="Launch another creator">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open <Link href="/launch" className="text-accent underline">Launch</Link> and choose <strong className="text-foreground">Another creator</strong>.</li>
            <li>Log in and connect a Solana wallet. Your own X account is not required.</li>
            <li>Search for the X profile and select the correct account.</li>
            <li>Choose the quote, review any optional SOL first buy, then confirm the swap and the Pump transaction.</li>
          </ol>
          <p>The token uses that profile’s name and photo. You are the wallet that signs the launch. Creator fees from the coin still accrue in the fee vault.</p>
        </Section>

        <Section id="buy" eyebrow="04 / Use TryFolio" title="Buy and sell">
          <p>Open a coin from the home page or from a launch. The token page quotes a buy or sell on the Pump bonding curve while the coin is still on the curve. After it graduates and the PumpSwap pool is open, the same page trades that pool.</p>
          <p>A buy is paid in SOL. If the coin’s quote is not SOL, that SOL is swapped into the quote first, then used to buy. A sell pays the coin and receives its quote.</p>
        </Section>

        <Section id="earnings" eyebrow="05 / Economics" title="Who earns what">
          <p>Pump charges its own protocol fee on every trade. The creator fee is separate and accrues in the fee vault, which is the creator on every TryFolio launch. It is not paid to the wallet that signed the launch.</p>
          <DataTable headers={["Quote", "Creator fee", "Where it accrues"]} rows={[
            ["SOL", "Pump’s creator schedule", "Fee vault"],
            ["USDC", "Pump’s creator schedule", "Fee vault"],
            ["Any other Pump quote", "2%", "Fee vault"],
          ]} />
          <p>A custom quote can use 2% only while Pump allows a configurable creator fee and 2% is inside Pump’s cap. SOL and USDC ignore that setting and keep Pump’s schedule.</p>
        </Section>

        <Section id="fee-vault" eyebrow="06 / Economics" title="Fee vault">
          <p>Uncollected creator fees sit in the fee vault, one balance per quote. The Pump curve balance is from coins still on the bonding curve. The PumpSwap balance is from coins that have graduated. <Link href="/rewards" className="text-accent underline">Rewards</Link> reads both.</p>
          <p>Those balances are waiting. Collecting them is a separate transaction and is not available in the app yet.</p>
        </Section>

        <Section id="graduation" eyebrow="07 / Economics" title="When a coin moves to PumpSwap">
          <p>A coin graduates when a buy takes the last of its real token reserves and Pump marks the curve complete. Trading on the curve stops. A separate migration transaction then opens the canonical PumpSwap pool. Until that transaction lands, the token page says the pool is not open yet.</p>
        </Section>

        <Section id="availability" eyebrow="08 / Reference" title="What works in the app today">
          <DataTable headers={["Action", "Current experience"]} rows={[
            ["Launch a profile or a meme", "Available with a Solana wallet. The coin is created on Pump, on Solana mainnet."],
            ["Buy or sell", "Available on the token page. Curve until graduation, then PumpSwap."],
            ["See uncollected creator fees", "Rewards reads the fee vault for each quote."],
            ["Collect creator fees", "Not available in the app. The balances stay in the fee vault until a collect transaction."],
          ]} />
        </Section>

        <Section id="addresses" eyebrow="09 / Reference" title="Addresses">
          <p>Launches and trades use Pump and PumpSwap on Solana mainnet. The fee vault is the creator address on every TryFolio coin.</p>
          {feeVault ? null : <p>The fee vault address is not configured in this app yet.</p>}
          <DataTable headers={["Account", "Address"]} rows={addresses.map(([name, address]) => [name, <a key={name} className="break-all font-mono text-accent underline underline-offset-2" href={solscan(address)} target="_blank" rel="noreferrer">{address}</a>])} />
        </Section>
      </article>

      <aside className="hidden border-l border-foreground/10 px-5 py-14 xl:block">
        <p className="sticky top-6 text-xs font-bold uppercase tracking-[.16em] text-muted">On this page</p>
        <div className="sticky top-14 mt-5 space-y-2 text-sm text-muted">{nav.flatMap((group) => group.items).map(([label, id]) => <a className="block hover:text-foreground" key={id} href={`#${id}`}>{label}</a>)}</div>
      </aside>
    </div>
  </main>;
}

function feeVaultAddress() {
  const value = process.env.NEXT_PUBLIC_PUMP_FEE_WALLET?.trim();
  if (!value) return null;
  try {
    return new PublicKey(value).toBase58();
  } catch {
    return null;
  }
}
