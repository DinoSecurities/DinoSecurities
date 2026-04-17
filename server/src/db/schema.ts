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
