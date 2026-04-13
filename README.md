<p align="center">
  <img src="public/favicon.png" alt="DinoSecurities" width="80" height="80" />
</p>

<h1 align="center">DinoSecurities</h1>

<p align="center">
  <strong>Solana-native tokenized securities platform with on-chain compliance, atomic settlement, and DAO governance.</strong>
</p>

<p align="center">
  <a href="https://dinosecurities.vercel.app">Live Demo</a> &middot;
  <a href="https://x.com/SecuritiesDino">Twitter</a> &middot;
  <a href="#getting-started">Getting Started</a>
</p>

---

## Overview

DinoSecurities is a full-stack platform for issuing, managing, trading, and governing legally enforceable security tokens on the Solana blockchain. Every token is cryptographically linked to its governing legal document via SHA-256 hash (Ricardian Contract principle), with compliance logic enforced at the token level through Token-2022 transfer hooks.

The platform supports real equity, debt, fund interests, and LLC memberships — not just NFTs or utility tokens — with regulatory transfer restrictions (Reg D, Reg S, Reg CF, Reg A+) enforced on every transfer.

## Key Features

- **Solana Wallet Authentication** — Phantom & Solflare integration, no traditional accounts
- **Token-2022 Securities** — Mint with Transfer Hook, Default Frozen, Metadata Pointer, and Permanent Delegate extensions
- **Atomic DvP Settlement** — Delivery vs Payment in a single Solana transaction (<1s, <$0.01)
- **On-Chain Compliance** — Transfer hook validates KYC, accreditation, freeze status, and regulation rules on every transfer
- **DAO Governance** — Token-weighted voting per security series via SPL Governance (Realms)
- **KYC/AML Integration** — Off-chain KYC oracle with on-chain HolderRecord PDAs
- **Issuer Portal** — Multi-step wizard to create security series with legal document upload
- **Arweave Storage** — Permanent legal document storage with SHA-256 hash verification
- **IPFS Metadata** — Token metadata pinned via Pinata
- **Real-Time Indexing** — Helius webhooks capture on-chain events into PostgreSQL

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

All rights reserved. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built on Solana &middot; Powered by Token-2022
</p>
