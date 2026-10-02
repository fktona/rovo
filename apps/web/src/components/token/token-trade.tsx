"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress, parseUnits, zeroAddress, type Address } from "viem";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { useRovoActions } from "@/hooks/useRovoActions";
import {
  useAllowance,
  useOnchainLaunch,
  usePonsPhase,
  useTokenBalance,
  useTokenInfo,
} from "@/hooks/useRovoQueries";
import { minTokensAtSlippage } from "@/lib/contracts/curve-quote";
import {
  quoteCurveBuyFromChain,
  quoteCurveSellFromChain,
} from "@/lib/contracts/curve-market";
import { formatQuoteAmount, quoteEthForToken } from "@/lib/contracts/uniswap";
import {
  PERMIT2,
  quoteV4ExactInput,
  readGraduatedPool,
} from "@/lib/contracts/uniswap-v4";
import { getPairChoice } from "@/lib/pairs";
import { useToast } from "@/components/toast/toast-provider";
import { useRovoContext } from "@/providers/RovoProviders";

const SLIPPAGE_PRESETS = ["0.5", "1", "2", "5"] as const;
const PREVIEW_RECIPIENT = "0x0000000000000000000000000000000000000001" as Address;

function parseAmount(value: string, decimals: number) {
  try {
    const parsed = parseUnits(value.trim(), decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function slippageBps(value: string) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent >= 50) return null;
  return BigInt(Math.round(percent * 100));
}

export function TokenTradePanel({ token }: { token: string }) {
  const address = isAddress(token) ? (token as Address) : undefined;
  const { publicClient } = useRovoContext();
  const queryClient = useQueryClient();
  const identity = useRovoIdentity();
  const wallet = identity.wallets[0]?.address as Address | undefined;
  const actions = useRovoActions(wallet);
  const launch = useOnchainLaunch(address);
  const phase = usePonsPhase(address);
  const tokenInfo = useTokenInfo(address);
  const pairToken = launch.data?.pairToken;
  const pair = pairToken ? getPairChoice(pairToken) : undefined;
  const pairIsEth = pairToken === zeroAddress;
  const pairSymbol = pair?.symbol ?? (pairIsEth ? "ETH" : "quote");
  const pairDecimals = pairIsEth ? 18 : 18;
  const tokenDecimals = tokenInfo.data?.decimals ?? 18;
  const tokenSymbol = tokenInfo.data?.symbol || "tokens";
  const curve = launch.data?.curve;
  const marketPhase = phase.data == null ? null : Number(phase.data);
  const onCurve = marketPhase === 0;
  const onUniswap = marketPhase === 2;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [payWith, setPayWith] = useState<"eth" | "pair">("eth");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [busy, setBusy] = useState("");
  const toast = useToast();

  const payingEth = side === "buy" && (pairIsEth || payWith === "eth");
  const inputDecimals = side === "sell" ? tokenDecimals : payingEth ? 18 : pairDecimals;
  const inputSymbol = side === "sell" ? tokenSymbol : payingEth ? "ETH" : pairSymbol;
  const amountIn = parseAmount(amount, inputDecimals);
  const bps = slippageBps(slippage);
  const spender =
    side === "sell" || !payingEth ? (onUniswap ? PERMIT2 : curve) : undefined;
  const allowanceToken = side === "sell" ? address : !payingEth ? pairToken : undefined;
  const allowance = useAllowance(
    allowanceToken && allowanceToken !== zeroAddress ? allowanceToken : undefined,
    wallet,
    spender,
  );
  const balanceToken =
    side === "sell" ? address : payingEth ? zeroAddress : pairToken;
  const balance = useTokenBalance(balanceToken, wallet);

  const quote = useQuery({
    queryKey: [
      "rovo",
      "curve-quote",
      address?.toLowerCase() ?? token,
      curve,
      side,
      payingEth,
      amountIn?.toString(),
      bps?.toString(),
      wallet,
      marketPhase,
    ],
    enabled:
      !!pairToken &&
      !!amountIn &&
      bps != null &&
      (onCurve ? !!curve : onUniswap),
    queryFn: async () => {
      if (!address) throw new Error("This token is still loading.");
      const recipient = wallet ?? PREVIEW_RECIPIENT;
      if (onUniswap) {
        if (!launch.data) throw new Error("This token is still loading.");
        const poolKey = await readGraduatedPool(
          publicClient,
          launch.data.ponsFactory,
          address,
          launch.data.ponsMemeHook,
          pairToken!,
        );
        if (side === "sell") {
          const receive = await quoteV4ExactInput(publicClient, poolKey, address, amountIn!);
          return {
            receive,
            receiveSymbol: pairSymbol,
            receiveDecimals: pairDecimals,
            minimum: minTokensAtSlippage(receive, bps!),
            blocked: null,
            via: "Uniswap",
          };
        }
        let quoteIn = amountIn!;
        let via = "Uniswap";
        if (payingEth && !pairIsEth) {
          const swap = await quoteEthForToken(publicClient, pairToken!, amountIn!);
          quoteIn = swap.amountOut;
          via = `${formatQuoteAmount(swap.amountOut, swap.decimals)} ${pairSymbol} on Uniswap`;
        }
        const receive = await quoteV4ExactInput(
          publicClient,
          poolKey,
          payingEth && pairIsEth ? zeroAddress : pairToken!,
          quoteIn,
        );
        return {
          receive,
          receiveSymbol: tokenSymbol,
          receiveDecimals: tokenDecimals,
          minimum: minTokensAtSlippage(receive, bps!),
          blocked: null,
          via,
        };
      }
      if (side === "sell") {
        const priced = await quoteCurveSellFromChain(
          publicClient,
          curve!,
          amountIn!,
          recipient,
        );
        return {
          receive: priced.quoteOut,
          receiveSymbol: pairSymbol,
          receiveDecimals: pairDecimals,
          minimum: minTokensAtSlippage(priced.quoteOut, bps!),
          blocked: priced.readyToGraduate ? "Selling is closed while this curve graduates." : null,
          via: null as string | null,
        };
      }
      let quoteIn = amountIn!;
      let via: string | null = null;
      if (payingEth && !pairIsEth) {
        const swap = await quoteEthForToken(publicClient, pairToken!, amountIn!);
        quoteIn = swap.amountOut;
        via = `${formatQuoteAmount(swap.amountOut, swap.decimals)} ${pairSymbol}`;
      }
      const priced = await quoteCurveBuyFromChain(publicClient, curve!, quoteIn, recipient);
      return {
        receive: priced.tokensOut,
        receiveSymbol: tokenSymbol,
        receiveDecimals: tokenDecimals,
        minimum: minTokensAtSlippage(priced.tokensOut, bps!),
        blocked: priced.tokensOut === 0n ? "The curve has nothing left to sell." : null,
        via,
      };
    },
  });

  const needsApproval =
    !!amountIn &&
    !!allowanceToken &&
    allowanceToken !== zeroAddress &&
    (allowance.data ?? 0n) < amountIn;
  const closed =
    marketPhase === 1
      ? "Graduation is pending. Trading resumes on Uniswap once the pool is open."
      : marketPhase != null && !onCurve && !onUniswap
        ? "This token is not tradable right now."
        : (quote.data?.blocked ?? null);

  const submit = async () => {
    if (!identity.authenticated) {
      identity.login();
      return;
    }
    if (!wallet) {
      identity.connectOrCreateWallet();
      return;
    }
    if (!actions || !address || !pairToken || !amountIn || bps == null || closed) return;
    if (!onUniswap && !curve) return;
    setBusy(needsApproval && !payingEth ? "Approving…" : "Confirming…");
    try {
      if (onUniswap) {
        if (!launch.data) throw new Error("This token is still loading.");
        const poolKey = await readGraduatedPool(
          publicClient,
          launch.data.ponsFactory,
          address,
          launch.data.ponsMemeHook,
          pairToken,
        );
        if (side === "sell") {
          const receive = await quoteV4ExactInput(publicClient, poolKey, address, amountIn);
          const minimum = minTokensAtSlippage(receive, bps);
          if (minimum <= 0n) throw new Error("The quoted output is too small for this slippage.");
          await actions.swapOnUniswapV4({
            poolKey,
            tokenIn: address,
            amountIn,
            amountOutMinimum: minimum,
          });
        } else if (payingEth && !pairIsEth) {
          setBusy("Swapping ETH…");
          const swap = await quoteEthForToken(publicClient, pairToken, amountIn);
          const received = await actions.swapEthForToken({
            tokenOut: pairToken,
            amountIn,
            fee: swap.fee,
            minAmountOut: minTokensAtSlippage(swap.amountOut, bps),
          });
          setBusy("Confirming buy…");
          const receive = await quoteV4ExactInput(publicClient, poolKey, pairToken, received);
          const minimum = minTokensAtSlippage(receive, bps);
          if (minimum <= 0n) throw new Error("The quoted output is too small for this slippage.");
          await actions.swapOnUniswapV4({
            poolKey,
            tokenIn: pairToken,
            amountIn: received,
            amountOutMinimum: minimum,
          });
        } else {
          const tokenIn = payingEth ? zeroAddress : pairToken;
          const receive = await quoteV4ExactInput(publicClient, poolKey, tokenIn, amountIn);
          const minimum = minTokensAtSlippage(receive, bps);
          if (minimum <= 0n) throw new Error("The quoted output is too small for this slippage.");
          await actions.swapOnUniswapV4({
            poolKey,
            tokenIn,
            amountIn,
            amountOutMinimum: minimum,
          });
        }
        setAmount("");
        toast.success(side === "buy" ? "Buy confirmed." : "Sell confirmed.");
        await queryClient.invalidateQueries({ queryKey: ["rovo"] });
        return;
      }
      if (!curve) return;
      const recipient = wallet;
      if (side === "sell") {
        const priced = await quoteCurveSellFromChain(publicClient, curve, amountIn, recipient);
        if (priced.readyToGraduate) throw new Error("Selling is closed while this curve graduates.");
        const minQuoteOut = minTokensAtSlippage(priced.quoteOut, bps);
        if (minQuoteOut <= 0n) throw new Error("The quoted output is too small for this slippage.");
        await actions.sellOnCurve({ curve, token: address, tokensIn: amountIn, minQuoteOut });
      } else if (payingEth && !pairIsEth) {
        setBusy("Swapping ETH…");
        const swap = await quoteEthForToken(publicClient, pairToken, amountIn);
        const received = await actions.swapEthForToken({
          tokenOut: pairToken,
          amountIn,
          fee: swap.fee,
          minAmountOut: minTokensAtSlippage(swap.amountOut, bps),
        });
        setBusy("Confirming buy…");
        const priced = await quoteCurveBuyFromChain(publicClient, curve, received, recipient);
        const minTokensOut = minTokensAtSlippage(priced.tokensOut, bps);
        if (minTokensOut <= 0n) throw new Error("The quoted output is too small for this slippage.");
        await actions.buyOnCurve({
          curve,
          pairToken,
          quoteIn: received,
          minTokensOut,
        });
      } else {
        const priced = await quoteCurveBuyFromChain(publicClient, curve, amountIn, recipient);
        const minTokensOut = minTokensAtSlippage(priced.tokensOut, bps);
        if (minTokensOut <= 0n) throw new Error("The quoted output is too small for this slippage.");
        await actions.buyOnCurve({ curve, pairToken, quoteIn: amountIn, minTokensOut });
      }
      setAmount("");
      toast.success(side === "buy" ? "Buy confirmed." : "Sell confirmed.");
      await queryClient.invalidateQueries({ queryKey: ["rovo"] });
    } catch (cause) {
      toast.walletError(cause, "Transaction failed.");
    } finally {
      setBusy("");
    }
  };

  const buttonLabel = !identity.authenticated
    ? "Log in"
    : !wallet
      ? "Connect wallet"
      : busy
        ? busy
        : needsApproval && side === "sell"
          ? `Approve ${tokenSymbol}`
          : needsApproval
            ? `Approve ${pairSymbol}`
            : side === "buy"
              ? "Buy"
              : "Sell";

  if (!address) {
    return (
      <section className="rounded-[20px] border border-line bg-surface p-5">
        <p className="text-sm leading-6 text-muted">
          This token trades on Raydium. Open it on Solscan to buy or sell.
        </p>
        <a
          className="mt-3 inline-block text-sm font-semibold text-accent"
          href={`https://solscan.io/token/${token}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Solscan
        </a>
      </section>
    );
  }

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
              side === value
                ? "border border-line bg-surface-raised"
                : ""
            } ${value === "buy" ? "text-positive" : "text-danger"}`}
          >
            {value}
          </button>
        ))}
      </div>
      {side === "buy" && !pairIsEth && (
        <div className="mt-4 flex gap-2" role="group" aria-label="Pay with">
          {(["eth", "pair"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={(value === "eth") === payingEth}
              onClick={() => {
                setPayWith(value);
                setAmount("");
              }}
              className={`h-8 rounded-lg px-3 text-xs ${
                (value === "eth" ? payingEth : !payingEth)
                  ? "bg-action font-semibold text-ink"
                  : "border border-line text-muted"
              }`}
            >
              {value === "eth" ? "ETH" : pairSymbol}
            </button>
          ))}
        </div>
      )}
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
        {(payingEth || side === "sell" ? ["0.01", "0.1", "0.5", "1"] : ["0.1", "0.5", "1", "5"]).map(
          (value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className="rounded-[5px] border border-line bg-surface-raised px-3 py-1.5 text-[10px] font-medium text-muted"
            >
              {value} {inputSymbol}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => {
            if (balance.data == null) return;
            setAmount(formatQuoteAmount(balance.data, inputDecimals));
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
                slippage === value ? "bg-action font-semibold text-ink" : "bg-surface-raised text-muted"
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
            ? "Could not quote this trade."
            : quote.data && quote.data.receive > 0n
              ? `You receive ${formatQuoteAmount(quote.data.receive, quote.data.receiveDecimals)} ${quote.data.receiveSymbol}${
                  quote.data.via ? ` · via ${quote.data.via}` : ""
                }. Minimum ${formatQuoteAmount(quote.data.minimum, quote.data.receiveDecimals)} at ${slippage}% slippage.`
              : onUniswap
                ? "Enter an amount to quote Uniswap."
                : "Enter an amount to quote the curve."}
      </p>
      {balance.data != null && (
        <p className="mt-1 text-xs text-muted">
          Balance {formatQuoteAmount(balance.data, inputDecimals)} {inputSymbol}
        </p>
      )}
      {closed && <p className="mt-3 text-sm text-warning">{closed}</p>}
      <button
        type="button"
        disabled={!!busy || (!!wallet && (!!closed || bps == null || (!!amountIn && quote.data?.receive === 0n)))}
        onClick={() => void submit()}
        className="mt-4 flex h-[42px] w-full items-center justify-center rounded-lg bg-action text-sm font-semibold text-ink disabled:opacity-45"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
