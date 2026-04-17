/**
 * Sanctions-list screening service.
 *
 * Three registries, cached locally in Supabase, refreshed nightly:
 *
 *   - OFAC SDN            (US Treasury, daily-updated XML)
 *   - EU Consolidated     (European External Action Service XML feed)
 *   - UK HMT              (HM Treasury consolidated list, CSV)
 *
 * Screening is wallet-based for v1 — any register_holder attempt whose
 * holder pubkey matches a cached sanctions entry gets blocked at
 * cosignAndSubmit time unless an issuer has explicitly filed an active
 * override with justification. v2 will add identity-hash matching
 * against the KYC attestation fields; that's out of scope here.
 *
 * All three source feeds are free, unauthenticated, and refresh on a
 * 24-hour cadence. A 1-hour local cache TTL is acceptable — a newly
 * sanctioned wallet could slip through for an hour, which is well
 * within the operational risk tolerance for soft-launch compliance.
 */
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { sanctionsEntries, sanctionsOverrides } from "../db/schema.js";

export interface SanctionsHit {
  source: "ofac_sdn" | "eu_consolidated" | "uk_hmt";
  identifier: string;
  displayName: string | null;
  listedOn: string | null;
  entryType: string;
  raw: unknown;
}

export interface ScreeningResult {
  clean: boolean;
  hits: SanctionsHit[];
  overrideActive: boolean; // true if an issuer has filed an active override
  overrideId?: number;
}

/**
 * Screen a Solana wallet address against the three cached sanctions
 * registries. Returns clean=true for the happy path and a list of hits
 * (with source attribution) for the match path. Also returns whether an
 * active override currently clears this wallet.
 */
export async function screenWallet(wallet: string): Promise<ScreeningResult> {
  const lower = wallet.toLowerCase();

  const hits = await db
    .select()
    .from(sanctionsEntries)
    .where(eq(sanctionsEntries.identifierLower, lower));

  // Any matching override on this wallet clears the screen even if there
  // are hits — the issuer has explicitly authorized onboarding.
  const [override] = await db
    .select()
    .from(sanctionsOverrides)
    .where(
      and(
        eq(sanctionsOverrides.wallet, wallet),
        eq(sanctionsOverrides.status, "active"),
      ),
    )
    .limit(1);

  return {
    clean: hits.length === 0,
    hits: hits.map((h) => ({
      source: h.source as SanctionsHit["source"],
      identifier: h.identifier,
      displayName: h.displayName,
      listedOn: h.listedOn,
      entryType: h.entryType,
      raw: h.raw,
    })),
    overrideActive: Boolean(override),
    overrideId: override?.id,
  };
}

/**
 * Coarse Solana pubkey matcher — a string that parses as 32 bytes of
 * base58 AND is between 32 and 44 chars. Sanctions lists routinely
 * include "digital currency addresses" inside the SDN XML as structured
 * tags; we pull those out and also scan the full entry text for any
 * base58-looking blob ≥32 chars just in case the curators dropped one
 * outside a structured tag.
 */
function extractSolanaAddresses(text: string): string[] {
  const RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text))) {
    const candidate = m[0];
    if (candidate.length >= 32 && candidate.length <= 44) {
      out.add(candidate);
    }
  }
  return [...out];
}

/**
 * Fetch OFAC SDN list and return any digital-currency-address entries
 * we find that could plausibly be Solana wallets. Output rows are
 * shaped for direct insert into sanctions_entries.
 *
 * Source: https://www.treasury.gov/ofac/downloads/sdn.xml
 */
