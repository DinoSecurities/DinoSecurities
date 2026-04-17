import { z } from "zod";
import { eq } from "drizzle-orm";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { createRequire } from "node:module";
import { router, publicProcedure } from "../trpc.js";
import { env } from "../env.js";
import { indexedSeries, indexedHolders } from "../db/schema.js";

const require = createRequire(import.meta.url);
const dinoCoreIdl = require("../idl/dino_core.json") as Idl;

const coder = new BorshAccountsCoder(dinoCoreIdl);
const PROGRAM_ID = new PublicKey(env.DINO_CORE_PROGRAM_ID);
const RPC_URL =
  env.SOLANA_RPC_FALLBACK ||
  env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

type CheckStatus = "pass" | "fail" | "warn" | "skip";
interface Check {
  id: string;
  name: string;
  status: CheckStatus;
  detail?: string;
}

function pass(id: string, name: string, detail?: string): Check {
  return { id, name, status: "pass", ...(detail ? { detail } : {}) };
}
function fail(id: string, name: string, detail: string): Check {
  return { id, name, status: "fail", detail };
}
function skip(id: string, name: string, detail: string): Check {
  return { id, name, status: "skip", detail };
}

function isValidPubkey(s: string) {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run the hook's validation logic off-chain, read-only. Mirrors the
 * exact sequence dino_transfer_hook::execute performs on the dest
 * account of every token transfer. Any divergence between this
 * simulator and the on-chain hook is a bug — keep the two in lockstep.
 */
export const complianceRouter = router({
  simulate: publicProcedure
    .input(
      z.object({
        wallet: z.string().min(32).max(44),
        mint: z.string().min(32).max(44),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Validate inputs up front so the user gets a useful message instead
      // of a cryptic Anchor deserialize error.
      if (!isValidPubkey(input.wallet)) {
        return {
          pass: false,
          checks: [fail("input.wallet", "Valid Solana address", "Wallet is not a valid base58 pubkey")],
          series: null,
          holder: null,
        };
      }
      if (!isValidPubkey(input.mint)) {
        return {
          pass: false,
          checks: [fail("input.mint", "Valid security mint", "Mint is not a valid base58 pubkey")],
          series: null,
          holder: null,
        };
      }

      const mint = new PublicKey(input.mint);
      const wallet = new PublicKey(input.wallet);

      // Prefer the indexed row if we have one — it's fast and enough for
      // most checks. Fall back to direct on-chain reads when the indexer
      // is cold.
      const [indexedRow] = await ctx.db
        .select()
        .from(indexedSeries)
        .where(eq(indexedSeries.mintAddress, input.mint))
        .limit(1);

      const [seriesPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("series"), mint.toBuffer()],
        PROGRAM_ID,
      );
      const seriesInfo = await connection.getAccountInfo(seriesPda, "confirmed");
      if (!indexedRow && !seriesInfo) {
        return {
          pass: false,
          checks: [
            fail("series.exists", "Security series exists", `No SecuritySeries PDA at ${seriesPda.toBase58()}`),
          ],
          series: null,
          holder: null,
        };
      }

      // Decode the series PDA to read transfer_restriction + paused flag.
      let paused = indexedRow?.status === "paused";
      let restriction = indexedRow?.transferRestrictions ?? "None";
      if (seriesInfo) {
        try {
          const decoded = coder.decode("SecuritySeries", seriesInfo.data) as {
            paused: boolean;
            transfer_restriction: Record<string, unknown>;
          };
          paused = !!decoded.paused;
          const key = Object.keys(decoded.transfer_restriction ?? {})[0] ?? "None";
          restriction = key.charAt(0).toUpperCase() + key.slice(1);
        } catch {
          // keep indexed fallback
        }
      }

      // HolderRecord PDA for (mint, wallet).
      const [holderPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("holder"), mint.toBuffer(), wallet.toBuffer()],
        PROGRAM_ID,
      );
      const holderInfo = await connection.getAccountInfo(holderPda, "confirmed");

      let holder: {
        isRevoked: boolean;
        isFrozen: boolean;
        isAccredited: boolean;
        kycExpiry: number;
        jurisdiction: string;
      } | null = null;
      if (holderInfo) {
        try {
          const d = coder.decode("HolderRecord", holderInfo.data) as {
            is_revoked: boolean;
            is_frozen: boolean;
            is_accredited: boolean;
            kyc_expiry: bigint | number;
            jurisdiction: number[];
          };
          holder = {
            isRevoked: !!d.is_revoked,
            isFrozen: !!d.is_frozen,
            isAccredited: !!d.is_accredited,
            kycExpiry: Number(d.kyc_expiry),
            jurisdiction: Buffer.from(d.jurisdiction ?? []).toString().replace(/\0/g, "").trim() || "--",
          };
        } catch {
          // Indexed fallback if on-chain decode fails.
          const [row] = await ctx.db
            .select()
            .from(indexedHolders)
            .where(eq(indexedHolders.mintAddress, input.mint))
            .limit(1);
          if (row && row.wallet === input.wallet) {
            holder = {
              isRevoked: row.isRevoked,
              isFrozen: row.isFrozen,
              isAccredited: row.isAccredited,
              kycExpiry: row.kycExpiry ? Math.floor(new Date(row.kycExpiry).getTime() / 1000) : 0,
              jurisdiction: "--",
            };
          }
        }
      }

      const checks: Check[] = [];
      const nowSec = Math.floor(Date.now() / 1000);

      // Check 1: HolderRecord exists for this (mint, wallet).
      if (!holder) {
        checks.push(fail("holder.whitelisted", "Wallet is whitelisted as a holder",
          `No HolderRecord PDA at ${holderPda.toBase58()}. Issuer must register this wallet first.`));
        return {
          pass: false,
          checks,
          series: { mint: input.mint, restriction, paused },
          holder: null,
          holderPda: holderPda.toBase58(),
        };
      }
      checks.push(pass("holder.whitelisted", "Wallet is whitelisted as a holder"));

      // Check 2: Not revoked.
      if (holder.isRevoked) {
        checks.push(fail("holder.notRevoked", "KYC not revoked", "Holder has been revoked by the oracle"));
      } else {
        checks.push(pass("holder.notRevoked", "KYC not revoked"));
      }

      // Check 3: Not frozen.
      if (holder.isFrozen) {
        checks.push(fail("holder.notFrozen", "Account not frozen", "Issuer has frozen this holder"));
      } else {
        checks.push(pass("holder.notFrozen", "Account not frozen"));
      }

      // Check 4: KYC not expired.
      if (holder.kycExpiry && holder.kycExpiry <= nowSec) {
        const ago = Math.floor((nowSec - holder.kycExpiry) / 86400);
        checks.push(fail("holder.kycValid", "KYC not expired", `KYC expired ${ago} day${ago === 1 ? "" : "s"} ago`));
      } else if (holder.kycExpiry) {
        const days = Math.floor((holder.kycExpiry - nowSec) / 86400);
        checks.push(pass("holder.kycValid", "KYC not expired", `Valid for another ${days} day${days === 1 ? "" : "s"}`));
      } else {
        checks.push(skip("holder.kycValid", "KYC not expired", "No expiry recorded on the holder"));
      }

      // Check 5: Series not paused.
      if (paused) {
        checks.push(fail("series.notPaused", "Series not paused", "Issuer has called emergency_pause on this series"));
      } else {
        checks.push(pass("series.notPaused", "Series not paused"));
      }

      // Check 6: Reg D accreditation — only enforced when restriction is RegD.
      if (restriction === "RegD") {
        if (holder.isAccredited) {
          checks.push(pass("regd.accredited", "Accredited (Reg D)"));
        } else {
          checks.push(fail("regd.accredited", "Accredited (Reg D)", "Reg D requires is_accredited = true on HolderRecord"));
        }
      }

      // Check 7: Reg S geo-fence — only enforced when restriction is RegS.
      if (restriction === "RegS") {
        if (holder.jurisdiction === "US") {
          checks.push(fail("regs.nonUs", "Non-US jurisdiction (Reg S)", "Reg S bars transfers to US persons"));
        } else {
          checks.push(pass("regs.nonUs", "Non-US jurisdiction (Reg S)", `Jurisdiction on file: ${holder.jurisdiction}`));
        }
      }

      const hardFails = checks.filter((c) => c.status === "fail");

      return {
        pass: hardFails.length === 0,
        checks,
        series: { mint: input.mint, restriction, paused },
        holder,
        holderPda: holderPda.toBase58(),
      };
    }),
});
