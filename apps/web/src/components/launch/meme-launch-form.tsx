import { pairIconSrc, type PairChoice } from "@/lib/pairs";

const field =
  "h-12 w-full rounded-xl border border-[#2e2e2e] bg-[#141414] px-3 text-sm text-white outline-none placeholder:text-[#6d6d6d] focus:border-[#ccff00]";

type PairKind = "all" | "xstocks" | "crypto";

export function MemeLaunchForm({
  name,
  onName,
  symbol,
  onSymbol,
  description,
  onDescription,
  website,
  onWebsite,
  telegram,
  onTelegram,
  twitter,
  onTwitter,
  tax,
  onTax,
  preview,
  onImage,
  pairs,
  pairKind,
  onPairKind,
  search,
  onSearch,
  pairToken,
  onPair,
  selectedPair,
  openingAmount,
  onOpeningAmount,
  openingAsset,
  onOpeningAsset,
  paySymbol,
  payInEth,
  hasOpeningBuy,
  openingValue,
  buyPresets,
  busy,
  launchLabel,
  onLaunch,
}: {
  name: string;
  onName: (value: string) => void;
  symbol: string;
  onSymbol: (value: string) => void;
  description: string;
  onDescription: (value: string) => void;
  website: string;
  onWebsite: (value: string) => void;
  telegram: string;
  onTelegram: (value: string) => void;
  twitter: string;
  onTwitter: (value: string) => void;
  tax: number;
  onTax: (value: number) => void;
  preview: string | null;
  onImage: (file: File | undefined) => void;
  pairs: readonly PairChoice[];
  pairKind: PairKind;
  onPairKind: (value: PairKind) => void;
  search: string;
  onSearch: (value: string) => void;
  pairToken: string | undefined;
  onPair: (address: PairChoice["address"]) => void;
  selectedPair: PairChoice | undefined;
  openingAmount: string;
  onOpeningAmount: (value: string) => void;
  openingAsset: "pair" | "eth";
  onOpeningAsset: (value: "pair" | "eth") => void;
  paySymbol: string;
  payInEth: boolean;
  hasOpeningBuy: boolean;
  openingValue: number;
  buyPresets: readonly string[];
  busy: boolean;
  launchLabel: string;
  onLaunch: () => void;
}) {
  const firstBuy = !hasOpeningBuy
    ? "Skipped"
    : payInEth
      ? `${openingAmount.trim()} ETH`
      : `${openingAmount.trim()} ${selectedPair?.symbol ?? ""}`.trim();
  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <label className="flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#4a4a4a] bg-[#141414] text-center text-xs font-medium tracking-[0.04em] text-[#8a8a8a]">
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            "Add image"
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            onChange={(event) => onImage(event.target.files?.[0])}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(event) => onName(event.target.value)}
            placeholder="Token name"
            aria-label="Token name"
            className={field}
          />
          <input
            value={symbol}
            onChange={(event) => onSymbol(event.target.value.toUpperCase())}
            placeholder="Ticker"
            aria-label="Ticker"
            className={field}
          />
        </div>

        <textarea
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="Description"
          aria-label="Description"
          rows={4}
          className={`${field} h-auto resize-y py-3`}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <input value={twitter} onChange={(event) => onTwitter(event.target.value)} placeholder="X" aria-label="X" className={field} />
          <input value={website} onChange={(event) => onWebsite(event.target.value)} placeholder="Website" aria-label="Website" className={field} />
          <input value={telegram} onChange={(event) => onTelegram(event.target.value)} placeholder="Telegram" aria-label="Telegram" className={field} />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Creator tax</p>
            <p className="text-sm text-[#ccff00]">{tax.toFixed(1)}%</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#7f7f7f]">
            Optional. An admin claims this with the scout and profile fees.
          </p>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={tax}
            aria-label="Creator tax"
            onChange={(event) => onTax(Number(event.target.value))}
            className="mt-3 w-full accent-[#ccff00]"
          />
        </div>

        <div>
          <p className="text-sm font-medium">Paired with</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex h-11 items-center gap-2 rounded-xl bg-[#141414] px-2">
              {(
                [
                  ["all", "All"],
                  ["xstocks", "xStocks"],
                  ["crypto", "Crypto"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={pairKind === value}
                  onClick={() => onPairKind(value)}
                  className={`h-8 rounded-lg px-3 text-sm ${
                    pairKind === value
                      ? "bg-[#ccff00] font-medium text-black"
                      : "text-[#7f7f7f]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search pair tokens"
              className={`${field} sm:max-w-[220px]`}
            />
          </div>
          <div className="mt-3 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {pairs.map((pair) => {
              const selected = pairToken?.toLowerCase() === pair.address.toLowerCase();
              return (
                <button
                  key={pair.address}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPair(pair.address)}
                  className={`flex h-16 items-center gap-3 rounded-xl bg-[#141414] px-3 text-left ${
                    selected ? "border border-[#ccff00]" : "border border-transparent"
                  }`}
                >
                  <img
                    src={pairIconSrc(pair.iconUrl)}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 shrink-0 rounded-full object-contain"
                  />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-medium">{pair.symbol}</strong>
                    <small className="block truncate text-xs text-[#7f7f7f]">{pair.name}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {pairs.length === 0 && (
            <p className="mt-3 text-sm text-[#7f7f7f]">No pair tokens match.</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium">Initial buy</p>
          <p className="mt-1 text-xs text-[#7f7f7f]">
            {pairToken
              ? "Optional. Pay with ETH or the pair token."
              : "Select a pair first."}
          </p>
          {pairToken && pairToken !== "0x0000000000000000000000000000000000000000" && (
            <div className="mt-3 flex h-11 w-fit items-center gap-2 rounded-xl bg-[#141414] px-2">
              {(
                [
                  ["eth", "ETH"],
                  ["pair", selectedPair?.symbol ?? "Token"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={openingAsset === value}
                  onClick={() => onOpeningAsset(value)}
                  className={`h-8 rounded-lg px-3 text-sm ${
                    openingAsset === value
                      ? "bg-[#ccff00] font-medium text-black"
                      : "text-[#7f7f7f]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <input
            value={openingAmount}
            onChange={(event) => onOpeningAmount(event.target.value)}
            inputMode="decimal"
            placeholder={pairToken ? `Amount in ${paySymbol}` : "Select a pair first"}
            aria-label="Initial buy amount"
            disabled={!pairToken}
            className={`${field} mt-3 disabled:opacity-50`}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {buyPresets.map((amount) => {
              const selected = hasOpeningBuy && Number(amount) === openingValue;
              return (
                <button
                  key={amount}
                  type="button"
                  disabled={!pairToken}
                  aria-pressed={selected}
                  onClick={() => onOpeningAmount(amount)}
                  className={`h-10 rounded-xl border px-3 text-sm disabled:opacity-40 ${
                    selected
                      ? "border-[#ccff00] text-white"
                      : "border-[#2e2e2e] text-[#7f7f7f]"
                  }`}
                >
                  {amount}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="rounded-[20px] border border-[#2e2e2e] bg-[#141414] p-5 lg:sticky lg:top-6">
        <p className="text-sm font-medium text-[#8a8a8a]">Launch summary</p>
        <div className="mt-4 flex items-center gap-3">
          {preview ? (
            <img src={preview} alt="" className="size-14 rounded-xl object-cover" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-xl border border-dashed border-[#4a4a4a] text-[10px] text-[#6d6d6d]">
              Image
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{name.trim() || "Untitled"}</p>
            <p className="truncate text-sm text-[#7f7f7f]">{symbol.trim() || "No ticker yet"}</p>
          </div>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <SummaryRow label="Paired with" value={selectedPair?.symbol ?? "—"} />
          <SummaryRow label="Creator tax" value={`${tax.toFixed(1)}%`} />
          {/* <SummaryRow label="Tax destination" value="Admin treasury" /> */}
          <SummaryRow label="First buy" value={firstBuy} />
        </dl>
        <p className="mt-4 text-xs leading-5 text-[#6d6d6d]">
          The image uploads to Pinata when you launch, not when you add it.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onLaunch}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#ccff00] text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          {launchLabel}
        </button>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#7f7f7f]">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
