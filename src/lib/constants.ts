/**
 * Security type enum matching the on-chain u8 representation
 */
export const SECURITY_TYPES = {
  0: "Equity",
  1: "Debt",
  2: "Fund",
  3: "LLC",
} as const;

export const SECURITY_TYPE_TO_U8 = {
  Equity: 0,
  Debt: 1,
  Fund: 2,
  LLC: 3,
} as const;

/**
 * Transfer restriction enum matching on-chain u8
 */
export const TRANSFER_RESTRICTIONS = {
  0: "RegD",
  1: "RegS",
  2: "RegCF",
  3: "RegA+",
  4: "Ricardian",
  5: "None",
} as const;

export const TRANSFER_RESTRICTION_TO_U8 = {
  RegD: 0,
  RegS: 1,
  RegCF: 2,
  "RegA+": 3,
  Ricardian: 4,
  None: 5,
} as const;

/**
 * Settlement order status enum matching on-chain u8
 */
export const ORDER_STATUS = {
  0: "created",
  1: "matched",
  2: "delegated",
  3: "executing",
  4: "settled",
  5: "failed",
  6: "cancelled",
  7: "expired",
} as const;

/**
 * Order side
 */
export const ORDER_SIDE = {
  0: "buy",
  1: "sell",
} as const;

export const ORDER_SIDE_TO_U8 = {
  buy: 0,
  sell: 1,
} as const;

/**
 * Governance proposal thresholds (from spec)
 */
export const PROPOSAL_THRESHOLDS = {
  UpdateLegalDoc: 66,
  UpdateTransferRestrictions: 60,
  MintAdditional: 66,
  BurnTokens: 60,
  FreezeHolder: 51,
  EmergencyPause: 51,
  TreasuryTransfer: 60,
  UpgradeProgram: 75,
} as const;

/**
 * Default governance parameters
 */
export const DEFAULT_GOVERNANCE = {
  VOTE_THRESHOLD: 60,
  MIN_PROPOSAL_WEIGHT_PERCENT: 1,
  VOTING_PERIOD_HOURS: 72,
  COOLOFF_PERIOD_HOURS: 24,
  TIMELOCK_HOURS: 48,
} as const;

/**
 * Token decimals
 */
export const TOKEN_DECIMALS = {
  SECURITY: 0,
  USDC: 6,
} as const;
