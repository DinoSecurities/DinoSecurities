<p align="center">
  <img src="public/favicon.png" alt="DinoSecurities" width="80" height="80" />
</p>

<h1 align="center">DinoSecurities</h1>

<p align="center">
  <strong>Open-source Solana infrastructure for compliance-aware token transfers — Token-2022 transfer hooks, whitelist-gated ATAs, atomic DvP, on-chain governance.</strong>
</p>

<p align="center">
  <a href="https://www.dinosecurities.com">Live Demo</a> &middot;
  <a href="https://x.com/SecuritiesDino">Twitter</a> &middot;
  <a href="#getting-started">Getting Started</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solana-mainnet--beta-9945FF?style=flat-square&logo=solana&logoColor=white" alt="Solana mainnet-beta" />
  <img src="https://img.shields.io/badge/Token--2022-live-14F195?style=flat-square&logo=solana&logoColor=white" alt="Token-2022 live" />
  <img src="https://img.shields.io/badge/Anchor-0.32.1-8b5cf6?style=flat-square" alt="Anchor 0.32.1" />
  <img src="https://img.shields.io/badge/USDC-accepted-2775CA?style=flat-square&logo=usdc&logoColor=white" alt="USDC accepted" />
  <img src="https://img.shields.io/badge/wXRP-accepted-23292F?style=flat-square&logo=xrp&logoColor=white" alt="wXRP accepted" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0" />
  <img src="https://img.shields.io/badge/release-v1.0.0--rc.1-6b7280?style=flat-square" alt="v1.0.0-rc.1" />
</p>

---

## Overview

DinoSecurities is an **open-source protocol** for building compliance-aware token workflows on Solana. It gives developers and DAOs a set of composable on-chain programs + reference UI for:

- Minting **Token-2022** tokens whose every transfer is gated by an on-chain Transfer Hook
- Maintaining per-token allowlists (`HolderRecord` PDAs) that gate which wallets can receive transfers
- Swapping those tokens for payment tokens atomically (**DvP**) without a trusted escrow
- Per-mint DAO governance (`Realm` / `Proposal` / `Vote` accounts) with token-weighted voting

The transfer hook's validation logic — KYC recency, accreditation flag, freeze status, jurisdiction — is **general-purpose**. Whether you use the hook to enforce a private allowlist, a compliance regime, a membership DAO, or something else entirely is up to the deployer. The protocol doesn't care.

**The protocol is infrastructure. It is not itself a securities issuance platform, broker-dealer, ATS, or transfer agent.** If you are using it to tokenize regulated financial instruments, consult securities counsel in the relevant jurisdiction(s). The reference UI includes inputs (legal doc hash, jurisdiction, restriction code) that *can* support that use case — they are not a claim that any particular issuance is compliant with any particular law.

## Key Features

