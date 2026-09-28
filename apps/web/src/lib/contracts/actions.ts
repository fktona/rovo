import {
  createWalletClient,
  custom,
  encodeFunctionData,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import type { BaseConnectedEthereumWallet } from "@privy-io/react-auth";
import { RovoApiClient, type RewardClaimView } from "../api";
import { robinhoodChain, type RovoAddresses } from "../chain";
import {
  asAddress,
  asBytes32,
  asUint,
  assertPositive,
  normalizeHandle,
  requireDeadline,
} from "../validation";
import {
  collectorAbi,
  curveAbi,
  erc20Abi,
  holderRewardsAbi,
  nottinghamAbi,
  ponsFactoryAbi,
  ponsLaunchAndBuyAbi,
  registryAbi,
  splitterAbi,
  wrapperAbi,
  zapRouterAbi,
} from "./abis";
import {
  swapRouterAbi,
  UNISWAP_SWAP_ROUTER,
  UNISWAP_WETH,
} from "./uniswap";
import {
  PERMIT2,
  permit2Abi,
  UNISWAP_V4_ROUTER,
  v4SwapCalldata,
  type V4PoolKey,
} from "./uniswap-v4";
import {
  claimAttestationArgs,
  hashTokenMetadata,
  scoutAttestationArgs,
  selfRoveAttestationArgs,
  tradeValue,
} from "./helpers";
import { createRovoReads, type RovoPublicClient } from "./reads";
import type { LaunchInput, ScoutInput, SelfRoveInput, TradeInput } from "./types";

function assertLaunchInput(input: ScoutInput | SelfRoveInput) {
  asAddress(input.pairToken, "pair token");
  asBytes32(input.metadata.salt, "token salt");
  asUint(input.launchConfigId, 32, "launch config ID");
  if (!input.metadata.name.trim() || !input.metadata.symbol.trim())
    throw new Error("Token name and symbol are required");
}

export function validateRewardClaim(claim: RewardClaimView, token: Address) {
  if (claim.profileToken.toLowerCase() !== token.toLowerCase())
    throw new Error("Reward proof belongs to another token");
  const epochId = asUint(claim.epochId, 256, "epoch ID");
  const amount = assertPositive(
    asUint(claim.amount, 256, "reward amount"),
    "reward amount",
  );
  return {
    epochId,
    amount,
    proof: claim.proof.map((item) => asBytes32(item, "Merkle proof")),
  };
}

export function createRovoActions(deps: {
  wallet: BaseConnectedEthereumWallet;
  client: RovoPublicClient;
  addresses: RovoAddresses;
  api: RovoApiClient;
  getAccessToken: () => Promise<string | null>;
}) {
  const { wallet, client, addresses, api } = deps;
  const account = asAddress(wallet.address, "connected wallet");
  const reads = createRovoReads(client, addresses);

  async function send(to: Address, data: Hex, value = 0n) {
    await wallet.switchChain(robinhoodChain.id);
    const provider = await wallet.getEthereumProvider();
    await provider
      .request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: toHex(robinhoodChain.id),
            chainName: robinhoodChain.name,
            nativeCurrency: robinhoodChain.nativeCurrency,
            rpcUrls: [robinhoodChain.rpcUrls.default.http[0]],
            blockExplorerUrls: [robinhoodChain.blockExplorers.default.url],
          },
        ],
      })
      .catch((error: unknown) => {
        const code =
          typeof error === "object" && error && "code" in error
            ? Number(error.code)
            : undefined;
        if (code === 4001)
          throw new Error("Approve the Robinhood Chain network in your wallet to launch.");
      });
    const walletClient = createWalletClient({
      account,
      chain: robinhoodChain,
      transport: custom(provider),
    });
    if ((await walletClient.getChainId()) !== robinhoodChain.id)
      throw new Error("Wallet is not on Robinhood Chain");
    const hash = await walletClient.sendTransaction({ to, data, value });
    let receipt;
    try {
      receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
    } catch {
      throw new Error(
        `Transaction ${hash} was submitted but Robinhood RPC did not confirm it. Check the transaction and profile on-chain before retrying.`,
      );
    }
    if (receipt.status !== "success")
      throw new Error(`Transaction reverted: ${hash}`);
    return receipt;
  }

  async function accessToken() {
    const token = await deps.getAccessToken();
    if (!token) throw new Error("Sign in with Privy before continuing");
    return token;
  }

  async function ensureAdmin() {
    if (!(await reads.isFeeAdmin(account)))
      throw new Error("Connected wallet is not a Rovo fee admin");
  }

  async function ensurePermit2(token: Address, amount: bigint) {
    if ((await reads.allowance(token, account, PERMIT2)) < amount) {
      await send(
        token,
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [PERMIT2, amount],
        }),
      );
    }
    const allowance = await client.readContract({
      address: PERMIT2,
      abi: permit2Abi,
      functionName: "allowance",
      args: [account, token, UNISWAP_V4_ROUTER],
    });
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (allowance[0] < amount || allowance[1] <= now + 60n) {
      const expiration = now + 30n * 60n;
      if (amount > 2n ** 160n - 1n)
        throw new Error("Trade amount is too large for a Uniswap swap.");
      await send(
        PERMIT2,
        encodeFunctionData({
          abi: permit2Abi,
          functionName: "approve",
          args: [token, UNISWAP_V4_ROUTER, amount, Number(expiration)],
        }),
      );
    }
  }

  async function openingBuyValue(input: ScoutInput | SelfRoveInput) {
    const opening = input.openingBuy;
    if (!opening) return 0n;
    assertPositive(opening.quoteIn, "opening buy amount");
    assertPositive(opening.minTokensOut, "minimum opening buy output");
    if (input.pairToken === zeroAddress) return opening.quoteIn;
    const allowance = await reads.allowance(input.pairToken, account, addresses.wrapper);
    if (allowance < opening.quoteIn)
      throw new Error("Approve the quote asset for the Rovo launch wrapper first");
    return 0n;
  }

  return {
    account,
    async verifyX() {
      return api.verifyX(await accessToken(), account);
    },
    async launchSelfRove(input: SelfRoveInput) {
      assertLaunchInput(input);
      const tax = Number(asUint(input.creatorTaxBps, 16, "creator tax"));
      if (tax < 100 || tax > 500) throw new Error("Creator tax must be 1%-5%");
      if (input.pairToken !== zeroAddress) {
        const economics = await reads.pairEconomics(input.pairToken);
        if (!economics.approved || economics.phantomQuote === 0n || economics.graduationThreshold === 0n || tax > economics.maxCreatorTaxBps)
          throw new Error("Pons does not allow this pair token and tax");
      }
      const buyValue = await openingBuyValue(input);
      const attestation = await api.selfRoveAttestation(
        await accessToken(),
        account,
        hashTokenMetadata(input.metadata),
      );
      const checked = selfRoveAttestationArgs(
        attestation,
        addresses.wrapper,
        input.metadata,
        account,
      );
      const args = [
        input.metadata,
        input.launchConfigId,
        input.pairToken,
        tax,
        {
          xUserId: checked.xUserId,
          handle: checked.handle,
          metadataHash: checked.metadataHash,
          recipient: checked.recipient,
          nonce: checked.nonce,
          deadline: checked.deadline,
        },
        checked.signature,
      ] as const;
      return send(
        addresses.wrapper,
        input.openingBuy
          ? encodeFunctionData({ abi: wrapperAbi, functionName: "launchSelfRoveAndBuy", args: [...args, input.openingBuy.quoteIn, input.openingBuy.minTokensOut] })
          : encodeFunctionData({ abi: wrapperAbi, functionName: "launchSelfRove", args }),
        (await reads.launchFee()) + buyValue,
      );
    },
    async launchMeme(input: LaunchInput & { creatorTaxBps: number }) {
      assertLaunchInput(input);
      const tax = Number(asUint(input.creatorTaxBps, 16, "creator tax"));
      const factory = await client.readContract({
        address: addresses.wrapper,
        abi: wrapperAbi,
        functionName: "pons",
      });
      const [allowed, maxTax, expectedEconomics] = await Promise.all([
        client.readContract({
          address: factory,
          abi: ponsFactoryAbi,
          functionName: "canLaunch",
          args: [account],
        }),
        client.readContract({
          address: factory,
          abi: ponsFactoryAbi,
          functionName: "maxCreatorTaxBps",
        }),
        client.readContract({
          address: factory,
          abi: ponsFactoryAbi,
          functionName: "previewLaunchEconomics",
          args: [BigInt(input.launchConfigId), input.pairToken],
        }),
      ]);
      if (!allowed) throw new Error("This wallet cannot launch on Pons yet.");
      if (tax > maxTax) throw new Error("Creator tax is above the Pons maximum.");
      if (input.pairToken !== zeroAddress) {
        const economics = await reads.pairEconomics(input.pairToken);
        if (!economics.approved || economics.phantomQuote === 0n || economics.graduationThreshold === 0n)
          throw new Error("Pons does not allow this pair token");
      }
      const treasury = await reads.treasury();
      if (treasury === zeroAddress) throw new Error("Fee treasury is not configured.");
      const params = {
        name: input.metadata.name,
        symbol: input.metadata.symbol,
        logo: input.metadata.logo,
        description: input.metadata.description,
        socials: input.metadata.socials,
        creatorFeeRecipient: treasury,
        creatorTaxBps: tax,
        buybackEnabled: false,
        expectedEconomics,
        salt: input.metadata.salt,
      } as const;
      const fee = await reads.launchFee();
      if (!input.openingBuy) {
        return send(
          factory,
          encodeFunctionData({
            abi: ponsFactoryAbi,
            functionName: "launchToken",
            args: [params, BigInt(input.launchConfigId), input.pairToken],
          }),
          fee,
        );
      }
      const router = await reads.atomicLaunchRouter();
      const value =
        input.pairToken === zeroAddress ? fee + input.openingBuy.quoteIn : fee;
      return send(
        router,
        encodeFunctionData({
          abi: ponsLaunchAndBuyAbi,
          functionName: "launchAndBuy",
          args: [
            params,
            BigInt(input.launchConfigId),
            input.pairToken,
            input.openingBuy.quoteIn,
            input.openingBuy.minTokensOut,
            account,
            [],
          ],
        }),
        value,
      );
    },
    async launchScout(input: ScoutInput) {
      assertLaunchInput(input);
      if (input.pairToken !== zeroAddress) {
        const economics = await reads.pairEconomics(input.pairToken);
        if (!economics.approved || economics.phantomQuote === 0n || economics.graduationThreshold === 0n)
          throw new Error("Pons does not allow this pair token");
      }
      const buyValue = await openingBuyValue(input);
      const attestation = await api.scoutAttestation(
        normalizeHandle(input.handle),
        hashTokenMetadata(input.metadata),
      );
      const checked = scoutAttestationArgs(
        attestation,
        addresses.wrapper,
        input.metadata,
      );
      if (normalizeHandle(checked.handle) !== normalizeHandle(input.handle))
        throw new Error("Scout attestation profile mismatch");
      const args = [
        input.metadata,
        input.launchConfigId,
        input.pairToken,
        {
          xUserId: checked.xUserId,
          handle: checked.handle,
          metadataHash: checked.metadataHash,
          nonce: checked.nonce,
          deadline: checked.deadline,
        },
        checked.signature,
      ] as const;
      return send(
        addresses.wrapper,
        input.openingBuy
          ? encodeFunctionData({ abi: wrapperAbi, functionName: "launchScoutAndBuy", args: [...args, input.openingBuy.quoteIn, input.openingBuy.minTokensOut] })
          : encodeFunctionData({ abi: wrapperAbi, functionName: "launchScout", args }),
        (await reads.launchFee()) + buyValue,
      );
    },
    async swapEthForToken(input: {
      tokenOut: Address;
      amountIn: bigint;
      fee: number;
      minAmountOut: bigint;
    }) {
      const tokenOut = asAddress(input.tokenOut, "output token");
      if (tokenOut === zeroAddress) throw new Error("ETH does not need a swap");
      const amountIn = assertPositive(input.amountIn, "swap amount");
      const minAmountOut = assertPositive(input.minAmountOut, "minimum swap output");
      const before = await reads.tokenBalance(tokenOut, account);
      await send(
        UNISWAP_SWAP_ROUTER,
        encodeFunctionData({
          abi: swapRouterAbi,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: UNISWAP_WETH,
              tokenOut,
              fee: input.fee,
              recipient: account,
              amountIn,
              amountOutMinimum: minAmountOut,
              sqrtPriceLimitX96: 0n,
            },
          ],
        }),
        amountIn,
      );
      const after = await reads.tokenBalance(tokenOut, account);
      const received = after > before ? after - before : 0n;
      if (received < minAmountOut)
        throw new Error("Uniswap returned less of the pair token than expected.");
      return received;
    },
    async approveToken(token: Address, spender: Address, amount: bigint) {
      if (token === zeroAddress)
        throw new Error("Native ETH does not need approval");
      assertPositive(amount, "approval amount");
      return send(
        token,
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, amount],
        }),
      );
    },
    async buyOnCurve(input: {
      curve: Address;
      pairToken: Address;
      quoteIn: bigint;
      minTokensOut: bigint;
    }) {
      const curve = asAddress(input.curve, "curve");
      const pairToken = asAddress(input.pairToken, "pair token");
      const quoteIn = assertPositive(input.quoteIn, "quote amount");
      const minTokensOut = assertPositive(input.minTokensOut, "minimum tokens out");
      const data = encodeFunctionData({
        abi: curveAbi,
        functionName: "buy",
        args: [quoteIn, minTokensOut, account],
      });
      if (pairToken === zeroAddress) return send(curve, data, quoteIn);
      if ((await reads.allowance(pairToken, account, curve)) < quoteIn) {
        await send(
          pairToken,
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [curve, quoteIn],
          }),
        );
      }
      return send(curve, data);
    },
    async sellOnCurve(input: {
      curve: Address;
      token: Address;
      tokensIn: bigint;
      minQuoteOut: bigint;
    }) {
      const curve = asAddress(input.curve, "curve");
      const token = asAddress(input.token, "token");
      const tokensIn = assertPositive(input.tokensIn, "token amount");
      const minQuoteOut = assertPositive(input.minQuoteOut, "minimum quote out");
      if ((await reads.allowance(token, account, curve)) < tokensIn) {
        await send(
          token,
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [curve, tokensIn],
          }),
        );
      }
      return send(
        curve,
        encodeFunctionData({
          abi: curveAbi,
          functionName: "sell",
          args: [tokensIn, minQuoteOut, account],
        }),
      );
    },
    async swapOnUniswapV4(input: {
      poolKey: V4PoolKey;
      tokenIn: Address;
      amountIn: bigint;
      amountOutMinimum: bigint;
    }) {
      const tokenIn = asAddress(input.tokenIn, "swap input");
      const amountIn = assertPositive(input.amountIn, "swap amount");
      if (input.amountOutMinimum < 0n)
        throw new Error("Minimum output cannot be negative");
      if (tokenIn !== zeroAddress) await ensurePermit2(tokenIn, amountIn);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      const call = v4SwapCalldata({
        poolKey: input.poolKey,
        tokenIn,
        amountIn,
        amountOutMinimum: input.amountOutMinimum,
        deadline,
      });
      return send(call.to, call.data, call.value);
    },
    async buy(input: TradeInput) {
      const value = tradeValue(input);
      const launch = await reads.getLaunch(input.profileToken);
      const phase = await reads.ponsPhase(input.profileToken);
      if (phase === 1)
        throw new Error(
          "Pons graduation is pending; call completeGraduation first",
        );
      if (phase !== 0 && phase !== 2)
        throw new Error(`Pons phase ${phase} is not tradable`);
      const adapter = input.inputAdapter ?? zeroAddress;
      if (input.inputToken.toLowerCase() !== launch.pairToken.toLowerCase()) {
        if (
          adapter === zeroAddress ||
          !(await reads.inputAdapterAllowed(adapter))
        )
          throw new Error("Input adapter is not allowlisted");
      } else if (adapter !== zeroAddress)
        throw new Error("Direct pair trade must not supply an input adapter");
      if (
        input.inputToken !== zeroAddress &&
        (await reads.allowance(
          input.inputToken,
          account,
          addresses.zapRouter,
        )) < input.amountIn
      ) {
        throw new Error("Approve the input token for the Zap router first");
      }
      const common = [
        input.profileToken,
        input.inputToken,
        input.amountIn,
        input.minPairOut,
        input.minProfileOut,
        requireDeadline(input.deadline),
        adapter,
        input.inputAdapterData ?? "0x",
      ] as const;
      if (phase === 0)
        return send(
          addresses.zapRouter,
          encodeFunctionData({
            abi: zapRouterAbi,
            functionName: "buyCurve",
            args: common,
          }),
          value,
        );
      if ((await reads.v4Adapter(input.profileToken)) === zeroAddress)
        throw new Error("V4 trading adapter is not configured");
      return send(
        addresses.zapRouter,
        encodeFunctionData({
          abi: zapRouterAbi,
          functionName: "buyV4",
          args: [...common, input.v4AdapterData ?? "0x"],
        }),
        value,
      );
    },
    completeGraduation(token: Address) {
      return send(
        addresses.zapRouter,
        encodeFunctionData({
          abi: zapRouterAbi,
          functionName: "completeGraduation",
          args: [token],
        }),
      );
    },
    async initiateNottinghamClaim(token: Address) {
      const attestation = await api.claimAttestation(
        await accessToken(),
        account,
        token,
      );
      const checked = claimAttestationArgs(
        attestation,
        addresses.nottingham,
        token,
        account,
      );
      return send(
        addresses.nottingham,
        encodeFunctionData({
          abi: nottinghamAbi,
          functionName: "initiateClaim",
          args: [
            {
              xUserId: checked.xUserId,
              handle: checked.handle,
              recipient: checked.recipient,
              profileToken: checked.profileToken,
              nonce: checked.nonce,
              deadline: checked.deadline,
            },
            checked.signature,
          ],
        }),
      );
    },
    finalizeNottinghamClaim(token: Address) {
      return send(
        addresses.nottingham,
        encodeFunctionData({
          abi: nottinghamAbi,
          functionName: "finalizeClaim",
          args: [token],
        }),
      );
    },
    setShareWithHolders(token: Address, enabled: boolean, bps: number) {
      const share = Number(asUint(bps, 16, "share bps"));
      if (share > 10_000) throw new Error("Share exceeds 100%");
      return send(
        addresses.registry,
        encodeFunctionData({
          abi: registryAbi,
          functionName: "setShareWithHolders",
          args: [token, enabled, enabled ? share : 0],
        }),
      );
    },
    async claimReward(claim: RewardClaimView) {
      const { epochId, amount, proof } = validateRewardClaim(
        claim,
        claim.profileToken,
      );
      const [launch, epoch] = await Promise.all([
        reads.getLaunch(claim.profileToken),
        reads.rewardEpoch(claim.profileToken, epochId),
      ]);
      if (
        launch.pairToken.toLowerCase() !== claim.stockToken.toLowerCase() ||
        epoch[0].toLowerCase() !== claim.merkleRoot.toLowerCase() ||
        amount > epoch[2]
      ) {
        throw new Error(
          "Reward proof does not match the current on-chain epoch",
        );
      }
      if (await reads.rewardClaimed(claim.profileToken, epochId, account))
        throw new Error("Reward already claimed");
      return send(
        addresses.holderRewards,
        encodeFunctionData({
          abi: holderRewardsAbi,
          functionName: "claim",
          args: [claim.profileToken, epochId, amount, proof],
        }),
      );
    },
    withdrawFees(asset: Address) {
      return send(
        addresses.splitter,
        encodeFunctionData({
          abi: splitterAbi,
          functionName: "withdraw",
          args: [asset],
        }),
      );
    },
    async harvest(token: Address) {
      await ensureAdmin();
      return send(
        addresses.splitter,
        encodeFunctionData({
          abi: splitterAbi,
          functionName: "harvest",
          args: [token],
        }),
      );
    },
    async harvestBatch(tokens: Address[]) {
      await ensureAdmin();
      if (tokens.length === 0) throw new Error("Choose at least one launch");
      return send(
        addresses.splitter,
        encodeFunctionData({
          abi: splitterAbi,
          functionName: "harvestBatch",
          args: [tokens.map((token) => asAddress(token))],
        }),
      );
    },
    async collectToTreasury(token: Address) {
      await ensureAdmin();
      const launch = await reads.getLaunch(token);
      if (
        launch.feeCollector === zeroAddress ||
        (await reads.collectorToken(launch.feeCollector)).toLowerCase() !==
          token.toLowerCase()
      ) {
        throw new Error("Launch collector binding mismatch");
      }
      return send(
        launch.feeCollector,
        encodeFunctionData({
          abi: collectorAbi,
          functionName: "collectToTreasury",
        }),
      );
    },
  };
}
