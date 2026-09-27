# Rovo implementation handoff

**Updated:** 2026-09-26  
**Scope completed:** contracts + indexer + API + identity + database + workers. No web client was built.

This document describes the code that exists today, how the pieces interact, how to verify or run them, and what remains before production deployment.

## Current system map

```text
Privy access token + linked X account + selected wallet
  -> API verifies the session and identity
  -> API issues/persists EIP-712 attestation
  -> user submits signed attestation to RovoFactoryWrapper / NottinghamVault

Pons trade revenue
  -> Pons FeeEscrow credits one unique LaunchFeeCollector per profile token
  -> Rovo admin chooses one route for the next claimable balance:
       A. splitter.harvest(token) / harvestBatch(tokens)
          -> collector claims -> splitter routes platform / creator or Nottingham / Rover / holders
       B. collector.collectToTreasury()
          -> collector claims -> configured treasury wallet directly, for manual use

Indexer
  -> observes Rovo events and dynamically discovers collectors
  -> projects launch, revenue, claim, and reward-epoch state

Workers
  -> reconstruct finalized holder snapshots from Transfer logs
  -> exclude protocol/system balances
  -> build deterministic holder reward Merkle epochs

Trader
  -> RovoZapRouter
  -> optional allowlisted input-swap adapter converts input asset to Stock Token
  -> Pons curve buy (pre-graduation) OR reviewed V4 adapter (post-graduation)
  -> profile tokens are sent directly to the trader
```

## What has been built

### Solidity contracts

| Contract              | File                                                   | What it does                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Factory wrapper       | `packages/contracts/src/RovoFactoryWrapper.sol`        | Validates Pons state, validates a Self-Rove or Scout attestation, creates the one-per-launch collector, launches through Pons, and registers the market.                                                                                                                             |
| Registry              | `packages/contracts/src/RovoRegistry.sol`              | Stores immutable launch data and rejects a second token for the same normalized X handle or numeric X user ID.                                                                                                                                                                       |
| Collector factory     | `packages/contracts/src/LaunchFeeCollectorFactory.sol` | Creates deterministic OpenZeppelin clone collectors. Only the wrapper can create collectors.                                                                                                                                                                                         |
| Fee collector         | `packages/contracts/src/LaunchFeeCollector.sol`        | Is bound to exactly one returned Pons token. The splitter can claim for normal sharing; a splitter admin can instead claim directly to the configured treasury. Both paths measure the amount actually received and emit distinct route evidence.                                    |
| Fee splitter          | `packages/contracts/src/RovoFeeSplitter.sol`           | Implements the Scout/Self-Rove splits, pull-payment credits, Nottingham funding, holder funding, platform reservoir funding, rounding dust rules, and admin-authorized harvest.                                                                                                      |
| Nottingham vault      | `packages/contracts/src/NottinghamVault.sol`           | Holds an unclaimed Scout creator bucket. A valid identity attestation starts a delayed claim; finalization marks the profile claimed and transfers accrued funds.                                                                                                                    |
| Holder distributor    | `packages/contracts/src/HolderRewardDistributor.sol`   | Holds per-profile quote-asset rewards (Stock Token, USDG, or native ETH), accepts Merkle roots from the epoch publisher, and lets holders claim proofs.                                                                                                                              |
| Zap router            | `packages/contracts/src/RovoZapRouter.sol`             | Reads the live Pons V2 phase from each launch's stored Pons factory; buys the curve only in phase 0, can permissionlessly complete phase-1 graduation, and only uses a reviewed V4 adapter in phase 2. Native ETH quotes are forwarded as call value, and unspent quote is refunded. |
| Uniswap Stock adapter | `packages/contracts/src/UniswapV3StockAdapter.sol`     | Converts native ETH or WETH into an admin-configured Stock Token through the official Robinhood-chain Uniswap V3 factory/router. It refuses unconfigured pairs or pools that do not exist.                                                                                           |
| Platform reservoir    | `packages/contracts/src/PlatformFeeReservoir.sol`      | Holds the platform portion pending a later buyback executor.                                                                                                                                                                                                                         |