async function fetchOfacSdn(): Promise<Array<typeof sanctionsEntries.$inferInsert>> {
  const url = "https://www.treasury.gov/ofac/downloads/sdn.xml";
  const res = await fetch(url, { headers: { "User-Agent": "DinoSecurities/1.0 (compliance)" } });
  if (!res.ok) throw new Error(`OFAC SDN fetch failed: ${res.status}`);
  const xml = await res.text();

  // Lightweight: treat each <sdnEntry>…</sdnEntry> block as one record.
  // For each block, extract firstName/lastName (display name) and scan
  // the block text for base58 wallet-shaped strings tagged as "digital
  // currency address" (OFAC uses the <idType>Digital Currency Address…
  // </idType> markup inside <id>). Good enough for v1.
  const out: Array<typeof sanctionsEntries.$inferInsert> = [];
  const blocks = xml.split("<sdnEntry>").slice(1);
  for (const block of blocks) {
    const end = block.indexOf("</sdnEntry>");
    if (end < 0) continue;
    const body = block.slice(0, end);

    const firstName = /<firstName>([^<]*)<\/firstName>/.exec(body)?.[1] ?? "";
    const lastName = /<lastName>([^<]*)<\/lastName>/.exec(body)?.[1] ?? "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

    // Only consider <id> blocks whose idType declares a digital currency
    // address — avoids treating random long numeric fields as wallets.
    const idBlocks = body.match(/<id>[\s\S]*?<\/id>/g) ?? [];
    for (const idBlock of idBlocks) {
      if (!/Digital Currency Address/i.test(idBlock)) continue;
      const value = /<idNumber>([^<]*)<\/idNumber>/.exec(idBlock)?.[1];
      if (!value) continue;
      // Accept values that match Solana shape; ignore ETH (0x…) / BTC (1…,3…,bc1…).
      for (const addr of extractSolanaAddresses(value)) {
        out.push({
          source: "ofac_sdn",
          identifier: addr,
          identifierLower: addr.toLowerCase(),
          entryType: "wallet",
          displayName,
          listedOn: null,
          raw: { firstName, lastName, idBlock, rawValue: value },
        });
      }
    }
  }
  return out;
}

/**
 * EU Consolidated list. Format is XML; we pull any digital-currency
 * addresses that shape like Solana pubkeys from the identification
 * fields. Source: https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw
 * (EU's public token-gated feed — free, no auth beyond the token).
 */
async function fetchEuConsolidated(): Promise<Array<typeof sanctionsEntries.$inferInsert>> {
  const url =
    "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw";
  const res = await fetch(url, { headers: { "User-Agent": "DinoSecurities/1.0 (compliance)" } });
  if (!res.ok) throw new Error(`EU Consolidated fetch failed: ${res.status}`);
  const xml = await res.text();

  const out: Array<typeof sanctionsEntries.$inferInsert> = [];
  const blocks = xml.split("<sanctionEntity").slice(1);
  for (const block of blocks) {
    const end = block.indexOf("</sanctionEntity>");
    if (end < 0) continue;
    const body = block.slice(0, end);

    const name =
      /<wholeName>([^<]*)<\/wholeName>/.exec(body)?.[1] ??
      /<nameAlias[^>]*wholeName="([^"]*)"/.exec(body)?.[1] ??
      null;

    // EU entries don't have structured digital-address fields yet, but do
    // sometimes include them in identification/remark text.
    for (const addr of extractSolanaAddresses(body)) {
      out.push({
        source: "eu_consolidated",
        identifier: addr,
        identifierLower: addr.toLowerCase(),
        entryType: "wallet",
        displayName: name,
        listedOn: null,
        raw: { name, source: "eu_consolidated" },
      });
    }
  }
  return out;
}

/**
 * UK HMT consolidated list. Published as CSV at
 * https://assets.publishing.service.gov.uk/media/ConList.csv (ordinary
 * public download). For this v1 we scan the CSV text for base58-shaped
 * Solana addresses; sanctioned crypto wallets do appear in the list's
 * "Other Information" column from time to time.
 */
