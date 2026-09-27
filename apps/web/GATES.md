# Gates: Rovo web integration layer

OWNS: apps/web/src/lib/**, apps/web/src/hooks/**, apps/web/src/providers/**, apps/web/package.json, apps/web/tsconfig.json, apps/web/README.md, apps/web/GATES.md, apps/web/src/**/*.test.ts, .env.example, pnpm-lock.yaml

Scope: provide typed API, Privy wallet/X identity, contract reads and writes, query hooks, and utilities without building UI.

- [x] W0: the integration ledger has testable checks
      CHECK: node ../../.agents/skills/unlazy/scripts/gate-lint.mjs GATES.md
      EXPECT: LINT OK
      EVIDENCE: automatic-evidence=v1; definition-sha256=aa01785ac688b74f7d7ce6fd7ed11268a0f8873c1deae0169377871a40cbd49a; exit=0; EXPECT=matched; output-sha256=ceafcfaffcb1c3308d192d44e46c58165eedf408c32bc55047c231bf23c8e385; output-bytes=150; shell=/bin/sh; cwd=/Users/faith/Documents/rovo/apps/web; path=ce241624dc26/40 entries

- [x] W1: web integration TypeScript and lint pass
      CHECK: pnpm --filter @rovo/web typecheck && pnpm --filter @rovo/web lint
      EXPECT: lint passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=e3b3683cfe47f661dcfd64232f62115dcdf462410205c0c188aa229bfb295178; exit=0; EXPECT=matched; output-sha256=7f10502eede73243ded22faa5940e4c12e95ce6aa36d36b82a38fc0aa2dbf141; output-bytes=207; shell=/bin/sh; cwd=/Users/faith/Documents/rovo/apps/web; path=ce241624dc26/40 entries

- [x] W2: API and contract input helpers reject invalid data and construct correct calls
      CHECK: pnpm --filter @rovo/web test
      EXPECT: web integration tests passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=067f4dc34ff8640d66aa88fbd190a4060ee65e6b3d8cbfc3b85b19da97ac802f; exit=0; EXPECT=matched; output-sha256=e318e25815e81148ca4c750ffc86c6c1d94f0fd34cc13b6561f302fc3b5bfe1e; output-bytes=450; shell=/bin/sh; cwd=/Users/faith/Documents/rovo/apps/web; path=ce241624dc26/40 entries

- [x] W3: production web build succeeds with the integration layer and no screen work
      CHECK: pnpm --filter @rovo/web build
      EXPECT: web integration build passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=116676fb8d4a22e9882563eb79a63cf0cd4a55a0c5b3d79f9200370a22ac630e; exit=0; EXPECT=matched; output-sha256=459effaca8fdf7106632d63cdf65b8aac9f5e212ec5e32df2e41f76c08849e65; output-bytes=685; shell=/bin/sh; cwd=/Users/faith/Documents/rovo/apps/web; path=ce241624dc26/40 entries

- [x] W4: provider, API, and contract surface covers each implemented user flow without adding UI
      EVIDENCE: 2026-09-26 manual review: src/providers/RovoProviders.tsx supplies Privy/WalletConnect, Query, API, viem reads; hooks expose identity, backend and on-chain queries, transaction mutations; contracts/actions.ts covers Self-Rove, Scout, approval/trading/graduation, Nottingham initiation/finalization, creator sharing, holder rewards, fee withdrawal, and both admin revenue routes. Curated Pons pairs are display-only and launch actions recheck approval. No src/app or src/components file was edited for this task.
