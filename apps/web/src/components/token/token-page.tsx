"use client";

import { useEffect, useState } from "react";
import { TokenPriceChart } from "./token-chart";
import { TokenTradePanel } from "./token-trade";
import { TokenProfileCard } from "@/components/creator-identity";
import { CHART_RANGES, useTokenPageData, type ChartRange } from "./use-token-page-data";

const asset = (name: string) => `/figma-token/${name}`;

function shortAddress(value: string) {
  return value.length < 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function hasEarnings(value: string | null) {
  return value != null && value !== "—";
}

function profileStats(data: ReturnType<typeof useTokenPageData>) {
  return [
    { label: "Market cap", value: data.marketCapLabel },
    { label: "Token price", value: data.priceLabel },
    { label: "24h Volume", value: data.volumeLabel },
    {
      label: "24h change",
      value: data.changeLabel,
      tone: data.changeUp ? "text-[#00e829]" : "text-[red]",
    },
  ];
}

function MobileTokenPage({
  token,
  data,
  range,
  onRange,
}: {
  token: string;
  data: ReturnType<typeof useTokenPageData>;
  range: ChartRange;
  onRange: (range: ChartRange) => void;
}) {
  const [tab, setTab] = useState<"Activity" | "Holders" | "Details">("Activity");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  return (
    <main className="min-h-full bg-black px-4 pb-28 text-white md:hidden">
      <div className="pt-3">
        <TokenProfileCard
          token={token}
          name={data.name}
          handle={data.handle}
          image={data.image}
          status={data.status}
          pairLabel={data.pairLabel}
          {...(data.pairIcon ? { pairIcon: data.pairIcon } : {})}
          scout={data.scout}
          stats={profileStats(data)}
        />
      </div>

      <section
        aria-label="Token chart"
        className="mt-6 overflow-hidden rounded-2xl border border-[#383838] bg-[#141414] p-3"
      >
        <TokenPriceChart
          points={data.points}
          quoteUsd={data.quoteUsd}
          supply={data.supply}
          loading={data.chartLoading}
          range={range}
        />
      </section>
      <div
        role="tablist"
        aria-label="Chart period"
        className="mt-3 flex items-center justify-center gap-1"
      >
        {CHART_RANGES.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={range === value}
            onClick={() => onRange(value)}
            className={`min-h-10 min-w-12 rounded-lg px-2 text-sm ${range === value ? "bg-[#252525] font-semibold text-[#ccff00]" : "text-[#888]"}`}
          >
            {value}
          </button>
        ))}
      </div>

      <dl className="mt-7 grid grid-cols-4 gap-2">
        {[
          ["MCAP", data.marketCapLabel],
          ["24H VOL", data.volumeLabel],
          ["HOLDERS", data.holdersCount == null ? "—" : String(data.holdersCount)],
          ["PAIR", data.pairLabel],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-medium text-[#888]">{label}</dt>
            <dd className="mt-1 truncate text-sm font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div
        className="mt-8 flex gap-6 overflow-x-auto border-b border-[#383838] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Token information"
      >
        {(["Activity", "Holders", "Details"] as const).map(
          (value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`relative min-h-12 shrink-0 text-sm ${tab === value ? "text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#ccff00]" : "text-[#888]"}`}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <div key={tab} className="motion-content">
        {tab === "Details" ? (
          <div className="mt-5 text-sm">
            {[
              ["Network", "Robinhood"],
              ["Token", data.handle ? `@${data.handle}` : "—"],
              ["Paired with", data.pairLabel],
              ["Contract", data.valid ? shortAddress(token) : "—"],
              ["Status", data.status ?? "—"],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 ${index % 2 === 0 ? "bg-[#1c1c1c]" : ""}`}
              >
                <span className="text-[#888]">{label}</span>
                <span className="truncate text-right font-medium">{value}</span>
              </div>
            ))}
          </div>
        ) : tab === "Holders" ? (
          <div className="mt-4">
            {data.holdersLoading ? (
              <p className="py-8 text-center text-sm text-[#888]">Loading holders…</p>
            ) : data.holders.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#888]">No holders yet.</p>
            ) : (
              data.holders.map((holder) => (
                <div
                  key={holder.rank}
                  className="flex min-h-14 items-center justify-between border-b border-[#252525] text-sm"
                >
                  <span className="text-[#888]">{holder.rank}</span>
                  <span>{holder.wallet}</span>
                  <span className="text-[#ccff00]">{holder.share}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mt-4">
            {data.tradesLoading ? (
              <p className="py-8 text-center text-sm text-[#888]">Loading trades…</p>
            ) : data.trades.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#888]">No trades yet.</p>
            ) : (
              data.trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex min-h-14 items-center gap-3 border-b border-[#252525] text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{trade.wallet}</span>
                  <span
                    className={
                      trade.side === "Buy" ? "text-[#39d353]" : "text-[#ff4edc]"
                    }
                  >
                    {trade.side}
                  </span>
                  <span className="w-16 text-right text-[#aaa]">{trade.usd}</span>
                  <span className="w-8 text-right text-[#777]">{trade.time}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[68px] z-20 bg-black px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="h-12 w-full rounded-full bg-[#ccff00] text-base font-semibold text-black"
        >
          Trade
        </button>
      </div>
      <div
        data-open={sheetOpen}
        inert={!sheetOpen}
        className="motion-overlay fixed inset-0 z-50 flex items-end bg-black/70 md:hidden"
        onClick={() => setSheetOpen(false)}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Trade"
          onClick={(event) => event.stopPropagation()}
          className="motion-panel w-full rounded-t-[28px] border-t border-[#383838] bg-[#191919] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 text-white"
        >
          <div className="mb-4 flex items-center">
            <button
              type="button"
              aria-label="Close trade sheet"
              onClick={() => setSheetOpen(false)}
              className="ml-auto size-10 text-xl text-[#aaa]"
            >
              ×
            </button>
          </div>
          <TokenTradePanel token={token} />
        </section>
      </div>
    </main>
  );
}

export function TokenPage({ token }: { token: string }) {
  const [range, setRange] = useState<ChartRange>("1d");
  const [panel, setPanel] = useState<"trades" | "holders">("trades");
  const data = useTokenPageData(token, range);

  return (
    <>
      <MobileTokenPage token={token} data={data} range={range} onRange={setRange} />
      <main className="mx-auto hidden w-full max-w-[1215px] flex-col gap-5 px-4 py-4 sm:px-6 md:flex lg:gap-6 lg:py-6">
        <TokenProfileCard
          token={token}
          name={data.name}
          handle={data.handle}
          image={data.image}
          status={data.status}
          pairLabel={data.pairLabel}
          {...(data.pairIcon ? { pairIcon: data.pairIcon } : {})}
          scout={data.scout}
          stats={profileStats(data)}
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_347px]">
          <section className="rounded-[20px] bg-[#191919] p-4 sm:p-6">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("chart.svg")} alt="" />
              <h2 className="text-xl font-bold tracking-tight">Live market</h2>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto text-base font-medium tracking-[0.32px] text-[#737373]">
              {CHART_RANGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={range === item}
                  onClick={() => setRange(item)}
                  className={`shrink-0 rounded-[10px] px-3 py-1 ${range === item ? "bg-[#212121]" : ""}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="relative mt-4 overflow-hidden rounded-[11px] bg-[#191919]">
              <TokenPriceChart
                points={data.points}
                quoteUsd={data.quoteUsd}
                supply={data.supply}
                loading={data.chartLoading}
                range={range}
              />
            </div>
          </section>

          <div className="flex flex-col gap-5">
            <section className="rounded-[20px] bg-[#191919] p-5">
              <TokenTradePanel token={token} />
            </section>
            <section className="flex items-center justify-between rounded-[10px] bg-[#191919] px-6 py-5">
              <p className="text-base font-medium tracking-[0.32px] text-[#737373]">
                Paired with
              </p>
              <p className="flex items-center gap-2 text-xl text-white">
                {data.pairIcon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.pairIcon}
                    alt=""
                    width={39}
                    height={39}
                    className="size-[39px] rounded-full object-cover"
                  />
                )}
                {data.pairLabel}
              </p>
            </section>
          </div>
        </div>

        {(hasEarnings(data.creatorEarnings) || hasEarnings(data.holderEarnings)) && (
          <section>
            <h2 className="mb-3 text-base font-medium tracking-[0.32px] text-[#737373]">
              Creator Earnings
            </h2>
            <div className="grid max-w-md grid-cols-2 rounded-[10px] bg-[#191919] py-4">
              <div className="px-6">
                <p className="text-xs font-medium tracking-[0.24px] text-[#737373]">
                  Lifetime
                </p>
                <p className="mt-2 text-[23px] font-bold tracking-tight">
                  {data.creatorEarnings ?? "—"}
                </p>
              </div>
              <div className="border-l border-[#383838] px-6">
                <p className="text-xs font-medium tracking-[0.24px] text-[#737373]">
                  Holders
                </p>
                <p className="mt-2 text-[23px] font-bold tracking-tight">
                  {data.holderEarnings ?? "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-[10px] bg-[#191919] p-4 sm:p-6">
          <div className="flex items-center gap-5">
            <button
              type="button"
              aria-pressed={panel === "holders"}
              onClick={() => setPanel("holders")}
              className={`text-base font-medium tracking-[0.32px] ${panel === "holders" ? "text-white" : "text-[#737373]"}`}
            >
              Top Holders
            </button>
            <button
              type="button"
              aria-pressed={panel === "trades"}
              onClick={() => setPanel("trades")}
              className={`h-7 rounded-[7px] border px-6 text-sm font-medium tracking-tight ${
                panel === "trades"
                  ? "border-[#e1ff1f] bg-[#212121] text-white"
                  : "border-transparent text-[#737373]"
              }`}
            >
              Trades
            </button>
          </div>
          <div key={panel} className="motion-content mt-6 overflow-x-auto">
            {panel === "trades" ? (
              <table className="w-full min-w-[36rem] border-separate border-spacing-y-4 text-left text-[13px] font-medium">
                <thead className="text-[#737373]">
                  <tr>
                    {["Time", "Type", "USD", "ETH", "MCAP", "Wallet"].map(
                      (label) => (
                        <th key={label} className="px-3 font-medium">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.tradesLoading ? (
                    <tr>
                      <td className="px-3 text-[#737373]" colSpan={6}>
                        Loading trades…
                      </td>
                    </tr>
                  ) : data.trades.length === 0 ? (
                    <tr>
                      <td className="px-3 text-[#737373]" colSpan={6}>
                        No trades yet.
                      </td>
                    </tr>
                  ) : (
                    data.trades.map((trade) => (
                      <tr key={trade.id} className="text-white">
                        <td className="px-3">{trade.time}</td>
                        <td
                          className={`px-3 ${trade.side === "Buy" ? "text-[#00e829]" : "text-[red]"}`}
                        >
                          {trade.side}
                        </td>
                        <td className="px-3">{trade.usd}</td>
                        <td className="px-3">{trade.quote}</td>
                        <td className="px-3">{trade.mcap}</td>
                        <td className="px-3">
                          {trade.tx ? (
                            <a href={trade.tx} target="_blank" rel="noreferrer" className="underline">
                              {trade.wallet}
                            </a>
                          ) : (
                            trade.wallet
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[24rem] border-separate border-spacing-y-4 text-left text-[13px] font-medium">
                <thead className="text-[#737373]">
                  <tr>
                    {["Rank", "Wallet", "Share"].map((label) => (
                      <th key={label} className="px-3 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.holdersLoading ? (
                    <tr>
                      <td className="px-3 text-[#737373]" colSpan={3}>
                        Loading holders…
                      </td>
                    </tr>
                  ) : data.holders.length === 0 ? (
                    <tr>
                      <td className="px-3 text-[#737373]" colSpan={3}>
                        No holders yet.
                      </td>
                    </tr>
                  ) : (
                    data.holders.map((holder) => (
                      <tr key={holder.rank} className="text-white">
                        <td className="px-3">{holder.rank}</td>
                        <td className="px-3">
                          {holder.href ? (
                            <a href={holder.href} target="_blank" rel="noreferrer" className="underline">
                              {holder.wallet}
                            </a>
                          ) : (
                            holder.wallet
                          )}
                        </td>
                        <td className="px-3">{holder.share}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="rounded-[10px] bg-[#212121] px-6 py-4">
          <h2 className="text-base text-white">How fees work</h2>
          <p className="mt-3 max-w-md text-sm font-medium text-[#737373]">
            Trading fees are routed between the creator, holders and platform
            according to the market state.
          </p>
          <div className="mt-6 flex h-2.5 overflow-hidden rounded-full">
            {(data.feeParts.length > 0
              ? data.feeParts
              : [
                  { key: "creator", label: "Creators", color: "#43e660", width: 70, usd: "—" },
                  { key: "holders", label: "Holders", color: "#9945ff", width: 20, usd: "—" },
                  { key: "platform", label: "Platform", color: "#fbad15", width: 10, usd: "—" },
                ]
            ).map((part) => (
              <span
                key={part.key}
                className="h-full"
                style={{ width: `${part.width}%`, background: part.color }}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-[#737373]">
            {(data.feeParts.length > 0
              ? data.feeParts
              : [
                  { key: "creator", label: "Creators", color: "#43e660", width: 70, usd: "—" },
                  { key: "holders", label: "Holders", color: "#9945ff", width: 20, usd: "—" },
                  { key: "platform", label: "Platform", color: "#fbad15", width: 10, usd: "—" },
                ]
            ).map((part) => (
              <span key={part.key} className="inline-flex items-center gap-1">
                <i className="size-[9px] rounded-[1px]" style={{ background: part.color }} />
                {part.label} {Number.isInteger(Math.round(part.width)) ? Math.round(part.width) : part.width.toFixed(1)}%
                {part.usd !== "—" ? ` · ${part.usd}` : ""}
              </span>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
