import { createPublicClient, http, parseAbi, zeroAddress, type Address } from "viem";
import { getWebConfig, robinhoodChain } from "@/lib/chain";
import { getPairChoice } from "@/lib/pairs";
import { fetchTokenPriceUsd } from "@/lib/asset-price";
import { fetchEthPriceUsd } from "@/lib/eth-price";
import {
  dexscreenerStats,
  marketCapInQuote,
  quoteAmountUsd,
  spotPriceInQuote,
} from "@/lib/token-market";

const tokenPattern = /^0x[a-fA-F0-9]{40}$/;

const registryAbi = parseAbi([
  "function getLaunch(address token) view returns ((address token,address curve,address pairToken,address feeCollector,address ponsFactory,address ponsFeeEscrow,address ponsMemeHook,bytes32 handleHash,bytes32 expectedEconomics,uint64 xUserId,address rover,address creator,uint64 launchedAt,uint16 creatorTaxBps,uint16 creatorToHoldersBps,uint32 launchConfigId,uint8 launchType,bool claimed,bool shareWithHolders) launch)",
]);

const factoryAbi = parseAbi([
  "function getLaunchedToken(address token) view returns ((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))",
]);

const curveAbi = parseAbi([
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
]);

async function dexscreenerMarket(token: string) {
  const upstream = await fetch(
    `https://api.dexscreener.com/tokens/v1/robinhood/${token}`,
    { cache: "no-store" },
  );
  if (!upstream.ok) return { available: false };
  const body: unknown = await upstream.json();
  const stats = dexscreenerStats(Array.isArray(body) ? body : [], token);
  return stats == null
    ? { available: false }
    : { available: true, marketCapUsd: stats.marketCap, priceUsd: stats.priceUsd };
}

const erc20Abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!tokenPattern.test(token)) {
    return Response.json({ error: "invalid token address" }, { status: 400 });
  }

  try {
    const config = getWebConfig();
    const client = createPublicClient({
      chain: robinhoodChain,
      transport: http(config.rpcUrl),
    });
    const launch = await client.readContract({
      address: config.addresses.registry,
      abi: registryAbi,
      functionName: "getLaunch",
      args: [token as Address],
    });
    if (launch.curve === zeroAddress || launch.ponsFactory === zeroAddress) {
      return Response.json({ available: false });
    }

    const launched = await client.readContract({
      address: launch.ponsFactory,
      abi: factoryAbi,
      functionName: "getLaunchedToken",
      args: [token as Address],
    });
    const phase = Number(launched.phase);
    // After graduation the curve price is stale. DexScreener indexes the v4 pool.
    if (phase !== 0) {
      return Response.json({ ...(await dexscreenerMarket(token)), phase });
    }

    const native = launch.pairToken === zeroAddress;
    const [reserves, totalSupply, quoteDecimals, tokenDecimals] = await Promise.all([
      client.readContract({
        address: launch.curve,
        abi: curveAbi,
        functionName: "getReserves",
      }),
      client.readContract({
        address: token as Address,
        abi: erc20Abi,
        functionName: "totalSupply",
      }),
      native
        ? Promise.resolve(18)
        : client.readContract({
            address: launch.pairToken,
            abi: erc20Abi,
            functionName: "decimals",
          }),
      client.readContract({
        address: token as Address,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);
    const quoteSymbol = native
      ? "ETH"
      : (getPairChoice(launch.pairToken)?.symbol ??
        (await client.readContract({
          address: launch.pairToken,
          abi: erc20Abi,
          functionName: "symbol",
        })));

    const marketCap = marketCapInQuote(reserves[0], reserves[1], totalSupply);
    if (marketCap === null) return Response.json({ available: false, phase });

    const quoteUsd = native
      ? await fetchEthPriceUsd()
      : await fetchTokenPriceUsd(launch.pairToken);
    if (quoteUsd != null) {
      const marketCapUsd = quoteAmountUsd(marketCap, quoteDecimals, quoteUsd);
      const spot = spotPriceInQuote(reserves[0], reserves[1], tokenDecimals);
      const priceUsd =
        spot == null ? null : quoteAmountUsd(spot, quoteDecimals, quoteUsd);
      if (marketCapUsd != null) {
        return Response.json({ available: true, marketCapUsd, priceUsd, phase });
      }
    }

    return Response.json({
      available: true,
      quoteSymbol,
      quoteDecimals,
      marketCap: marketCap.toString(),
      phase,
    });
  } catch {
    return Response.json({ error: "market unavailable" }, { status: 503 });
  }
}
