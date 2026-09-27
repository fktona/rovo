# Rovo Vision Brief

**Product:** Rovo  
**Domain:** [rovo.fun](https://rovo.fun)  
**Platform token:** `$ROVO`  
**Network:** Robinhood Chain (Arbitrum Orbit L2, Chain ID `4663`)  
**Document version:** 1.0.0  
**Audience:** Engineering, Design, GTM — read this first, then the role PRDs.

---

## 1. One-liner

**Rovo turns social capital into markets quoted in Stock Tokens on Robinhood Chain. Admins choose whether each claimable fee batch follows the normal creator/holder split or goes in full to a treasury for manual use.**

---

## 2. Why this product exists

Robinhood Chain is being built as the home for tokenized equities and onchain finance. The first wave of apps will either clone meme launchpads or bolt “custom pairs” onto social products designed for attention coins.

[Zora](https://docs.zora.co/coins) already proved the social trading loop (profile → coin → trade → share) and can pair against stock tokens. That is not a moat.

Rovo’s wedge is different:

|                 | Zora-like social coins     | Rovo                                                                                                 |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Default backing | `$ZORA` / attention        | **Robinhood Stock Tokens** (e.g. TSLA, NVDA, SPY)                                                    |
| Who gets paid   | Creators in protocol token | Creators **and holders** in Stock Tokens                                                             |
| Viral loop      | Post / content coins       | **Scout & Claim** — launch any `@handle`, vault accumulates Stock Tokens until the real owner claims |
| Network token   | Culture / attention        | **`$ROVO`** buyback flywheel from real trading volume                                                |

We are not “Zora on Robinhood.” We are the **Social-RWA launchpad**: permissionless profile markets whose quote asset is real-world equity exposure.

---

## 3. Product rails (MVP)

### Track A — Self-Rove

A verified X account owner connects wallet + X OAuth, picks a Stock Token pair, and launches their profile token via **Pons Protocol V2**. They earn the creator fee bucket directly (and can share part of it with holders).

### Track B — Scout & Claim

Any user (“Rover”) can launch an unclaimed public X handle. Trading fees accrue:

- **Rover bounty** — paid immediately to the scout
- **Nottingham Vault** — locked for the real X owner until they claim
- **Holders** — base share of fees in the paired Stock Token
- **Platform** — buys `$ROVO`

When the vault is large enough, the community tags the creator. Claiming liberates the Stock Tokens and hands them control of future creator fees.

### What we do _not_ build

- Custom bonding curves (use [Pons V2](https://docs.ponsfamily.com/v2))
- “Black Hole” / Depth Lock / guaranteed price floors
- X engagement mining / InfoFi reward-for-posting as a core dependency

---

## 4. Economic flywheel

The split below applies **only when the admin selects the normal split route**. The admin may instead direct the entire Rovo-controlled creator allocation plus creator tax from a launch's next claim to the configured treasury wallet for manual use (for example, off-app creator payments or funding another activity). That treasury route does not fund creator, Rover, holder, Nottingham, or buyback buckets on-chain. The choice and amount must be visible in product reporting; no recipient should be promised an unconditional on-chain share of every fee claim.

```
User trades profile token (paired in Stock Tokens)
        │
        ▼
Pons takes its protocol fee share
        │
        ▼
Rovo creator-share → Fee Splitter
        │
        ├── 10%  → buy $ROVO → 50% burn / 50% treasury
        ├── 60–70% → Creator wallet or Nottingham Vault
        ├── 0–15% → Rover (Scout launches only)
        └── 15–20% → Holders of that profile token
```

**Thesis:** More social trading → more Stock Token fee flow → more `$ROVO` buy pressure + burns → `$ROVO` reflects platform volume; holders of profile tokens earn equity-linked rewards; creators get a reason to claim and own their market.

---

## 5. Glossary

| Term                   | Meaning                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Rove**               | To launch or trade a profile market on Rovo                                                                         |
| **Self-Rove**          | Verified creator launches their own handle                                                                          |
| **Scout / Rover**      | User who launches an unclaimed handle                                                                               |
| **Nottingham Vault**   | Escrow holding the creator fee bucket for unclaimed profiles                                                        |
| **Holder Rewards**     | Stock Token fees paid to holders of a specific profile token (weekly Merkle epochs)                                 |
| **Share with Holders** | Creator toggle to redirect part of _their_ fee bucket to holders                                                    |
| **Sunset**             | After 60 days unclaimed, new creator-bucket fees split 50% holders / 50% `$ROVO` buyback                            |
| **Stock Token**        | Robinhood tokenized equity/ETF exposure onchain — **not** legal share ownership                                     |
| **`$ROVO`**            | Rovo platform token; bought by the platform fee sink                                                                |
| **Radar**              | Discovery feed of live profile markets                                                                              |
| **User profile**       | A Rovo participant’s hub (wallet ± linked X): holdings, scouts, markets, earnings — not the same as a profile token |
| **Profile token**      | The tradable market for an `@handle` at `/t/:handle`                                                                |
| **Zap**                | One-tx path: USDC/ETH → Stock Token → buy profile token                                                             |

---

## 6. Compliance posture (non-negotiable copy)

- Stock Tokens provide **economic exposure**, not ownership or voting rights in the underlying company. See [Robinhood Stock Tokens](https://robinhood.com/rhj/stocktokens/).
- Availability is **geo-restricted** (not for US persons and other restricted jurisdictions). The app must gate and disclaimer; contracts on a permissionless L2 cannot enforce KYC alone.
- Never market “owning Apple,” “guaranteed floors,” or “risk-free RWA yield.”
- Product and counsel should review all GTM before mainnet.

---

## 7. MVP vs Phase 2

### MVP (ship)

- Self-Rove + Scout & Claim
- Pons V2 launches quoted in approved Stock Tokens
- Fee splitter, Nottingham, Rover payouts, holder Merkle epochs
- Creator share-with-holders toggle
- 60-day unclaimed sunset (50/50 holders / `$ROVO`)
- Zap router, Radar, claim portal, **user profile (`/me`, `/u/:address`)** with creator controls
- `$ROVO` buyback executor (burn + treasury split)
- X OAuth for verify / claim only (not engagement scoring)

### Phase 2

- Continuous stake-to-earn holder rewards
- `$ROVO` staking / governance
- Multi-social identity (Farcaster, etc.)
- Automated X mention bot (ops-dependent; share cards are MVP)
- Custom holder reward schedules per creator

### Non-goals

- Replacing Pons or Uniswap
- Content/post coins (profile markets only for MVP)
- Custodial brokerage or offchain equity custody

---

## 8. Success signals (first 90 days)

1. Organic Scout launches of recognizable handles with growing Nottingham balances
2. At least one high-profile **claim** that regenerates as a Self-Rove narrative
3. Holder reward claims > vanity metric (people return weekly)
4. Measurable `$ROVO` buyback volume correlated with platform fees
5. Clear differentiation in market: “the stock-backed social launchpad on Robinhood Chain”

---

## 9. Document map

| Doc                                        | Owner            |
| ------------------------------------------ | ---------------- |
| [VISION.md](./VISION.md)                   | Product (shared) |
| [PRD-ENGINEERING.md](./PRD-ENGINEERING.md) | Engineering      |
| [PRD-DESIGN.md](./PRD-DESIGN.md)           | Design           |

---

## 10. References

- [Zora Coins Protocol](https://docs.zora.co/coins)
- [Pons Protocol V2](https://docs.ponsfamily.com/v2)
- [Robinhood Chain](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet/)
- [Robinhood Stock Tokens](https://robinhood.com/rhj/stocktokens/)
