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
  return <section id={id} className="scroll-mt-24 border-b border-white/10 py-12 first:pt-0 last:border-0">
    <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#adcf36]">{eyebrow}</p>
    <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
    <div className="mt-6 space-y-5 text-[15px] leading-7 text-[#bababa]">{children}</div>
  </section>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-[#647b2a] bg-[#202713] px-5 py-4 text-[#e6efcb]">{children}</div>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="overflow-x-auto rounded-xl border border-white/10">
    <table className="w-full min-w-[580px] border-collapse text-left text-sm">
      <thead className="bg-[#1e1e1e] text-white"><tr>{headers.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} className="border-t border-white/10 align-top">{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export default function DocsPage() {
  const addresses = addressRows.flatMap(([name, ...envNames]) => {
    const source = envNames.find((key) => isAddress(process.env[key] ?? ""));
    return source ? [{ name, address: process.env[source]! }] : [];
  });

  return <main className="min-h-full bg-[#101110] text-white">
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/10 bg-[#111311]/95 px-5 backdrop-blur sm:px-9">
      <a href="/docs" className="flex items-center gap-3 text-lg font-bold tracking-tight">
        <RovoWordmark />
        Docs
      </a>
      <Link href="/" className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-[#d4d8d0] hover:border-[#ccff00] hover:text-white">Back to app ↗</Link>
    </header>
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[250px_minmax(0,1fr)_190px]">
      <aside className="border-b border-white/10 bg-[#151715] px-5 py-7 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <nav aria-label="Documentation" className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:block lg:space-y-7">
          {nav.map((section) => <div key={section.group}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#838a80]">{section.group}</p>
            <ul className="space-y-1">{section.items.map(([label, id]) => <li key={id}><a className="block rounded-md px-2 py-1.5 text-sm text-[#b9bdb6] hover:bg-white/5 hover:text-white" href={`#${id}`}>{label}</a></li>)}</ul>
          </div>)}
        </nav>
      </aside>

      <article className="min-w-0 px-5 py-10 sm:px-9 lg:px-12 lg:py-14">
        <div className="mb-4 inline-flex rounded-full border border-[#596c2e] bg-[#232b18] px-3 py-1 text-xs font-semibold text-[#d6f584]">Your guide to Rovo · Robinhood Chain</div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Make a market around a profile</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#b7bcb4]">Launch your own profile token, discover someone else through Scout, buy tokens, and see how trading fees are handled.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href="/launch" className="rounded-xl border border-[#607c24] bg-[#263216] p-4 text-sm font-semibold text-[#dcf9a1] hover:border-[#ccff00]">Launch a token <span aria-hidden="true">↗</span></Link>
          <Link href="/" className="rounded-xl border border-white/10 bg-[#1b1d1b] p-4 text-sm font-semibold hover:border-[#ccff00]">Explore tokens <span aria-hidden="true">↗</span></Link>
          <Link href="/rewards" className="rounded-xl border border-white/10 bg-[#1b1d1b] p-4 text-sm font-semibold hover:border-[#ccff00]">View rewards <span aria-hidden="true">↗</span></Link>
        </div>

        <Section id="overview" eyebrow="01 / Use Rovo" title="Welcome">
          <p>Rovo lets people launch tokens tied to X profiles. Choose <strong className="text-white">Your X profile</strong> to launch the account you own, or <strong className="text-white">Another creator</strong> to launch a token for a profile that has not launched yet. A token trades against a chosen asset, such as ETH, USDG, or an available Stock Token. Meme tokens are a separate wallet-only track and are not tied to an X account.</p>
          <p>You need a connected wallet on Robinhood Chain to submit transactions. Link your X account to launch your own profile or claim a token made for it. Launching another creator does not require your own X account. Opening a wallet, launching, buying, and claiming all require network transactions and may cost gas.</p>
          {/* <Callout>Trading activity is never guaranteed. The percentages in this guide describe shares of <em>fees received by Rovo</em> under the normal route. They are not a share of every trade and do not promise income.</Callout> */}
        </Section>

        <Section id="self-rove" eyebrow="02 / Use Rovo" title="Launch yourself">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open <Link href="/launch" className="text-[#ccff00] underline">Launch</Link> and choose <strong className="text-white">Your X profile</strong>.</li>
            <li>Log in, connect a wallet, and verify the X profile you own.</li>
            <li>Choose the token details and trading pair. Set the creator tax within the range shown by the launch form.</li>
            <li>Review the Pons launch fee and any optional first buy, then confirm the transaction in your wallet.</li>
          </ol>
          <p>Your profile is marked as the creator from launch. When the normal sharing route is used, 70% of Rovo-controlled fees is allocated to you, 20% to holders, and 10% to the platform. See <a href="#fee-flow" className="text-[#ccff00] underline">How fees move</a> for the current arrangement.</p>
        </Section>

        <Section id="scout" eyebrow="03 / Use Rovo" title="Scout a profile">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open <Link href="/launch" className="text-[#ccff00] underline">Launch</Link> and choose <strong className="text-white">Another creator</strong>.</li>
            <li>Log in and connect a wallet. Your own X account is not required.</li>
            <li>Search for the X profile you want to scout and select the correct account.</li>
            <li>Choose the token details and trading pair, review the launch fee and optional first buy, then confirm in your wallet.</li>
          </ol>
          <p>You become the <strong className="text-white">Rover</strong> for that launch. On normal distributions, 15% of Rovo-controlled fees is allocated to the Rover, including after the profile owner claims the token. The profile owner’s 60% share is held for them until a valid claim is completed.</p>
          <Callout>Each X account can have only one Rovo launch. Check the profile carefully before confirming a Scout launch.</Callout>
        </Section>

        <Section id="buy" eyebrow="04 / Use Rovo" title="Buy a profile token">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open a token from the home page and connect your wallet.</li>
            <li>Enter the amount of the token’s <strong className="text-white">pair asset</strong> you want to spend and the minimum profile tokens you will accept.</li>
            <li>If the pair asset is an ERC-20 token, approve it first. Then review and confirm the buy in your wallet.</li>
          </ol>
          <p>The minimum received amount protects your transaction from filling below the amount you entered. Buying can be unavailable while a token graduates to a new trading pool or when its later trading route is not configured. Rovo does not currently offer selling or live price quotes in the app.</p>
        </Section>

        <Section id="earnings" eyebrow="05 / Economics" title="Who earns what">
          <p>When a batch of collected fees is sent through the normal sharing route, the amount is divided as follows. These are <strong className="text-white">normal-route allocations</strong>, not automatic audit-period payouts. The figures apply to the fees Rovo receives from Pons after Pons’ own protocol share, including the configured creator tax.</p>
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
          <p>If someone launched a Scout token for your X profile, your creator share from normal fee distributions is held in the Nottingham vault. To claim it, link that X account to your Rovo login, open the token page, and go to <strong className="text-white">Details → Nottingham creator vault</strong>.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Select <strong className="text-white">Initiate claim</strong> and confirm in your wallet.</li>
            <li>Wait through the required claim delay.</li>
            <li>Select <strong className="text-white">Finalize claim</strong> when available. The vault balance is paid to the verified wallet and the token is marked claimed.</li>
          </ol>
          <p>If the token remains unclaimed for 60 days, new normal-route fees use the 45% holder / 40% platform / 15% Rover split. Amounts already held in the vault are not moved by that change; they remain available for a valid claim.</p>
        </Section>

        <Section id="payouts" eyebrow="07 / Economics" title="When do creator and Rover fees become payable?">
          <p>Fee shares build up only after trading fees are collected and the admin chooses the normal sharing route. The creator and Rover shares are recorded for their wallets on-chain; they are not sent to the wallet automatically.</p>
          <p>The <strong className="text-white">Claim</strong> button on the current Profile page is disabled. The Profile and Rewards pages may show estimated shares, but those figures do not mean a withdrawal is ready in the app. An eligible creator or Rover can withdraw their recorded balance through the splitter contract with a compatible wallet tool. A future app update may bring that withdrawal into Rovo.</p>
          <p>The Scout profile owner’s earlier, unclaimed allocation follows the separate <a href="#claim-profile" className="text-[#ccff00] underline">Nottingham claim</a> process above.</p>
        </Section>

        <Section id="holder-rewards" eyebrow="08 / Economics" title="Claim holder rewards">
          <p>Normal fee distributions fund a holder reward pool for each profile token. Rewards become claimable only after an eligibility snapshot is published. Holding a token does not by itself mean that a claim is available today.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Connect the wallet that held the token and open that token’s page.</li>
            <li>Choose the <strong className="text-white">Rewards</strong> tab.</li>
            <li>If a reward appears for your wallet, select <strong className="text-white">Claim reward</strong> and confirm the transaction.</li>
          </ol>
          <p>If the page says there are no published claims, there is currently nothing for that wallet to claim through the app. Rewards are paid in the token’s pair asset, which may be ETH or an ERC-20 token.</p>
        </Section>

        <Section id="treasury-route" eyebrow="09 / Economics" title="What if fees go to X Money?">
          <p>A Rovo admin can send an entire batch of available fees directly to the configured X Money wallet. This is the route Rovo is using during the contract audit. That batch does <strong className="text-white">not</strong> create creator, Rover, holder, or platform pool allocations on-chain.</p>
          <p>The choice applies to that batch, not permanently to the token. Later fees may follow a different route. Any payments made from X Money afterward are manual and separate from the normal on-chain split. Check actual fee activity and payments when evaluating what has been distributed.</p>
        </Section>

        <Section id="fee-flow" eyebrow="10 / Economics" title="How fees move">
          <div className="rounded-xl border border-[#b28236] bg-[#2a2115] px-5 py-4 text-sm leading-6 text-[#ffe1b6]" role="note"><strong className="mb-1 block text-base text-white">Contract audit in progress</strong>During the audit, Rovo sends the fees it collects to the X Money wallet for manual allocation. The percentage tables above describe the normal sharing route; those shares are not automatically credited from audit-period transfers.</div>
          <div className="rounded-xl border border-white/10 bg-[#191b19] p-5 text-sm leading-8 text-[#e6eae2]">Trading on a profile token <span className="text-[#ccff00]">→</span> fees become claimable <span className="text-[#ccff00]">→</span> Rovo admin chooses a route<br /><span className="pl-4">During audit: the full batch goes to the X Money wallet for manual allocation</span><br /><span className="pl-4">Normal sharing: creator or vault · Rover · holders · platform</span></div>
          <p>Pons takes its protocol share first. Rovo can allocate only the creator-side fees it receives. Those fees stay unallocated until an admin claims them from Pons and chooses a route. That is why trading activity, visible estimates, and a withdrawable balance can be different amounts.</p>
          <p>Sending a batch to X Money does not credit the normal on-chain shares. Any payment from that wallet is handled separately. The admin chooses the route for each batch, so check actual fee activity before treating an estimated share as payable.</p>
        </Section>

        <Section id="availability" eyebrow="11 / Reference" title="What works in the app today">
          <DataTable headers={["Action", "Current experience"]} rows={[
            ["Launch Self-Rove or Scout", "Available with a connected wallet and the required identity check."],
            ["Buy a token", "Available for a supported trading pair and route; a minimum received amount is required."],
            ["Claim a Scout profile", "Initiate and finalize from the token’s Details tab after the claim delay."],
            ["Claim holder rewards", "Available from the token’s Rewards tab when a claim has been published for your wallet."],
            ["Withdraw creator or Rover fees", "Tracked on-chain; the Profile Claim button is currently disabled."],
            ["Sell or view live price quotes", "Not currently available in the app."],
            ["Platform buyback and burn", "Planned, but no automatic buyback executor is in the current contracts."],
          ]} />
        </Section>

        <Section id="addresses" eyebrow="12 / Reference" title="Contract addresses">
          <p>Use the address list to check a Rovo contract or wallet on the Robinhood Chain explorer. Check the address on-chain before using it.</p>
          <DataTable headers={["Contract / wallet", "Address"]} rows={addresses.map(({ name, address }) => [name, <a key={name} className="break-all font-mono text-[#ccff00] underline underline-offset-2" href={'' + robinhoodChain.blockExplorers.default.url + '/address/' + address} target="_blank" rel="noreferrer">{address}</a>])} />
          <p>The token page’s <strong className="text-white">Details</strong> tab shows the profile token, pair asset, and fee collector for that specific launch.</p>
        </Section>
      </article>

      <aside className="hidden border-l border-white/10 px-5 py-14 xl:block">
        <p className="sticky top-6 text-xs font-bold uppercase tracking-[.16em] text-[#838a80]">On this page</p>
        <div className="sticky top-14 mt-5 space-y-2 text-sm text-[#969d94]">{nav.flatMap((group) => group.items).map(([label, id]) => <a className="block hover:text-white" key={id} href={`#${id}`}>{label}</a>)}</div>
      </aside>
    </div>
  </main>;
}
