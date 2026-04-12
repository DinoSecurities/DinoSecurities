import {
  Connection,
  PublicKey,
  Transaction,
  type TransactionSignature,
} from "@solana/web3.js";
import type { AnchorProvider } from "@coral-xyz/anchor";
import { deriveSettlementOrderPDA, PROGRAM_IDS } from "./solana";
import { buildApproveInstruction } from "./token2022";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ORDER_SIDE_TO_U8 } from "./constants";

export type OrderSide = "buy" | "sell";

export interface CreateOrderParams {
  securityMint: PublicKey;
  tokenAmount: number;
  usdcAmount: number;
  side: OrderSide;
}

/**
 * Client-side settlement engine for DvP (Delivery vs Payment).
 *
 * Flow:
 * 1. User creates a SettlementOrder PDA (buy or sell)
 * 2. Counterparty matches the order
 * 3. Both parties approve delegation to the settlement agent
 * 4. Settlement agent constructs and submits atomic DvP transaction
 * 5. Both legs (security token + USDC) transfer in a single tx
 */
export class DinoSettlementEngine {
  constructor(
    private connection: Connection,
    private provider: AnchorProvider | null,
  ) {}

  /**
   * Generate a unique order ID
   */
  generateOrderId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Create a new settlement order on-chain
   */
  async createOrder(
    params: CreateOrderParams,
  ): Promise<{ orderId: string; tx: TransactionSignature }> {
    if (!this.provider) throw new Error("Wallet not connected");

    const orderId = this.generateOrderId();
    const wallet = this.provider.wallet.publicKey;
    const [orderPDA] = deriveSettlementOrderPDA(orderId);

    // TODO: Use real program instruction when deployed
    // For now, simulate the order creation
    console.log("Creating settlement order:", {
      orderId,
      orderPDA: orderPDA.toBase58(),
      wallet: wallet.toBase58(),
      ...params,
      securityMint: params.securityMint.toBase58(),
    });

    // When real program is deployed:
    // const program = new Program(DINO_CORE_IDL, PROGRAM_IDS.DINO_CORE, this.provider);
    // const tx = await program.methods
    //   .createSettlementOrder(orderId, params.tokenAmount, params.usdcAmount, ORDER_SIDE_TO_U8[params.side])
    //   .accounts({ creator: wallet, order: orderPDA, securityMint: params.securityMint, systemProgram: SystemProgram.programId })
    //   .rpc();

    return { orderId, tx: "simulated_tx_signature" };
  }

  /**
   * Cancel an existing settlement order
   */
  async cancelOrder(orderId: string): Promise<TransactionSignature> {
    if (!this.provider) throw new Error("Wallet not connected");

    const [orderPDA] = deriveSettlementOrderPDA(orderId);
    const wallet = this.provider.wallet.publicKey;

    console.log("Cancelling order:", orderId, orderPDA.toBase58());

    // TODO: Use real program instruction
    return "simulated_cancel_tx";
  }

  /**
   * Approve delegation of tokens to the settlement agent.
   * Both buyer (USDC) and seller (security tokens) must call this.
   */
  async approveDelegate(params: {
    mint: PublicKey;
    amount: number;
    settlementAgent: PublicKey;
  }): Promise<TransactionSignature> {
    if (!this.provider) throw new Error("Wallet not connected");

    const wallet = this.provider.wallet.publicKey;
    const ata = getAssociatedTokenAddressSync(
      params.mint,
      wallet,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    const instruction = buildApproveInstruction({
      account: ata,
      delegate: params.settlementAgent,
      owner: wallet,
      amount: params.amount,
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.provider.sendAndConfirm(tx);

    return signature;
  }

  /**
   * Simulate a transaction before sending to catch errors early
   */
  async simulateTransaction(tx: Transaction): Promise<boolean> {
    try {
      const result = await this.connection.simulateTransaction(tx);
      if (result.value.err) {
        console.error("Transaction simulation failed:", result.value.err);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Simulation error:", err);
      return false;
    }
  }
}
