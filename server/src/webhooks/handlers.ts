import { db } from "../db/index.js";
import { indexedSeries, indexedHolders, settlementOrders } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface WebhookEvent {
  type?: string;
  signature?: string;
  description?: string;
  accountData?: Array<{ account: string; nativeBalanceChange: number; tokenBalanceChanges: unknown[] }>;
  instructions?: Array<{ programId: string; data: string; accounts: string[] }>;
  events?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Route webhook events to specific handlers based on event type / instruction data.
 * The exact routing logic depends on the Anchor program instruction discriminators
 * which will be finalized when Sorrow deploys the programs.
 */
export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  const eventType = detectEventType(event);

  switch (eventType) {
    case "SeriesCreated":
      await handleSeriesCreated(event);
      break;
    case "SecurityMinted":
      await handleSecurityMinted(event);
      break;
    case "TransferValidated":
      await handleTransferValidated(event);
      break;
    case "HolderRegistered":
      await handleHolderRegistered(event);
      break;
    case "HolderRevoked":
      await handleHolderRevoked(event);
      break;
    case "ProposalCreated":
      await handleProposalCreated(event);
      break;
    case "VoteCast":
      await handleVoteCast(event);
      break;
    case "ProposalExecuted":
      await handleProposalExecuted(event);
      break;
    default:
      console.log("Unrecognized event type:", eventType);
  }
}

/**
 * Detect event type from Helius enhanced transaction data.
 * This will be refined once the Anchor program IDLs are finalized.
 */
function detectEventType(event: WebhookEvent): string {
  // Helius enhanced events include a description field
  if (event.description) {
    if (event.description.includes("create_security_series")) return "SeriesCreated";
    if (event.description.includes("mint_to")) return "SecurityMinted";
    if (event.description.includes("transfer")) return "TransferValidated";
    if (event.description.includes("register_holder")) return "HolderRegistered";
    if (event.description.includes("revoke_holder")) return "HolderRevoked";
    if (event.description.includes("create_proposal")) return "ProposalCreated";
    if (event.description.includes("cast_vote")) return "VoteCast";
    if (event.description.includes("execute")) return "ProposalExecuted";
  }
  return event.type || "unknown";
}

async function handleSeriesCreated(event: WebhookEvent): Promise<void> {
  // TODO: Decode SecuritySeries account data from transaction
  // and upsert into indexed_series table
  console.log("Processing SeriesCreated:", event.signature);
}

async function handleSecurityMinted(event: WebhookEvent): Promise<void> {
  // TODO: Update current_supply in indexed_series
  console.log("Processing SecurityMinted:", event.signature);
}

async function handleTransferValidated(event: WebhookEvent): Promise<void> {
  // TODO: Update holder registry, log transfer
  console.log("Processing TransferValidated:", event.signature);
}

async function handleHolderRegistered(event: WebhookEvent): Promise<void> {
  // TODO: Insert into indexed_holders
  console.log("Processing HolderRegistered:", event.signature);
}

async function handleHolderRevoked(event: WebhookEvent): Promise<void> {
  // TODO: Update indexed_holders set is_revoked = true
  console.log("Processing HolderRevoked:", event.signature);
}

async function handleProposalCreated(event: WebhookEvent): Promise<void> {
  // TODO: Index proposal from SPL Governance
  console.log("Processing ProposalCreated:", event.signature);
}

async function handleVoteCast(event: WebhookEvent): Promise<void> {
  // TODO: Update vote tally
  console.log("Processing VoteCast:", event.signature);
}

async function handleProposalExecuted(event: WebhookEvent): Promise<void> {
  // TODO: Log execution, update affected state
  console.log("Processing ProposalExecuted:", event.signature);
}
