import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const indexedSeries = pgTable(
  "indexed_series",
  {
    mintAddress: text("mint_address").primaryKey(),
    issuer: text("issuer").notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    securityType: text("security_type").notNull(), // Equity, Debt, Fund, LLC
    docHash: text("doc_hash").notNull(),
    docUri: text("doc_uri").notNull(),
    isin: text("isin"),
    maxSupply: bigint("max_supply", { mode: "number" }).notNull(),
    currentSupply: bigint("current_supply", { mode: "number" }).notNull().default(0),
    transferRestrictions: text("transfer_restrictions").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    status: text("status").notNull().default("active"),
    governance: text("governance"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    indexedAt: timestamp("indexed_at").defaultNow().notNull(),
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  },
  (table) => [
    index("idx_series_issuer").on(table.issuer),
    index("idx_series_type").on(table.securityType),
    index("idx_series_status").on(table.status),
  ],
);

export const indexedHolders = pgTable(
  "indexed_holders",
  {
    mintAddress: text("mint_address").notNull(),
    wallet: text("wallet").notNull(),
    kycHash: text("kyc_hash"),
    kycExpiry: timestamp("kyc_expiry"),
    isAccredited: boolean("is_accredited").default(false).notNull(),
    isFrozen: boolean("is_frozen").default(false).notNull(),
    isRevoked: boolean("is_revoked").default(false).notNull(),
    jurisdiction: text("jurisdiction").default("").notNull(),
    registeredAt: timestamp("registered_at").defaultNow().notNull(),
    indexedAt: timestamp("indexed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_holders_pk").on(table.mintAddress, table.wallet),
    index("idx_holders_wallet").on(table.wallet),
    index("idx_holders_mint").on(table.mintAddress),
  ],
);

export const settlementOrders = pgTable(
  "settlement_orders",
  {
    orderId: text("order_id").primaryKey(),
    buyer: text("buyer"),
    seller: text("seller"),
    securityMint: text("security_mint").notNull(),
    tokenAmount: bigint("token_amount", { mode: "number" }).notNull(),
    usdcAmount: bigint("usdc_amount", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    txSignature: text("tx_signature"),
    // Performance metrics captured on SettlementExecuted. Populated by the
    // webhook handler from the confirmed tx's blockTime (finality) and
    // meta.fee (lamports paid by the agent). These power the live
    // click-to-verify numbers on the marketing landing page.
    finalityMs: integer("finality_ms"),
    feeLamports: bigint("fee_lamports", { mode: "number" }),
    settlementSlot: bigint("settlement_slot", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    settledAt: timestamp("settled_at"),
  },
  (table) => [
    index("idx_orders_buyer").on(table.buyer),
    index("idx_orders_seller").on(table.seller),
    index("idx_orders_mint").on(table.securityMint),
    index("idx_orders_status").on(table.status),
  ],
);

export const kycSessions = pgTable(
  "kyc_sessions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    wallet: text("wallet").notNull(),
    providerSessionId: text("provider_session_id"),
    status: text("status").notNull().default("pending"),
    resultHash: text("result_hash"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_kyc_wallet").on(table.wallet)],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    seriesMint: text("series_mint").notNull(),
    version: integer("version").notNull(),
    arweaveUri: text("arweave_uri").notNull(),
    docHash: text("doc_hash").notNull(),
    uploadedBy: text("uploaded_by"),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_docver_unique").on(table.seriesMint, table.version),
    index("idx_docver_mint").on(table.seriesMint),
  ],
);

export const govRealms = pgTable(
  "gov_realms",
  {
    securityMint: text("security_mint").primaryKey(),
    realmPda: text("realm_pda").notNull(),
    authority: text("authority").notNull(),
    voteThresholdBps: integer("vote_threshold_bps").notNull(),
    quorumBps: integer("quorum_bps").notNull(),
    votingPeriodSec: bigint("voting_period_sec", { mode: "number" }).notNull(),
    cooloffPeriodSec: bigint("cooloff_period_sec", { mode: "number" }).notNull(),
    minProposalWeight: bigint("min_proposal_weight", { mode: "number" }).notNull().default(0),
    proposalCount: bigint("proposal_count", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_realm_authority").on(table.authority)],
);

export const govProposals = pgTable(
  "gov_proposals",
  {
    proposalPda: text("proposal_pda").primaryKey(),
    realmPda: text("realm_pda").notNull(),
    securityMint: text("security_mint").notNull(),
    proposer: text("proposer").notNull(),
    proposalType: text("proposal_type").notNull(),
    title: text("title").notNull(),
    descriptionUri: text("description_uri"),
    executionPayloadHex: text("execution_payload_hex"),
    proposalIndex: bigint("proposal_index", { mode: "number" }).notNull(),
    yesVotes: bigint("yes_votes", { mode: "number" }).notNull().default(0),
    noVotes: bigint("no_votes", { mode: "number" }).notNull().default(0),
    abstainVotes: bigint("abstain_votes", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("voting"),
    votingEndsAt: timestamp("voting_ends_at").notNull(),
    executionEta: timestamp("execution_eta").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  },
  (table) => [
    index("idx_proposal_mint").on(table.securityMint),
    index("idx_proposal_realm").on(table.realmPda),
    index("idx_proposal_status").on(table.status),
    index("idx_proposal_proposer").on(table.proposer),
  ],
);

export const govVotes = pgTable(
  "gov_votes",
  {
    proposalPda: text("proposal_pda").notNull(),
    voter: text("voter").notNull(),
    choice: text("choice").notNull(),
    weight: bigint("weight", { mode: "number" }).notNull(),
    txSignature: text("tx_signature"),
    castAt: timestamp("cast_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_votes_pk").on(table.proposalPda, table.voter),
    index("idx_votes_proposal").on(table.proposalPda),
    index("idx_votes_voter").on(table.voter),
  ],
);

/**
 * Cached sanctions-list entries — refreshed nightly from OFAC SDN, the
 * EU Consolidated list, and UK HMT. Keyed by (source, identifier) since
 * a single individual can appear on multiple lists. Match lookup is done
 * against `identifier_lower` (wallet pubkey lowercased) OR against the
 * full `raw` JSON for name/alias fuzzy matching (v2 — wallet-only for
 * first pass).
 */
export const sanctionsEntries = pgTable(
  "sanctions_entries",
  {
    source: text("source").notNull(), // 'ofac_sdn' | 'eu_consolidated' | 'uk_hmt'
    identifier: text("identifier").notNull(), // wallet address (lowercased) or list-specific ID
    identifierLower: text("identifier_lower").notNull(),
    entryType: text("entry_type").notNull(), // 'wallet' | 'name' | 'alias'
    displayName: text("display_name"),
    listedOn: text("listed_on"), // date the entry was first listed (source-reported)
    raw: jsonb("raw").notNull(), // full entry from the source, for human review
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_sanctions_pk").on(table.source, table.identifier),
    index("idx_sanctions_lookup").on(table.identifierLower),
    index("idx_sanctions_source").on(table.source),
  ],
);

/**
 * Immutable audit log of issuer overrides on sanctions-match screening.
 * Every override is: an authenticated admin wallet explicitly approving
 * a flagged register_holder despite a sanctions-list match, with a
 * free-text justification. Never delete rows from this table.
 */
export const sanctionsOverrides = pgTable(
  "sanctions_overrides",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    wallet: text("wallet").notNull(), // the holder wallet that matched
    seriesMint: text("series_mint"),
    matchedSources: text("matched_sources").array().notNull(), // e.g. ['ofac_sdn', 'uk_hmt']
    matchedIdentifiers: jsonb("matched_identifiers").notNull(), // array of the raw sanctions entries
    justification: text("justification").notNull(),
    adminWallet: text("admin_wallet").notNull(),
    adminSignature: text("admin_signature").notNull(), // proof the admin authorized this
    status: text("status").notNull().default("active"), // 'active' | 'revoked'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sanctions_override_wallet").on(table.wallet),
    index("idx_sanctions_override_admin").on(table.adminWallet),
  ],
);

/**
 * Per-issuer branding. Settings apply to the issuer's embed widget
 * (/embed/:symbol) and their section of the Issuer Portal. Every
 * field is tier-gated by the platform — the tier check happens on
 * write, so a wallet whose balance later drops keeps the branding
 * they earned (squat-resistance via the entry bar, not ongoing tax).
 */
export const issuerBranding = pgTable(
  "issuer_branding",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    issuerWallet: text("issuer_wallet").notNull(),
    accentColor: text("accent_color"), // CSS hex, e.g. "#22c55e"; Bronze+
    logoUri: text("logo_uri"), // arweave / https URL; Silver+
    hideEmbedFooter: boolean("hide_embed_footer").notNull().default(false), // Gold-only
    tierAtWrite: integer("tier_at_write").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_issuer_branding_wallet").on(table.issuerWallet),
  ],
);

/**
 * Scheduled public listing for a series. If set and in the future,
 * non-Gold callers hitting the marketplace list don't see the series;
 * Gold-tier holders see it in /app/marketplace/upcoming instead. No
 * on-chain change — the series is created immediately; only the
 * platform UI gates it.
 */
export const seriesPreviewListings = pgTable(
  "series_preview_listings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    seriesMint: text("series_mint").notNull(),
    publicListingAt: timestamp("public_listing_at").notNull(),
    scheduledBy: text("scheduled_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_preview_series").on(table.seriesMint),
    index("idx_preview_public_at").on(table.publicListingAt),
  ],
);

/**
 * $DINO community-governance proposals. DELIBERATELY ISOLATED from
 * every other governance surface on the platform:
 *
 *   - This table has NO foreign-key, join, or cross-reference to
 *     gov_proposals / gov_realms / gov_votes (the on-chain securities-
 *     governance indexer).
 *   - Records here NEVER execute anything on-chain. No CPI, no signer,
 *     no automatic treasury movement. Outcomes are advisory polls;
 *     the platform team executes manually (or doesn't).
 *   - Proposal type is a strict enum. No "generic on-chain action"
 *     kind exists and none will be added without legal review.
 *
 * Separation is the whole feature. If you're adding a field that
 * touches a security mint, issuer PDA, or on-chain program state,
 * stop — that belongs in a different surface.
 */
export const communityProposals = pgTable(
  "community_proposals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: text("title").notNull(),
    description: text("description").notNull(), // markdown
    proposalType: text("proposal_type").notNull(), // enum enforced at write: marketing_budget | feature_request | community_grant | community_event | generic
    createdBy: text("created_by").notNull(),
    creatorBalanceAtCreation: bigint("creator_balance_at_creation", { mode: "number" }).notNull(),
    creatorTierAtCreation: integer("creator_tier_at_creation").notNull(),
    disclosureAck: boolean("disclosure_ack").notNull().default(false),
    status: text("status").notNull().default("voting"), // voting | closed | canceled
    votingEndsAt: timestamp("voting_ends_at").notNull(),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_community_proposal_status").on(table.status),
    index("idx_community_proposal_creator").on(table.createdBy),
    index("idx_community_proposal_type").on(table.proposalType),
  ],
);

export const communityVotes = pgTable(
  "community_votes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    proposalId: integer("proposal_id").notNull(),
    voterWallet: text("voter_wallet").notNull(),
    choice: text("choice").notNull(), // yes | no | abstain
    weightAtVote: bigint("weight_at_vote", { mode: "number" }).notNull(), // $DINO UI-decimal balance at vote time
    castAt: timestamp("cast_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_community_vote_pk").on(table.proposalId, table.voterWallet),
    index("idx_community_vote_proposal").on(table.proposalId),
    index("idx_community_vote_voter").on(table.voterWallet),
  ],
);

/**
 * $DINO community handles. One wallet claims one handle; the handle
 * becomes the wallet's display name across the platform. Claim is
 * tier-gated — a wallet must hold at least Bronze ($DINO minBalance
 * 100_000) at claim time. Handles are not auto-revoked when the
 * balance drops — the row survives, but the tier-gated claim bar
 * means squatting costs real token exposure upfront.
 *
 * Handles are case-insensitive at claim time (stored lowercased)
 * but the original casing is preserved in `displayHandle` for the
 * rendering path. The unique index guarantees one claim per handle.
 */
export const dinoHandles = pgTable(
  "dino_handles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerWallet: text("owner_wallet").notNull(),
    handle: text("handle").notNull(), // lowercased, for lookup
    displayHandle: text("display_handle").notNull(), // as-typed
    minTierAtClaim: integer("min_tier_at_claim").notNull(), // snapshot of tier id
    balanceAtClaim: bigint("balance_at_claim", { mode: "number" }).notNull(),
    releasedAt: timestamp("released_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_dino_handle_owner").on(table.ownerWallet),
    uniqueIndex("idx_dino_handle_unique").on(table.handle),
    index("idx_dino_handle_active").on(table.releasedAt),
  ],
);

