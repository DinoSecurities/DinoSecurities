import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { seriesPreviewListings } from "../db/schema.js";

/**
 * Preview-listing schedule for a series. The series is on-chain the
 * moment it's created; what this table gates is whether it shows up
 * in the public marketplace view. Non-Gold callers see only series
 * whose publicListingAt has passed (or who have no schedule row at
 * all). Gold callers see everything, with the ones still in their
 * preview window bucketed into /app/marketplace/upcoming.
 *
 * On-chain state is never gated by this — anyone holding the mint
 * can still see their holdings; anyone with the direct /marketplace/:mint
 * URL can still view the security. The gate is discovery, not access.
 */

export async function getSchedule(mint: string): Promise<Date | null> {
  const [row] = await db
    .select()
    .from(seriesPreviewListings)
    .where(eq(seriesPreviewListings.seriesMint, mint))
    .limit(1);
  return row?.publicListingAt ?? null;
}

export async function setSchedule(
  mint: string,
  publicListingAt: Date,
  scheduledBy: string,
): Promise<void> {
  const existing = await getSchedule(mint);
  if (existing) {
    await db
      .update(seriesPreviewListings)
      .set({ publicListingAt, scheduledBy })
      .where(eq(seriesPreviewListings.seriesMint, mint));
  } else {
    await db.insert(seriesPreviewListings).values({
      seriesMint: mint,
      publicListingAt,
      scheduledBy,
    });
  }
}

export async function clearSchedule(mint: string): Promise<void> {
  await db
    .delete(seriesPreviewListings)
    .where(eq(seriesPreviewListings.seriesMint, mint));
}

export async function previewingMints(): Promise<{ mint: string; publicListingAt: Date }[]> {
  const now = new Date();
  const rows = await db.select().from(seriesPreviewListings);
  return rows
    .filter((r) => r.publicListingAt > now)
    .map((r) => ({ mint: r.seriesMint, publicListingAt: r.publicListingAt }));
}
