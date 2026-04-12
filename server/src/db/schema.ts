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

export const webhookEvents = pgTable("webhook_events", {
  txSignature: text("tx_signature").primaryKey(),
  eventType: text("event_type").notNull(),
  accounts: jsonb("accounts"),
  rawData: jsonb("raw_data"),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});
