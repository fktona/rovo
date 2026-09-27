# Rovo Engineering PRD

**Product:** Rovo (`rovo.fun`)  
**Version:** 1.1.0  
**Status:** Implementation-ready  
**Network:** Robinhood Chain — Chain ID `4663`  
**RPC:** `https://rpc.mainnet.chain.robinhood.com`  
**Companion docs:** [VISION.md](./VISION.md) · [PRD-DESIGN.md](./PRD-DESIGN.md)

---

## 1. Purpose

Specify the end-to-end system for Rovo: a Social-RWA launchpad on Robinhood Chain that launches profile tokens via **Pons Protocol V2**, receives the complete **Pons creator allocation plus creator tax**, and routes that combined Rovo-controlled revenue to creators (or Nottingham escrow), Rovers, holders, and a `$ROVO` buyback sink.

This document is the engineering source of truth for contracts, off-chain services, fee math, edge cases, and acceptance criteria.

---

## 2. Scope

### In scope (MVP)

- `RovoFactoryWrapper` — launch via Pons `launchToken` / `launchAndBuy`
- `LaunchFeeCollectorFactory` + one `LaunchFeeCollector` per profile token
- `RovoFeeSplitter` — coordinate per-launch collection and route buckets
- `NottinghamVault` — unclaimed creator escrow + claim lifecycle
- `HolderRewardDistributor` — per-token Stock Token pools + weekly Merkle claims
- `PlatformBuybackExecutor` + `PlatformFeeReservoir` — `$ROVO` sink
- `RovoZapRouter` — USDC/ETH/native → Stock Token → curve/pool buy
- Privy identity integration — wallets + linked X/Twitter account + EIP-712 attestations
- Indexer / API — launches, fees, vaults, epochs, radar feeds
- Profile registry (handle + `x_user_id` uniqueness)

### Out of scope (MVP)

- Custom bonding curves or Uniswap v4 hooks
- Black Hole / Depth Lock / price-floor mechanisms
- X engagement scoring / reward-for-posting APIs
- `$ROVO` TGE supply schedule finalization (mechanism required; numbers TBD pre-mainnet)
- Continuous on-chain stake-to-earn (Phase 2)

---

## 3. External dependencies

