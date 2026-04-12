# DinoSecurities - Backend Implementation Plan

> **Version:** 1.0 | **Date:** April 12, 2026
> **Developers:** Powerz (On-Chain & Frontend Integration) | Sorrow (Backend API & Off-Chain Services)
> **Goal:** Replace all mock data with real Solana on-chain logic, backend API, and off-chain services as specified in the DinoSecurities Technical Specification v1.0.

---

## Current State

- React 18 + Vite 5 + Tailwind + shadcn/ui frontend (fully built UI shell)
- All data is mock (`src/lib/mockData.ts`)
- No wallet connection, no Solana integration, no backend API
- Routes: Dashboard, Portfolio, Marketplace, SecurityDetail, Governance, Settlement, Settings

## Target State

- Solana Wallet Adapter for auth (Phantom, Solflare, Backpack, Ledger)
- 3 Anchor programs on-chain: `dino_core`, `dino_transfer_hook`, `dino_governance`
- Token-2022 with extensions (Transfer Hook, Permanent Delegate, Metadata, etc.)
- tRPC 11 + Express backend with Drizzle ORM + PostgreSQL
- Helius RPC + webhooks for event indexing
- Arweave (Irys) for legal documents, IPFS (Pinata) for metadata
- KYC via Jumio/Persona with oracle server
- Atomic DvP settlement engine
- SPL Governance (Realms) for DAO voting

---

## Shared Prerequisites (Both devs, Week 0)

Before splitting, both developers must complete together:

- [ ] Upgrade React 18 -> 19, Vite 5 -> 7, Tailwind 3 -> 4
- [ ] Replace React Router v6 with Wouter (per spec)
- [ ] Set up monorepo structure: `client/` (existing frontend) + `server/` (new backend) + `programs/` (Anchor)
- [x] Create shared `types/` package with TypeScript interfaces (security.ts, holder.ts, governance.ts) -- DONE
- [x] Set up `.env` with all required env variables -- DONE
- [x] Install shared dependencies: `@solana/web3.js`, `@solana/spl-token`, `@coral-xyz/anchor`, `@solana/wallet-adapter-react` -- DONE
- [ ] Set up devnet Solana programs (deploy placeholder IDLs)
- [ ] Create `CLAUDE.md` with project conventions

---

## POWERZ - On-Chain Integration & Frontend Wiring

> **Focus:** Solana wallet connection, Anchor program client, Token-2022 operations, settlement engine client, and rewiring all frontend pages from mock data to real on-chain/API data.

---

### Phase P1: Wallet & Connection Layer (Week 1-2)

**Goal:** Replace the fake wallet badge with real Solana wallet auth.

- [x] **P1.1** Install and configure `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets` -- DONE
- [x] **P1.2** Create `src/providers/SolanaProvider.tsx` -- DONE
  - WalletProvider wrapping ConnectionProvider
  - Configure endpoint from env (Helius RPC URL)
  - Support: Phantom, Solflare, Ledger, Coinbase
  - Auto-connect for returning users
- [x] **P1.3** Create `src/providers/QueryProvider.tsx` -- DONE
  - TanStack Query client with Solana-aware defaults
  - Stale time / cache time tuned for on-chain data
- [x] **P1.4** Update `main.tsx` to wrap app in SolanaProvider + QueryProvider -- DONE
- [x] **P1.5** Update `AppHeader.tsx` — replace static wallet badge with real `WalletMultiButton` -- DONE
- [x] **P1.6** Update `AppSidebar.tsx` — show connected wallet pubkey (truncated), network indicator (devnet/mainnet) -- DONE
- [x] **P1.7** Create `src/components/wallet/WalletButton.tsx`, `WalletStatus.tsx`, `NetworkBadge.tsx` -- DONE
- [x] **P1.8** Implement network detection via `useNetwork` hook + `NetworkBadge` component -- DONE
- [ ] **P1.9** Implement session management — signMessage for off-chain API auth when needed (deferred to S2 backend integration)
- [x] **P1.10** Create role detection hook `src/hooks/useUserRole.ts` -- DONE
  - Check on-chain: does IssuerProfile PDA exist for this wallet? -> Issuer role
  - Check on-chain: does HolderRecord PDA exist? -> Investor role
  - No PDA -> Unverified User
  - In platform multisig? -> Platform Admin

