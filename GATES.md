# Gates: Rovo trading and reward snapshot ingestion

OWNS: GATES.md, .env.example, apps/api/**, apps/workers/**, packages/config/**, packages/database/**, packages/contracts/**, scripts/**, IMPLEMENTATION-HANDOFF.md, package.json, pnpm-lock.yaml

Scope: provide a phase-aware Pons Zap router and reward epochs, then reconcile Pons pair choices with Robinhood Chain Stock Token deployments

- [x] G0: this ledger states outcomes that can fail
      CHECK: node .agents/skills/unlazy/scripts/gate-lint.mjs GATES.md
      EXPECT: LINT OK
      EVIDENCE: automatic-evidence=v1; definition-sha256=9bb769c9825e56c6031e9774519c19d0b892664ee461d141706fcb807b263a22; exit=0; EXPECT=matched; output-sha256=7a7922f0e3f69de36db176b084b74091e068cc8772d7b0d01d49001e587c54e0; output-bytes=150; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G1: authenticated Self-Rove and Nottingham requests bind the Privy user, linked X identity, selected wallet, and target launch into valid EIP-712 attestations
      CHECK: pnpm --filter @rovo/api test
      EXPECT: identity attestation integration passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=5ac5ff7cef3992d3a1c58f1fb37a7e3d55d595b5ab646425d262c9fdd6a8830f; exit=0; EXPECT=matched; output-sha256=5a8523e0dd677191b47ff7e4da95fa3eea1bf69ac0215d7db4fa3af4e0af20fb; output-bytes=634; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G2: Scout attestations resolve a stable numeric X identity and every issued attestation is persisted with a unique nonce and ten-minute-or-shorter deadline
      CHECK: node scripts/verify-attestations.mjs
      EXPECT: attestation persistence verified
      EVIDENCE: automatic-evidence=v1; definition-sha256=08913308dd03b1617aa97bfea29af596ad33c87a5e4b2efe4218b494c63efaf1; exit=0; EXPECT=matched; output-sha256=331c023faf05d8d5dfe2a7e6e9f6c6a928c7bae131e60af557b83d7f43515761; output-bytes=448; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G3: the complete contract stack, including RovoZapRouter, has deterministic deployment wiring, roles and module references, and passes on-chain deployment assertions
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: deployment wiring verified
      EVIDENCE: automatic-evidence=v1; definition-sha256=5691861c26e37be912c7d0ab743fe6ede071cbb0bcc66a858495ece07769193f; exit=0; EXPECT=matched; output-sha256=f6b2ef7439c6a7680ecb6b29556175bcfe6b1ae1b2d91e4218b00ee0ac1da89b; output-bytes=342; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G4: database migration, TypeScript boundaries, tests, and production builds pass together
      CHECK: node scripts/verify-integration.mjs
      EXPECT: identity deployment integration verified
      EVIDENCE: automatic-evidence=v1; definition-sha256=62e36c81eac2487deb86647a4569d3012282a5dd5cafaefe27f65fd796ac1628; exit=0; EXPECT=matched; output-sha256=212150ed98ecd8e9ea0ab8c0ed83628fc9f50dac1b4dba08fcabe3fb4442a881; output-bytes=4650; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G5: Zap and snapshot trust boundaries are manually reviewed against the PRD requirements
      EVIDENCE: 2026-09-26 manual review: the router derives curve and pair token only from the immutable Rovo registry; it permits input conversion only through admin-allowlisted adapters; enforces exact native value, deadline and both pair/profile minimum outputs; and always makes msg.sender the Pons recipient. It reads Pons' launch phase from the immutable stored factory: phase 0 uses the curve, phase 1 can only call permissionless Pons graduation, phase 2 can use a reviewed V4 adapter, and other phases reject. The Uniswap adapter only supports native ETH/WETH into admin-configured Stock Token pools verified through the V3 factory. Snapshot ingestion begins at the launch block, pins the requested finalized block hash, rejects malformed/negative transfer reconstruction, excludes system addresses plus an explicit caller-supplied list, and requires an archival RPC for the whole range. Publication rechecks the hash and on-chain unreserved pool, waits for a successful receipt, then persists the root and proofs; the API reads those persisted proofs only.

- [x] G6: finalized transfer-log ingestion excludes system balances, pins a block hash, and produces valid deterministic Merkle allocations
      CHECK: pnpm --filter @rovo/workers test
      EXPECT: snapshot ingestion passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=1b6baeda2d13ce600c8861d3fbfb2d5d85752ef308178dddbeb419cb42df7278; exit=0; EXPECT=matched; output-sha256=bcb26f743c162967468c0983b2aca43e37a770241ec61fb27fcf85b0b108a6c8; output-bytes=460; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G7: a root is only persisted after snapshot-hash and pool checks plus successful on-chain publication, and the API returns the stored claim proof
      CHECK: pnpm --filter @rovo/workers test && pnpm --filter @rovo/api test
      EXPECT: reward epoch publication passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=b9eece72b7ab47accc9cf9f442eb029e3839c45910b2617d60946bd083656393; exit=0; EXPECT=matched; output-sha256=511515242fc91b86987141638e26e5b360c070ddaf5bcad83b91a974bda30fa5; output-bytes=1145; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G8: deployment includes an allowlisted Uniswap ETH/WETH-to-Stock adapter, and the Zap router uses the authoritative Pons phase before routing or completing graduation
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: deployment wiring verified
      EVIDENCE: automatic-evidence=v1; definition-sha256=5691861c26e37be912c7d0ab743fe6ede071cbb0bcc66a858495ece07769193f; exit=0; EXPECT=matched; output-sha256=9d4871f2b70ce65ebe02b22aab322f7834a85d2fc8490789bd7327108297968d; output-bytes=342; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G9: Pons pair catalogue keeps 63 active chain-4663 Robinhood Stock Token deployments plus only Pons-verified ETH and USDG, with the other seven non-stock choices removed
      CHECK: node scripts/verify-pons-pair-addresses.mjs /private/tmp/rovo-rhj-assets.json /private/tmp/rovo-pons-pairs.js
      EXPECT: Pons pair address reconciliation passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=2fff003293f0addadb05a6706eb659560a9a3a34784315e81a23a84753ff7ae7; exit=0; EXPECT=matched; output-sha256=85b37b18bf48b4e286308c3f3c4bfc075ee6e6f4686229d54f3bc88dd068ff6f; output-bytes=100; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G10: native ETH launch records, fee collection, split accounting, holder claims, and reservoir releases work end to end on local EVM
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: native ETH contract paths passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=eaa04bc735505f7e1b3b58a528e9256385d6a0b2f02065e2b31e16cb3a636e8f; exit=0; EXPECT=matched; output-sha256=9d827c9e338a6f3d633428e041fc840f1bf68d340b6cf5c49888248c891624e8; output-bytes=407; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G11: ETH and six-decimal USDG-style ERC-20 quote buys, including native V4 routing, return unspent quote and enforce output limits
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: quote routing regression passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=9a8204dd263a170c680af8248dc82d9447192776b56f099698934d7e51219a0f; exit=0; EXPECT=matched; output-sha256=7cea298a4977f745e05b3faa9c7f2dbf0ba92cd3390d6e480574017d7c236870; output-bytes=407; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [ ] G12: deployed Rovo contracts complete ETH and USDG launches and trades against the live Pons V2 factory on Robinhood Chain
      EVIDENCE: pending

ABANDON: G12 Rovo has no deployment addresses or funded authorized launch wallet in this workspace; live launch/trade transactions are outside the available environment.

- [x] G13: only the configured splitter admin can trigger fee collection and direct collector calls cannot bypass authorization
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: admin fee release authorization passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=d6f12ac068c9c5f9a40479b18637a71db1c0cebc7740d6e9c3f504100d1d3635; exit=0; EXPECT=matched; output-sha256=066c0738021fa62e485fe2b73b78a31357305ea24de8d74dee6af110d8af8488; output-bytes=488; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G14: admin batch harvesting preserves per-launch failure isolation and deployment assigns the intended admin
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: admin harvest deployment and batch passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=0cf3a736a5395e74b3614bc185761a0eaac1da5548779cbeafa63e6848e6e26b; exit=0; EXPECT=matched; output-sha256=e66a80e5c41a9fc7fda0cfc7f0bfc890a3625cca5f20bfd25afede309c8bf05c; output-bytes=488; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G15: admin can choose complete claimable revenue for the normal split or direct treasury delivery for native ETH and ERC-20 without sending treasury-route funds through the splitter
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: dual revenue route tests passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=db34ccc76f8b376e560f88ac55df8dbc50920970fdb4ae38fb966de46788ad44; exit=0; EXPECT=matched; output-sha256=cfacfe691ea8f693764416edf27b1765268fb34549c099589cac85c0a59c6b21; output-bytes=557; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G16: non-admin callers cannot choose the treasury route and treasury destination is configured, nonzero, and verified at deployment
      CHECK: node scripts/verify-contracts.mjs
      EXPECT: treasury route authorization passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=063db0ba61eac479ce68b086aea9071728630de266a6a0f1b080803f9d5b06ce; exit=0; EXPECT=matched; output-sha256=ec0def4315374931e2d44aa9c5ef73ff44e9a5d96464295254c4d7aae184b2b3; output-bytes=557; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries

- [x] G17: treasury diversions remain visible in the indexer and the backend regression suite passes
      CHECK: node scripts/verify-treasury-indexer.mjs && node scripts/verify-integration.mjs
      EXPECT: treasury revenue indexing verified
      EVIDENCE: automatic-evidence=v1; definition-sha256=4da5d994bd45e932455b545cb0919c62ea0ddf89eee3cbe64425208c905d072b; exit=0; EXPECT=matched; output-sha256=d11d3f4180ebf9d5c473bfe3292ec4404804388f79a93f46d1b377b5f457d219; output-bytes=5960; shell=/bin/sh; cwd=/Users/faith/Documents/rovo; path=ce241624dc26/40 entries
