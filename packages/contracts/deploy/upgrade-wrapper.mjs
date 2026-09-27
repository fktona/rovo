import { access, readFile, writeFile } from "node:fs/promises";
import { artifact, compileContracts, requireFromContracts } from "../../../scripts/lib/compile-contracts.mjs";

const { createPublicClient, createWalletClient, http, isAddress, keccak256, toBytes } = requireFromContracts("viem");
const { privateKeyToAccount } = requireFromContracts("viem/accounts");
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const previous = JSON.parse(await readFile(new URL("../deployments/4663.json", import.meta.url), "utf8"));
const outputPath = new URL("../deployments/4663-wrapper-upgrade.json", import.meta.url);
try {
  await access(outputPath);
  throw new Error("Wrapper upgrade manifest already exists; refusing a second deployment");
} catch (cause) {
  if (cause.code !== "ENOENT") throw cause;
}
if (previous.chainId !== 4663) throw new Error("Expected Robinhood Chain deployment manifest");
const account = privateKeyToAccount(required("DEPLOYER_PRIVATE_KEY"));
const client = createPublicClient({ transport: http(required("ROBINHOOD_RPC_URL")) });
const wallet = createWalletClient({ account, transport: http(required("ROBINHOOD_RPC_URL")) });
const router = required("PONS_LAUNCH_AND_BUY_ADDRESS");
const identitySigner = required("IDENTITY_SIGNER_ADDRESS");
const pons = required("PONS_FACTORY_ADDRESS");
const escrow = required("PONS_FEE_ESCROW_ADDRESS");
const hook = required("PONS_MEME_HOOK_ADDRESS");
const tax = Number(process.env.SCOUT_CREATOR_TAX_BPS ?? "100");
if (![router, identitySigner, pons, escrow, hook].every(isAddress) || tax < 100 || tax > 500)
  throw new Error("Invalid wrapper upgrade configuration");
if (await client.getChainId() !== 4663) throw new Error("RPC is not Robinhood Chain mainnet");
const routerCode = await client.getBytecode({ address: router });
if (!routerCode || routerCode === "0x") throw new Error("Pons launch-and-buy router has no code");
const launchForwarder = await client.readContract({
  address: pons,
  abi: [{ type: "function", name: "launchForwarder", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
  functionName: "launchForwarder",
});
if (launchForwarder.toLowerCase() !== router.toLowerCase())
  throw new Error("Pons factory does not trust the configured launch-and-buy router");

const { output } = compileContracts();
const wrapper = artifact(output, "src/RovoFactoryWrapper.sol", "RovoFactoryWrapper");
const registry = artifact(output, "src/RovoRegistry.sol", "RovoRegistry");
const collectorFactory = artifact(output, "src/LaunchFeeCollectorFactory.sol", "LaunchFeeCollectorFactory");
const adminRole = `0x${"00".repeat(32)}`;
for (const [name, address, abi] of [
  ["registry", previous.registry, registry.abi],
  ["collector factory", previous.collectorFactory, collectorFactory.abi],
]) {
  if (!await client.readContract({ address, abi, functionName: "hasRole", args: [adminRole, account.address] }))
    throw new Error(`Deployer is not ${name} admin`);
}

const hash = await wallet.deployContract({
  abi: wrapper.abi,
  bytecode: wrapper.bytecode,
  args: [account.address, identitySigner, pons, router, previous.registry,
    previous.collectorFactory, previous.splitter, escrow, hook, tax],
});
const deployed = await client.waitForTransactionReceipt({ hash });
if (deployed.status !== "success" || !deployed.contractAddress) throw new Error("Wrapper deployment failed");
const newWrapper = deployed.contractAddress;
for (const [address, abi, role] of [
  [previous.registry, registry.abi, keccak256(toBytes("LAUNCHER_ROLE"))],
  [previous.collectorFactory, collectorFactory.abi, keccak256(toBytes("WRAPPER_ROLE"))],
]) {
  const grantHash = await wallet.writeContract({ address, abi, functionName: "grantRole", args: [role, newWrapper] });
  const receipt = await client.waitForTransactionReceipt({ hash: grantHash });
  if (receipt.status !== "success") throw new Error(`Role grant failed: ${grantHash}`);
  if (!await client.readContract({ address, abi, functionName: "hasRole", args: [role, newWrapper] }))
    throw new Error(`Role verification failed: ${address}`);
}
const ponsAbi = [{ type: "function", name: "canLaunch", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] }];
const canLaunch = await client.readContract({ address: pons, abi: ponsAbi, functionName: "canLaunch", args: [newWrapper] });
const result = { chainId: 4663, previousWrapper: previous.wrapper, wrapper: newWrapper,
  deployTransaction: hash, deployBlock: Number(deployed.blockNumber), ponsRouter: router, canLaunch };
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
console.log(`New wrapper: ${newWrapper}`);
console.log(`Pons permits new wrapper to launch: ${canLaunch}`);
console.log(`Set ROVO_FACTORY_WRAPPER_ADDRESS=${newWrapper} in root .env for the API.`);
console.log(`Also set NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS=${newWrapper} in root .env.`);
console.log(`Set NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS=${newWrapper} in apps/web/.env.local, then restart API and web.`);
if (!canLaunch) console.log("Pons must enable/whitelist the new wrapper before launches can succeed.");
