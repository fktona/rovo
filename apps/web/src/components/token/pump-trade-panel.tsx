"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import bs58 from "bs58";
import {
  useCreateWallet,
  useSignAndSendTransaction,
  useStandardWallets,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { useToast } from "@/components/toast/toast-provider";
import { formatQuoteAmount } from "@/lib/contracts/uniswap";
import { parseTokenAmount } from "@/lib/pump/fees";
import {
  connectExternalSolanaWallet,
  hasExternalSolanaWallet,
  preferredSolanaWallet,
} from "@/lib/solana-wallet";
import {
  SOL_BUY_RESERVE,
  formatTokenAmount,
  maxSpendForSlippage,
  type PumpTradeVenue,
} from "@/lib/pump/trade-math";

type PumpTradeSide = "buy" | "sell";
type SolanaChain = "solana:devnet" | "solana:mainnet";

type PumpMarket = {
  venue: PumpTradeVenue;
  quoteSymbol: string;
  quoteDecimals: number;
  baseDecimals: number;
  balance: string | null;
};

type PumpPreview = {
  venue: PumpTradeVenue;
  side: PumpTradeSide;
  receive: bigint;
  bound: bigint;
  receiveDecimals: number;
  receiveSymbol: string;
  paySymbol: string;
  payDecimals: number;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "Could not quote this trade.";
  } catch {
    return "Could not quote this trade.";
  }
}

const SLIPPAGE_PRESETS = ["0.5", "1", "2", "5"] as const;

function parsedSlippage(value: string) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent >= 50) return null;
  return percent;
}

