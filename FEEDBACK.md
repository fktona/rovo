# Rovo product feedback

**Audience:** Engineering  
**Status:** Ready to implement  
**Decisions locked with product:**

- **Meme / normal tokens** are a first-class launch + discovery track this round (not Phase 2).
- **X Money** is UI clarity only: show that audit-period fees go to the X Money / treasury wallet. Do **not** add a creator “send fees to X Money” field at launch (admin `collectToTreasury` per batch stays as-is).

---

## Locked product decisions

| Decision | Meaning |
| -------- | ------- |
| Meme launches in scope | New launch + homepage track for non-profile tokens |
| X Money = visibility | Surface the audit treasury route in product UI; no creator fee-destination control at launch |

---

## Global

### 1. Dark and light mode

Add a real theme toggle. Persist preference; respect system default on first visit.

Today [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css) is dark-only (`color-scheme: dark` + hard-coded black / `#ccff00` surfaces). Theme must cover shell, home, launch, token, profile, rewards, and admin.

**Done when:** toggle works on desktop and mobile; both themes are readable; preference survives refresh.

### 2. X Money visibility

Surface that platform fee batches currently go to **X Money** (audit treasury route) where users look for payouts — Rewards, Profile fee copy, Docs (already partly there), and a short note near fee estimates.

Do not imply creators or holders are automatically paid on-chain while that route is active.

**Done when:** a logged-in user can see, without reading only `/docs`, that fees are going to X Money during audit.

### 3. `$ROVO` contract address in header

Show the platform token CA in the app header (shortened). Click copies the full address and shows a toast.

Source from env (e.g. `NEXT_PUBLIC_ROVO_TOKEN_ADDRESS`). Product must supply the live address.

**Done when:** address is visible in the header on desktop and mobile shell; click copies; no layout break when unset (hide or show “TBA”).

---

## Homepage

Primary file: [`apps/web/src/components/home/home-dashboard.tsx`](apps/web/src/components/home/home-dashboard.tsx)

### 4. Table columns

- **Remove** the Creator fee column (and stop fetching `/api/creator-fees` just for the home table).
- **Add / restore** metrics: **24h volume**, **liquidity** (or market depth proxy already available), and **age**.
- 24h change may stay if data is reliable; volume, liquidity, and age are required.

**Done when:** home table has no creator-fee column; volume / liquidity / age populate for launches that have market data.

### 5. Remove “Highest Vault” filter

Delete the “Highest Vault” tab from `views` and any sort keyed on `creatorFeeUsd`.

**Done when:** the tab is gone and no code path ranks by vault / creator fee for that filter.

### 6. Meme / other tokens section

Add a distinct homepage section (or filter) for **non-profile / meme tokens** vs creator / profile tokens.

Depends on meme launch support (§11). Until data exists, empty-state with a CTA to Launch is fine.

**Done when:** creators and memes are visually separable on the homepage.

### 7. Footer links

Implement pages (or redirects) for `/how-it-works` and `/terms` linked from [`apps/web/src/components/shell/app-shell.tsx`](apps/web/src/components/shell/app-shell.tsx) (footer + account menu). Privacy currently also points at `/terms` — share Terms or give Privacy its own page.

**Done when:** neither link 404s; content is real (not placeholder Lorem).

### 8. Stock pair filter icons under VPN / blocked CDN

Pair icons come from remote `iconBaseUrl` in [`packages/config/pons-pair-tokens.json`](packages/config/pons-pair-tokens.json). When that host is blocked, icons break.

**Fix:** proxy or self-host icons under `apps/web/public` (or a same-origin API), with a local fallback glyph if load fails.

**Done when:** homepage pair chips still show icons (or consistent fallbacks) with a typical VPN / blocked third-party image host.

---

## Launch page

Primary file: [`apps/web/src/components/launch/launch-live.tsx`](apps/web/src/components/launch/launch-live.tsx)

### 9. Copy / IA — three launch tracks

Replace Self-Rove / Scout jargon as primary UI labels with clearer tracks. Keep Self-Rove / Scout only in docs / glossary if needed.