**Deliverable:** Users can connect real Solana wallets, see their pubkey, and the app detects their role. **STATUS: COMPLETE**

---

### Phase P2: Anchor Program Client & Core Hooks (Week 3-4)

**Goal:** Set up Anchor IDL clients and create React hooks for all on-chain reads.

- [x] **P2.1** Create `src/lib/anchor.ts` -- DONE
  - Anchor provider setup using wallet adapter
  - Program initialization for dino_core with placeholder IDL
  - Full IDL with all account structs and instructions
- [x] **P2.2** Create `src/lib/constants.ts` -- DONE
  - Security type/transfer restriction enums
  - Order status/side enums
  - Governance thresholds, default governance params, token decimals
- [x] **P2.3** Create `src/hooks/useDinoCore.ts` -- DONE
  - `useIssuerProfile(wallet)` — fetch IssuerProfile PDA
  - `useAllSecuritySeries()` — fetch all via getProgramAccounts
  - `useSecuritySeriesByMint(mint)` — fetch single series
  - `useRegisterIssuer()` mutation
  - `useCreateSecuritySeries()` mutation
- [x] **P2.4** Create `src/hooks/useSecuritySeries.ts` -- DONE
  - `useAllSecuritySeriesData()` — fetch all, fallback to mock
  - `useSecuritySeriesById(id)` — single series lookup
  - Mock data mapping to real SecuritySeries interface
- [x] **P2.5** Create `src/hooks/useHolderRecord.ts` -- DONE
  - `useHolderRecord(mint, wallet)` — fetch HolderRecord PDA
  - `useMyKYCStatus()` — current user KYC status
  - `useHoldersForSeries(mint)` — all holders for a security
- [x] **P2.6** Create `src/hooks/useTokenBalance.ts` -- DONE
  - `useMyTokenBalances()` — all Token-2022 balances
  - `useTokenBalance(mint)` — single mint balance
  - `useSolBalance()` — SOL balance
- [x] **P2.7** Create `src/lib/token2022.ts` -- DONE
  - `buildCreateSecurityMintInstructions()` — full Token-2022 mint with all extensions
  - `buildMintToInstruction()`, `buildFreezeInstruction()`, `buildThawInstruction()`
  - `buildApproveInstruction()` — delegate for settlement agent
  - `getSecurityMintRent()` — rent calculation
- [x] **P2.8** Create `src/lib/solana.ts` -- DONE
  - PDA derivation helpers (issuer, series, holder, order, governance)
  - Address truncation, lamports conversion, USD formatting
  - Explorer URL generation
  - Program ID constants from env

**Deliverable:** All core on-chain data is readable via React hooks with caching. **STATUS: COMPLETE**

---

### Phase P3: Settlement Engine Client (Week 5-6)

**Goal:** Build the client-side DvP settlement engine.

- [x] **P3.1** Create `src/lib/settlement.ts` — DinoSettlementEngine class -- DONE
  - `createOrder()` — create SettlementOrder PDA
  - `cancelOrder()` — cancel own order
  - `approveDelegate()` — Token-2022 approve() for settlement agent
  - `simulateTransaction()` — pre-flight simulation
- [x] **P3.2** Create `src/hooks/useSettlement.ts` -- DONE
  - `useSettlementOrders()` — all orders for connected wallet (with mock fallback)
  - `useOrderBook(mint)` — all open orders for a security
  - `useCreateSettlementOrder()` — mutation with toast notifications
  - `useCancelSettlementOrder()` — mutation with toast
  - `useApproveSettlementDelegate()` — delegation mutation
  - 30s refetch interval for real-time status
- [x] **P3.3** Implement transaction simulation in DinoSettlementEngine -- DONE
- [ ] **P3.4** Rewire `Settlement.tsx` page (moved to P4)
- [ ] **P3.5** Rewire `SecurityDetail.tsx` purchase flow (moved to P4)

