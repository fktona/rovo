# Rovo web app

The deployed Robinhood Chain 4663 addresses are configured in the root `.env` for backend services and in `apps/web/.env.local` for the browser. The latter contains public addresses only. Do not put a private key or Privy App Secret in a `NEXT_PUBLIC_*` variable.

## Finish local configuration

Add these values before login can work:

- Root `.env`: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `IDENTITY_SIGNER_PRIVATE_KEY`, and `X_API_BEARER_TOKEN`. The identity signer key must correspond to the `IDENTITY_SIGNER_ADDRESS` used when the contracts were deployed; do not replace the address with a new one.
- Set `NEXT_PUBLIC_PRIVY_APP_ID` in `apps/web/.env.local` for Privy login. Without it, the UI still renders in read-only mode and login/transactions remain unavailable. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is optional for WalletConnect QR-based connections; Privy can connect supported external wallets without making it a startup requirement. The app ID and project ID are public; the app secret is not.

Start only local Postgres and Redis with `docker compose up -d`. Compose publishes Postgres on `localhost:5433` (to avoid an existing Postgres on 5432) and Redis on `localhost:6379`. Run database migrations from the host with `pnpm --filter @rovo/database migrate`, then start the API with `pnpm dev:api` and the web app with `pnpm dev:web` from the repository root. Compose does not run any app process. The API reads the root `.env`; Next reads `apps/web/.env.local`. Restart both after changing configuration. The API permits browser requests from `http://localhost:3000` by default; set `ROVO_WEB_ORIGIN` for another origin. Run the indexer separately for live launch listings.

## Connected flows

- First login redirects to `/onboarding` when X is not linked. The user can link and verify X or skip. Skip is stored for that Privy user in the browser. Self-Rove still requires a linked X account; Scout does not.
- Home lists indexed launches from `GET /v1/launches`. Market cap, price and volume are deliberately not fabricated while market-data indexing is absent.
- Launch creates the token on Raydium Launchpad with the Raydium SDK and a Solana wallet. It does not call the Rovo or Pons contracts. The quote asset is a Solana mint. An optional first buy is paid in SOL; a non-SOL quote is swapped from SOL on Raydium CLMM before the launch transaction. See `docs/solana-visual-design.md`.
- `/token/[address]` reads the indexed launch and on-chain state. Direct-pair buys require a user-supplied minimum token output and an ERC-20 approval when applicable. Reward proofs, Nottingham claims and admin fee-routing actions use the existing contract helpers. Sell and price quotes are not yet exposed.
- The old `/token/zora` mock route redirects home so its invented chart and prices are not mistaken for live data.

The manifest at `packages/contracts/deployments/4663.json` confirms deployment, not production readiness. Live Privy/X and wallet transactions still require credentials, funded wallets, running API/indexer infrastructure, and independent security review. Run `pnpm --filter @rovo/web typecheck`, `test`, `lint`, and `build` to verify this package.