The contract source is in [packages/contracts/src](/Users/faith/Documents/rovo/packages/contracts/src).

### Fee behavior implemented

When the admin selects normal harvesting, Rovo applies these percentages to the complete amount received by the unique collector: the Pons creator allocation plus the full creator tax. Pons protocol fees are not controlled by Rovo. The alternative `collectToTreasury()` route sends 100% of that claim to the configured treasury wallet and **does not** fund any of the split buckets; subsequent use or off-app payments must be handled and reported manually.

| Launch state                          | Platform | Creator / Nottingham | Rover | Holders |
| ------------------------------------- | -------: | -------------------: | ----: | ------: |
| Self-Rove                             |      10% |          70% creator |     — |     20% |
| Scout, unclaimed before 60-day sunset |      10% |       60% Nottingham |   15% |     15% |
| Scout, unclaimed after sunset         |      40% |                    — |   15% |     45% |
| Scout, claimed                        |      10% |          60% creator |   15% |     15% |

- Creator tax is enforced at **100–500 bps (1%–5%)** for Self-Rove, also capped by live Pons `maxCreatorTaxBps()`.
- Scout creator tax is fixed to the configured 100 bps MVP rate.
- The Rover’s 15% share persists after the target profile claims the Scout token.
- A creator can move part of their creator bucket to holders using `setShareWithHolders`.
- Integer remainder always goes to holders so every raw token unit is accounted for.
- Pons fees first accrue and are swept into Pons FeeEscrow for the launch's unique collector. They remain undistributed until a splitter admin calls `harvest(token)` or `harvestBatch(tokens)`. Direct public calls to a collector's `collect()` are rejected. An admin batch isolates a failed launch and continues with the others; there is no scheduled harvest worker yet.
- A splitter admin may instead call that launch's collector `collectToTreasury()`. It checks the admin role against the splitter, reads the deployment-configured treasury address, claims the currently available fee balance, and sends it directly there (native ETH or ERC-20). The collector emits `RevenueRoutedToTreasury`, and the indexer records a `treasury` revenue row with destination and amount. This choice is per claim transaction, not a permanent launch setting; the other route can be used for later fees. Both calls revert when there is nothing claimable, preventing a double claim of the same balance.

### Attestation and identity service

The API is in [apps/api/src](/Users/faith/Documents/rovo/apps/api/src).

1. The client sends a Privy bearer token and selected wallet.
2. `PrivyIdentityVerifier` verifies the token through Privy and fetches the authoritative Privy user.
3. It requires a linked `twitter_oauth` account with a stable numeric subject and confirms the selected wallet is linked to that same Privy user.
4. `IdentityAttestationService` generates a cryptographically random nonce, sets a deadline no later than ten minutes, signs typed data on chain `4663`, persists the issued attestation, and returns the signature plus domain/message.
5. The wrapper or vault checks signer role, chain-specific EIP-712 domain, expiry, and a single-use nonce on-chain.

Endpoints:

| Endpoint                          | Authentication     | Result                                                                                               |
| --------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `GET /health`                     | none               | API health response                                                                                  |
| `GET /v1/launches/:token`         | none               | indexed launch view                                                                                  |
| `GET /v1/profiles/:handle`        | none               | indexed profile + token view                                                                         |
| `GET /v1/rewards/:token/:account` | none               | stored epoch claim arguments: epoch ID, amount, Merkle proof, root, snapshot block, and metadata URI |
| `POST /v1/identity/x/verify`      | Privy bearer token | verified X identity bound to wallet                                                                  |
| `POST /v1/attestations/self-rove` | Privy bearer token | Self-Rove typed-data signature for `{ wallet, metadataHash }`                                        |
| `POST /v1/attestations/scout`     | none               | public X lookup + Scout typed-data signature for `{ handle, metadataHash }`                          |
| `POST /v1/attestations/claim`     | Privy bearer token | Nottingham claim typed-data signature for `{ wallet, profileToken }`                                 |