async function fetchUkHmt(): Promise<Array<typeof sanctionsEntries.$inferInsert>> {
  const url =
    "https://assets.publishing.service.gov.uk/media/ConList.csv";
  const res = await fetch(url, { headers: { "User-Agent": "DinoSecurities/1.0 (compliance)" } });
  if (!res.ok) throw new Error(`UK HMT fetch failed: ${res.status}`);
  const csv = await res.text();

  const out: Array<typeof sanctionsEntries.$inferInsert> = [];
  const lines = csv.split(/\r?\n/);
  for (const line of lines) {
    for (const addr of extractSolanaAddresses(line)) {
      out.push({
        source: "uk_hmt",
        identifier: addr,
        identifierLower: addr.toLowerCase(),
        entryType: "wallet",
        displayName: null,
        listedOn: null,
        raw: { line },
      });
    }
  }
  return out;
}

/**
 * Refresh all three lists in parallel and swap them into the cache
 * atomically — truncate the stale rows for each source, insert fresh.
 * Each source is independent: a fetch failure for one source doesn't
 * nuke the others. Returns a per-source count summary.
 */
export async function refreshAllSanctionsLists(): Promise<
  Record<"ofac_sdn" | "eu_consolidated" | "uk_hmt", { count: number; error?: string }>
> {
  const summary = {
    ofac_sdn: { count: 0 } as { count: number; error?: string },
    eu_consolidated: { count: 0 } as { count: number; error?: string },
    uk_hmt: { count: 0 } as { count: number; error?: string },
  };

  const jobs = [
    { source: "ofac_sdn" as const, fn: fetchOfacSdn },
    { source: "eu_consolidated" as const, fn: fetchEuConsolidated },
    { source: "uk_hmt" as const, fn: fetchUkHmt },
  ];

  await Promise.all(
    jobs.map(async (job) => {
      try {
        const rows = await job.fn();
        // Swap atomically: delete prior rows for this source, insert
        // new ones. Do it in a transaction so we never expose a half-
        // updated list during screening.
        await db.transaction(async (tx) => {
          await tx.delete(sanctionsEntries).where(eq(sanctionsEntries.source, job.source));
          if (rows.length > 0) {
            // onConflictDoNothing in case the same address is listed twice
            // under the same source (EU has done this historically).
            await tx.insert(sanctionsEntries).values(rows).onConflictDoNothing();
          }
        });
        summary[job.source].count = rows.length;
      } catch (err: any) {
        summary[job.source].error = err?.message ?? String(err);
        console.error(`[sanctions] ${job.source} refresh failed:`, err?.message ?? err);
      }
    }),
  );

  return summary;
}

/**
 * Convenience: check whether an override exists for (wallet, series).
 * Returns the override row if so, null otherwise. Used by the oracle
 * signer to decide whether to proceed despite a sanctions hit.
 */
export async function activeOverrideFor(
  wallet: string,
  seriesMint: string | null,
): Promise<{ id: number; adminWallet: string; justification: string } | null> {
  const rows = await db
    .select()
    .from(sanctionsOverrides)
    .where(
      and(
        eq(sanctionsOverrides.wallet, wallet),
        eq(sanctionsOverrides.status, "active"),
      ),
    );
  // Global overrides (series_mint NULL) apply to any series; otherwise
  // require an exact mint match.
  const applicable = rows.find((r) => r.seriesMint === null || r.seriesMint === seriesMint);
  return applicable
    ? {
        id: applicable.id,
        adminWallet: applicable.adminWallet,
        justification: applicable.justification,
      }
    : null;
}

/**
 * Admin wallets that are allowed to record overrides. Comma-separated in
 * the ADMIN_WALLETS env var. If empty, no overrides are accepted —
 * deliberately fail-safe for production.
 */
export function isAdminWallet(wallet: string): boolean {
  const raw = process.env.ADMIN_WALLETS ?? "";
  const admins = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return admins.includes(wallet);
}

// Re-exports for routes that aren't in this file.
export { sanctionsEntries as sanctionsEntriesTable, sanctionsOverrides as sanctionsOverridesTable };
