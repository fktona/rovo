export async function deployRovoStack({ wallet, client, artifacts, config }) {
  const { isAddress, keccak256, toBytes } = await import("viem");
  const addresses = [
    config.admin,
    config.treasury,
    config.identitySigner,
    config.epochPublisher,
    config.ponsFactory,
    config.ponsLaunchAndBuy,
    config.ponsFeeEscrow,
    config.ponsMemeHook,
    config.uniswapSwapRouter,
    config.uniswapV3Factory,
    config.weth,
  ];
  if (
    !addresses.every(isAddress) ||
    /^0x0{40}$/i.test(config.treasury) ||
    config.claimDelay <= 0n ||
    config.scoutCreatorTaxBps < 100 ||
    config.scoutCreatorTaxBps > 500
  ) {
    throw new Error("Invalid deployment configuration");
  }

  async function wait(hash) {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      try {
        return await client.getTransactionReceipt({ hash });
      } catch {}
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
    throw new Error(`Timed out waiting for ${hash}`);
  }

  async function deploy(name, args) {
    const contract = artifacts[name];
    const hash = await wallet.deployContract({
      abi: contract.abi,
      bytecode: contract.bytecode,
      args,
    });
    const result = await wait(hash);
    if (result.status !== "success" || !result.contractAddress)
      throw new Error(`${name} deployment failed`);
    return result.contractAddress;
  }

  async function write(name, address, functionName, args) {
    const hash = await wallet.writeContract({
      address,
      abi: artifacts[name].abi,
      functionName,
      args,
    });
    const result = await wait(hash);
    if (result.status !== "success")
      throw new Error(`${name}.${functionName} failed`);
  }

  const registry = await deploy("RovoRegistry", [config.admin]);
  const collectorFactory = await deploy("LaunchFeeCollectorFactory", [
    config.admin,
  ]);
  const nottingham = await deploy("NottinghamVault", [
    config.admin,
    config.identitySigner,
    registry,
    config.claimDelay,
  ]);
  const holderRewards = await deploy("HolderRewardDistributor", [
    config.admin,
    config.epochPublisher,
    registry,
  ]);
  const reservoir = await deploy("PlatformFeeReservoir", [
    config.admin,
    registry,
  ]);
  const splitter = await deploy("RovoFeeSplitter", [
    config.admin,
    registry,
    nottingham,
    holderRewards,
    reservoir,
    config.treasury,
  ]);
  const zapRouter = await deploy("RovoZapRouter", [config.admin, registry]);
  const uniswapStockAdapter = await deploy("UniswapV3StockAdapter", [
    config.admin,
    config.uniswapSwapRouter,
    config.uniswapV3Factory,
    config.weth,
  ]);

  await write("NottinghamVault", nottingham, "setSplitter", [splitter]);
  await write("HolderRewardDistributor", holderRewards, "setSplitter", [
    splitter,
  ]);
  await write("PlatformFeeReservoir", reservoir, "setSplitter", [splitter]);

  const wrapper = await deploy("RovoFactoryWrapper", [
    config.admin,
    config.identitySigner,
    config.ponsFactory,
    config.ponsLaunchAndBuy,
    registry,
    collectorFactory,
    splitter,
    config.ponsFeeEscrow,
    config.ponsMemeHook,
    config.scoutCreatorTaxBps,
  ]);

  await write("RovoRegistry", registry, "grantRole", [
    keccak256(toBytes("LAUNCHER_ROLE")),
    wrapper,
  ]);
  await write("RovoRegistry", registry, "grantRole", [
    keccak256(toBytes("CLAIM_FINALIZER_ROLE")),
    nottingham,
  ]);
  await write("LaunchFeeCollectorFactory", collectorFactory, "grantRole", [
    keccak256(toBytes("WRAPPER_ROLE")),
    wrapper,
  ]);
  await write("RovoZapRouter", zapRouter, "setAdapter", [
    uniswapStockAdapter,
    true,
  ]);

  return {
    registry,
    collectorFactory,
    nottingham,
    holderRewards,
    reservoir,
    splitter,
    wrapper,
    zapRouter,
    uniswapStockAdapter,
  };
}

