import type { LaunchPair } from "@/lib/raydium/pairs";

const field =
  "h-12 w-full rounded-xl border border-line bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent";

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
  creatorFee,
  preview,
  onImage,
  pairs,
  pairsMessage = "No pair tokens match.",
  pairKind,
  onPairKind,
  search,
  onSearch,
  pairToken,
  onPair,
  selectedPair,
  openingAmount,
  onOpeningAmount,
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
  creatorFee: string;
  preview: string | null;
  onImage: (file: File | undefined) => void;
  pairs: readonly LaunchPair[];
  pairsMessage?: string;
  pairKind: PairKind;
  onPairKind: (value: PairKind) => void;
  search: string;
  onSearch: (value: string) => void;
  pairToken: string | undefined;
  onPair: (mint: string) => void;
  selectedPair: LaunchPair | undefined;
  openingAmount: string;
  onOpeningAmount: (value: string) => void;
  hasOpeningBuy: boolean;
  openingValue: number;
  buyPresets: readonly string[];
  busy: boolean;
  launchLabel: string;
  onLaunch: () => void;
}) {
  const firstBuy = hasOpeningBuy
    ? `${openingAmount.trim()} SOL`
    : "Skipped";
  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <label className="flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface text-center text-xs font-medium tracking-[0.04em] text-muted">
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

        <div className="rounded-xl bg-surface px-3 py-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Creator fee</p>
            <p className="text-sm text-accent">{creatorFee}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            Quote pairs other than SOL and USDC lock a 2% creator fee. SOL and USDC use Pump&apos;s schedule.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium">Paired with</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex h-11 items-center gap-2 rounded-xl bg-surface px-2">
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
                      ? "bg-action font-medium text-ink"
                      : "text-muted"
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
              const selected = pairToken === pair.mint;
              return (
                <button
                  key={pair.mint}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPair(pair.mint)}
                  className={`flex h-16 items-center gap-3 rounded-xl bg-surface px-3 text-left ${
                    selected ? "border border-accent" : "border border-transparent"
                  }`}
                >
                  <PairIcon iconUrl={pair.iconUrl} label={pair.symbol} />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-medium">{pair.symbol}</strong>
                    <small className="block truncate text-xs text-muted">{pair.name}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {pairs.length === 0 && (
            <p className="mt-3 text-sm text-muted">{pairsMessage}</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium">Initial buy</p>
          <p className="mt-1 text-xs text-muted">
            Optional. Paid in SOL. If the pair is not SOL, that SOL is swapped into the pair first. A blank amount creates the coin only.
          </p>
          <input
            value={openingAmount}
            onChange={(event) => onOpeningAmount(event.target.value)}
            inputMode="decimal"
            placeholder={pairToken ? "Amount in SOL" : "Select a pair first"}
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
                      ? "border-accent text-foreground"
                      : "border-line text-muted"
                  }`}
                >
                  {amount}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="rounded-[20px] border border-line bg-surface p-5 lg:sticky lg:top-6">
        <p className="text-sm font-medium text-muted">Launch summary</p>
        <div className="mt-4 flex items-center gap-3">
          {preview ? (
            <img src={preview} alt="" className="size-14 rounded-xl object-cover" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-xl border border-dashed border-line text-[10px] text-muted">
              Image
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{name.trim() || "Untitled"}</p>
            <p className="truncate text-sm text-muted">{symbol.trim() || "No ticker yet"}</p>
          </div>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <SummaryRow label="Paired with" value={selectedPair?.symbol ?? "—"} />
          <SummaryRow label="Creator fee" value={creatorFee} />
          {/* <SummaryRow label="Tax destination" value="Admin treasury" /> */}
          <SummaryRow label="First buy" value={firstBuy} />
        </dl>
        <p className="mt-4 text-xs leading-5 text-muted">
          The image uploads to Pinata when you launch, not when you add it.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onLaunch}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-action text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45"
        >
          {launchLabel}
        </button>
      </aside>
    </div>
  );
}

function PairIcon({ iconUrl, label }: { iconUrl: string; label: string }) {
  if (!iconUrl) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold uppercase">
        {label.slice(0, 1) || "?"}
      </span>
    );
  }
  return (
    <img
      src={iconUrl}
      alt=""
      width={28}
      height={28}
      className="size-7 shrink-0 rounded-full object-contain"
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