Claiming is rename-safe: ownership is checked using the stable numeric X user ID. The API signs the original, launch-time handle because Nottingham verifies the immutable on-chain handle hash. A later X handle change therefore does not lose a legitimate claimant’s funds.

### Database and migrations

Database definitions are in [packages/database/src/schema.ts](/Users/faith/Documents/rovo/packages/database/src/schema.ts), with SQL migrations in [packages/database/migrations](/Users/faith/Documents/rovo/packages/database/migrations).

Persisted tables include:

- `profiles` — numeric X identity and display metadata.
- `launches` — Pons/Rovo market metadata and lifecycle state.
- `revenue_events` — indexed collection/distribution events.
- `reward_epochs` — published Merkle reward roots.
- `reward_proofs` — each published `(profile token, epoch, account)` allocation and its exact Merkle proof.
- `verified_identities` — verified Privy/X/wallet bindings.
- `identity_attestations` — issued typed-data signatures, nonce, deadline, target contract, and payload bindings.

Nonce uniqueness is enforced in the database as an operational audit safeguard and independently on-chain as the security boundary.

### Pons pair-token catalogue

[packages/config/pons-pair-tokens.json](/Users/faith/Documents/rovo/packages/config/pons-pair-tokens.json) contains 65 curated pair choices from the supplied Pons launchpad menu: 63 active Robinhood Chain Stock Tokens, native ETH, and USDG. ETH uses Pons' native-currency marker `0x0000000000000000000000000000000000000000`; USDG uses Pons' published ERC-20 address `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. The other seven non-stock choices were removed at the user's request. Each item has its symbol, display name, and Pons icon path; icon URLs are `iconBaseUrl + iconPath`. Robinhood asset IDs and addresses are retained in [robinhood-stock-deployments-4663.json](/Users/faith/Documents/rovo/packages/config/robinhood-stock-deployments-4663.json), while `nonStockAddressSource` records the Pons bundle used for ETH and USDG. Names and symbols are never used for on-chain authorization; a configured address must still pass Pons' live pair-token approval and economics checks. Native ETH is a zero-address quote marker, not an ERC-20 contract. Rovo now accepts that marker in the registry, forwards ETH to Pons curves and native-capable V4 adapters, refunds unspent quote, and supports native-ETH fee collection, holder claims, Nottingham vault payouts, and platform reservoir releases. The existing ERC-20 path remains in place for USDG and stock tokens. Local mock-Pons EVM tests cover the native and ERC-20 paths; live Pons launch/trade testing still requires deployed Rovo contracts and funded Robinhood Chain transactions. Native-quote V4 trading additionally requires a separately reviewed and allowlisted V4 adapter that accepts ETH; the stock-only Uniswap V3 input adapter is not that adapter.

### Indexer and workers

- [apps/indexer/ponder.config.ts](/Users/faith/Documents/rovo/apps/indexer/ponder.config.ts) configures Ponder for Robinhood Chain `4663`.
- The indexer discovers each collector from `CollectorCreated`, then watches `ProfileTokenBound`, registry, splitter, Nottingham, and holder reward events.
- The API now independently scans `RovoRegistry` launch/claim events into its `launches` table, with a durable `launch_sync_state` cursor. This closes the gap between Ponder's `launch` table and the API's richer launch view. Apply `pnpm --filter @rovo/database migrate` before starting the API. The sync starts with the API, uses `PONDER_RPC_URL_4663` (falling back to `ROBINHOOD_RPC_URL`), and scans from `ROVO_START_BLOCK` to 12 blocks behind the chain tip. Use `pnpm --filter @rovo/api sync:launches` for a one-shot backfill or verification. The RPC must permit historical `eth_getLogs`; the free dRPC endpoint rejects queries older than its recent-history window, while the official Robinhood endpoint accepted the launch backfill. For sustained Ponder indexing, use a keyed archival RPC when available.
- [apps/workers/src/epoch.ts](/Users/faith/Documents/rovo/apps/workers/src/epoch.ts) creates deterministic OpenZeppelin Standard Merkle Trees from holder balances. It filters zero balances, allocates pro-rata, puts remaining rounding dust in the final allocation, and returns proofs.
- [apps/workers/src/snapshot.ts](/Users/faith/Documents/rovo/apps/workers/src/snapshot.ts) rebuilds balances from the profile token's ERC-20 Transfer logs from its deployment block through a caller-selected finalized block. It pins the returned block hash, excludes the zero address, profile token, curve/distributor and any supplied exclusion list, then produces the Merkle allocations and metadata URI for the epoch-publisher transaction. An archival RPC is required for the full range.
- BullMQ workers are wired for reward epochs, buyback jobs, and monitoring jobs. The buyback job is a queue shell only until the buyback executor exists.

#### Zap router behavior

`RovoZapRouter` reads the Pons V2 `getLaunchedToken(profileToken).phase` record from the immutable Pons factory saved at launch. It does not infer venue from UI state, balances, or events.

1. The deployment creates `UniswapV3StockAdapter` with official Robinhood Uniswap addresses and allowlists it in `RovoZapRouter`.
2. The admin configures a Stock Token only after `UniswapV3Factory.getPool(WETH, stockToken, fee)` returns a real pool. No pool means ETH Zap is unavailable for that Stock Token.
3. A trader calls `buyCurve` with ETH, WETH, or an already-held pair token. A native-ETH pair needs no input adapter when the input is ETH. For a Stock Token pair, the allowlisted adapter performs exact-input ETH/WETH → Stock Token; for an already-held ERC-20 pair token, no adapter is used. Other input-to-pair routes require their own reviewed adapter.
4. In Pons phase 0, the router calls the immutable curve stored in `RovoRegistry`: native ETH quotes travel as call value; ERC-20 quotes are approved only for the call and the allowance is cleared afterward.
5. In Pons phase 1, anyone may call `completeGraduation`; this calls Pons `createGraduatedPool` and never moves liquidity itself. In phase 2, `buyV4` requires a reviewed per-token V4 adapter. Phase 3 is rejected.
6. The user is always the Pons `recipient`; this preserves recipient-based Pons snipe-tax behavior and prevents a router-controlled recipient from changing it.

Both paths enforce a deadline, exact native-value handling, adapter allowlisting, a minimum pair-token amount, and a minimum profile-token amount measured from the recipient’s actual balance change. Unspent native ETH or ERC-20 quote returned to the router is refunded to the caller. Native-ETH V4 buys require an allowlisted adapter that accepts call value; the deployed stock-only Uniswap V3 input adapter cannot serve as that V4 adapter.

#### Reward snapshot ingestion

The epoch worker supports two job formats:

- Legacy calculation input: `{ pool, balances }` builds a Merkle tree from supplied balances.
- Snapshot input: `{ profileToken, launchBlock, snapshotBlock, pool, excludedAccounts, metadataUri }` queries ERC-20 `Transfer` logs from `launchBlock` through `snapshotBlock` in 50,000-block chunks, reconstructs balances, and returns a snapshot artifact.

The artifact contains the profile token, snapshot block and block hash, exclusion/eligible supply totals, holder count, metadata URI, Merkle root, total allocation, and account proofs. A `null` root means no eligible holders and must not be submitted on-chain. The requested snapshot block must already be finalized by the job scheduler; the worker pins its hash so the publisher can re-check it immediately before publication.

For each token, pass the curve, rewards distributor, router/treasury wallets, token contract, and any other protocol-controlled addresses in `excludedAccounts`. The zero address and profile-token contract are always excluded. Use an archival Robinhood RPC: a provider that cannot serve logs back to the launch block cannot safely produce an epoch.

#### Reward epoch publication and claims

Snapshot jobs now require `epochId` and `stockToken` in addition to the snapshot fields. The worker:

1. Re-fetches the snapshot block and refuses publication if its hash changed.
2. Reads `HolderRewardDistributor.pools(profileToken)` and refuses when the currently unreserved on-chain pool cannot fund the root.
3. Sends `setEpochRoot(profileToken, epochId, root, total)` from `EPOCH_PUBLISHER_PRIVATE_KEY`.
4. Waits for a successful receipt before persisting the epoch and every proof in Postgres.
5. Makes those exact claim arguments available at `GET /v1/rewards/:token/:account`.

The worker therefore never exposes proofs for a root that failed on-chain publication. Repeating an already-published epoch ID will revert on-chain and the job will fail rather than overwrite proofs.

### Deployment tooling

[packages/contracts/deploy/deploy.mjs](/Users/faith/Documents/rovo/packages/contracts/deploy/deploy.mjs) deploys the stack from the admin wallet. It deliberately deploys each contract as a separate transaction instead of using a giant on-chain deployer contract, avoiding EVM code-size risk.

Deployment sequence:

1. Deploy registry, collector factory, Nottingham vault, holder distributor, reservoir, splitter (with the configured admin as its `DEFAULT_ADMIN_ROLE` holder and a nonzero immutable treasury wallet), Zap router, Uniswap Stock adapter, then wrapper.
2. Bind splitter addresses into the vault, distributor, and reservoir.
3. Grant only required roles:
   - wrapper → `LAUNCHER_ROLE`
   - Nottingham → `CLAIM_FINALIZER_ROLE`
   - wrapper → collector factory `WRAPPER_ROLE`
4. Allowlist the deployed Uniswap Stock adapter in the Zap router, then read each role and contract reference back from chain before declaring deployment successful.
5. Write an address manifest only if the output path does not already exist.

## Local setup and commands

Copy values from [.env.example](/Users/faith/Documents/rovo/.env.example) into your private environment. Never commit secrets.

```bash
pnpm install
pnpm db:generate
pnpm typecheck
pnpm test
pnpm build
```

Run services:

```bash
pnpm dev:api
pnpm dev:indexer
pnpm dev:workers
```

Deploy only after you have confirmed the real Robinhood/Pons addresses and used a securely stored deployer key:

```bash
node --env-file=.env packages/contracts/deploy/deploy.mjs
```

Required deployment environment values:

```text
DEPLOYER_PRIVATE_KEY
ROBINHOOD_RPC_URL
ROVO_TREASURY_ADDRESS
IDENTITY_SIGNER_ADDRESS
EPOCH_PUBLISHER_ADDRESS
EPOCH_PUBLISHER_PRIVATE_KEY
PONS_FACTORY_ADDRESS
PONS_LAUNCH_AND_BUY_ADDRESS=0xe33E9E479dF8802cb0866d5d05258bEc4cF62948
PONS_FEE_ESCROW_ADDRESS
PONS_MEME_HOOK_ADDRESS
UNISWAP_SWAP_ROUTER02_ADDRESS=0xCaf681a66D020601342297493863E78C959E5cb2
UNISWAP_V3_FACTORY_ADDRESS=0x1f7d7550B1b028f7571E69A784071F0205FD2EfA
WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
CLAIM_DELAY_SECONDS=86400
SCOUT_CREATOR_TAX_BPS=200
DEPLOYMENT_OUTPUT=packages/contracts/deployments/4663.json
```

### Atomic launch and opening buy

The updated wrapper supports `launchSelfRoveAndBuy` and `launchScoutAndBuy`. Each verifies the X-profile attestation, creates the per-launch fee collector, calls Pons `launchAndBuy` with that collector as the explicit creator fee recipient, and registers the launch in Rovo. The opening-buy recipient is the launch caller. Native ETH sends `launchFee + quoteIn`; an ERC-20 pair first needs a wallet approval to the Rovo wrapper, then the wrapper approves the Pons router. The wrapper returns unused quote to the caller and removes its ERC-20 router allowance. `minTokensOut` must be positive. The old launch-only entrypoints remain available.

Native ETH is the zero-address pair: Pons reads its economics from the launch config, not `approvedPairTokens(0)` or `pairTokenEconomics(0)`. The updated wrapper and web action now treat it accordingly.

The existing mainnet wrapper at `0x16bed89fdb8b6e36984f20d03bbd4a5469998007` is immutable and **does not** contain these changes. Deploy only the replacement wrapper and grant its existing registry/collector roles with:

```bash
node --env-file=.env packages/contracts/deploy/upgrade-wrapper.mjs
```

The command refuses to overwrite `packages/contracts/deployments/4663-wrapper-upgrade.json`. After it succeeds, set `ROVO_FACTORY_WRAPPER_ADDRESS` and `NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS` in root `.env`, plus `NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS` in `apps/web/.env.local`, to the new address; restart API and web. The API must sign attestations for the same wrapper the web calls. Confirm the script reports `canLaunch: true`; if false, Pons must allowlist the new wrapper before launches can work. The web launch flow checks for the new entrypoint and refuses to submit an opening buy through the old wrapper.

## Verification completed

The Robinhood Chain 4663 deployment manifest is now at `packages/contracts/deployments/4663.json`. Read-only RPC checks confirmed code at all nine recorded addresses. The root `.env` and `apps/web/.env.local` contain those public addresses; Privy, X API, and signer secrets still need to be supplied before live onboarding and attestations can run.

The following passed on 2026-09-26:

- Solidity `0.8.28` compilation with optimizer + `viaIR`.
- 11 contract behavior tests and 13 fee-accounting invariant vectors on local Anvil, including unauthorized harvest/direct-collector rejection, admin batch isolation, and both native/erc-20 treasury routing paths.
- Deployment orchestration, role and module-reference assertions on local Anvil.
- 15 API tests: Privy verification, X resolver, typed-data recovery, persistence behavior, rename-safe claims, HTTP routes, and reward-proof retrieval.
- 7 fee-domain tests, 2 Merkle worker tests, 2 reward-snapshot ingestion tests, and 2 publication safety tests.
- Drizzle migration validation.
- Full workspace type-check, test suite, and production build.

## Not yet implemented — do not treat as production-ready

These are explicit remaining MVP slices:

1. **V4 trading adapter** — deploy/audit the adapter that turns a Stock Token into the profile token through the Pons-created Uniswap V4 pool in phase 2.
2. **PlatformBuybackExecutor** — swap platform Stock Token balances to `$ROVO`, enforce allowlisted route adapters/slippage, then burn 50% and send 50% to treasury.
3. **Live Pons event integration** — replace the current Rovo-only indexer ABI coverage with confirmed deployed Pons V2 factory, curve, MemeHook, and FeeEscrow events; monitor unswept balances and Pons stack changes.
4. **Privy webhooks** — verify signed link/unlink webhooks and synchronize records; current identity persistence occurs at attestation time only.
5. **Production operations** — secrets manager, Postgres/Redis deployment, RPC reliability, monitoring/alerts, multisig ownership, audit, testnet deployment, and incident procedures.
6. **Web production completion** — the mounted web app now has Privy/WalletConnect configuration, skip-enabled X onboarding, live indexed home listings, Self-Rove/Scout launch, direct-pair buy, Nottingham and reward claims, wallet/profile pages, and admin fee routing. It still needs real Privy/X credentials, live wallet/Pons end-to-end testing, market-data charts/quotes, sell trading, terms/geo restrictions, risk disclosures, and Radar. The old static token preview no longer represents a live market.

## Important production rules

- Do not deploy with guessed Pons addresses or guessed Pons ABI methods.
- Do not configure a V4 adapter from an assumed graduation state: verify the live Pons phase for that exact profile token first.
- Do not publish a reward root unless the snapshot block hash is re-checked, the whole Transfer-log range was served, and the complete exclusion list was reviewed.
- Do not use a local development key for `IDENTITY_SIGNER_PRIVATE_KEY` or deployment.
- Put the identity signer and contract admin behind proper operational controls; production admin should be a multisig.
- Keep the ten-minute attestation limit unchanged unless the matching on-chain limits change together.
- Run an independent security audit before mainnet deployment. The test suite proves intended cases; it is not an audit.
