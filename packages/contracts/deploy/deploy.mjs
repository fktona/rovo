import { writeFile } from "node:fs/promises";
import {
  artifact,
  compileContracts,
  requireFromContracts,
} from "../../../scripts/lib/compile-contracts.mjs";
import { deployRovoStack, verifyRovoDeployment } from "./deploy-stack.mjs";

const { createPublicClient, createWalletClient, http } =
  requireFromContracts("viem");
const { privateKeyToAccount } = requireFromContracts("viem/accounts");
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const { output } = compileContracts();
const artifacts = {
  RovoRegistry: artifact(output, "src/RovoRegistry.sol", "RovoRegistry"),
  LaunchFeeCollectorFactory: artifact(
    output,
    "src/LaunchFeeCollectorFactory.sol",
    "LaunchFeeCollectorFactory",
  ),
  NottinghamVault: artifact(
    output,
    "src/NottinghamVault.sol",
    "NottinghamVault",
  ),
  HolderRewardDistributor: artifact(
    output,
    "src/HolderRewardDistributor.sol",
    "HolderRewardDistributor",
  ),
  PlatformFeeReservoir: artifact(
    output,
    "src/PlatformFeeReservoir.sol",
    "PlatformFeeReservoir",
  ),
  RovoFeeSplitter: artifact(
    output,
    "src/RovoFeeSplitter.sol",
    "RovoFeeSplitter",
  ),
  RovoFactoryWrapper: artifact(
    output,
    "src/RovoFactoryWrapper.sol",
    "RovoFactoryWrapper",
  ),
  RovoZapRouter: artifact(output, "src/RovoZapRouter.sol", "RovoZapRouter"),
  UniswapV3StockAdapter: artifact(
    output,
    "src/UniswapV3StockAdapter.sol",
    "UniswapV3StockAdapter",
  ),
};
const account = privateKeyToAccount(required("DEPLOYER_PRIVATE_KEY"));
const transport = http(required("ROBINHOOD_RPC_URL"));
const client = createPublicClient({ transport });
const wallet = createWalletClient({ account, transport });
const config = {
  admin: account.address,
  treasury: required("ROVO_TREASURY_ADDRESS"),
  identitySigner: required("IDENTITY_SIGNER_ADDRESS"),
  epochPublisher: required("EPOCH_PUBLISHER_ADDRESS"),
  ponsFactory: required("PONS_FACTORY_ADDRESS"),
  ponsLaunchAndBuy: required("PONS_LAUNCH_AND_BUY_ADDRESS"),
  ponsFeeEscrow: required("PONS_FEE_ESCROW_ADDRESS"),
  ponsMemeHook: required("PONS_MEME_HOOK_ADDRESS"),
  claimDelay: BigInt(process.env.CLAIM_DELAY_SECONDS ?? "86400"),
  scoutCreatorTaxBps: Number(process.env.SCOUT_CREATOR_TAX_BPS ?? "100"),
  uniswapSwapRouter: required("UNISWAP_SWAP_ROUTER02_ADDRESS"),
  uniswapV3Factory: required("UNISWAP_V3_FACTORY_ADDRESS"),
  weth: required("WETH_ADDRESS"),
};
const deployment = await deployRovoStack({ wallet, client, artifacts, config });
await verifyRovoDeployment({ client, artifacts, deployment, config });
const outputPath = required("DEPLOYMENT_OUTPUT");
await writeFile(
  outputPath,
  `${JSON.stringify({ chainId: 4663, ...deployment }, null, 2)}\n`,
  { flag: "wx" },
);
console.log(
  `Rovo stack deployed and verified; manifest written to ${outputPath}`,
);