function parsedAmount(value: string, decimals: number) {
  try {
    const amount = parseTokenAmount(value, decimals);
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

function venueLabel(venue: PumpTradeVenue) {
  return venue === "pump" ? "Pump" : "PumpSwap";
}

export function PumpTradePanel({ mint }: { mint: string }) {
  const { wallets: solanaWallets } = useSolanaWallets();
  const { wallets: standardWallets } = useStandardWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { createWallet } = useCreateWallet();
  const externalWalletAvailable = hasExternalSolanaWallet(standardWallets);
  const solanaWallet = externalWalletAvailable
    ? solanaWallets.find(
        (wallet) => !/privy/i.test(wallet.standardWallet.name),
      )
    : preferredSolanaWallet(solanaWallets);
  const identity = useRovoIdentity();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<PumpTradeSide>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [busy, setBusy] = useState("");

  const market = useQuery({
    queryKey: ["pump-trade", mint, "market", solanaWallet?.address, side],
    queryFn: async () => {
      const params = new URLSearchParams({ side });
      if (solanaWallet) params.set("wallet", solanaWallet.address);
      const response = await fetch(`/api/pump/coins/${mint}/trade?${params}`);
      if (!response.ok) throw new Error(await readError(response));
      return (await response.json()) as PumpMarket;
    },
  });
  const coin = useQuery({
    queryKey: ["pump-trade", mint, "coin"],
    queryFn: async () => {
      const response = await fetch(`/api/pump/coins/${mint}`);
      if (!response.ok) return null;
      const body = (await response.json()) as { ticker?: string };
      return body.ticker?.trim() || null;
    },
  });

  const tokenSymbol = coin.data || "tokens";
  const quoteSymbol = market.data?.quoteSymbol ?? "quote";
  const payDecimals =
    side === "sell" ? market.data?.baseDecimals : market.data?.quoteDecimals;
  const inputSymbol = side === "sell" ? tokenSymbol : quoteSymbol;
  const slippagePercent = parsedSlippage(slippage);
  const amountIn =
    payDecimals == null ? null : parsedAmount(amount, payDecimals);

  const balance =
    market.data?.balance == null ? null : BigInt(market.data.balance);

  const quote = useQuery({
    queryKey: [
      "pump-trade",
      mint,
      "quote",
      side,
      amountIn?.toString(),
      slippagePercent,
      tokenSymbol,
    ],
    enabled: amountIn != null && slippagePercent != null && !!market.data,
    queryFn: async () => {
      const response = await fetch(`/api/pump/coins/${mint}/trade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          side,
          amount,
          slippagePercent,
          tokenSymbol,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as {
        preview: Omit<PumpPreview, "receive" | "bound"> & {
          receive: string;
          bound: string;
        };
      };
      return {
        ...body.preview,
        receive: BigInt(body.preview.receive),
        bound: BigInt(body.preview.bound),
      } satisfies PumpPreview;
    },
  });

  const spendable =
    balance == null || slippagePercent == null
      ? null
      : side === "sell"
        ? balance
        : maxSpendForSlippage(
            quoteSymbol === "SOL" && balance > SOL_BUY_RESERVE
              ? balance - SOL_BUY_RESERVE
              : quoteSymbol === "SOL"
                ? 0n
                : balance,
            slippagePercent,
          );
  const insufficient =
    amountIn != null && spendable != null && amountIn > spendable;

  const submit = async () => {
    if (!identity.authenticated) {
      identity.login();
      return;
    }
    if (!solanaWallet) {
      if (externalWalletAvailable) {
        try {
          await connectExternalSolanaWallet(standardWallets);
        } catch (cause) {
          toast.walletError(
            cause,
            "Could not connect MetaMask. Enable its Solana account, then try again.",
          );
        }
        return;
      }
      try {
        await createWallet();
      } catch (cause) {
        toast.walletError(cause, "Could not create a Solana wallet.");
      }
      return;
    }
    if (slippagePercent == null) {
      toast.error("Choose a slippage under 50%.");
      return;
    }
    if (!amountIn) {
      toast.error("Enter an amount.");
      return;
    }
    if (insufficient) {
      toast.error(`Not enough ${inputSymbol}.`);
      return;
    }
    setBusy(side === "buy" ? "Buying…" : "Selling…");
    try {
      const prepared = await fetch(`/api/pump/coins/${mint}/trade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          side,
          amount,
          slippagePercent,
          tokenSymbol,
          walletAddress: solanaWallet.address,
        }),
      });
      if (!prepared.ok) throw new Error(await readError(prepared));
      const built = (await prepared.json()) as {
        chain: SolanaChain;
        transaction: string;
        preview: { venue: PumpTradeVenue };
      };
      const signed = await signAndSendTransaction({
        transaction: Uint8Array.from(atob(built.transaction), (char) =>
          char.charCodeAt(0),
        ),
        wallet: solanaWallet,
        chain: built.chain,
      });
      const signature =
        typeof signed.signature === "string"
          ? signed.signature
          : bs58.encode(signed.signature);
      const confirmed = await fetch(`/api/pump/coins/${mint}/trade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (!confirmed.ok) throw new Error(await readError(confirmed));
      setAmount("");
      toast.success(
        side === "buy" ? "Buy confirmed." : "Sell confirmed.",
        `Filled on ${venueLabel(built.preview.venue)}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["pump-trade", mint] });
    } catch (cause) {
      toast.walletError(cause, "Transaction failed.");
    } finally {
      setBusy("");
    }
  };

  const buttonLabel = !identity.authenticated
    ? "Log in"
    : !solanaWallet
      ? "Create Solana wallet"
      : busy
        ? busy
        : side === "buy"
          ? "Buy"
          : "Sell";
  const venue = quote.data?.venue ?? market.data?.venue;

  return (
    <div>
      <div className="flex items-center justify-center gap-8">
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={side === value}
            onClick={() => {
              setSide(value);
              setAmount("");
            }}
            className={`h-7 w-28 rounded-[10px] text-xs font-medium capitalize ${
              side === value ? "border border-line bg-surface-raised" : ""
            } ${value === "buy" ? "text-positive" : "text-danger"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        {market.isError
          ? market.error instanceof Error
            ? market.error.message
            : "This token is not on Pump."
          : venue
            ? venue === "pump"
              ? "Bonding curve"
              : "PumpSwap"
            : "Checking the Pump market…"}
      </p>
      <label className="mt-4 block rounded-[10px] bg-surface-raised px-3 py-2">
        <span className="text-sm font-medium">Amount</span>
        <span className="mt-1 flex items-center gap-2 text-sm text-foreground">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Amount in ${inputSymbol}`}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          />
          {inputSymbol}
        </span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["25", "50", "75"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              if (spendable == null || payDecimals == null) return;
              const slice = (spendable * BigInt(value)) / 100n;
              setAmount(formatTokenAmount(slice, payDecimals));
            }}
            className="rounded-[5px] border border-line bg-surface-raised px-3 py-1.5 text-[10px] font-medium text-muted"
          >
            {value}%
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (spendable == null || payDecimals == null) return;
            setAmount(formatTokenAmount(spendable, payDecimals));
          }}
          className="rounded-[5px] border border-line bg-surface-raised px-3 py-1.5 text-[10px] font-medium text-muted"
        >
          MAX
        </button>
      </div>
      <label className="mt-4 block text-xs text-muted">
        Slippage
        <span className="mt-2 flex flex-wrap items-center gap-2">
          {SLIPPAGE_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={slippage === value}
              onClick={() => setSlippage(value)}
              className={`h-7 rounded-md px-2 ${
                slippage === value
                  ? "bg-action font-semibold text-ink"
                  : "bg-surface-raised text-muted"
              }`}
            >
              {value}%
            </button>
          ))}
          <input
            value={slippage}
            onChange={(event) => setSlippage(event.target.value)}
            inputMode="decimal"
            aria-label="Custom slippage percent"
            className="h-7 w-16 rounded-md bg-surface-raised px-2 text-foreground outline-none"
          />
          <span>%</span>
        </span>
      </label>
      <p className="mt-4 text-sm text-muted">
        {quote.isFetching && amountIn
          ? "Quoting…"
          : quote.isError
            ? quote.error instanceof Error
              ? quote.error.message
              : "Could not quote this trade."
            : quote.data && quote.data.receive > 0n
              ? side === "buy"
                ? `You receive ${formatQuoteAmount(quote.data.receive, quote.data.receiveDecimals)} ${quote.data.receiveSymbol} on ${venueLabel(quote.data.venue)}. Max ${formatQuoteAmount(quote.data.bound, quote.data.payDecimals)} ${quote.data.paySymbol} at ${slippage}% slippage.`
                : `You receive ${formatQuoteAmount(quote.data.receive, quote.data.receiveDecimals)} ${quote.data.receiveSymbol} on ${venueLabel(quote.data.venue)}. Minimum ${formatQuoteAmount(quote.data.bound, quote.data.receiveDecimals)} at ${slippage}% slippage.`
              : venue === "pumpswap"
                ? "Enter an amount to quote PumpSwap."
                : "Enter an amount to quote the bonding curve."}
      </p>
      {balance != null && payDecimals != null && (
        <p className="mt-1 text-xs text-muted">
          Balance {formatQuoteAmount(balance, payDecimals)} {inputSymbol}
        </p>
      )}
      {insufficient && (
        <p className="mt-3 text-sm text-warning">Not enough {inputSymbol}.</p>
      )}
      <button
        type="button"
        disabled={
          !!busy ||
          (!!solanaWallet &&
            (market.isError ||
              slippagePercent == null ||
              insufficient ||
              (!!amountIn && quote.data?.receive === 0n)))
        }
        onClick={() => void submit()}
        className="mt-4 flex h-[42px] w-full items-center justify-center rounded-lg bg-action text-sm font-semibold text-ink disabled:opacity-45"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
