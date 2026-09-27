import { keccak256, stringToBytes, zeroAddress, type Address } from "viem";
import { createRovoPublicClient, type RovoAddresses } from "../chain";
import { asAddress, asUint, normalizeHandle } from "../validation";
import {
  collectorAbi,
  erc20Abi,
  feeEscrowAbi,
  holderRewardsAbi,
  nottinghamAbi,
  ponsFactoryAbi,
  registryAbi,
  splitterAbi,
  wrapperAbi,
  zapRouterAbi,
} from "./abis";

export type RovoPublicClient = ReturnType<typeof createRovoPublicClient>;

export function createRovoReads(
  client: RovoPublicClient,
  addresses: RovoAddresses,
) {
  return {
    atomicLaunchRouter: () => client.readContract({
      address: addresses.wrapper,
      abi: wrapperAbi,
      functionName: "ponsLaunchAndBuy",
    }),
    getLaunch: (token: Address) =>
      client.readContract({
        address: addresses.registry,
        abi: registryAbi,
        functionName: "getLaunch",
        args: [asAddress(token)],
      }),
    tokenForHandle: (handle: string) =>
      client.readContract({
        address: addresses.registry,
        abi: registryAbi,
        functionName: "handleToToken",
        args: [keccak256(stringToBytes(normalizeHandle(handle)))],
      }),
    tokenForXUserId: (id: string | bigint) =>
      client.readContract({
        address: addresses.registry,
        abi: registryAbi,
        functionName: "xUserIdToToken",
        args: [asUint(id, 64, "X user ID")],
      }),
    launchFee: async () => {
      const factory = await client.readContract({
        address: addresses.wrapper,
        abi: wrapperAbi,
        functionName: "pons",
      });
      return client.readContract({
        address: factory,
        abi: ponsFactoryAbi,
        functionName: "launchFee",
      });
    },
    launchCurve: async (launchConfigId: number, pairToken: Address) => {
      const factory = await client.readContract({
        address: addresses.wrapper,
        abi: wrapperAbi,
        functionName: "pons",
      });
      const config = await client.readContract({
        address: factory,
        abi: ponsFactoryAbi,
        functionName: "getLaunchConfig",
        args: [BigInt(launchConfigId)],
      });
      if (!config.enabled) throw new Error("This launch configuration is disabled.");
      const [phantomQuote, graduationThreshold] =
        pairToken === zeroAddress
          ? [config.phantomQuote, config.graduationThreshold]
          : await client.readContract({
              address: factory,
              abi: ponsFactoryAbi,
              functionName: "pairTokenEconomics",
              args: [pairToken],
            });
      if (config.supply === 0n || phantomQuote === 0n || graduationThreshold === 0n) {
        throw new Error("This pair has no launch curve.");
      }
      return {
        supply: config.supply,
        feeBps: config.curveFeeBps,
        phantomQuote,
        graduationThreshold,
      };
    },
    scoutCreatorTaxBps: () =>
      client.readContract({
        address: addresses.wrapper,
        abi: wrapperAbi,
        functionName: "scoutCreatorTaxBps",
      }),
    pairEconomics: async (pairToken: Address) => {
      const factory = await client.readContract({
        address: addresses.wrapper,
        abi: wrapperAbi,
        functionName: "pons",
      });
      const [approved, economics, maxCreatorTaxBps] = await Promise.all([
        client.readContract({
          address: factory,
          abi: ponsFactoryAbi,
          functionName: "approvedPairTokens",
          args: [pairToken],
        }),
        client.readContract({
          address: factory,
          abi: ponsFactoryAbi,
          functionName: "pairTokenEconomics",
          args: [pairToken],
        }),
        client.readContract({
          address: factory,
          abi: ponsFactoryAbi,
          functionName: "maxCreatorTaxBps",
        }),
      ]);
      return {
        approved,
        phantomQuote: economics[0],
        graduationThreshold: economics[1],
        decimals: economics[2],
        maxCreatorTaxBps,
      };
    },
    ponsPhase: async (token: Address) => {
      const launch = await client.readContract({
        address: addresses.registry,
        abi: registryAbi,
        functionName: "getLaunch",
        args: [token],
      });
      const data = await client.readContract({
        address: launch.ponsFactory,
        abi: ponsFactoryAbi,
        functionName: "getLaunchedToken",
        args: [token],
      });
      return data.phase;
    },
    feeEscrowBalance: async (token: Address) => {
      const launch = await client.readContract({
        address: addresses.registry,
        abi: registryAbi,
        functionName: "getLaunch",
        args: [token],
      });
      return launch.pairToken === zeroAddress
        ? client.readContract({
            address: launch.ponsFeeEscrow,
            abi: feeEscrowAbi,
            functionName: "balanceOf",
            args: [launch.feeCollector],
          })
        : client.readContract({
            address: launch.ponsFeeEscrow,
            abi: feeEscrowAbi,
            functionName: "balanceOfToken",
            args: [launch.feeCollector, launch.pairToken],
          });
    },
    pendingFee: (asset: Address, account: Address) =>
      client.readContract({
        address: addresses.splitter,
        abi: splitterAbi,
        functionName: "pending",
        args: [asset, account],
      }),
    treasury: () =>
      client.readContract({
        address: addresses.splitter,
        abi: splitterAbi,
        functionName: "treasury",
      }),
    isFeeAdmin: (account: Address) =>
      client.readContract({
        address: addresses.splitter,
        abi: splitterAbi,
        functionName: "hasRole",
        args: [`0x${"00".repeat(32)}`, account],
      }),
    vaultBalance: (token: Address) =>
      client.readContract({
        address: addresses.nottingham,
        abi: nottinghamAbi,
        functionName: "pendingBalance",
        args: [token],
      }),
    pendingClaim: (token: Address) =>
      client.readContract({
        address: addresses.nottingham,
        abi: nottinghamAbi,
        functionName: "pendingClaims",
        args: [token],
      }),
    rewardPool: (token: Address) =>
      client.readContract({
        address: addresses.holderRewards,
        abi: holderRewardsAbi,
        functionName: "pools",
        args: [token],
      }),
    rewardEpoch: (token: Address, epochId: bigint) =>
      client.readContract({
        address: addresses.holderRewards,
        abi: holderRewardsAbi,
        functionName: "epochs",
        args: [token, epochId],
      }),
    rewardClaimed: (token: Address, epochId: bigint, account: Address) =>
      client.readContract({
        address: addresses.holderRewards,
        abi: holderRewardsAbi,
        functionName: "hasClaimed",
        args: [token, epochId, account],
      }),
    tokenBalance: (token: Address, account: Address) =>
      token === zeroAddress
        ? client.getBalance({ address: account })
        : client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
          }),
    tokenInfo: (token: Address) =>
      Promise.all([
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]).then(([symbol, decimals]) => ({ symbol, decimals })),
    allowance: (token: Address, owner: Address, spender: Address) =>
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
      }),
    inputAdapterAllowed: (adapter: Address) =>
      client.readContract({
        address: addresses.zapRouter,
        abi: zapRouterAbi,
        functionName: "allowedAdapters",
        args: [adapter],
      }),
    v4Adapter: (token: Address) =>
      client.readContract({
        address: addresses.zapRouter,
        abi: zapRouterAbi,
        functionName: "v4Adapters",
        args: [token],
      }),
    collectorToken: (collector: Address) =>
      client.readContract({
        address: collector,
        abi: collectorAbi,
        functionName: "profileToken",
      }),
  };
}
