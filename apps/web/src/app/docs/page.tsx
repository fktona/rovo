import type { Metadata } from "next";
import Link from "next/link";
import { isAddress } from "viem";
import { RovoWordmark } from "@/components/home/assets";
import { robinhoodChain } from "@/lib/chain";

export const metadata: Metadata = {
  title: "How to use Rovo | Rovo Docs",
  description: "Learn how to launch, scout, buy, and earn on Rovo.",
};

const nav: { group: string; items: [string, string][] }[] = [
  { group: "Use Rovo", items: [["Welcome", "overview"], ["Launch yourself", "self-rove"], ["Scout a profile", "scout"], ["Buy a token", "buy"]] },
  { group: "Economics", items: [["Who earns what", "earnings"], ["Claim a Scout token", "claim-profile"], ["Get paid", "payouts"], ["Holder rewards", "holder-rewards"], ["X Money route", "treasury-route"], ["How fees move", "fee-flow"]] },
  { group: "Reference", items: [["What works today", "availability"], ["Contract addresses", "addresses"]] },
];

const addressRows = [
  ["RovoFactoryWrapper", "NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS", "ROVO_FACTORY_WRAPPER_ADDRESS"],
  ["RovoRegistry", "NEXT_PUBLIC_ROVO_REGISTRY_ADDRESS", "ROVO_REGISTRY_ADDRESS"],
  ["RovoFeeSplitter", "NEXT_PUBLIC_ROVO_SPLITTER_ADDRESS", "ROVO_SPLITTER_ADDRESS"],
  ["LaunchFeeCollectorFactory", "ROVO_COLLECTOR_FACTORY_ADDRESS"],
  ["PlatformFeeReservoir", "ROVO_RESERVOIR_ADDRESS"],
  ["NottinghamVault", "NEXT_PUBLIC_ROVO_NOTTINGHAM_ADDRESS", "ROVO_NOTTINGHAM_ADDRESS"],
  ["HolderRewardDistributor", "NEXT_PUBLIC_ROVO_HOLDER_REWARDS_ADDRESS", "ROVO_HOLDER_REWARDS_ADDRESS"],
  ["RovoZapRouter", "NEXT_PUBLIC_ROVO_ZAP_ROUTER_ADDRESS", "ROVO_ZAP_ROUTER_ADDRESS"],
  ["UniswapV3StockAdapter", "ROVO_UNISWAP_STOCK_ADAPTER_ADDRESS"],
  ["X Money wallet", "ROVO_TREASURY_ADDRESS"],
  ["Pons factory", "PONS_FACTORY_ADDRESS"],
  ["Pons fee escrow", "PONS_FEE_ESCROW_ADDRESS"],
  ["Pons launch and buy", "PONS_LAUNCH_AND_BUY_ADDRESS"],
] as const;

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