/**
 * Public REST API keys. Each key belongs to a single owner wallet;
 * the rate-limit tier applied to requests using the key is read
 * live-on-request from the owner's $DINO balance (cached briefly),
 * so a holder who accumulates more $DINO gets the higher tier
 * without rotating their key.
 *
 * The plaintext key is shown to the owner exactly once on creation;
 * only the sha256 hash is persisted. `keyPrefix` is the first eight
 * chars kept alongside the hash for display purposes — the dashboard
 * shows "dino_live_abc123…" without needing the full key.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerWallet: text("owner_wallet").notNull(),
    keyPrefix: text("key_prefix").notNull(), // first 14 chars, e.g. "dino_live_abcd" for display
    keyHash: text("key_hash").notNull(), // sha256 hex of the full key
    label: text("label"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("idx_api_key_hash").on(table.keyHash),
    index("idx_api_key_owner").on(table.ownerWallet),
    index("idx_api_key_active").on(table.active),
  ],
);

export const webhookEvents = pgTable("webhook_events", {
  txSignature: text("tx_signature").primaryKey(),
  eventType: text("event_type").notNull(),
  accounts: jsonb("accounts"),
  rawData: jsonb("raw_data"),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

/**
 * Allow-list of XRPL accounts we trust to issue KYC (and related) credentials
 * under the XLS-70 Credentials standard. When a holder presents a credential
 * on their XRPL address, we accept it as an alternate KYC attestation — in
 * parallel to the platform's own KYC oracle — only if the credential's
 * issuer address appears here and is active. `credentialTypes` is an allow-
 * list of permitted credentialType hex strings (e.g. sha256 of "KYC-BASIC");
 * an empty array means "any type from this issuer."
 */
