import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { issuerBranding } from "../db/schema.js";
import { dinoTierFor } from "./dino-balance.js";

/**
 * Tier-gated issuer branding surface. Gates:
 *   - accentColor   Bronze (tier >= 1)
 *   - logoUri       Silver (tier >= 2)
 *   - hideEmbedFooter  Gold (tier >= 3)
 *
 * Each field is checked at write time against the server-authoritative
 * $DINO balance — a client cannot fake a tier to unlock a setting
 * they're not eligible for. Past settings survive a tier drop.
 */

export interface BrandingInput {
  accentColor?: string | null;
  logoUri?: string | null;
  hideEmbedFooter?: boolean;
}

export interface BrandingRecord {
  issuerWallet: string;
  accentColor: string | null;
  logoUri: string | null;
  hideEmbedFooter: boolean;
  tierAtWrite: number;
  updatedAt: Date;
}

function rowToRecord(row: any): BrandingRecord {
  return {
    issuerWallet: row.issuerWallet,
    accentColor: row.accentColor,
    logoUri: row.logoUri,
    hideEmbedFooter: row.hideEmbedFooter,
    tierAtWrite: row.tierAtWrite,
    updatedAt: row.updatedAt,
  };
}

export async function getBrandingFor(
  issuerWallet: string,
): Promise<BrandingRecord | null> {
  const [row] = await db
    .select()
    .from(issuerBranding)
    .where(eq(issuerBranding.issuerWallet, issuerWallet))
    .limit(1);
  return row ? rowToRecord(row) : null;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateBranding(
  issuerWallet: string,
  input: BrandingInput,
): Promise<BrandingRecord> {
  const { tier } = await dinoTierFor(issuerWallet);

  if (input.accentColor) {
    if (tier.id < 1) {
      throw new Error("Bronze tier (100,000 $DINO) required to set a custom accent color");
    }
    if (!HEX_COLOR.test(input.accentColor)) {
      throw new Error("accent color must be a 6-digit hex value, e.g. #22c55e");
    }
  }
  if (input.logoUri) {
    if (tier.id < 2) {
      throw new Error("Silver tier (1,000,000 $DINO) required to set a custom logo");
    }
    if (!/^https?:\/\//.test(input.logoUri) && !input.logoUri.startsWith("ar://")) {
      throw new Error("logo URI must be an https:// or ar:// URL");
    }
  }
  if (input.hideEmbedFooter) {
    if (tier.id < 3) {
      throw new Error("Gold tier (5,000,000 $DINO) required to remove the embed footer");
    }
  }

  const existing = await getBrandingFor(issuerWallet);
  const next = {
    issuerWallet,
    accentColor:
      input.accentColor !== undefined ? input.accentColor : existing?.accentColor ?? null,
    logoUri: input.logoUri !== undefined ? input.logoUri : existing?.logoUri ?? null,
    hideEmbedFooter:
      input.hideEmbedFooter !== undefined
        ? input.hideEmbedFooter
        : existing?.hideEmbedFooter ?? false,
    tierAtWrite: tier.id,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(issuerBranding)
      .set({
        accentColor: next.accentColor,
        logoUri: next.logoUri,
        hideEmbedFooter: next.hideEmbedFooter,
        tierAtWrite: next.tierAtWrite,
        updatedAt: next.updatedAt,
      })
      .where(eq(issuerBranding.issuerWallet, issuerWallet));
  } else {
    await db.insert(issuerBranding).values(next);
  }

  return {
    issuerWallet,
    accentColor: next.accentColor,
    logoUri: next.logoUri,
    hideEmbedFooter: next.hideEmbedFooter,
    tierAtWrite: next.tierAtWrite,
    updatedAt: next.updatedAt,
  };
}