| Track | UI title | Supporting line |
| ----- | -------- | --------------- |
| Own profile | **Tokenize your X profile** (or “Generate your creator coin”) | Launch a market for your verified X account |
| Scout | **Tokenize another creator** | Launch their profile market and earn a % of their fees |
| Meme | **Launch a meme token** | Normal launch — not tied to a creator / X profile |

Section body copy must match the selected track.

**Done when:** launch UI presents three clear tracks with matching copy; Self-Rove / Scout are not the primary labels.

### 10. Scout does not require connected X

- **Tokenize another creator:** wallet required; X search / resolve of the *target* is enough. Do **not** force the launcher through `/onboarding` or a linked X account.
- **Tokenize your X profile:** still requires linked / verified X (unchanged).
- **Meme:** wallet only; no X.

Today both profile modes gate on launcher X identity in `launch-live.tsx` (roughly the identity checks before submit). Remove that gate for Scout and Meme.

**Done when:** a user with wallet only (no X linked) can complete a Scout launch end-to-end.

### 11. Meme / normal token launches (in scope)

New launch path: name, symbol, image, pair, optional socials / description — **no X handle / attestation**.

Requires product + engineering design against current contracts (registry today is handle / `x_user_id`-centric). Deliver:

- Contract / API support for a non-profile launch type **or** an approved Pons path without Rovo profile registry — document the chosen approach in the PR.
- Indexer / API list fields so the homepage can separate **Creators** vs **Memes**.
- UI wizard for the meme track.

**Done when:** a wallet-only user can launch a meme token; it appears in the meme homepage section; the token page uses the normal (non–X profile) layout (§14).

### 12. No creator “fees → X Money” launch control

Out of scope (locked decision). Do not add this field.

---

## Profile page

Primary file: [`apps/web/src/components/profile/profile-live.tsx`](apps/web/src/components/profile/profile-live.tsx)

### 13. Creator / X-linked profile presentation

When the user has (or is viewing) a **creator / profile token**, the page should feel like an **X profile**: **banner**, **avatar**, **bio**, handle, and a clear link-out to X.

Persist / fetch bio + banner (X API on verify / sync; extend profile / launch projection as needed — today the schema mostly has `imageUrl`, not banner / bio).

**Meme-only** users / tokens: keep a simpler non-X layout.

**Done when:** a Self-Rove creator’s profile shows banner + bio + avatar in an X-like header.

---

## Token page

Primary files: [`apps/web/src/components/token/token-page.tsx`](apps/web/src/components/token/token-page.tsx), [`apps/web/src/components/token/use-token-page-data.ts`](apps/web/src/components/token/use-token-page-data.ts)

### 14. Creator tokens look like X profiles

For profile / creator tokens:

- Show **banner**, **bio / description**, and socials **Web / Tg / X** (visible, not missing).
- “Profile connection” (linked X / scout attribution) must be obvious above the fold.
- Description must render when present in metadata / API (wire from launch metadata / X bio — today the token page shows name / handle / image but not bio or a social row).

For **meme tokens:** standard token header (image, name, symbol, CA, optional socials) without forcing empty X chrome.

**Done when:** opening a creator token shows an X-like identity block with description + Web / Tg / X when set; meme tokens do not look broken or empty of required creator chrome.

---

## Explicit non-goals this round

- Creator-selectable X Money fee destination at launch.
- Enabling or promising full on-chain split payouts while the audit treasury route is active (copy must stay honest).
- Reworking admin harvest tooling beyond making the X Money route **visible** to users.

---

## Suggested implementation order

1. Footer pages + header `$ROVO` CA + theme toggle (quick UX wins)
2. Homepage column / filter fixes + pair icon hosting
3. Launch copy + Scout-without-X gate removal
4. Token + profile X-like identity (API fields for bio / banner / socials)
5. X Money clarity copy on Rewards / Profile
6. Meme launch track (largest: contracts / API / indexer + UI + homepage section)

---

## Open input product still owes engineering

- Live `$ROVO` token address for the header (or confirm “TBA” until TGE).
- Canonical How it works / Terms copy (or approval to draft from existing docs).
- Confirmation of meme launch economics (same fee split? no Rover / Nottingham? same pair catalogue as profile?).
