# Solana visual branch

Branch: `codex/solana-visual-refresh`.

Token launch uses Raydium Launchpad through `@raydium-io/raydium-sdk-v2`. It does not call the Rovo or Pons contracts. The flow is the one in `/Users/faith/Documents/sol-stocks`: upload metadata, optionally swap SOL into the quote mint, then `raydium.launchpad.createLaunchpad`.

## Launch

- Wallet: Privy Solana. Login can create an embedded Solana wallet, and external Solana wallets connect through Privy. The signer is `useSignAndSendTransaction` from `@privy-io/react-auth/solana`.
- Quote assets: Solana mints in `apps/web/src/lib/raydium/pairs/` — xStocks, SOL, currency tokens, and the Stonkfun list. The pair step filters those lists. Robinhood Chain pair addresses are not used for launch.
- First buy: optional, paid in SOL. If the quote mint is not wrapped SOL, the app swaps SOL to that mint on a Raydium CLMM pool, then buys on the launch transaction. Leave the amount blank to create the curve without a buy.
- Metadata: `POST /api/uploads/pinata` pins the image and a JSON metadata file. Profile launches send the X photo URL; meme launches send the chosen image file. `PINATA_JWT` comes from the environment, or from the repo root `.env` when the web app is started from `apps/web`.
- Curve: 6 decimals, supply `1000000000000000`, `totalSellA` `793100000000000`, raise target 85 units of the quote token, migration `cpmm`, creator fee on quote token only (`CpmmCreatorFeeOn.OnlyTokenB`).
- Symbol: at most 10 characters. The mint keypair is generated in the browser and added as an extra signer.
- After confirmation, the success dialog shows the mint and opens it on Solscan. The app does not write the mint into the EVM launch index.

Code: `apps/web/src/lib/raydium/raydium-launch.ts`, `raydium-clmm-swap.ts`, and `apps/web/src/components/launch/launch-live.tsx`.

Public configuration, in `apps/web/.env.local`:

- `NEXT_PUBLIC_SOLANA_RPC_URL` — defaults to `https://api.mainnet-beta.solana.com`
- `NEXT_PUBLIC_RAYDIUM_CLUSTER` — `mainnet` or `devnet`
- Optional overrides: `NEXT_PUBLIC_RAYDIUM_LAUNCHPAD_PROGRAM_ID`, `NEXT_PUBLIC_RAYDIUM_LAUNCHPAD_PLATFORM_ID`, `NEXT_PUBLIC_RAYDIUM_LAUNCHPAD_CONFIG_ID`

When the config id is unset, the app derives the constant-curve, index-0 Launchpad config for the selected quote mint. The default mainnet platform id is `4Bu96XjU84XjPDSpveTVf6LYGCkfW5FK7SNkREWcEfV4`.

Trading, rewards, and the Robinhood Chain contracts are unchanged. A new Raydium mint is not a token page on the old market.

## Visual system

- Light default: lavender canvas `#f7f6fb`, white surfaces, violet text `#231b35`.
- Accent: accessible violet `#7434c5`; mint positive values `#087e58`.
- Primary actions: pastel violet → blue → mint gradient, with dark text.
- Dark mode: plum-black canvas `#100e17`, violet surfaces, lavender accents, mint positive values.
- Typeface: locally hosted Manrope variable font, weights 200–800. Existing text sizes, component spacing, and responsive breakpoints are preserved.
- Color roles are declared in `apps/web/src/app/globals.css` and exposed as Tailwind utilities. Theme preference uses `rovo-solana-theme` so it is independent of the original Rovo theme.
- Existing Rovo vector marks retain their geometry and use lavender in place of lime.

## Sources

Solana's official brand palette specifies purple `#9945FF` and green `#14F195`: https://solana.com/branding. This UI uses softer shades and stronger text colors for contrast rather than applying those saturated colors to every surface.

Manrope is an independently chosen open-source UI font, not a claim about Solana's official typography. Font and OFL license: https://github.com/google/fonts/tree/main/ofl/manrope. Both are bundled in `apps/web/src/app/fonts`.