export async function verifyRovoDeployment({
  client,
  artifacts,
  deployment,
  config,
}) {
  const { keccak256, toBytes } = await import("viem");
  const checks = await Promise.all([
    client.readContract({
      address: deployment.registry,
      abi: artifacts.RovoRegistry.abi,
      functionName: "hasRole",
      args: [keccak256(toBytes("LAUNCHER_ROLE")), deployment.wrapper],
    }),
    client.readContract({
      address: deployment.registry,
      abi: artifacts.RovoRegistry.abi,
      functionName: "hasRole",
      args: [keccak256(toBytes("CLAIM_FINALIZER_ROLE")), deployment.nottingham],
    }),
    client.readContract({
      address: deployment.collectorFactory,
      abi: artifacts.LaunchFeeCollectorFactory.abi,
      functionName: "hasRole",
      args: [keccak256(toBytes("WRAPPER_ROLE")), deployment.wrapper],
    }),
    client.readContract({
      address: deployment.nottingham,
      abi: artifacts.NottinghamVault.abi,
      functionName: "splitter",
    }),
    client.readContract({
      address: deployment.holderRewards,
      abi: artifacts.HolderRewardDistributor.abi,
      functionName: "splitter",
    }),
    client.readContract({
      address: deployment.reservoir,
      abi: artifacts.PlatformFeeReservoir.abi,
      functionName: "splitter",
    }),
    client.readContract({
      address: deployment.wrapper,
      abi: artifacts.RovoFactoryWrapper.abi,
      functionName: "registry",
    }),
    client.readContract({
      address: deployment.wrapper,
      abi: artifacts.RovoFactoryWrapper.abi,
      functionName: "pons",
    }),
    client.readContract({
      address: deployment.wrapper,
      abi: artifacts.RovoFactoryWrapper.abi,
      functionName: "ponsLaunchAndBuy",
    }),
    client.readContract({
      address: deployment.zapRouter,
      abi: artifacts.RovoZapRouter.abi,
      functionName: "registry",
    }),
    client.readContract({
      address: deployment.zapRouter,
      abi: artifacts.RovoZapRouter.abi,
      functionName: "allowedAdapters",
      args: [deployment.uniswapStockAdapter],
    }),
    client.readContract({
      address: deployment.zapRouter,
      abi: artifacts.RovoZapRouter.abi,
      functionName: "hasRole",
      args: [`0x${"00".repeat(32)}`, config.admin],
    }),
    client.readContract({
      address: deployment.registry,
      abi: artifacts.RovoRegistry.abi,
      functionName: "hasRole",
      args: [`0x${"00".repeat(32)}`, config.admin],
    }),
    client.readContract({
      address: deployment.splitter,
      abi: artifacts.RovoFeeSplitter.abi,
      functionName: "hasRole",
      args: [`0x${"00".repeat(32)}`, config.admin],
    }),
    client.readContract({
      address: deployment.splitter,
      abi: artifacts.RovoFeeSplitter.abi,
      functionName: "treasury",
    }),
  ]);
  const [
    launcher,
    finalizer,
    collectorCreator,
    vaultSplitter,
    holderSplitter,
    reservoirSplitter,
    wrapperRegistry,
    wrapperPons,
    wrapperPonsRouter,
    zapRegistry,
    zapAdapter,
    zapAdmin,
    admin,
    splitterAdmin,
    treasury,
  ] = checks;
  if (
    !launcher ||
    !finalizer ||
    !collectorCreator ||
    !admin ||
    !splitterAdmin ||
    !zapAdmin ||
    !zapAdapter
  )
    throw new Error("Deployment role verification failed");
  if (treasury.toLowerCase() !== config.treasury.toLowerCase())
    throw new Error("Deployment treasury verification failed");
  if (
    [vaultSplitter, holderSplitter, reservoirSplitter].some(
      (value) => value.toLowerCase() !== deployment.splitter.toLowerCase(),
    )
  ) {
    throw new Error("Deployment splitter reference verification failed");
  }
  if (
    wrapperRegistry.toLowerCase() !== deployment.registry.toLowerCase() ||
    wrapperPons.toLowerCase() !== config.ponsFactory.toLowerCase() ||
    wrapperPonsRouter.toLowerCase() !== config.ponsLaunchAndBuy.toLowerCase()
  ) {
    throw new Error("Deployment wrapper reference verification failed");
  }
  if (zapRegistry.toLowerCase() !== deployment.registry.toLowerCase())
    throw new Error("Deployment zap registry verification failed");
}