- **Solana Wallet Authentication** — Phantom & Solflare, no passwords
- **Token-2022 with extensions** — Transfer Hook + Metadata Pointer + Permanent Delegate pre-wired
- **Atomic DvP Settlement** — Payment + asset legs in a single transaction (<1s, <$0.01)
- **Transfer Hook enforcement** — Configurable per-mint allowlist, accreditation flag, freeze, jurisdiction
- **Per-mint DAO governance** — Realm + token-weighted voting + proposal timelock
- **Optional KYC pipeline** — Didit (or any provider via the `KYCProvider` interface) with on-chain `HolderRecord` PDAs
- **Issuer Portal** — Reference UI wizard for deploying a new series end-to-end
- **Permanent document storage** — SHA-256-pinned uploads to Arweave via Irys
- **Real-Time Indexing** — Helius webhooks capture on-chain events into PostgreSQL
- **Click-to-Verify Stats** — every performance number on the landing page links to the actual mainnet settlement tx that proves it. No marketing fluff, only on-chain truth.
- **Client-Side Ricardian Verification** — on every SecurityDetail page the browser fetches the Arweave-stored governing document, SHA-256-hashes it locally, and compares to the on-chain `doc_hash`. Any investor can prove the legal document hasn't been substituted — no trust in the platform required.
- **Pre-Trade Compliance Simulator** — a public page at `/compliance` that runs the exact Transfer Hook validation sequence off-chain, read-only, against any (wallet, mint) pair. Anyone can paste an address and see whether a transfer would succeed or revert, with a step-by-step pass/fail table. Reproducible from public on-chain state alone.
- **Trade-Confirmation PDF Receipts** — every settled atomic DvP generates a formal trade-confirmation document, rendered on demand at `/receipts/:signature.pdf`. Includes both counterparties, mint, quantity, unit price, consideration, settlement date, finality, fee, and a QR code linking back to the Solana Explorer tx. Downloadable from Portfolio → Activity.
- **Embeddable Issuer Widget** — issuers paste a single `<iframe>` on their corporate website to display live series stats + an Invest CTA to their holders. Themeable (light / dark / custom accent), responsive, safe to embed on any origin. Snippet generator at `/embed`, widget itself at `/embed/:symbol`.
- **Sanctions List Screening** — every `register_holder` co-sign request is screened against OFAC SDN, EU Consolidated, and UK HMT sanctions lists before the KYC oracle signs. Matches block the co-sign unless an authorized admin files an override with justification — logged immutably in an auditor-readable audit log at `/app/issue/overrides`.
- **Bulk Whitelist Import** — issuers migrating from Carta or legacy systems upload a CSV of existing investors at `/app/issue/bulk-whitelist/:mint`. We validate every row, let the wallet sign all transactions in a single Phantom popup via `signAllTransactions`, then oracle-cosign + submit in chunks through the same sanctions-screened path single-row registration uses. 500-investor onboarding goes from days to minutes.
- **Issuer Webhook API** — issuers register an HTTPS endpoint per series at `/app/issue/webhooks/:mint` and subscribe to `HolderRegistered`, `SettlementExecuted`, and related indexed events. Outbound POSTs are signed with `X-DinoSecurities-Signature: sha256=HMAC(timestamp.body, secret)` (Stripe-style), retried on 4xx/5xx with exponential backoff (1m → 2h), and visible per-attempt in the portal. Issuer backends — CRMs, accounting systems — reflect platform state in near-real-time without polling.
- **XRPL Credentials holder onboarding (XLS-70d)** — holders with an on-ledger KYC credential from a trusted XRPL issuer can self-serve-qualify for a series at `/app/whitelist/xrpl/:mint`. The flow proves the binding between Solana and XRPL identities with a challenge-signed nonce (ed25519 and secp256k1 both verified server-side, with the classic-address derivation cross-checked against the submitted public key), queries XRPL for a currently-accepted unexpired credential from a trusted issuer, and files a pending whitelist request visible to the issuer on their portal. Issuer one-click approves; backend re-verifies against live XRPL state and co-signs `register_holder` with `kyc_source = 'xrpl_credential'`. Trusted-issuer allow-list admin UI at `/app/issue/xrpl-credentials`.
- **Holder Concentration Metrics** — every SecurityDetail page now carries a live concentration card: Herfindahl-Hirschman Index (HHI) with a qualitative label (competitive / moderate / highly concentrated), top-5 / top-10 / top-25 supply shares, Gini coefficient, and a top-25 + Others stacked distribution chart. All computed client-side from a direct Token-2022 `getProgramAccounts` scan so the numbers track the cap table without indexing lag. Thin-series caveat surfaces under 10 holders to keep the headline number honest.
- **Supply Reconciliation Dashboard** — admin-only canary at `/app/admin/reconciliation`. For every series on chain it asserts `SecuritySeries.current_supply == Σ(every Token-2022 account balance for that mint)`, breaking the right side out into the issuer float (seriesPda's ATA) and the distributed holder float so a reader can see *where* the supply lives. A non-zero delta — token leak, indexer drift, program bug — surfaces in seconds with a red row before anyone external notices. Auto-refreshes every 60s.
- **Public REST API + OpenAPI** — unauthed read-only gateway at `/api/v1/` (docs at [`/api/v1/docs`](https://api.dinosecurities.com/api/v1/docs), spec at `/api/v1/openapi.json`). Endpoints: `GET /series` (paginated, filterable), `GET /series/:mint`, `GET /series/:mint/holders/stats`, `GET /settlements/recent`, `GET /compliance/simulate?wallet=&mint=`. CORS-open (`*`), rate-limited to 60 req/min/IP, cached `public, max-age=60, s-maxage=300`. Built for Dune / Flipside / DeFiLlama / portfolio-tracker / CRM integrations — the easier our data is to consume, the more the ecosystem integrates us.
- **`@dinosecurities/sdk` TypeScript package** — first-class SDK at [`packages/sdk/`](packages/sdk/). PDA derivation helpers (`derivePdas`, `deriveHolderPda`, `deriveSeriesPda`, etc.), instruction builders (`buildRegisterHolderIx`, `makeDinoCoreProgram`), a typed tRPC client factory (`createDinoClient<AppRouter>()`), the `/api/v1/compliance/simulate` REST helper, and all three Anchor IDLs bundled as snapshots. Dual ESM + CJS + `.d.ts` via tsup, Anchor and `@solana/web3.js` as peer deps to keep the install small, tree-shakeable subpath imports (`/pdas`, `/compliance`, `/idl`). Three working example scripts under [`packages/sdk/examples/`](packages/sdk/examples/). Not yet on npm — publish ships with the first external integration partner.
- **$DINO tier discount on platform fees** — the DinoSecurities community token (`6BUv6SWDDtyvzbYaUisPubfGpYxibr5hdbqcpv3Ypump`, classic SPL / pump.fun) unlocks a four-tier discount schedule on paid platform services: Base / Bronze (100K) / Silver (1M) / Gold (5M) at 0 / 10 / 20 / 30% off. Live balance read + tier resolution on both client and server, so UX shows the right tier and discount calculations can't be spoofed. Badge on the Dashboard, dedicated page at [/app/dino](/app/dino) with full tier schedule and an honest "live vs planned" map of every fee surface the discount applies to. $DINO is explicitly **not** a security — no equity, no profit share, no governance over the regulated securities infrastructure.
- **$DINO-gated REST API rate limits** — first live fee-surface of the $DINO tier. Anonymous `/api/v1/*` traffic caps at 60 req/min/IP; holders generate an API key at [/app/dino](/app/dino), attach as `Authorization: Bearer dino_live_…`, and requests run under their tier's limit — Bronze 300, Silver 1200, Gold 3000 req/min. Tier resolves live from the key owner's balance at request time (5-minute cache), so a holder who accumulates more $DINO gets the higher limit automatically without rotating keys. Keys are sha256-hashed at rest; plaintext shown exactly once on creation. OpenAPI spec documents the `DinoKey` security scheme.
- **$DINO community handles** — Bronze-tier holders claim a handle (3–24 chars, letters / numbers / underscore) at [/app/dino](/app/dino) that replaces their truncated wallet address everywhere the platform surfaces a wallet: holder lists, settlement participants, series community badges. Server-side tier check at claim time means a client can't fake ownership of $DINO to squat a handle. One wallet, one handle; release any time. `HolderName` is a drop-in component for `truncateAddress` — batched `useHandlesFor` keeps the N+1 query story honest when rendering long lists.

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | Component-based UI |
| TypeScript | Type safety |
| Vite 5 | Build tooling & HMR |
| Tailwind CSS | Utility-first styling |
| shadcn/ui + Radix | Accessible component primitives |
| TanStack Query | Server/blockchain state management |
| Recharts | Portfolio & governance charts |
| Solana Wallet Adapter | Phantom, Solflare connection |
| @coral-xyz/anchor | Anchor program client |
| @solana/spl-token | Token-2022 operations |

### Backend
| Technology | Purpose |
|---|---|
| Express 5 | HTTP server |
| tRPC 11 | End-to-end type-safe API |
| Drizzle ORM | Type-safe database queries |
| PostgreSQL | Off-chain indexing & state |
| tweetnacl | Wallet signature verification |
| Zod | Runtime validation |

### Blockchain
| Component | Details |
|---|---|
| Solana | Mainnet-Beta / Devnet |
| Token-2022 | Security token standard with extensions |
| Anchor | Smart contract framework (Rust) |
| SPL Governance | DAO voting (Realms) |
| Arweave / Irys | Permanent legal document storage |
| IPFS / Pinata | Token metadata storage |

## Project Structure

```
dinosecurities/
├── src/                          # Frontend (React)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (48 components)
│   │   ├── dashboard/            # App layout, sidebar, header
│   │   ├── wallet/               # WalletButton, WalletModal, WalletStatus
│   │   └── veliq/                # Landing page sections (17 components)
│   ├── hooks/                    # React hooks
│   │   ├── useDinoCore.ts        # Anchor program interactions
│   │   ├── useSecuritySeries.ts  # Security series data
│   │   ├── useHolderRecord.ts    # KYC & holder status
│   │   ├── useTokenBalance.ts    # Token-2022 balances
│   │   ├── useSettlement.ts      # DvP settlement engine
│   │   ├── useGovernance.ts      # DAO proposals & voting
│   │   └── useUserRole.ts        # On-chain role detection
│   ├── lib/
│   │   ├── anchor.ts             # Anchor provider & IDL
│   │   ├── solana.ts             # PDA derivation, program IDs
│   │   ├── token2022.ts          # Token-2022 helpers
│   │   ├── settlement.ts         # Settlement engine class
│   │   ├── trpc.ts               # tRPC client
│   │   └── constants.ts          # Enums & config
│   ├── pages/
│   │   ├── Index.tsx             # Landing page
│   │   └── app/                  # Authenticated pages
│   │       ├── Dashboard.tsx     # Portfolio overview
│   │       ├── Portfolio.tsx     # Holdings & performance
│   │       ├── Marketplace.tsx   # Browse securities
│   │       ├── SecurityDetail.tsx# Individual security page
│   │       ├── Governance.tsx    # DAO proposals & voting
│   │       ├── Settlement.tsx    # DvP order management
│   │       ├── IssuerPortal.tsx  # Issuer management panel
│   │       ├── CreateSeries.tsx  # 5-step series creation wizard
│   │       └── Settings.tsx      # KYC & preferences
│   ├── providers/
│   │   ├── SolanaProvider.tsx    # Wallet & connection context
│   │   └── QueryProvider.tsx     # TanStack Query client
│   └── types/                    # Shared TypeScript types
│       ├── security.ts
│       ├── holder.ts
│       └── governance.ts
│
├── server/                       # Backend (tRPC + Express)
│   └── src/
│       ├── index.ts              # Express entry point
│       ├── trpc.ts               # tRPC initialization
│       ├── context.ts            # Request context
│       ├── env.ts                # Zod-validated config
│       ├── db/
│       │   ├── schema.ts         # Drizzle schema (6 tables)
│       │   ├── index.ts          # Database client
│       │   └── migrate.ts        # Migration runner
│       ├── middleware/
│       │   └── wallet-auth.ts    # Signature verification
│       ├── routers/              # tRPC API routers
│       │   ├── securities.ts     # list, search, getByMint
│       │   ├── holders.ts        # holder registry & stats
│       │   ├── settlements.ts    # DvP order management
│       │   ├── kyc.ts            # KYC session management
│       │   ├── governance.ts     # Proposal indexing
│       │   ├── documents.ts      # Arweave doc management
│       │   └── analytics.ts      # Platform metrics
│       ├── webhooks/
│       │   ├── helius.ts         # Helius webhook handler
│       │   └── handlers.ts       # Event processors
│       └── services/
│           ├── solana-rpc.ts     # RPC with fallback
│           ├── kyc-oracle.ts     # KYC provider integration
│           ├── arweave.ts        # Irys document upload
│           ├── ipfs.ts           # Pinata metadata upload
│           └── settlement-agent.ts # Atomic DvP execution
│
└── public/                       # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- PostgreSQL (for backend)
- Solana CLI (optional, for program deployment)

### Frontend

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend runs at `http://localhost:8080`.

### Backend

```bash
# Navigate to server
cd server

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your values

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The API runs at `http://localhost:3001`.

## Environment Variables

### Frontend (`/.env`)

```env
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=YOUR_RPC_URL
VITE_DINO_CORE_PROGRAM_ID=YOUR_PROGRAM_ID
VITE_DINO_HOOK_PROGRAM_ID=YOUR_PROGRAM_ID
VITE_DINO_GOV_PROGRAM_ID=YOUR_PROGRAM_ID
VITE_USDC_MINT=YOUR_USDC_MINT
VITE_API_URL=http://localhost:3001/trpc
```

### Backend (`/server/.env`)

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/dinosecurities
SOLANA_RPC_URL=YOUR_RPC_URL
DINO_CORE_PROGRAM_ID=YOUR_PROGRAM_ID
DINO_HOOK_PROGRAM_ID=YOUR_PROGRAM_ID
DINO_GOV_PROGRAM_ID=YOUR_PROGRAM_ID
HELIUS_API_KEY=YOUR_HELIUS_KEY
WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
KYC_PROVIDER_API_KEY=YOUR_KYC_KEY
SETTLEMENT_AGENT_KEY=YOUR_AGENT_KEYPAIR
IRYS_WALLET_KEY=YOUR_IRYS_KEY
PINATA_API_KEY=YOUR_PINATA_KEY
PINATA_SECRET_KEY=YOUR_PINATA_SECRET
CORS_ORIGIN=http://localhost:8080
```

## API Overview

The backend exposes a type-safe tRPC API with the following routers:

| Router | Endpoints | Auth |
|---|---|---|
| `securities` | list, getByMint, getByIssuer, search | Public |
| `holders` | getForSeries, getForWallet, stats | Mixed |
| `settlements` | createOrder, getOrders, getOrderBook, cancelOrder | Protected |
| `kyc` | initSession, getStatus | Protected |
| `governance` | getProposals, getVotes, realmStats | Public |
| `documents` | upload, verify, getHistory | Mixed |
| `analytics` | platformStats, seriesStats, volumeHistory, portfolioHistory | Mixed |

**Webhook Endpoints:**
- `POST /webhooks/helius` — Helius enhanced transaction events
- `POST /webhooks/kyc` — KYC provider verification results
- `GET /health` — Health check

## On-Chain Architecture

### Solana Programs

| Program | Purpose |
|---|---|
| `dino_core` | Security series creation, holder registry, settlement orders |
| `dino_transfer_hook` | Compliance validation on every token transfer |
| `dino_governance` | DAO proposal creation, voting, execution |

### Token-2022 Extensions

| Extension | Purpose |
|---|---|
| Transfer Hook | KYC/whitelist enforcement on every transfer |
| Default Account State (Frozen) | New accounts must be explicitly whitelisted |
| Metadata Pointer | Legal doc hash, ISIN, security type stored in mint |
| Permanent Delegate | Regulatory clawback capability |

### PDA Accounts

| Account | Seeds | Purpose |
|---|---|---|
| IssuerProfile | `["issuer", issuer_pubkey]` | Issuer identity & KYC |
| SecuritySeries | `["series", issuer_pubkey, series_id]` | Security metadata & supply |
| HolderRecord | `["holder", mint, holder_pubkey]` | KYC status & accreditation |
| SettlementOrder | `["order", order_id]` | DvP order state |
| GovernanceConfig | `["governance", series_mint]` | Voting parameters |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

---

> ⚠️ **Protocol is experimental beta software. Use at your own risk. Not investment advice. See [TERMS.md](TERMS.md).** Operators do not act as broker-dealer, ATS, transfer agent, or offering facilitator. Users are solely responsible for ensuring their own use of the protocol complies with applicable law in their jurisdiction.

---

<p align="center">
  Built on Solana &middot; Powered by Token-2022
</p>