| Dependency                                | Role                                                | Notes                                                             |
| ----------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| [Pons V2](https://docs.ponsfamily.com/v2) | Launch, curve, graduation, fees                     | Read live `approvedPairTokens`, `pairTokenEconomics`, `canLaunch` |
| Uniswap v4 (via Pons)                     | Post-graduation trading                             | Pons MemeHook collects fees; LP locked by Pons                    |
| Robinhood Stock Tokens                    | Quote assets                                        | Economic exposure ≠ ownership; geo restrictions                   |
| Privy                                     | Wallet onboarding + X/Twitter OAuth account linking | Backend verifies Privy tokens and linked account data             |
| X API v2                                  | Public profile metadata where permitted             | Do not build core product on engagement endpoints                 |
| DEX router / aggregator                   | Zap + buyback swaps                                 | Prefer Robinhood Chain native liquidity routes                    |

**Pons fee truth:** Of each trade, Pons takes its protocol share first. The remaining creator allocation plus the full creator tax credits **FeeEscrow** for `creatorFeeRecipient`. Rovo sets that recipient to a unique per-launch `LaunchFeeCollector`. Rovo **cannot** intercept Pons protocol fees. Once fees are claimable, an admin chooses either the normal on-chain split or a direct transfer of the complete claimable amount from that collector to the configured treasury for manual allocation. The two routes are mutually exclusive for the amount claimed in that transaction.

Pons FeeEscrow balances are keyed by recipient and asset, not by launched profile token. A shared recipient would merge revenue from every Rovo launch using the same Stock Token. Therefore every launch MUST have a unique collector; collectors forward claimed funds to the central splitter with profile-token attribution intact.

---

## 4. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Rovo Web Client                          │
│         Radar · Launch · Terminal/Zap · Claim · Creator      │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐      ┌────────────────────────────┐
│   Rovo Backend / API   │      │ Privy Identity Service     │
│  Indexer · Epochs ·    │      │ Wallet + X link → EIP-712  │
│  Merkle · Radar        │      └─────────────┬──────────────┘
└────────────┬───────────┘                    │ signature
             │                                │
             ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Robinhood Chain                           │
│                                                              │
│  RovoZapRouter ──► Stock Token ──► Pons Curve / UV4 Pool     │
│                                                              │
│  RovoFactoryWrapper ──launchToken/launchAndBuy──► Pons V2    │
│       creatorFeeRecipient = per-launch FeeCollector          │
│                                                              │
│  Pons Curve/Hook ──sweep──► Pons FeeEscrow                   │
│  FeeCollector ──admin-selected claim──► Splitter or Treasury  │
│       ├── PlatformBuybackExecutor / Reservoir                │
│       ├── NottinghamVault  (Scout creator bucket)            │
│       ├── Creator wallet   (Self-Rove / post-claim)          │
│       ├── Rover wallet                                       │
│       └── HolderRewardDistributor                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Launch tracks

### 5.1 Self-Rove

1. User signs in with Privy, connects or creates a wallet, and links X/Twitter.
2. Backend verifies the Privy access token and linked X account, then maps the numeric X user ID → current handle → selected wallet.
3. User selects approved Stock Token `pairToken`.
4. User selects `creatorTaxBps` from **100–500 bps (1%–5%)**, subject to Pons `maxCreatorTaxBps()`.
5. `RovoFactoryWrapper.launchSelfRove(...)` creates a unique collector and calls Pons with:
   - metadata from X (name, logo, socials)
   - `creatorFeeRecipient = LaunchFeeCollector`
   - `creatorTaxBps = user selection`
   - `buybackEnabled = false` (Rovo owns the `$ROVO` buyback policy)
   - `expectedEconomics = previewLaunchEconomics(launchConfigId, pairToken)`
   - registry mark: `LaunchType.SelfRove`, `claimed = true`, `creator = attestation.recipient`
6. Future fees: Self-Rove split table; creator toggle available immediately (default OFF).

### 5.2 Scout & Claim

1. Rover enters `@handle` + selects `pairToken`.
2. Backend resolves the public profile’s numeric X user ID and metadata (avatar, display name) — **no authentication is required from the target**.
3. `launchScout(...)` deploys via Pons with a unique collector; registry: `LaunchType.Scout`, `claimed = false`, resolved `xUserId`, `rover`, `launchedAt`.
   - Scout creator tax is a protocol-configured default of **100 bps (1%)** for MVP; the Rover cannot change it.
   - Creator tax is immutable in Pons, so claiming later does not change the Scout rate.
4. Fees route Scout split; creator bucket → Nottingham until claim or sunset.
5. Claim: Privy X linking/reverification → EIP-712 → timelock → withdraw → `claimed = true`.

### 5.3 Registry rules

- One live profile token per normalized handle (`lowercase`, strip `@`).
- Every new launch requires a resolved non-zero `uint64 x_user_id`; handle is display + lookup. Do not launch an unbound Scout token in MVP.
- Permanent invariant: **one X user ID → one Rovo profile token** across Self-Rove and Scout.
- A verified Self-Rove attempt for an already-scouted identity must claim the existing token, not launch a second one.
- Second launch of same handle reverts with `HandleTaken`.
- Second binding of the same numeric X user ID reverts with `XUserIdTaken`.
- CREATE2 salt optional for vanity; race = first mined tx wins.

---

## 6. Fee routing (authoritative)

### 6.1 Gross trade

```
Trade notional
  → Pons curve/hook base fee + creator-selected/configured creator tax
      → Pons protocol share (out of Rovo control)
      → Pons creator allocation + full creator tax
          → FeeEscrow[per-launch LaunchFeeCollector]
          → admin-selected RovoFeeSplitter or Rovo treasury
```

The **total Rovo-controlled revenue** is:

```text
Pons creator allocation + full creator tax
```

When the admin chooses the normal split, Rovo percentages below apply to that complete combined amount, after the Pons protocol take. Creator tax is additional trade revenue but is not reserved exclusively for the creator. The alternative direct treasury route sends 100% of that claimable Rovo-controlled amount to the configured treasury and does not create on-chain creator, Rover, Nottingham, holder, or platform-bucket allocations. Any later manual payments are outside the splitter and must be accounted for separately.

### 6.2 Creator tax policy

| Launch type | Rule                                                       |
| ----------- | ---------------------------------------------------------- |
| Self-Rove   | Verified creator selects **100–500 bps (1%–5%)** at launch |
| Scout       | Fixed MVP default **100 bps (1%)**; Rover cannot select it |

- Validate against live Pons `maxCreatorTaxBps()` before launch.
- The selected rate is immutable for the life of the Pons launch.
- UI MUST show the Pons base fee, creator tax, and total trade cost separately before confirmation.
- `buybackEnabled = false` on Pons because Pons buybacks purchase the profile token; Rovo’s platform buyback purchases `$ROVO`.

### 6.3 Base split tables

| Bucket                            | Scout    | Self-Rove |
| --------------------------------- | -------- | --------- |
| Platform → `$ROVO` buyback        | **10%**  | **10%**   |
| Nottingham Vault / Creator wallet | **60%**  | **70%**   |
| Rover bounty                      | **15%**  | —         |
| Base Holder Rewards               | **15%**  | **20%**   |
| **Total**                         | **100%** | **100%**  |

### 6.4 Creator “Share with Holders” toggle

Applies only when `claimed == true` (Self-Rove or post-claim Scout).

| State         | Effect on Creator bucket                                                               |
| ------------- | -------------------------------------------------------------------------------------- |
| OFF (default) | 100% of Creator bucket → creator wallet                                                |
| ON            | `creatorToHoldersBps` of Creator bucket → HolderRewardDistributor; remainder → creator |

**Presets:** 1000 / 2500 / 5000 / 10000 bps (10% / 25% / 50% / 100%). Default when enabling = **5000**.  
Affects **future dispersals only**.

### 6.5 Unclaimed sunset (day 60+)

If `!claimed && block.timestamp >= launchedAt + 60 days`:

- Creator bucket (**60%** Scout) no longer credits Nottingham.
- That 60% splits: **50% → Holders** + **50% → `$ROVO` buyback**  
  (i.e. **30%** and **30%** of full Rovo allocation respectively).
- Platform 10%, Rover 15%, Base Holders 15% unchanged.
- Pre-sunset Nottingham balance remains claimable forever.

**Effective Scout split after sunset (unclaimed):**

| Bucket                          | % of Rovo allocation |
| ------------------------------- | -------------------- |
| Platform buyback                | 10% + 30% = **40%**  |
| Nottingham (new)                | **0%**               |
| Rover                           | **15%**              |
| Holders (base 15% + sunset 30%) | **45%**              |

### 6.6 Worked examples

Assume one dispersal delivers **100 units** of Stock Token `S` as the combined Pons creator allocation plus creator tax.

**A — Scout, unclaimed, pre-sunset**

- Platform 10 → buyback
- Nottingham 60
- Rover 15
- Holders 15

**B — Scout, unclaimed, post-sunset**

- Platform 10 + 30 = 40 → buyback
- Nottingham 0 (new)
- Rover 15
- Holders 15 + 30 = 45

**C — Self-Rove, toggle OFF**

- Platform 10
- Creator 70
- Holders 20

**D — Self-Rove, toggle ON at 50%**

- Platform 10
- Creator 35 (50% of 70)
- Holders 20 + 35 = 55

**E — Scout claimed, toggle ON at 100%**

- Platform 10
- Creator 0 (100% of 60 redirected)
- Rover 15 (persistent scout royalty)
- Holders 15 + 60 = 75

**F — Combined Pons revenue**  
If a sweep contributes 100 units of normal Pons creator allocation plus 50 units from creator tax, Rovo receives and splits 150 units. For an unclaimed pre-sunset Scout:

- Platform 15
- Nottingham 90
- Rover 22.5
- Holders 22.5

### 6.7 Rover bounty timing

- Rover receives **15% of each dispersal while the launch remains a Scout accounting path**.
- After claim, Scout table still applies for Platform / Creator / Holders, and Rover continues to receive 15% of dispersals for the life of the token (locked MVP rule: **persistent scout royalty**).  
  _Rationale:_ Rovers need lasting incentive; document clearly in UI.  
  If product later wants time-limited Rover cut, that is a parameterized upgrade — default MVP = persistent.

---

## 7. Smart contract modules

### 7.1 `RovoFactoryWrapper`

**Responsibilities**

- Gate launches through Rovo registry before calling Pons.
- Create one deterministic minimal-proxy `LaunchFeeCollector` per profile token and set it as `creatorFeeRecipient`.
- Require `pons.canLaunch(effectiveInitiator)` and confirm Rovo’s wrapper/forwarder integration preserves the initiating user as the Pons deployer.
- Pass `pairToken` only if `pons.approvedPairTokens(pairToken)` and `pairTokenEconomics(pairToken)` is non-zero and valid.
- Enumerate enabled launch configurations at transaction time rather than permanently caching a config ID.
- Call `previewLaunchEconomics` and pass the returned hash as `expectedEconomics`; surface `LaunchEconomicsMismatch` as a refresh-and-retry state.
- Set Pons `buybackEnabled = false`.
- Construct the sensitive Pons `TokenParams` fields inside the wrapper. Never trust caller-supplied values for `creatorFeeRecipient`, `creatorTaxBps`, `buybackEnabled`, or `expectedEconomics`.
- Store launch metadata.

**Key storage**

```text
struct Launch {
  address token;
  address curve;
  address pairToken;
  address feeCollector;
  address ponsFactory;
  address ponsFeeEscrow;
  address ponsMemeHook;
  bytes32 handleHash;      // keccak256(lowercase handle)
  bytes32 expectedEconomics;
  uint64  xUserId;         // required and non-zero for every new launch
  address rover;           // address(0) for Self-Rove
  address creator;         // set on Self-Rove or claim
  uint256 launchConfigId;
  uint8   launchType;      // 0 Scout, 1 SelfRove
  bool    claimed;
  uint64  launchedAt;
  uint16  creatorTaxBps;   // immutable Pons launch tax
  uint16  creatorToHoldersBps; // 0 when off
  bool    shareWithHolders;
}
mapping(bytes32 => address) handleToToken;
mapping(address => Launch) launches; // token => Launch
mapping(uint64 => address) xUserIdToToken; // authoritative identity uniqueness
```

**Critical functions**

- `launchSelfRove(TokenParams, launchConfigId, pairToken, creatorTaxBps, attestation)`
- `launchScout(TokenParams, launchConfigId, pairToken, profileAttestation)`
- `launchAndBuy` wrappers forwarding to Pons router pattern

Every launch stores the Pons stack that owns it: **factory; FeeEscrow; MemeHook**. Never assume the latest global Pons deployment owns historical launches.

### 7.2 `LaunchFeeCollectorFactory` + `LaunchFeeCollector`

**Why this exists**

- Pons FeeEscrow aggregates by `(recipient, asset)`, not by profile token.
- A single shared recipient would merge revenue from multiple markets paired with the same Stock Token.

**Responsibilities**

- Factory deploys one `LaunchFeeCollector` per launch using an OpenZeppelin minimal proxy, optionally with CREATE2 for deterministic addressing.
- Before calling Pons, the collector is initialized once with a unique launch key, quote token, Pons FeeEscrow, and Rovo splitter. After Pons returns, the wrapper binds the returned profile-token address exactly once.
- `collect()` calls Pons `claim()` for native revenue or `claimToken(pairToken)` for ERC-20 revenue.
- Only the configured `RovoFeeSplitter` may call `collect()`; callers cannot bypass the admin release decision by calling a collector directly.
- `collectToTreasury()` may be called only by an account with the splitter's `DEFAULT_ADMIN_ROLE`. It measures the exact amount received from Pons and transfers it directly to the splitter's configured treasury wallet, without routing through the splitter or funding the ordinary buckets. It emits a distinct on-chain treasury event.
- Collector measures the amount received and sends exactly that amount to the route the admin selected for that claim: `RovoFeeSplitter.disperse(profileToken, pairToken, amount)` for normal sharing, or the configured treasury wallet for manual use.
- Only the wrapper may initialize; initialization and collection are reentrancy-protected.
- Collector MUST NOT expose an arbitrary-call facility.

**Revenue states surfaced by the indexer/API**

1. `unswept` — fees still held by the Pons curve or MemeHook.
2. `swept but unclaimed` — attributed collector balance in Pons FeeEscrow.
3. `claimed but undistributed` — transient collector/splitter balance.
4. `distributed` — normal-route Rovo bucket transfers or pull credits recorded.
5. `treasury` — direct-route claim delivered to the configured Rovo treasury; no split buckets credited.

Pons trades do not credit FeeEscrow immediately. Pre-graduation, the curve must execute `sweepFees`; post-graduation, the MemeHook must execute `sweepPoolFees`. Sweeps requiring internal conversion are restricted to Pons’s trusted operator. Rovo monitoring therefore treats unswept fees and operator-dependent sweeps as an explicit work queue.

### 7.3 `RovoFeeSplitter`

**Responsibilities**

- Admin-authorized `harvest(token)` / `harvestBatch` (the splitter's `DEFAULT_ADMIN_ROLE`):
  1. Ask the token’s unique collector to claim its Pons FeeEscrow balance.
  2. Measure actual Stock Token/native value received.
  3. Read launch state (type, claimed, sunset, toggle).
  4. Transfer buckets atomically.

**Invariants**

- Harvest must never revert due to a single recipient failure (use pull accounts where needed; Rover/creator can be push with try/catch → pending balance).
- `harvestBatch` isolates failures per token and emits a failure event rather than reverting already completed dispersals.
- Pons may sweep fees into FeeEscrow before Rovo acts, but no Rovo fee sharing occurs until an admin sends a harvest transaction. The admin authorizes release by choosing the token(s) and executing that transaction; there is no public or automatic harvest path.
- Alternatively, the admin calls that launch's `LaunchFeeCollector.collectToTreasury()` to send the entire currently claimable Pons creator-side balance to the configured treasury wallet for manual use. This path bypasses `disperse` entirely and is indexed separately from normal distributions.
- Harvest only credits the Reservoir; buyback execution happens later. A failed swap leaves funds in the Reservoir and cannot roll back unrelated fee buckets.
- Split input is the full amount received by the collector: Pons creator allocation plus creator tax.
- Bucket arithmetic uses full-precision multiplication; deterministic remainder goes to the base holder-reward bucket so the complete input is accounted for.

### 7.4 `NottinghamVault`

**Responsibilities**

- `credit(token, amount)` from splitter only.
- `initiateClaim(attestation)` → starts 24h timelock for `(xUserId, recipient)` after Privy-backed verification.
- `finalizeClaim(token)` after timelock → transfer full balance, set `claimed`, set `creator`.
- `pendingBalance(token)` view.

**Security**

- Claim attestation must include `xUserId`, `handle`, `recipient`, `profileToken`, `nonce`, and `deadline`.
- Attestation signer key rotatable; old signatures invalid after nonce use or signer revocation.
- Contest window = timelock period; admin pause for dispute (multisig) documented.

### 7.5 `HolderRewardDistributor`

**Responsibilities**

- Per `(profileToken, stockToken)` accounting of accrued rewards.
- `setEpochRoot(profileToken, epochId, merkleRoot, totalAmount)` — only epoch publisher role.
- `claim(profileToken, epochId, amount, proof)` — pulls Stock Tokens.
- Roll-forward: if epoch has zero eligible holders, keep funds for next epoch publish (same token).
- Publishing an epoch reserves its `totalAmount`; cumulative published-but-unclaimed obligations MUST never exceed unreserved funds for that `(profileToken, stockToken)` pool.

**Snapshot exclusion set (indexer)**

- Bonding curve address
- Graduated pool / hook managed liquidity addresses as applicable
- `address(0)`, `0x…dEaD`
- Rovo contracts (splitter, vault, distributor, buyback)
- Dust: balances below `minHoldAmount` (config per token decimals)

### 7.6 `PlatformFeeReservoir` + `PlatformBuybackExecutor`

**Flow**

1. Splitter transfers Stock Tokens to Reservoir.
2. Keeper calls `executeBuyback(stockToken, amount, minRovoOut, routeData)`.
3. Swap Stock Token → `$ROVO` (direct pool or multi-hop via USDC/ETH).
4. Of `$ROVO` received: **50% burn** (`address(0)` or dead), **50%** to `RovoTreasury`.
5. On slippage fail: leave balance in Reservoir; emit `BuybackDeferred`.

The keeper supplies route parameters but cannot supply an arbitrary call target. Executors and swap adapters are allowlisted; post-swap balance deltas enforce the promised `$ROVO` output.

**Params**

- `maxSlippageBps` (e.g. 200 = 2%)
- `maxSingleBuyback` size caps
- Role: `BUYBACK_KEEPER`

### 7.7 `RovoZapRouter`

- Input: native ETH, WETH, or USDC (extend allowlist as needed).
- Path: input → `pairToken` → Pons `buy` (pre-grad) or UV4 swap (post-grad).
- Route using the authoritative Pons phase (`NotGraduated`, `Swept`, `PoolCreated`, or `Rescued`), not a UI assumption.
- Enforce deadline, `minOut`, and price-impact bounds. Oracle validation checks positive answer, feed heartbeat/staleness, L2 sequencer uptime and recovery grace period, and Stock Token `oraclePaused()` state.
- Chainlink Stock Token prices already include the ERC-8056 multiplier; never multiply them again.
- Snipe tax awareness: quote using Pons `currentSnipeTaxBps(recipient)`.
- The Pons curve exposes no quote method; reproduce its integer arithmetic exactly, including base fee, creator tax, recipient-specific snipe tax, and partial-fill clamping near graduation.

---

## 8. Privy identity and attestation service

Privy is the single user authentication and wallet-onboarding layer. It supports embedded wallets, injected/external wallets, WalletConnect, and linked X/Twitter accounts. Rovo does not maintain a second first-party X OAuth login flow for Self-Rove or claims.

### 8.1 Privy authentication and X linking

- Frontend authenticates with Privy and lets the user connect/create a wallet and link X/Twitter to the same Privy user.
- Backend accepts a Privy access token, verifies its signature, issuer, audience, expiry, and app ID, then fetches the authoritative Privy user record server-side.
- The verified linked account supplies the stable numeric X user ID, current handle, name, and available profile metadata.
- Require a recently verified X link before issuing a Self-Rove or Nottingham claim attestation; stale sessions require reauthentication.
- Signed Privy linked-account webhooks synchronize account links/unlinks and metadata. Webhook signatures MUST be verified before processing.
- Store `privyUserId`, numeric `xUserId`, normalized current handle, selected wallet, and latest verification timestamp.
- A linked X account is identity evidence; the recipient wallet is bound explicitly into the EIP-712 attestation.
- Unlinking X after a finalized onchain claim does not undo ownership or redirect previously established creator rights.

### 8.2 EIP-712 attestation

```text
Launch domain:
  name "Rovo Identity"
  version "1"
  chainId 4663
  verifyingContract RovoFactoryWrapper

SelfRoveAttestation {
  uint64  xUserId;
  string  handle;
  bytes32 metadataHash;
  address recipient;
  uint256 nonce;
  uint256 deadline;
}

ScoutProfileAttestation {
  uint64  xUserId;
  string  handle;
  bytes32 metadataHash;
  uint256 nonce;
  uint256 deadline;
}

Claim domain:
  name "Rovo Identity"
  version "1"
  chainId 4663
  verifyingContract NottinghamVault

ClaimAttestation {
  uint64  xUserId;
  string  handle;
  address recipient;
  address profileToken;
  uint256 nonce;
  uint256 deadline;
}
```

For Self-Rove and claims, the attestation service signs only after verifying the current Privy session and linked X identity server-side. For Scout, it signs the resolved public profile ID, normalized handle, and metadata hash so a Rover cannot bind an arbitrary handle to an unrelated X user ID.

Attestation deadlines are at most 10 minutes. Nonces are single-use within their attestation type and verifying contract. The wrapper/vault verifies the expected domain, type hash, signer role, chain ID, recipient where applicable, and exact metadata/profile binding.

### 8.3 Handle changes

Ownership and Nottingham balances key off the numeric X user ID. The UI updates `current_handle` from verified linked-account metadata and may refresh onchain display metadata; funds cannot be stolen by renaming onto a scouted handle.

---

## 9. Holder rewards epoch pipeline

```
Week N trading
  → Splitter credits HolderRewardDistributor
Week N end (UTC Sunday 00:00 or configurable)
  → Indexer snapshots ERC20 balances at epoch block
  → Filter exclusion set + dust
  → Build Merkle tree (account, amount) pro-rata to balances
  → Publisher submits merkleRoot + IPFS/HTTPS metadata URI
Users
  → claim anytime after root is live
```

**Pro-rata:** `userAmount = epochPool * userBalance / eligibleSupply`.

**API:** `GET /v1/rewards/:token/:address` → published claimable epochs + exact on-chain claim proofs.

### 9.1 Stock Token accounting and application selection

- Robinhood Stock Tokens are ERC-20 tokens with 18 decimals and implement ERC-8056 scaled UI amounts.
- Contract accounting, Pons pairing, fee balances, and Merkle distributions use raw ERC-20 amounts.
- `uiMultiplier()` changes share-equivalent display after dividends, splits, and other corporate actions without rebasing raw balances or total supply.
- Use `balanceOfUI()` / `totalSupplyUI()` or apply the multiplier only for share-equivalent display.
- Chainlink feeds return multiplier-adjusted per-token prices. Robinhood REST `/prices` returns the raw underlying-equity price; combine it with `/assets.currentMultiplier` only when a token-equivalent REST value is required.
- Rovo provides the Stock Token choices in its own application catalogue; it does not perform or expose general Robinhood asset discovery.
- A selected pair token is launchable only when live Pons checks pass: `approvedPairTokens(pairToken) == true` and `pairTokenEconomics(pairToken)` is valid.
- The application catalogue stores the exact pair-token address and display metadata. Symbols and names are display-only and are never used for contract authorization.

---

## 10. `$ROVO` token (mechanism MVP)

| Item           | MVP rule                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Utility        | Buyback sink from platform fees; future staking/gov Phase 2                                               |
| Buyback source | 10% base platform cut + 50% of sunset creator-bucket                                                      |
| Disposition    | 50% burn / 50% treasury                                                                                   |
| Supply / TGE   | **TBD pre-mainnet** — placeholder section in tokenomics appendix; do not block contracts on final numbers |
| Pool           | Seed `$ROVO` / ETH or `$ROVO` / USDC before enabling buyback keeper                                       |

---

## 11. Sequence flows

### 11.1 Self-Rove launch

```
User → Client: Sign in with Privy + connect/create wallet + link X
Client → API: Privy access token + chosen wallet
API → Privy: verify session and fetch linked X identity
API → Client: short-lived EIP-712 attestation for launch
User → Wrapper: launchSelfRove(params, pairToken, attestation)
Wrapper → Registry: bind handle + xUserId
Wrapper → CollectorFactory: deploy unique LaunchFeeCollector
Wrapper → Pons: launchToken(..., creatorFeeRecipient=Collector)
Pons → Token+Curve deployed
```

### 11.2 Scout launch

```
Rover → Client: @handle + pairToken
Client → API: resolve public profile
API → Rover: short-lived ScoutProfileAttestation
Rover → Wrapper: launchScout(..., profileAttestation)
Wrapper → CollectorFactory: deploy unique LaunchFeeCollector
Wrapper → Pons: launchToken(..., creatorTaxBps=100, buybackEnabled=false)
Registry: claimed=false, rover=msg.sender, launchedAt=now
```

### 11.3 Trade + fee harvest

```
Trader → ZapRouter: zapBuy(token, amountIn, minOut)
ZapRouter → DEX: swap to pairToken
ZapRouter → Curve/Pool: buy
… fees accrue but remain unswept …
Pons operator/eligible caller → Curve or MemeHook: sweep fees
Pons → FeeEscrow: credit launch-specific collector
Rovo admin → Splitter: harvest(token) or harvestBatch(tokens)
Splitter → LaunchFeeCollector: collect
LaunchFeeCollector → FeeEscrow: claim/claimToken
LaunchFeeCollector → Splitter: attributed amount
Splitter → route buckets per §6

OR Rovo admin → LaunchFeeCollector: collectToTreasury()
LaunchFeeCollector → FeeEscrow: claim/claimToken
LaunchFeeCollector → configured Rovo treasury: full attributed amount
No splitter allocation is created for this claim
```

### 11.4 Nottingham claim

```
Creator → Privy: authenticate + link/reverify X + select wallet
Creator → API: request attestation with verified Privy session
Creator → Vault: initiateClaim(attestation)
… 24h …
Creator → Vault: finalizeClaim(token)
Vault → creator: Stock Tokens
Registry: claimed=true, creator=recipient
```

### 11.5 Toggle

```
Creator → Splitter/Wrapper: setShareWithHolders(token, enabled, bps)
Require msg.sender == launch.creator && claimed
Emit ShareToggled
Next harvest uses new bps
```

### 11.6 Holder claim

```
User → API: getProof(token, epoch, address)
User → Distributor: claim(token, epoch, amount, proof)
```

### 11.7 Buyback

```
Keeper → Executor: executeBuyback(stockToken, amount, minOut, route)
Executor → DEX: swap to $ROVO
Executor → burn 50% / treasury 50%
```

---

## 12. Edge-case matrix

| Case                                                              | Behavior                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Creator never claims                                              | Nottingham accrues days 0–60; from day 60 new Creator-bucket → 50% Holders / 50% `$ROVO` buyback; historical vault claimable forever |
| Creator claims after sunset                                       | Receives full pre-sunset vault; future Creator-bucket returns to creator (toggle applies); sunset dispersals already paid are final  |
| Creator claims then disappears                                    | Fees continue to their wallet or toggle-split; no Rover reclaim of creator bucket                                                    |
| Handle renamed on X                                               | Ownership/vault follow `x_user_id`                                                                                                   |
| Two Rovers race same handle                                       | First successful registry+Pons launch wins; loser reverts `HandleTaken`                                                              |
| Handle was already scouted; owner attempts Self-Rove              | Self-Rove reverts and directs owner to claim the existing token                                                                      |
| Same X user ID appears under a new handle                         | Existing `xUserIdToToken` binding wins; no second profile token                                                                      |
| Scout is not the real owner; owner claims                         | Claimant must match `x_user_id`; Rover keeps royalty only                                                                            |
| Toggle ON mid-epoch                                               | Next harvest uses new bps; current epoch pool unchanged                                                                              |
| Toggle OFF                                                        | Creator-bucket stops extra holder feed; **base** Holder Rewards continue                                                             |
| Buyback swap fails                                                | Funds remain in Reservoir; harvest of other buckets unaffected                                                                       |
| Stock Token removed from Pons allowlist                           | Block new launches; existing markets trade; buyback may multi-hop                                                                    |
| Balance only in curve/pool                                        | Excluded from Merkle; no holder rewards                                                                                              |
| Flash-loan at snapshot                                            | Snapshot at epoch block end; Phase 2 may add min-hold-duration                                                                       |
| Compromised X / wrong wallet                                      | 24h timelock; multisig pause/contest SOP                                                                                             |
| Restricted geo                                                    | App-level gate + disclaimers; contracts permissionless                                                                               |
| Graduation mid-week                                               | Fee path switches curve→hook; splitter accounting unchanged                                                                          |
| Pons fee exists but escrow balance is zero                        | Show it as unswept curve/hook revenue; do not report zero lifetime earnings                                                          |
| Pons sweep needs internal conversion                              | Queue/monitor for Pons trusted sweep operator; never force an unsafe conversion                                                      |
| Pons deploys a replacement stack                                  | Historical launch continues using its stored factory, FeeEscrow, and MemeHook                                                        |
| Pons config changes before mining                                 | `expectedEconomics` mismatch reverts; refresh preview and ask user to retry                                                          |
| Pons launch permission disabled                                   | `canLaunch` check blocks creation with an actionable error                                                                           |
| Zero eligible holders                                             | Epoch pool rolls to next epoch for that token                                                                                        |
| Thin `$ROVO` liquidity                                            | Slippage cap; partial fill; residual stays in Reservoir                                                                              |
| Rover is creator (Self-scouts own handle without first linking X) | Allowed as Scout; claiming through Privy X verification converts to claimed; Rover royalty still pays the scout address (themselves) |
| Privy X account is unlinked after claim                           | Existing onchain claim remains final; future identity-sensitive changes require fresh verification                                   |
| Stock Token oracle is stale/paused or sequencer is down           | Block oracle-dependent Zap/buyback execution; retain funds and surface availability state                                            |
| Stock Token multiplier changes                                    | Raw balances remain unchanged; refresh UI-adjusted amounts and prices                                                                |

---

## 13. Off-chain services

| Service                      | Duties                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| API                          | Privy session verification, launch metadata, radar queries, vault balances, rewards proofs, and application-provided Stock Token choices  |
| Indexer                      | Pons `TokenLaunched`, curve/hook fees, sweeps, FeeEscrow credits/claims, Rovo dispersals, claims, graduations, recipient-change proposals |
| Epoch worker                 | Weekly snapshot + Merkle publish                                                                                                          |
| Buyback keeper               | Reservoir drains under slippage policy                                                                                                    |
| Identity attestation service | Verify Privy access token + linked X identity; issue EIP-712 signatures using HSM/KMS                                                     |
| Privy webhook consumer       | Verify signed linked/unlinked-account events and synchronize identity metadata                                                            |
| Monitoring                   | Missed epochs, unswept fee backlog, reservoir backlog, harvest failures, allowlist/config/stack changes, corporate actions                |

Poll Pons `PairTokenApprovalUpdated` / `approvedPairTokens` at least every block range sync.

Indexer accounting MUST expose `unswept`, `swept but unclaimed`, `claimed`, and `distributed` revenue separately. Indexing FeeEscrow alone understates earnings.

---

## 14. Security requirements

- Auditable fee math with invariant tests (sum of buckets == harvested amount).
- Attestation key isolation in HSM/KMS; deadline ≤ 10 minutes for claims.
- Verify Privy access-token signatures and signed webhook deliveries server-side; never trust client-supplied linked-account fields.
- Reentrancy guards on harvest/claim/buyback.
- Multisig admin: pause, publish roles, treasury, contest Nottingham claims.
- No upgradeability on vault balances without explicit migration plan (prefer immutable core + replaceable peripheral routers).
- Slippage and oracle bounds on Zap and buyback.
- Check Chainlink staleness and L2 sequencer uptime; treat Stock Token `oraclePaused()` as unavailable.
- Buyback route data may select only allowlisted adapters/targets and cannot authorize arbitrary calls.
- Treat Pons V2 as unaudited until its announced reviews are published and independently assessed.
- Monitor Pons creator-recipient change/takeover proposals for every launch and alert before their execution window.

### 14.1 Compliance and product-copy requirements

- Stock Tokens are tokenized debt securities issued by Robinhood Assets (Jersey) Limited. They provide economic exposure but no legal or beneficial ownership or voting rights in the underlying security.
- External copy must say **Stock Tokens** or “tokenized real-world assets such as Stock Tokens”; do not call them “tokenized stocks” or “tokenized equities.”
- Describe profile markets as **paired, quoted, and settled in Stock Tokens**, not collateralized by or redeemably backed by Stock Tokens.
- Availability is jurisdiction-restricted, including the United States, Canada, United Kingdom, Switzerland, and any other jurisdiction on Robinhood’s current restricted list.
- The web app implements geo gating, eligibility acknowledgement, risk disclosures, and counsel-approved copy. Permissionless contracts cannot by themselves enforce offchain eligibility.

---

## 15. Testing & acceptance

### Unit / fork

- [ ] Fee split vectors A–E (§6.6) exact balances
- [ ] Pons creator allocation and creator tax are combined before applying Rovo split tables
- [ ] Creator tax boundaries 100/500 bps + reject above live Pons cap
- [ ] Sunset transition at `launchedAt + 60 days`
- [ ] Toggle ON/OFF mid-stream
- [ ] Claim timelock enforce + wrong `xUserId` reject
- [ ] Merkle claim happy path + invalid proof
- [ ] Buyback fail → reservoir; retry success
- [ ] HandleTaken race
- [ ] `XUserIdTaken` prevents a second token after a handle change
- [ ] Dedicated collectors keep two launches using the same Stock Token fully attributable
- [ ] Unswept → swept/unclaimed → claimed/distributed accounting lifecycle
- [ ] `LaunchEconomicsMismatch` retry and disabled config handling
- [ ] Privy token/webhook verification + linked X mismatch rejection
- [ ] Scout profile attestation rejects forged handle/X-user-ID and altered metadata
- [ ] Zap pre- and post-graduation
- [ ] Zap/buyback reject stale feed, paused oracle, and sequencer outage

### Integration acceptance

- [ ] Self-Rove launch live on Robinhood Chain test/main with approved Stock Token
- [ ] Scout launch → harvest → Nottingham balance visible in API
- [ ] Claim end-to-end with Privy staging app, linked X account, and embedded + external wallet
- [ ] Epoch publish + holder claim UI
- [ ] Buyback burns observable `$ROVO` supply decrease

### Operational readiness

- [ ] Runbooks for contested claim, stuck buyback, delisted pair
- [ ] Geo disclaimer + app gate shipped with design copy

---

## 16. Selected implementation stack

| Layer          | Selection                                    |
| -------------- | -------------------------------------------- |
| Monorepo       | pnpm workspaces + Turborepo                  |
| Contracts      | Solidity, Foundry, OpenZeppelin              |
| Web            | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| Auth + wallets | Privy, WalletConnect, Wagmi, Viem            |
| Client data    | TanStack Query                               |
| API            | Node.js, TypeScript, Fastify                 |
| Database       | PostgreSQL + Drizzle ORM                     |
| Indexer        | Ponder with Rovo/Pons handlers               |
| Jobs           | BullMQ + Redis                               |
| Key management | AWS KMS/HSM-backed attestation signer        |
| Artifacts      | S3-compatible storage; optional IPFS mirror  |
| Testing        | Foundry, Vitest, Playwright, Anvil forks     |
| Observability  | Sentry + OpenTelemetry                       |
| CI             | GitHub Actions                               |

### 16.1 Repository layout

```text
apps/web                  Next.js product UI
apps/api                  Fastify API + Privy verification
apps/indexer              Ponder chain indexer
apps/workers              epochs, buybacks, monitoring
packages/contracts        Solidity + Foundry
packages/chain            ABIs, addresses, Viem clients
packages/database         Drizzle schema + migrations
packages/sdk              shared Rovo SDK
packages/merkle           deterministic rewards pipeline
packages/identity         EIP-712 types + verification
packages/config           chain/app configuration
packages/ui               shared UI system
infrastructure            container and deployment configuration
```

Privy owns authentication, embedded/external wallet onboarding, WalletConnect access, and X/Twitter account linking. Wagmi/Viem own typed application-side chain interactions. Privy identity evidence is verified server-side before Rovo signs an onchain identity attestation.

---

## 17. Milestone plan

1. **M0 — Pons integration spike:** verify `canLaunch`, forwarder identity, config enumeration/economics pinning, Stock Token launch, curve and pool trades, sweep, FeeEscrow claim, and unique collector attribution on a fork/test environment. Record ABIs, addresses, deployment blocks, and receipts.
2. **M1 — Contract foundation:** Registry + Wrapper + CollectorFactory/Collector + Splitter + Nottingham, with unit/fuzz/invariant tests.
3. **M2 — Privy identity:** wallet onboarding, X linking, backend token verification, signed webhooks, EIP-712 claim, and 24h contest flow.
4. **M3 — Holder rewards:** indexed balances, exclusions, deterministic Merkle worker, reserved epoch funds, API proofs, and claims.
5. **M4 — Trading product:** Pons phase router, exact curve quotes, Zap, Radar API, terminal, and user profiles.
6. **M5 — `$ROVO` sink:** seed liquidity, allowlisted buyback adapter, oracle protections, burn/treasury accounting, and transparency UI.
7. **M6 — Audit + staged mainnet:** independent review, Safe role handover, one-pair canary, caps/monitoring, then broader pair rollout.

M0 is a hard gate: do not build dependent production paths until Pons launch permissions, forwarding semantics, sweeping, and per-launch revenue attribution are proven against the deployed contracts.

---

## 18. Open items

| Item                                             | Owner      | Notes                                                  |
| ------------------------------------------------ | ---------- | ------------------------------------------------------ |
| Final `$ROVO` supply / TGE                       | Tokenomics | Mechanism fixed                                        |
| Pons wrapper/forwarder approval + `canLaunch`    | Eng/Pons   | Must be proven in M0 before dependent build            |
| Current Pons stack addresses + deployment blocks | Eng        | Config-driven; store stack per launch and verify in M0 |
| Min dust threshold per Stock Token               | Eng        | Config per decimals                                    |
| Contest SOP legal review                         | Counsel    | Timelock + pause                                       |

---

## 19. References

- [Pons V2 Docs](https://docs.ponsfamily.com/v2)
- [Zora Coins](https://docs.zora.co/coins)
- [Robinhood Chain](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet/)
- [Stock Tokens](https://robinhood.com/rhj/stocktokens/)
- [Robinhood Chain developer docs](https://docs.robinhood.com/chain/)
- [Building with Stock Tokens](https://docs.robinhood.com/chain/building-with-stock-tokens/)
- [Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis/)
- [Oracles & Price Feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds/)
- [Robinhood Chain brand guidelines](https://docs.robinhood.com/chain/brand-guidelines/)
- [Privy documentation](https://docs.privy.io/)
- [VISION.md](./VISION.md)
- [PRD-DESIGN.md](./PRD-DESIGN.md)
