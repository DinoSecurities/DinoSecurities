import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { PROGRAM_IDS } from "@/lib/solana";
import dinoCoreIdl from "@/idl/dino_core.json";

export interface OnChainOrder {
  pda: string;
  creator: string;
  side: "Buy" | "Sell";
  securityMint: string;
  paymentMint: string;
  tokenAmount: number;
  paymentAmount: number;
  expiresAt: number;
  nonce: string;
  status: "Open" | "Cancelled" | "Settled" | "Expired";
  createdAt: number;
}

const coder = new BorshAccountsCoder(dinoCoreIdl as Idl);
const ORDER_DISCRIMINATOR: Buffer = (() => {
  const acct = (dinoCoreIdl as any).accounts?.find((a: any) => a.name === "SettlementOrder");
  return Buffer.from(acct?.discriminator ?? []);
})();

function decode(data: Buffer): OnChainOrder | null {
  const d: any = coder.decode("SettlementOrder", data);
  const sideKey = Object.keys(d.side ?? {})[0] ?? "buy";
  const statusKey = Object.keys(d.status ?? {})[0] ?? "open";
  return {
    pda: "", // filled by caller
    creator: d.creator.toBase58(),
    side: sideKey === "sell" ? "Sell" : "Buy",
    securityMint: d.security_mint?.toBase58?.() ?? d.securityMint?.toBase58?.(),
    paymentMint: d.payment_mint?.toBase58?.() ?? d.paymentMint?.toBase58?.(),
    tokenAmount: Number(d.token_amount ?? d.tokenAmount ?? 0),
    paymentAmount: Number(d.payment_amount ?? d.paymentAmount ?? 0),
    expiresAt: Number(d.expires_at ?? d.expiresAt ?? 0),
    nonce: String(d.nonce ?? "0"),
    status: (statusKey.charAt(0).toUpperCase() + statusKey.slice(1)) as OnChainOrder["status"],
    createdAt: Number(d.created_at ?? d.createdAt ?? 0),
  };
}

/**
 * Fetch all SettlementOrder PDAs for dino_core. Optionally filtered by mint.
 */
export function useOnChainOrders(opts: { mint?: string; creator?: string } = {}) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["onChainOrders", opts.mint, opts.creator],
    queryFn: async (): Promise<OnChainOrder[]> => {
      if (ORDER_DISCRIMINATOR.length !== 8) return [];
      const accounts = await connection.getProgramAccounts(PROGRAM_IDS.DINO_CORE, {
        commitment: "confirmed",
        filters: [{ memcmp: { offset: 0, bytes: bs58.encode(ORDER_DISCRIMINATOR) } }],
      });
      const out: OnChainOrder[] = [];
      for (const { pubkey, account } of accounts) {
        try {
          const o = decode(account.data as Buffer);
          if (!o) continue;
          o.pda = pubkey.toBase58();
          if (opts.mint && o.securityMint !== opts.mint) continue;
          if (opts.creator && o.creator !== opts.creator) continue;
          out.push(o);
        } catch {
          // skip un-decodeable
        }
      }
      // Newest first.
      out.sort((a, b) => b.createdAt - a.createdAt);
      return out;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useMyOrders() {
  const { publicKey } = useWallet();
  return useOnChainOrders({ creator: publicKey?.toBase58() });
}
