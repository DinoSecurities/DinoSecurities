import { Connection } from "@solana/web3.js";
import { env } from "../env.js";

export const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");

export const fallbackConnection = env.SOLANA_RPC_FALLBACK
  ? new Connection(env.SOLANA_RPC_FALLBACK, "confirmed")
  : null;

/**
 * Get a connection, falling back to secondary if primary fails
 */
export async function getHealthyConnection(): Promise<Connection> {
  try {
    await connection.getSlot();
    return connection;
  } catch {
    if (fallbackConnection) {
      console.warn("Primary RPC failed, using fallback");
      return fallbackConnection;
    }
    throw new Error("All RPC endpoints are unavailable");
  }
}
