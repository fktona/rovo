import { spawn } from "node:child_process";
import {
  artifact as getArtifact,
  compileContracts,
  requireFromContracts,
} from "./lib/compile-contracts.mjs";
import {
  deployRovoStack,
  verifyRovoDeployment,
} from "../packages/contracts/deploy/deploy-stack.mjs";

const { output, sourceCount, solcVersion } = compileContracts();
console.log(
  `Solidity ${solcVersion} compiled ${sourceCount} Rovo source/test files`,
);
const artifactSpecs = {
  RovoRegistry: ["src/RovoRegistry.sol", "RovoRegistry"],
  LaunchFeeCollectorFactory: [
    "src/LaunchFeeCollectorFactory.sol",
    "LaunchFeeCollectorFactory",
  ],
  NottinghamVault: ["src/NottinghamVault.sol", "NottinghamVault"],
  HolderRewardDistributor: [
    "src/HolderRewardDistributor.sol",
    "HolderRewardDistributor",
  ],
  PlatformFeeReservoir: [
    "src/PlatformFeeReservoir.sol",
    "PlatformFeeReservoir",
  ],
  RovoFeeSplitter: ["src/RovoFeeSplitter.sol", "RovoFeeSplitter"],
  RovoFactoryWrapper: ["src/RovoFactoryWrapper.sol", "RovoFactoryWrapper"],
  RovoZapRouter: ["src/RovoZapRouter.sol", "RovoZapRouter"],
  UniswapV3StockAdapter: [
    "src/UniswapV3StockAdapter.sol",
    "UniswapV3StockAdapter",
  ],
};
for (const [name, [source, contractName]] of Object.entries(artifactSpecs)) {
  const deployed =
    output.contracts[source][contractName].evm.deployedBytecode.object;
  if (deployed.length / 2 > 24_576)
    throw new Error(`${name} exceeds the EIP-170 deployed code-size limit`);
}

if (process.argv.includes("--compile-only")) {
  console.log("contract compilation passed");
  process.exit(0);
}

const { createPublicClient, createWalletClient, http } =
  requireFromContracts("viem");
const { privateKeyToAccount } = requireFromContracts("viem/accounts");
const port = 20_000 + (process.pid % 20_000);
const rpcUrl = `http://127.0.0.1:${port}`;
const anvil = spawn(
  "anvil",
  [
    "--port",
    String(port),
    "--hardfork",
    "cancun",
    "--gas-limit",
    "120000000",
    "--disable-code-size-limit",
    "--silent",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let anvilError = "";
anvil.stderr.on("data", (chunk) => {
  anvilError += chunk.toString();
});

async function receipt(hash) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [hash],
      }),
    });
    const payload = await response.json();
    if (payload.result) return payload.result;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  throw new Error(`Timed out waiting for transaction ${hash}`);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  if (!ready) throw new Error(`Anvil did not start: ${anvilError}`);
  console.log(`local Anvil EVM ready on ${rpcUrl}`);

  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );
  const transport = http(rpcUrl);
  const wallet = createWalletClient({ account, transport });
  const publicClient = createPublicClient({ transport });
  const artifact = output.contracts["test/RovoCore.t.sol"].RovoCoreTest;
  const deployment = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
    gas: 100_000_000n,
  });
  console.log(`Solidity test harness submitted: ${deployment}`);
  const deployed = await receipt(deployment);
  if (deployed.status !== "0x1" || !deployed.contractAddress)
    throw new Error("Test contract deployment failed");

  const unitTests = [
    "testRegistryRejectsASecondTokenForTheSameHandle",
    "testRegistryRejectsASecondTokenForTheSameXProfile",
    "testScoutSplitAndFundingInvariant",
    "testSelfRoveSplitUsesTheFullCombinedRevenue",
    "testUsdGRevenueCanGoDirectlyToTreasury",
    "testZeroTreasuryRejected",
  ];
  for (const functionName of unitTests) {
    const hash = await wallet.writeContract({
      address: deployed.contractAddress,
      abi: artifact.abi,
      functionName,
      gas: 100_000_000n,
    });
    const result = await receipt(hash);
    if (result.status !== "0x1") throw new Error(`${functionName} reverted`);
  }

  const payableTests = [
    ["testNativeEthFeeCollectionAndRewardClaims", 10_000n],
    ["testAdminBatchHarvestIsolatesFailedLaunch", 10_000n],
    ["testNativeRevenueCanGoDirectlyToTreasury", 10_000n],
    ["testZapNativeQuoteRefundAndUsdGRegression", 1_000n],
    ["testZapNativeV4QuoteRefund", 1_000n],
  ];
  for (const [functionName, value] of payableTests) {
    const hash = await wallet.writeContract({
      address: deployed.contractAddress,
      abi: artifact.abi,
      functionName,
      value,
      gas: 100_000_000n,
    });
    const result = await receipt(hash);
    if (result.status !== "0x1") throw new Error(`${functionName} reverted`);
  }
  console.log("native ETH contract paths passed");
  console.log("quote routing regression passed");
  console.log("admin fee release authorization passed");
  console.log("dual revenue route tests passed");

  const fuzzInputs = [
    0n,
    1n,
    2n,
    9n,
    10n,
    99n,
    100n,
    101n,
    999n,
    10_000n,
    2n ** 64n,
    2n ** 96n,
    2n ** 127n - 1n,
  ];
  for (const rawAmount of fuzzInputs) {
    const hash = await wallet.writeContract({
      address: deployed.contractAddress,
      abi: artifact.abi,
      functionName: "testFuzzSelfRoveAlwaysAccountsForEveryUnit",
      args: [rawAmount],
      gas: 100_000_000n,
    });
    const result = await receipt(hash);
    if (result.status !== "0x1")
      throw new Error(`accounting invariant failed for ${rawAmount}`);
  }
  const artifacts = Object.fromEntries(
    Object.entries(artifactSpecs).map(([name, [source, contractName]]) => [
      name,
      getArtifact(output, source, contractName),
    ]),
  );
  const config = {
    admin: account.address,
    treasury: "0x0000000000000000000000000000000000002001",
    identitySigner: account.address,
    epochPublisher: account.address,
    ponsFactory: "0x0000000000000000000000000000000000001001",
    ponsLaunchAndBuy: "0x0000000000000000000000000000000000001007",
    ponsFeeEscrow: "0x0000000000000000000000000000000000001002",
    ponsMemeHook: "0x0000000000000000000000000000000000001003",
    claimDelay: 86_400n,
    scoutCreatorTaxBps: 100,
    uniswapSwapRouter: "0x0000000000000000000000000000000000001004",
    uniswapV3Factory: "0x0000000000000000000000000000000000001005",
    weth: "0x0000000000000000000000000000000000001006",
  };
  const stack = await deployRovoStack({
    wallet,
    client: publicClient,
    artifacts,
    config,
  });
  await verifyRovoDeployment({
    client: publicClient,
    artifacts,
    deployment: stack,
    config,
  });
  console.log(
    `${unitTests.length + payableTests.length} contract unit tests and ${fuzzInputs.length} invariant vectors passed`,
  );
  console.log("deployment wiring verified");
  console.log("admin harvest deployment and batch passed");
  console.log("treasury route authorization passed");
  console.log("contract verification passed");
} finally {
  anvil.kill("SIGTERM");
}
