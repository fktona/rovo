import { parseAbi } from "viem";

export const registryAbi = parseAbi([
  "event LaunchRegistered(address indexed token, uint64 indexed xUserId, bytes32 indexed handleHash, address collector)",
  "event CreatorClaimed(address indexed token, uint64 indexed xUserId, address indexed creator)",
  "event ShareWithHoldersUpdated(address indexed token, bool enabled, uint16 bps)",
]);

export const splitterAbi = parseAbi([
  "event FeesDispersed(address indexed profileToken, address indexed asset, uint256 amount, uint256 platform, uint256 creatorOrVault, uint256 rover, uint256 holders)",
  "event RecipientCredited(address indexed recipient, address indexed asset, uint256 amount)",
  "event BatchHarvestFailed(address indexed profileToken, bytes reason)",
]);

export const collectorFactoryAbi = parseAbi([
  "event CollectorCreated(bytes32 indexed launchKey, address indexed collector, address indexed quoteToken)",
]);

export const collectorAbi = parseAbi([
  "event ProfileTokenBound(address indexed profileToken)",
  "event RevenueCollected(address indexed profileToken, address indexed asset, uint256 amount)",
  "event RevenueRoutedToTreasury(address indexed profileToken, address indexed asset, address indexed treasury, uint256 amount, address admin)",
]);

export const nottinghamAbi = parseAbi([
  "event VaultCredited(address indexed profileToken, address indexed asset, uint256 amount)",
  "event ClaimInitiated(address indexed profileToken, address indexed recipient, uint64 effectiveAt)",
  "event ClaimFinalized(address indexed profileToken, address indexed recipient, uint256 amount)",
]);

export const holderRewardsAbi = parseAbi([
  "event RewardsCredited(address indexed profileToken, address indexed asset, uint256 amount)",
  "event EpochPublished(address indexed profileToken, uint256 indexed epochId, bytes32 root, uint256 total)",
  "event RewardClaimed(address indexed profileToken, uint256 indexed epochId, address indexed account, uint256 amount)",
]);