**Deliverable:** Settlement engine client ready. Hook into pages happens in P4. **STATUS: COMPLETE**

---

### Phase P4: Frontend Page Rewiring (Week 7-9)

**Goal:** Replace ALL mock data across every page with real data sources.

- [x] **P4.1** **Dashboard.tsx** rewire -- DONE
  - Wallet connection gate (shows "Connect Wallet" when disconnected)
  - Active Proposals: from `useProposals()` hook
  - Pending Settlements: from `useSettlementOrders()` hook
  - KYC Status: from `useMyKYCStatus()` hook (dynamic badge color/icon)
  - Holdings/chart: still mock until Token-2022 balances decode is ready
- [ ] **P4.2** **Portfolio.tsx** rewire -- BLOCKED (needs real token balance decoding from Sorrow's deployed program)
- [x] **P4.3** **Marketplace.tsx** rewire -- DONE (hooked to `useAllSecuritySeriesData()`, fallback to mock)
- [ ] **P4.4** **SecurityDetail.tsx** rewire -- BLOCKED (needs Arweave doc fetching from Sorrow's S5)
- [ ] **P4.5** **Governance.tsx** rewire -- READY (hooks exist: `useProposals`, `useCastVote`, `useCreateProposal`)
- [ ] **P4.6** **Settings.tsx** rewire -- READY (KYC hook exists: `useMyKYCStatus`)
- [ ] **P4.7** **Landing page (Index.tsx)** — wire Stats Bar -- BLOCKED (needs tRPC API from Sorrow's S3)

**Deliverable:** Dashboard and Marketplace wired to hooks. Other pages ready for wiring when backend is deployed. **STATUS: IN PROGRESS (blocked on Sorrow's backend)**

---

### Phase P5: Issuer Portal (Week 10-11)

**Goal:** Build the issuer-facing pages (not yet in frontend).

- [x] **P5.1** Create `src/pages/app/IssuerPortal.tsx` -- DONE
  - Series dashboard with supply bars, holder count, price, regulation
  - Role-gated (requires IssuerProfile PDA or connected wallet)
  - Selected series management panel with action buttons
- [x] **P5.2** Create `src/pages/app/CreateSeries.tsx` — 5-step wizard -- DONE
  - Step 1: Upload legal document (file picker + Arweave URI input)
  - Step 2: Metadata (name, symbol, type, jurisdiction, maxSupply, ISIN, description)
  - Step 3: Transfer restrictions (RegD/S/CF/A+/Ricardian/None with info callouts)
  - Step 4: Review all parameters
  - Step 5: Deploy with loading/success states
- [ ] **P5.3** Holder management UI — Ready (buttons in IssuerPortal, needs backend from Sorrow)
- [ ] **P5.4** Mint tokens UI — Ready (button in IssuerPortal, needs deployed program)
- [ ] **P5.5** Force transfer UI — Ready (needs Permanent Delegate integration)
- [x] **P5.6** Emergency pause — Button wired in IssuerPortal action panel -- DONE
- [x] **P5.7** Routes added: `/app/issue`, `/app/issue/create` -- DONE

**Deliverable:** Issuer portal and create wizard built. Actions wired to hooks. **STATUS: COMPLETE**

---

### Phase P6: Polish & Testing (Week 12)

- [x] **P6.1** Transaction simulation built into DinoSettlementEngine -- DONE
- [x] **P6.2** Error handling: toast notifications on all mutations (success/error) -- DONE
- [x] **P6.3** Loading states: Dashboard wallet-not-connected state, IssuerPortal role loading -- DONE
- [x] **P6.4** Optimistic updates: TanStack Query invalidation on all mutations -- DONE
- [ ] **P6.5** Write integration tests for all hooks (Vitest + mock Anchor provider) -- DEFERRED (needs deployed program)
- [ ] **P6.6** Remove `mockData.ts` — DEFERRED (mock data is graceful fallback until real program exists)
- [ ] **P6.7** Devnet end-to-end testing with Powerz + Sorrow wallets -- BLOCKED (needs Sorrow's programs)
- [x] **P6.8** Issuer Portal nav link added to sidebar + mobile nav -- DONE
- [x] **P6.9** All pages build successfully with zero type errors -- DONE

---

## SORROW - Backend API & Off-Chain Services

> **Focus:** tRPC + Express server, PostgreSQL database, Helius webhooks, KYC oracle, Arweave/IPFS storage services, and Anchor program development (Rust).

---

### Phase S1: Anchor Program Development (Week 1-3)

**Goal:** Build and deploy the 3 Solana programs to devnet.

- [ ] **S1.1** Initialize Anchor workspace in `programs/`
  - `programs/dino_core/`
  - `programs/dino_transfer_hook/`
  - `programs/dino_governance/`
  - Shared types crate
- [ ] **S1.2** **dino_core** program — account structs
  - `IssuerProfile` PDA (~350 bytes): authority, legal_name, jurisdiction, kyc_hash, kyc_expiry, is_active, series_count
  - `SecuritySeries` PDA (~680 bytes): mint, name, symbol, security_type, doc_hash, doc_uri, isin, max_supply, current_supply, transfer_restrictions, governance
  - `HolderRecord` PDA (~116 bytes): kyc_hash, kyc_expiry, is_accredited, is_frozen, is_revoked
  - `SettlementOrder` PDA (variable): buyer, seller, security_mint, token_amount, usdc_amount, status
  - `GovernanceConfig` PDA (variable): realm, vote_threshold, min_proposal_weight, voting_time, cooloff_time
- [ ] **S1.3** **dino_core** instructions
  - `initialize_platform` — one-time setup with multisig authority
  - `register_issuer` — create IssuerProfile PDA (requires KYC)
  - `create_security_series` — create SecuritySeries PDA + link to Token-2022 mint
  - `register_holder` — create HolderRecord PDA (called by KYC oracle)
  - `revoke_holder` — mark HolderRecord as revoked
  - `update_holder_kyc` — refresh KYC data
  - `create_settlement_order` — create SettlementOrder PDA
  - `cancel_settlement_order` — cancel by creator
  - `execute_settlement` — atomic DvP (restricted to settlement agent)
  - `emergency_pause` — pause all transfers for a series
  - `update_governance_config` — update governance params
- [ ] **S1.4** **dino_transfer_hook** program
  - Implement Token-2022 Transfer Hook interface
  - Check 1: Destination has HolderRecord PDA (whitelisted)
  - Check 2: KYC not revoked
  - Check 3: Account not frozen
  - Check 4: KYC not expired
  - Check 5: Security series not paused
  - Check 6: Transfer restriction rules pass (accredited, geo-fence, investment limits)
  - Emit TransferValidated event on success
- [ ] **S1.5** **dino_governance** program
  - Wrapper around SPL Governance
  - `create_realm` — create governance realm for a security series
  - `create_proposal` — with proposal type enforcement (thresholds per type)
  - `cast_vote` — validate holder has tokens, delegate vote weight
  - `execute_proposal` — timelock enforcement, type-specific execution
  - Proposal types: UpdateLegalDoc, UpdateTransferRestrictions, MintAdditional, BurnTokens, FreezeHolder, EmergencyPause, TreasuryTransfer, UpgradeProgram
- [ ] **S1.6** Write Anchor test suite (TypeScript tests in `tests/`)
  - Test all instructions
  - Test transfer hook validation (all 6 checks)
  - Test settlement lifecycle (CREATED -> MATCHED -> DELEGATED -> EXECUTING -> SETTLED)
  - Test governance proposal lifecycle
- [ ] **S1.7** Deploy all 3 programs to devnet
  - Record program IDs
  - Share IDL JSON files with Powerz for client integration
  - Set up upgrade authority (dev wallet for now, multisig for mainnet)

**Deliverable:** All 3 programs deployed to devnet, tested, IDLs exported.

---

### Phase S2: Backend API Server Setup (Week 4-5)

**Goal:** Create the tRPC + Express backend with database.

- [ ] **S2.1** Initialize `server/` directory
  - `server/package.json` — Express, tRPC 11, Drizzle ORM, dotenv, cors
  - `server/tsconfig.json` — Node target, strict mode
  - `server/src/index.ts` — Express app entry point
  - `server/src/trpc.ts` — tRPC router initialization
  - `server/src/context.ts` — request context (wallet auth verification)
- [ ] **S2.2** Set up PostgreSQL with Drizzle ORM
  - `server/src/db/schema.ts` — all tables:
    - `indexed_series` (mint_address, issuer, name, symbol, type, jurisdiction, supply, created_at)
    - `indexed_holders` (wallet, mint, kyc_status, is_accredited, registered_at)
    - `settlement_orders` (id, buyer, seller, mint, token_amount, usdc_amount, status, created_at)
    - `kyc_sessions` (wallet, provider_session_id, status, result_hash, expires_at)
    - `document_versions` (series_mint, version, arweave_uri, doc_hash, uploaded_at)
    - `webhook_events` (tx_signature, event_type, accounts, timestamp)
  - `server/src/db/index.ts` — Drizzle client connection
  - `server/drizzle.config.ts` — migration config
- [ ] **S2.3** Create database migrations
  - Initial migration with all tables
  - Indexes on frequently queried columns (mint_address, wallet, status)
- [ ] **S2.4** Implement wallet signature auth middleware
  - Verify signed message from frontend (nacl/tweetnacl)
  - Extract wallet pubkey from signature
  - No server-side sessions — stateless auth
- [ ] **S2.5** Set up Redis for caching (optional, can start with in-memory TanStack Query)
  - Cache getProgramAccounts results
  - Cache computed analytics

**Deliverable:** Express + tRPC server running with PostgreSQL database and auth.

---

### Phase S3: tRPC API Routers (Week 5-7)

**Goal:** Implement all API endpoints from the spec.

- [ ] **S3.1** `server/src/routers/securities.ts`
  - `list()` — paginated list of indexed securities (faster than on-chain)
  - `getByMint(mint)` — single security by mint address
  - `getByIssuer(wallet)` — all securities for an issuer
  - `search(query)` — full-text search across name, symbol, ISIN
- [ ] **S3.2** `server/src/routers/holders.ts`
  - `getForSeries(mint)` — all holders for a security with KYC status
  - `getForWallet(wallet)` — all holdings for a wallet
  - `stats(mint)` — holder count, KYC breakdown, accredited count
- [ ] **S3.3** `server/src/routers/settlements.ts`
  - `createOrder(params)` — record off-chain order (before on-chain PDA)
  - `getOrders(wallet)` — all orders for a wallet
  - `executeSettlement(orderId)` — trigger settlement agent
- [ ] **S3.4** `server/src/routers/kyc.ts`
  - `initSession(wallet)` — create KYC provider session (Jumio/Persona)
  - `getStatus(wallet)` — current KYC status
  - `handleWebhook(payload)` — KYC provider webhook handler
- [ ] **S3.5** `server/src/routers/governance.ts`
  - `getProposals(realm)` — indexed proposals for a realm
  - `getVotes(proposalId)` — vote records
  - `realmStats(realm)` — governance analytics
- [ ] **S3.6** `server/src/routers/documents.ts`
  - `upload(file, metadata)` — upload to Arweave via Irys, return URI + hash
  - `verify(uri, expectedHash)` — fetch from Arweave, compute SHA-256, compare
  - `getHistory(seriesMint)` — document version history
- [ ] **S3.7** `server/src/routers/analytics.ts`
  - `platformStats()` — total RWA value, securities count, holders, volume
  - `seriesStats(mint)` — per-series analytics
  - `volumeHistory(range)` — settlement volume over time
  - `portfolioHistory(wallet)` — historical portfolio value for a wallet
- [ ] **S3.8** Create `server/src/routers/index.ts` — merge all routers into appRouter
- [ ] **S3.9** Export `AppRouter` type for frontend tRPC client type inference
- [ ] **S3.10** Set up tRPC client in frontend: `src/lib/trpc.ts`
  - httpBatchLink pointing to server URL
  - Type-safe client using AppRouter type

**Deliverable:** Full API with all endpoints, type-safe tRPC client wired to frontend.

---

### Phase S4: Helius Webhooks & Event Indexing (Week 7-8)

**Goal:** Real-time on-chain event capture and database indexing.

- [ ] **S4.1** Set up Helius webhook endpoint: `server/src/webhooks/helius.ts`
  - HMAC signature verification (WEBHOOK_SECRET)
  - Parse enhanced transaction data
  - Route to event-specific handlers
- [ ] **S4.2** Event handlers:
  - `SeriesCreated` — index new security in `indexed_series` table
  - `SecurityMinted` — update supply counts, notify holder
  - `TransferValidated` — update holder registry, log transfer
  - `HolderRegistered` — update holder count in `indexed_holders`
  - `HolderRevoked` — update status, trigger freeze if needed
  - `ProposalCreated` — index proposal, notify all holders
  - `VoteCast` — update vote tally
  - `ProposalExecuted` — log execution, update affected state
- [ ] **S4.3** Configure Helius webhooks via API
  - Monitor dino_core program account changes
  - Monitor dino_transfer_hook invocations
  - Monitor dino_governance events
  - Monitor SPL Governance program for realm changes
- [ ] **S4.4** Implement webhook retry/dedup logic
  - Idempotent processing using tx_signature as key
  - Store raw events in `webhook_events` table
  - Dead letter queue for failed processing
- [ ] **S4.5** Backfill script — index existing on-chain state into database on first run

**Deliverable:** All on-chain events are captured in real-time and indexed in PostgreSQL.

---

### Phase S5: KYC Oracle & Arweave/IPFS Services (Week 8-10)

**Goal:** Off-chain services for KYC, document storage, and metadata.

- [ ] **S5.1** KYC Oracle Server: `server/src/services/kyc-oracle.ts`
  - Integration with Jumio or Persona API
  - Create verification session for wallet
  - Handle provider webhook on completion
  - On successful KYC:
    1. Compute kyc_hash from provider result
    2. Call dino_core.register_holder to create HolderRecord PDA on-chain
    3. Store session data in `kyc_sessions` table
  - KYC expiry tracking and re-verification alerts
  - OFAC sanctions screening before registration
- [ ] **S5.2** Accredited Investor verification flow
  - Additional verification step via KYC provider
  - Set is_accredited flag on HolderRecord PDA
  - Required for Reg D securities
- [ ] **S5.3** Create `server/src/services/arweave.ts`
  - Irys/Bundlr client setup with IRYS_WALLET_KEY
  - `uploadDocument(file, tags)` — upload legal doc with Irys tags:
    - Content-Type, App-Name, Document-Hash, Security-Type, ISIN, Jurisdiction, Series-Mint
  - `fetchDocument(uri)` — retrieve from Arweave gateway
  - `verifyHash(uri, expectedHash)` — fetch + SHA-256 + compare
- [ ] **S5.4** Create `server/src/services/ipfs.ts`
  - Pinata client setup
  - `uploadMetadata(json)` — upload token metadata JSON to IPFS
  - Metadata JSON format per spec:
    - name, symbol, description, image, external_url
    - attributes[] (Security Type, Jurisdiction, Transfer Restrictions, ISIN, Series ID)
    - properties.files[] (legal doc Arweave URI)
    - properties.legal (doc_hash, doc_uri, governing_law, ricardian_version)
  - `pinFile(file)` — pin supplementary files (images, logos)
- [ ] **S5.5** Document version management
  - Track document updates in `document_versions` table
  - Support amended documents (requires governance vote for some types)
  - Version history API endpoint

**Deliverable:** KYC flow works end-to-end, legal docs stored permanently on Arweave, metadata on IPFS.

---

### Phase S6: Settlement Agent Backend (Week 10-11)

**Goal:** Server-side settlement agent that executes atomic DvP.

- [ ] **S6.1** Create `server/src/services/settlement-agent.ts`
  - Settlement agent keypair loaded from HSM reference (SETTLEMENT_AGENT_KEY)
  - **Never takes custody** — only holds delegated approval
  - Runs in isolated process/container
- [ ] **S6.2** Settlement execution flow:
  1. Monitor SettlementOrder PDAs for MATCHED status
  2. Verify both parties have approved delegation
  3. Build atomic transaction:
     - Leg 1: Transfer security tokens (issuer/seller -> investor/buyer)
     - Leg 2: Transfer USDC (investor/buyer -> issuer/seller)
  4. Submit single Solana transaction
  5. Update order status: EXECUTING -> SETTLED or FAILED
- [ ] **S6.3** Multi-party settlement support
  - Address Lookup Tables (ALTs) for 3+ party transactions
  - Broker-dealer intermediation flow
- [ ] **S6.4** Order matching engine
  - Match buy/sell orders by security mint + price
  - Update SettlementOrder PDA status to MATCHED
  - Notify both parties
- [ ] **S6.5** Failure handling
  - Retry on transient failures (network timeout)
  - Revert to CREATED status on permanent failure (insufficient balance)
  - Alert via webhook on repeated failures
- [ ] **S6.6** Settlement history logging
  - Record all completed settlements with tx signatures
  - Expose via `settlements` tRPC router

**Deliverable:** Fully automated settlement agent executing atomic DvP on Solana.

---

### Phase S7: Infrastructure & DevOps (Week 11-12)

**Goal:** Production-ready infrastructure.

- [ ] **S7.1** Docker setup
  - `server/Dockerfile` — backend API container
  - `docker-compose.yml` — API + PostgreSQL + Redis for local dev
- [ ] **S7.2** Helius RPC configuration
  - Primary: Helius (production)
  - Fallback: QuickNode
  - Health check and automatic failover
- [ ] **S7.3** Monitoring setup
  - Grafana + Prometheus for API metrics (latency, error rates)
  - Sentry for frontend error tracking
  - Custom alerts for failed settlements, webhook processing delays
- [ ] **S7.4** Environment configuration
  - Development: devnet RPC, local PostgreSQL
  - Staging: devnet RPC, managed database
  - Production: mainnet-beta RPC, managed database, HSM keys
- [ ] **S7.5** CI/CD pipeline
  - Anchor program tests on PR
  - tRPC API tests on PR
  - Frontend build verification
  - Auto-deploy frontend to Vercel on main merge
  - Backend deploy to Railway/Render on main merge
- [ ] **S7.6** Database backup strategy
  - Automated daily backups
  - Point-in-time recovery
- [ ] **S7.7** Security hardening
  - CSP headers on frontend
  - Rate limiting on API
  - HMAC verification on all webhooks
  - Input validation with Zod on all tRPC procedures

**Deliverable:** Production-ready infrastructure with monitoring, CI/CD, and security.

---

## Note for Sorrow: Environment Variables After Deployment

Once you deploy the Anchor programs to devnet and set up the backend services, update the `.env` file in the project root with the real values. The frontend reads all `VITE_*` vars at build time.

### After deploying Anchor programs to devnet:

```env
# Replace the placeholder program IDs with the real deployed ones
VITE_DINO_CORE_PROGRAM_ID=<dino_core program ID from anchor deploy>
VITE_DINO_HOOK_PROGRAM_ID=<dino_transfer_hook program ID from anchor deploy>
VITE_DINO_GOV_PROGRAM_ID=<dino_governance program ID from anchor deploy>
```

### After setting up Helius RPC:

```env
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your-helius-key>
# or for devnet:
VITE_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=<your-helius-key>
VITE_SOLANA_NETWORK=devnet
```

### After setting up the tRPC backend server:

```env
VITE_API_URL=http://localhost:3001/trpc
# or for production:
VITE_API_URL=https://api.dinosecurities.com/trpc
```

### After setting up USDC on devnet (use devnet USDC mint):

```env
VITE_USDC_MINT=<devnet USDC mint address>
```

### Server-side `.env` (for `server/` directory — not committed):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dinosecurities

# Solana
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=<key>
SOLANA_RPC_FALLBACK=https://solana-devnet.g.alchemy.com/v2/<key>

# Program IDs (same as frontend)
DINO_CORE_PROGRAM_ID=<from anchor deploy>
DINO_HOOK_PROGRAM_ID=<from anchor deploy>
DINO_GOV_PROGRAM_ID=<from anchor deploy>

# Helius webhooks
HELIUS_API_KEY=<your-helius-api-key>
WEBHOOK_SECRET=<random-hmac-secret-for-webhook-verification>

# KYC Provider
KYC_PROVIDER_API_KEY=<jumio-or-persona-api-key>

# Settlement Agent (HSM reference or keypair path — NEVER commit the actual key)
SETTLEMENT_AGENT_KEY=<path-to-keypair-or-hsm-reference>

# Arweave / Irys
IRYS_WALLET_KEY=<path-to-solana-keypair-for-irys-uploads>

# IPFS / Pinata
PINATA_API_KEY=<pinata-api-key>
PINATA_SECRET_KEY=<pinata-secret-key>
```

### Important notes:
- The frontend currently uses placeholder program IDs (`111...111`). When these are placeholders, the hooks gracefully fall back to mock data. Once you set real program IDs, the hooks will fetch real on-chain data.
- Copy the generated IDL JSON files from `programs/target/idl/` to a shared location so Powerz can replace the placeholder IDL in `src/lib/anchor.ts`.
- Never commit private keys or API keys to git. The `.env` file is already in `.gitignore`.

---

## Integration Points (Powerz <-> Sorrow)

These are the critical handoff points where both devs must coordinate:

| Week | Integration Point | Powerz Needs | Sorrow Provides |
|------|------------------|--------------|-----------------|
| 3 | IDL Handoff | Anchor IDL JSON files for client | Deployed devnet programs + IDLs |
| 5 | tRPC Client | Type-safe API client | AppRouter type export |
| 6 | Wallet Auth | signMessage flow on frontend | Signature verification middleware |
| 7 | Webhook Events | TanStack Query invalidation triggers | Webhook -> DB indexing pipeline |
| 8 | KYC Flow | KYC page UI with provider widget | KYC oracle + on-chain registration |
| 9 | Settlement UI | Order creation + status display | Settlement agent execution |
| 10 | Arweave Upload | Upload UI in CreateSeries wizard | Irys upload service + hash computation |
| 11 | Governance | Vote casting UI | SPL Governance program + indexing |

---

## Weekly Sync Schedule

| Day | Activity |
|-----|---------|
| Monday | Standup — what each dev will work on this week |
| Wednesday | Mid-week sync — blockers, integration testing |
| Friday | Demo — show what's working end-to-end on devnet |

---

## Definition of Done

A feature is "done" when:
1. Works on Solana devnet with real transactions
2. No mock data remains for that feature
3. Error states are handled (loading, error, empty)
4. Transaction simulation runs before wallet signing
5. Toast notifications for transaction status
6. Tested with both Phantom and Solflare wallets

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Anchor programs take longer than expected | Sorrow starts with simplified instructions, iterates. Powerz uses mock IDL until real one is ready |
| Token-2022 extension conflicts (Confidential Transfer + Transfer Hook) | Spec already documents this — use wrapper token pattern if needed |
| Helius webhook reliability | Implement backfill script + polling fallback |
| KYC provider integration delays | Build with mock KYC oracle first, swap provider later |
| Devnet instability | QuickNode fallback RPC configured from day 1 |

---

## Final Milestone Checklist

- [ ] All 3 Anchor programs deployed and tested on devnet
- [ ] tRPC API serving real indexed data
- [ ] Wallet connects and role detection works
- [ ] Dashboard shows real portfolio from on-chain data
- [ ] Marketplace lists real SecuritySeries from chain
- [ ] Settlement creates real DvP orders and executes atomically
- [ ] Governance proposals can be created and voted on
- [ ] KYC flow works end-to-end (provider -> oracle -> on-chain PDA)
- [ ] Legal documents stored on Arweave with hash verification
- [ ] Issuer portal creates real security series
- [ ] Zero mock data remaining in codebase
- [ ] All pages handle loading/error/empty states
- [ ] Devnet demo works end-to-end for all user roles (Visitor, Investor, Issuer, Admin)
