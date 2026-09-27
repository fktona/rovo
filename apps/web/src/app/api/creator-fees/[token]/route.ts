import { fetchTokenPriceUsd } from "@/lib/asset-price";
import { fetchEthPriceUsd } from "@/lib/eth-price";
import { quoteAmountUsd } from "@/lib/token-market";

const tokenPattern = /^0x[a-fA-F0-9]{40}$/;

type CreatorFeeBody = {
  earnedForToken?: string;
  quoteAsset?: {
    address?: string;
    symbol?: string;
    decimals?: number;
    isNative?: boolean;
  };
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!tokenPattern.test(token)) {
    return Response.json({ error: "invalid token address" }, { status: 400 });
  }
  const upstream = await fetch(
    `https://www.ponsfamily.com/api/pons-v2-market/${token}/creator-fees`,
    { cache: "no-store" },
  );
  if (!upstream.ok) {
    return Response.json(
      { error: "creator fees unavailable" },
      { status: upstream.status },
    );
  }
  const body = (await upstream.json()) as CreatorFeeBody;
  const earned = body.earnedForToken;
  const quote = body.quoteAsset;
  if (
    typeof quote?.decimals === "number" &&
    typeof earned === "string" &&
    /^\d+$/.test(earned)
  ) {
    const priceUsd =
      quote.isNative && quote.symbol === "ETH"
        ? await fetchEthPriceUsd()
        : typeof quote.address === "string"
          ? await fetchTokenPriceUsd(quote.address)
          : null;
    const usdValue =
      priceUsd == null
        ? null
        : quoteAmountUsd(BigInt(earned), quote.decimals, priceUsd);
    if (usdValue != null) return Response.json({ ...body, usdValue });
  }
  return Response.json(body);
}
