import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProvider } from "@/lib/anchor";
import { DinoSettlementEngine, type CreateOrderParams } from "@/lib/settlement";
import { PROGRAM_IDS } from "@/lib/solana";
import { useMemo } from "react";
import { toast } from "sonner";

// Mock fallback
import { settlementOrders as mockOrders } from "@/lib/mockData";

/**
 * Get the settlement engine instance
 */
export function useSettlementEngine(): DinoSettlementEngine | null {
  const { connection } = useConnection();
  const provider = useAnchorProvider();

  return useMemo(() => {
    return new DinoSettlementEngine(connection, provider);
  }, [connection, provider]);
}

/**
 * Fetch all settlement orders for the connected wallet
 */
export function useSettlementOrders() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const programDeployed = !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId);

  return useQuery({
    queryKey: ["settlementOrders", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return [];

      if (!programDeployed) {
        // Return mock data
        return mockOrders;
      }

      // Fetch real SettlementOrder PDAs for this wallet
      const accounts = await connection.getProgramAccounts(PROGRAM_IDS.DINO_CORE, {
        commitment: "confirmed",
        filters: [
          // Filter by buyer or seller pubkey
          {
            memcmp: {
              offset: 8 + 32, // After discriminator + orderId string prefix
              bytes: publicKey.toBase58(),
            },
          },
        ],
      });

      // TODO: Decode accounts
      return [];
    },
    enabled: !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch the order book for a specific security (all open orders)
 */
export function useOrderBook(securityMint: PublicKey | null) {
  const { connection } = useConnection();
  const programDeployed = !PROGRAM_IDS.DINO_CORE.equals(SystemProgram.programId);

  return useQuery({
    queryKey: ["orderBook", securityMint?.toBase58()],
    queryFn: async () => {
      if (!securityMint || !programDeployed) return { buys: [], sells: [] };

      // TODO: Fetch and decode SettlementOrder accounts filtered by mint
      return { buys: [], sells: [] };
    },
    enabled: !!securityMint && programDeployed,
    staleTime: 10_000,
  });
}

/**
 * Mutation: Create a new settlement order
 */
export function useCreateSettlementOrder() {
  const engine = useSettlementEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateOrderParams) => {
      if (!engine) throw new Error("Settlement engine not ready");

      const result = await engine.createOrder(params);
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Order ${result.orderId} created`);
      queryClient.invalidateQueries({ queryKey: ["settlementOrders"] });
      queryClient.invalidateQueries({ queryKey: ["orderBook"] });
    },
    onError: (error: Error) => {
      toast.error(`Order failed: ${error.message}`);
    },
  });
}

/**
 * Mutation: Cancel a settlement order
 */
export function useCancelSettlementOrder() {
  const engine = useSettlementEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!engine) throw new Error("Settlement engine not ready");
      return engine.cancelOrder(orderId);
    },
    onSuccess: () => {
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: ["settlementOrders"] });
      queryClient.invalidateQueries({ queryKey: ["orderBook"] });
    },
    onError: (error: Error) => {
      toast.error(`Cancel failed: ${error.message}`);
    },
  });
}

/**
 * Mutation: Approve delegation for settlement
 */
export function useApproveSettlementDelegate() {
  const engine = useSettlementEngine();

  return useMutation({
    mutationFn: async (params: {
      mint: PublicKey;
      amount: number;
      settlementAgent: PublicKey;
    }) => {
      if (!engine) throw new Error("Settlement engine not ready");
      return engine.approveDelegate(params);
    },
    onSuccess: () => {
      toast.success("Delegation approved for settlement");
    },
    onError: (error: Error) => {
      toast.error(`Delegation failed: ${error.message}`);
    },
  });
}