export const trustedXrplCredentialIssuers = pgTable(
  "trusted_xrpl_credential_issuers",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    xrplAddress: text("xrpl_address").notNull(),
    displayName: text("display_name").notNull(),
    credentialTypes: text("credential_types").array().notNull().default(sql`ARRAY[]::text[]`),
    network: text("network").notNull().default("mainnet"), // 'mainnet' | 'testnet' | 'devnet'
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_trusted_xrpl_issuer_pk").on(table.xrplAddress, table.network),
    index("idx_trusted_xrpl_issuer_active").on(table.active),
  ],
);

/**
 * Short-lived challenges issued to prove ownership of an XRPL address
 * from a specific Solana wallet. The holder requests a challenge, signs
 * the nonce with their XRPL wallet, and posts the signature back — we
 * verify and record the binding. Challenges are single-use and expire
 * five minutes after issue.
 */
export const xrplBindingChallenges = pgTable(
  "xrpl_binding_challenges",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    solanaWallet: text("solana_wallet").notNull(),
    xrplAddress: text("xrpl_address").notNull(),
    network: text("network").notNull(),
    nonce: text("nonce").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_challenge_wallet").on(table.solanaWallet),
    index("idx_challenge_xrpl").on(table.xrplAddress),
  ],
);

/**
 * Proved (Solana wallet, XRPL address) bindings. A row lands here only
 * after a challenge was successfully signed by the claimed XRPL key and
 * the derived address matched. Every downstream XRPL-credential check
 * must reference a row in this table — without a binding, an attacker
 * could claim any XRPL address that happens to hold a trusted credential.
 */
