import { parseAbi } from "viem";

export const registryAbi = parseAbi([
  "function getLaunch(address token) view returns ((address token,address curve,address pairToken,address feeCollector,address ponsFactory,address ponsFeeEscrow,address ponsMemeHook,bytes32 handleHash,bytes32 expectedEconomics,uint64 xUserId,address rover,address creator,uint64 launchedAt,uint16 creatorTaxBps,uint16 creatorToHoldersBps,uint32 launchConfigId,uint8 launchType,bool claimed,bool shareWithHolders) launch)",
  "function handleToToken(bytes32 handleHash) view returns (address)",
  "function xUserIdToToken(uint64 xUserId) view returns (address)",
  "function setShareWithHolders(address token,bool enabled,uint16 bps)",
]);

export const wrapperAbi = parseAbi([
  "function pons() view returns (address)",
  "function ponsLaunchAndBuy() view returns (address)",
  "function scoutCreatorTaxBps() view returns (uint16)",
  "function hashMetadata((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,bytes32 salt) metadata) pure returns (bytes32)",
  "function launchSelfRove((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,bytes32 salt) metadata,uint32 launchConfigId,address pairToken,uint16 creatorTaxBps,(uint64 xUserId,string handle,bytes32 metadataHash,address recipient,uint256 nonce,uint256 deadline) attestation,bytes signature) payable returns (address token,address curve)",
  "function launchScout((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,bytes32 salt) metadata,uint32 launchConfigId,address pairToken,(uint64 xUserId,string handle,bytes32 metadataHash,uint256 nonce,uint256 deadline) attestation,bytes signature) payable returns (address token,address curve)",
  "function launchSelfRoveAndBuy((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,bytes32 salt) metadata,uint32 launchConfigId,address pairToken,uint16 creatorTaxBps,(uint64 xUserId,string handle,bytes32 metadataHash,address recipient,uint256 nonce,uint256 deadline) attestation,bytes signature,uint256 quoteIn,uint256 minTokensOut) payable returns (address token,address curve)",
  "function launchScoutAndBuy((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,bytes32 salt) metadata,uint32 launchConfigId,address pairToken,(uint64 xUserId,string handle,bytes32 metadataHash,uint256 nonce,uint256 deadline) attestation,bytes signature,uint256 quoteIn,uint256 minTokensOut) payable returns (address token,address curve)",
  "event RovoLaunchCreated(address indexed token,address indexed curve,address indexed collector,uint64 xUserId,uint8 launchType)",
]);

export const ponsFactoryAbi = parseAbi([
  "function launchFee() view returns (uint256)",
  "function maxCreatorTaxBps() view returns (uint16)",
  "function approvedPairTokens(address pairToken) view returns (bool)",
  "function pairTokenEconomics(address pairToken) view returns (uint256 phantomQuote,uint256 graduationThreshold,uint8 decimals)",
  "function getLaunchConfig(uint256 id) view returns ((uint256 supply,uint256 curveFeeBps,uint256 phantomQuote,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,bool enabled) config)",
  "function getLaunchedToken(address token) view returns ((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))",
]);

export const zapRouterAbi = parseAbi([
  "function buyCurve(address profileToken,address inputToken,uint256 amountIn,uint256 minPairOut,uint256 minProfileOut,uint256 deadline,address inputAdapter,bytes inputAdapterData) payable returns (uint256 profileOut)",
  "function buyV4(address profileToken,address inputToken,uint256 amountIn,uint256 minPairOut,uint256 minProfileOut,uint256 deadline,address inputAdapter,bytes inputAdapterData,bytes v4AdapterData) payable returns (uint256 profileOut)",
  "function completeGraduation(address profileToken)",
  "function allowedAdapters(address adapter) view returns (bool)",
  "function v4Adapters(address profileToken) view returns (address)",
]);

export const splitterAbi = parseAbi([
  "function harvest(address profileToken) returns (uint256)",
  "function harvestBatch(address[] profileTokens)",
  "function withdraw(address asset) returns (uint256)",
  "function pending(address asset,address recipient) view returns (uint256)",
  "function treasury() view returns (address)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
]);

export const collectorAbi = parseAbi([
  "function collectToTreasury() returns (uint256)",
  "function profileToken() view returns (address)",
  "function quoteToken() view returns (address)",
]);

export const feeEscrowAbi = parseAbi([
  "function balanceOf(address recipient) view returns (uint256)",
  "function balanceOfToken(address recipient,address token) view returns (uint256)",
]);

export const nottinghamAbi = parseAbi([
  "function pendingBalance(address profileToken) view returns (uint256)",
  "function pendingClaims(address profileToken) view returns (address recipient,uint64 effectiveAt)",
  "function initiateClaim((uint64 xUserId,string handle,address recipient,address profileToken,uint256 nonce,uint256 deadline) attestation,bytes signature)",
  "function finalizeClaim(address profileToken)",
]);

export const holderRewardsAbi = parseAbi([
  "function pools(address profileToken) view returns (uint256 funded,uint256 reserved,uint256 claimed)",
  "function epochs(address profileToken,uint256 epochId) view returns (bytes32 root,uint256 total,uint256 remaining)",
  "function hasClaimed(address profileToken,uint256 epochId,address account) view returns (bool)",
  "function claim(address profileToken,uint256 epochId,uint256 amount,bytes32[] proof)",
]);

export const curveAbi = parseAbi([
  "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)",
  "function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)",
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function sellableTokens() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function currentSnipeTaxBps(address recipient) view returns (uint256)",
  "function readyToGraduate() view returns (bool)",
  "function pairToken() view returns (address)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