export default function DocsPage() {
  const addresses = addressRows.flatMap(([name, ...envNames]) => {
    const source = envNames.find((key) => isAddress(process.env[key] ?? ""));
    return source ? [{ name, address: process.env[source]! }] : [];
  });

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
        <div className="mb-4 inline-flex rounded-full border border-accent-border bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Your guide to Rovo · Raydium Launchpad</div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Make a market around a profile</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Launch your own profile token, discover someone else through Scout, or launch a meme token. New tokens are created on Raydium Launchpad and signed with a Solana wallet.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href="/launch" className="rounded-xl border border-accent-border bg-accent-soft p-4 text-sm font-semibold text-accent hover:border-accent">Launch a token <span aria-hidden="true">↗</span></Link>
          <Link href="/" className="rounded-xl border border-foreground/10 bg-surface p-4 text-sm font-semibold hover:border-accent">Explore tokens <span aria-hidden="true">↗</span></Link>
          <Link href="/rewards" className="rounded-xl border border-foreground/10 bg-surface p-4 text-sm font-semibold hover:border-accent">View rewards <span aria-hidden="true">↗</span></Link>
        </div>

        <Section id="overview" eyebrow="01 / Use Rovo" title="Welcome">
          <p>Rovo lets people launch tokens tied to X profiles. Choose <strong className="text-foreground">Your X profile</strong> to launch the account you own, or <strong className="text-foreground">Another creator</strong> to launch a token for a profile that has not launched yet. The token is paired with a Solana asset, such as SOL, an xStock, or a stablecoin. Meme tokens are a separate wallet-only track and are not tied to an X account.</p>
          <p>Launch uses Raydium Launchpad. Log in and use a Solana wallet — Privy can create one if you do not already have one. Profile launches use the X photo as the token image. An optional first buy is paid in SOL. If the pair is not SOL, that SOL is swapped into the pair token before the launch. The ticker can be at most 10 characters.</p>
        </Section>

        <Section id="self-rove" eyebrow="02 / Use Rovo" title="Launch yourself">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open <Link href="/launch" className="text-accent underline">Launch</Link> and choose <strong className="text-foreground">Your X profile</strong>.</li>
            <li>Log in, create or connect a Solana wallet, and verify the X profile you own.</li>
            <li>Choose the Solana asset this token trades against.</li>
            <li>Optionally enter a first buy in SOL, then confirm the Raydium transaction in your wallet.</li>
          </ol>
          <p>Your profile is the token name and image. Raydium creates the mint and the launchpad curve. The app shows the mint after the transaction confirms and links it on Solscan.</p>
        </Section>

        <Section id="scout" eyebrow="03 / Use Rovo" title="Scout a profile">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open <Link href="/launch" className="text-accent underline">Launch</Link> and choose <strong className="text-foreground">Another creator</strong>.</li>
            <li>Log in and connect a Solana wallet. Your own X account is not required.</li>
            <li>Search for the X profile you want to scout and select the correct account.</li>
            <li>Choose the Solana quote asset, review any optional SOL first buy, then confirm the Raydium transaction.</li>
          </ol>
          <p>The token uses that profile’s name and photo. You are the wallet that signs the launch.</p>
        </Section>

        <Section id="buy" eyebrow="04 / Use Rovo" title="Buy a profile token">
          <p>A new launch is a Solana mint. The success dialog opens that mint on Solscan. Buying it inside the Rovo token page is not part of the Raydium launch. The token page still describes the earlier Robinhood Chain markets.</p>
        </Section>

        <Section id="earnings" eyebrow="05 / Economics" title="Who earns what">
          <p>Raydium Launchpad charges its own trading fees on the new curve. Creator fees on these launches are collected in the quote token. The percentage table below is the previous Rovo contract route on Robinhood Chain. A Raydium launch does not send fees through that splitter, the Nottingham vault, or the holder-reward contract.</p>
          <DataTable headers={["Launch", "Profile owner", "Rover", "Holders", "Platform"]} rows={[
            ["Self-Rove", "70%", "—", "20%", "10%"],
            ["Scout, not yet claimed", "60% held for owner", "15%", "15%", "10%"],
            ["Scout, claimed", "60%", "15%", "15%", "10%"],
            ["Scout, still unclaimed after 60 days", "No share from new fee batches", "15%", "45%", "40%"],
          ]} />
          <p>For example, if a Self-Rove collector receives 100 units and the normal route is selected, 70 units go to the creator allocation, 20 to holder rewards, and 10 to the platform allocation. On a Scout launch, the Rover’s 15% remains theirs after the profile owner claims.</p>
          <p>After claiming, a profile owner can choose to share some of their creator allocation with holders. That choice affects future distributions only. Small rounding remainders also go to holders.</p>
        </Section>

        <Section id="claim-profile" eyebrow="06 / Economics" title="Claim a token scouted for you">
          <p>If someone launched a Scout token for your X profile, your creator share from normal fee distributions is held in the Nottingham vault. To claim it, link that X account to your Rovo login, open the token page, and go to <strong className="text-foreground">Details → Nottingham creator vault</strong>.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Select <strong className="text-foreground">Initiate claim</strong> and confirm in your wallet.</li>
            <li>Wait through the required claim delay.</li>
            <li>Select <strong className="text-foreground">Finalize claim</strong> when available. The vault balance is paid to the verified wallet and the token is marked claimed.</li>
          </ol>
          <p>If the token remains unclaimed for 60 days, new normal-route fees use the 45% holder / 40% platform / 15% Rover split. Amounts already held in the vault are not moved by that change; they remain available for a valid claim.</p>
        </Section>

        <Section id="payouts" eyebrow="07 / Economics" title="When do creator and Rover fees become payable?">
          <p>Fee shares build up only after trading fees are collected and the admin chooses the normal sharing route. The creator and Rover shares are recorded for their wallets on-chain; they are not sent to the wallet automatically.</p>
          <p>The <strong className="text-foreground">Claim</strong> button on the current Profile page is disabled. The Profile and Rewards pages may show estimated shares, but those figures do not mean a withdrawal is ready in the app. An eligible creator or Rover can withdraw their recorded balance through the splitter contract with a compatible wallet tool. A future app update may bring that withdrawal into Rovo.</p>
          <p>The Scout profile owner’s earlier, unclaimed allocation follows the separate <a href="#claim-profile" className="text-accent underline">Nottingham claim</a> process above.</p>
        </Section>

        <Section id="holder-rewards" eyebrow="08 / Economics" title="Claim holder rewards">
          <p>Normal fee distributions fund a holder reward pool for each profile token. Rewards become claimable only after an eligibility snapshot is published. Holding a token does not by itself mean that a claim is available today.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Connect the wallet that held the token and open that token’s page.</li>
            <li>Choose the <strong className="text-foreground">Rewards</strong> tab.</li>
            <li>If a reward appears for your wallet, select <strong className="text-foreground">Claim reward</strong> and confirm the transaction.</li>
          </ol>
          <p>If the page says there are no published claims, there is currently nothing for that wallet to claim through the app. Rewards are paid in the token’s pair asset, which may be ETH or an ERC-20 token.</p>
        </Section>

        <Section id="treasury-route" eyebrow="09 / Economics" title="What if fees go to X Money?">
          <p>A Rovo admin can send an entire batch of available fees directly to the configured X Money wallet. This is the route Rovo is using during the contract audit. That batch does <strong className="text-foreground">not</strong> create creator, Rover, holder, or platform pool allocations on-chain.</p>
          <p>The choice applies to that batch, not permanently to the token. Later fees may follow a different route. Any payments made from X Money afterward are manual and separate from the normal on-chain split. Check actual fee activity and payments when evaluating what has been distributed.</p>
        </Section>

        <Section id="fee-flow" eyebrow="10 / Economics" title="How fees move">
          <div className="rounded-xl border border-warning-border bg-warning-soft px-5 py-4 text-sm leading-6 text-warning" role="note"><strong className="mb-1 block text-base text-foreground">Raydium launches</strong>New tokens are created on Raydium Launchpad. Trading fees on those curves stay in Raydium. The flow below is the previous Robinhood Chain contract route and does not run for a Raydium mint.</div>
          <div className="rounded-xl border border-foreground/10 bg-surface p-5 text-sm leading-8 text-foreground">Trading on a profile token <span className="text-accent">→</span> fees become claimable <span className="text-accent">→</span> Rovo admin chooses a route<br /><span className="pl-4">During audit: the full batch goes to the X Money wallet for manual allocation</span><br /><span className="pl-4">Normal sharing: creator or vault · Rover · holders · platform</span></div>
          <p>Pons takes its protocol share first. Rovo can allocate only the creator-side fees it receives. Those fees stay unallocated until an admin claims them from Pons and chooses a route. That is why trading activity, visible estimates, and a withdrawable balance can be different amounts.</p>
          <p>Sending a batch to X Money does not credit the normal on-chain shares. Any payment from that wallet is handled separately. The admin chooses the route for each batch, so check actual fee activity before treating an estimated share as payable.</p>
        </Section>

        <Section id="availability" eyebrow="11 / Reference" title="What works in the app today">
          <DataTable headers={["Action", "Current experience"]} rows={[
            ["Launch Self-Rove, Scout, or a meme", "Available with a Solana wallet. The token is created on Raydium Launchpad."],
            ["Buy a Raydium launch inside Rovo", "Not available. Open the mint on Solscan from the launch confirmation."],
            ["Claim a Scout profile", "Applies to earlier Robinhood Chain launches, from the token’s Details tab after the claim delay."],
            ["Claim holder rewards", "Applies to earlier launches, from the token’s Rewards tab when a claim has been published."],
            ["Withdraw creator or Rover fees", "The previous splitter balance. The Profile Claim button is currently disabled."],
            ["Sell or view live price quotes", "Not currently available in the app."],
            ["Platform buyback and burn", "Planned, but no automatic buyback executor is in the current contracts."],
          ]} />
        </Section>

        <Section id="addresses" eyebrow="12 / Reference" title="Contract addresses">
          <p>New launches do not use these contracts. The addresses below are the previous Rovo deployment on Robinhood Chain. Check an address on-chain before using it.</p>
          <DataTable headers={["Contract / wallet", "Address"]} rows={addresses.map(({ name, address }) => [name, <a key={name} className="break-all font-mono text-accent underline underline-offset-2" href={'' + robinhoodChain.blockExplorers.default.url + '/address/' + address} target="_blank" rel="noreferrer">{address}</a>])} />
          <p>The token page’s <strong className="text-foreground">Details</strong> tab shows the profile token, pair asset, and fee collector for that specific launch.</p>
        </Section>
      </article>

      <aside className="hidden border-l border-foreground/10 px-5 py-14 xl:block">
        <p className="sticky top-6 text-xs font-bold uppercase tracking-[.16em] text-muted">On this page</p>
        <div className="sticky top-14 mt-5 space-y-2 text-sm text-muted">{nav.flatMap((group) => group.items).map(([label, id]) => <a className="block hover:text-foreground" key={id} href={`#${id}`}>{label}</a>)}</div>
      </aside>
    </div>
  </main>;
}