export const walletXrplBindings = pgTable(
  "wallet_xrpl_bindings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    solanaWallet: text("solana_wallet").notNull(),
    xrplAddress: text("xrpl_address").notNull(),
    xrplPublicKey: text("xrpl_public_key").notNull(),
    keyType: text("key_type").notNull(), // 'ed25519' | 'secp256k1'
    network: text("network").notNull(),
    signature: text("signature").notNull(),
    nonce: text("nonce").notNull(),
    provedAt: timestamp("proved_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_binding_pk").on(table.solanaWallet, table.xrplAddress),
    index("idx_binding_wallet").on(table.solanaWallet),
    index("idx_binding_xrpl").on(table.xrplAddress),
  ],
);

/**
 * Pending holder-initiated whitelist requests that verified via an XRPL
 * credential. The holder proves their binding and a trusted issuer's
 * credential clears; an issuer then reviews the queue and one-click
 * approves, at which point the normal register_holder path runs with
 * kyc_source='xrpl_credential' so the audit trail points at the XRPL
 * credential instead of the platform's own oracle check.
 */
export const xrplWhitelistRequests = pgTable(
  "xrpl_whitelist_requests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    seriesMint: text("series_mint").notNull(),
    solanaWallet: text("solana_wallet").notNull(),
    xrplAddress: text("xrpl_address").notNull(),
    network: text("network").notNull(),
    verificationId: integer("verification_id"), // fk to xrpl_credential_verifications.id
    requestedJurisdiction: text("requested_jurisdiction"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | expired
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolvedTx: text("resolved_tx"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_whitelist_req_pk").on(table.seriesMint, table.solanaWallet),
    index("idx_whitelist_req_status").on(table.status),
    index("idx_whitelist_req_series").on(table.seriesMint),
  ],
);

/**
 * Append-only audit log of every XRPL-credential verification the platform
 * has performed. One row per verification attempt, whether it resolved to
 * clean or dirty. Pairs with sanctions_overrides for a full compliance-
 * decision history an auditor can read end-to-end.
 */
export const xrplCredentialVerifications = pgTable(
  "xrpl_credential_verifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    solanaWallet: text("solana_wallet"),
    xrplAddress: text("xrpl_address").notNull(),
    xrplIssuer: text("xrpl_issuer"),
    credentialType: text("credential_type"),
    network: text("network").notNull(),
    clean: boolean("clean").notNull(),
    reason: text("reason"),
    rawCredential: jsonb("raw_credential"),
    checkedBy: text("checked_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_xrpl_verif_wallet").on(table.solanaWallet),
    index("idx_xrpl_verif_address").on(table.xrplAddress),
  ],
);

