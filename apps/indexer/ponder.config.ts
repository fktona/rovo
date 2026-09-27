import { createConfig, factory } from "ponder";
import { zeroAddress, type Address } from "viem";
import {
  collectorAbi,
  collectorFactoryAbi,
  holderRewardsAbi,
  nottinghamAbi,
  registryAbi,
  splitterAbi,
} from "./abis/rovo.js";
import { indexerRpc } from "./src/paced-rpc.js";

const address = (name: string) => (process.env[name] ?? zeroAddress) as Address;
const startBlock = Number(process.env.ROVO_START_BLOCK ?? 0);
const rpcUrl =
  process.env.PONDER_RPC_URL_4663 ?? "https://rpc.mainnet.chain.robinhood.com";

export default createConfig({
  chains: {
    robinhood: {
      id: 4663,
      rpc: indexerRpc(rpcUrl),
      pollingInterval: 2_000,
    },
  },
  contracts: {
    RovoRegistry: {
      abi: registryAbi,
      chain: "robinhood",
      address: address("ROVO_REGISTRY_ADDRESS"),
      startBlock,
    },
    RovoFeeSplitter: {
      abi: splitterAbi,
      chain: "robinhood",
      address: address("ROVO_SPLITTER_ADDRESS"),
      startBlock,
    },
    CollectorFactory: {
      abi: collectorFactoryAbi,
      chain: "robinhood",
      address: address("ROVO_COLLECTOR_FACTORY_ADDRESS"),
      startBlock,
    },
    LaunchFeeCollector: {
      abi: collectorAbi,
      chain: "robinhood",
      address: factory({
        address: address("ROVO_COLLECTOR_FACTORY_ADDRESS"),
        event: collectorFactoryAbi[0],
        parameter: "collector",
      }),
      startBlock,
    },
    NottinghamVault: {
      abi: nottinghamAbi,
      chain: "robinhood",
      address: address("ROVO_NOTTINGHAM_ADDRESS"),
      startBlock,
    },
    HolderRewards: {
      abi: holderRewardsAbi,
      chain: "robinhood",
      address: address("ROVO_HOLDER_REWARDS_ADDRESS"),
      startBlock,
    },
  },
});