/**
 * Issuer-registered outbound webhook endpoints. One row per (series, URL).
 * An issuer subscribes their backend to a subset of onchain events we index
 * — when a matching event lands, the dispatcher POSTs an HMAC-SHA256 signed
 * payload to `url`. Rotating the secret creates a new value in-place; active
 * deliveries keep using whatever secret was current at dispatch time.
 */
export const issuerWebhooks = pgTable(
  "issuer_webhooks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    seriesMint: text("series_mint").notNull(),
    issuerWallet: text("issuer_wallet").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    eventsSubscribed: text("events_subscribed").array().notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastRotatedAt: timestamp("last_rotated_at"),
  },
  (table) => [
    index("idx_webhook_series").on(table.seriesMint),
    index("idx_webhook_issuer").on(table.issuerWallet),
    uniqueIndex("idx_webhook_series_url").on(table.seriesMint, table.url),
  ],
);

/**
 * Per-attempt delivery log. One row per POST attempt, including retries.
 * Visible to the issuer in the portal so they can see which events reached
 * their endpoint and which ones are still bouncing. Status is 'pending'
 * while in-flight, 'delivered' on 2xx, 'failed' after final retry exhausts.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    webhookId: integer("webhook_id").notNull(),
    eventType: text("event_type").notNull(),
    txSignature: text("tx_signature"),
    payload: jsonb("payload").notNull(),
    attempt: integer("attempt").notNull().default(1),
    status: text("status").notNull().default("pending"), // 'pending' | 'delivered' | 'failed'
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_delivery_webhook").on(table.webhookId),
    index("idx_delivery_status").on(table.status),
    index("idx_delivery_event").on(table.txSignature),
  ],
);
