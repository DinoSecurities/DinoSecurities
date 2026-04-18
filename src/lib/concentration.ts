/**
 * Concentration metrics for a holder base. All computations are pure
 * functions of a sorted balance list — the hook that produces the list
 * fetches token accounts directly via getProgramAccounts; this file is
 * the numeric core.
 *
 * Regulatory framing: concentration disclosures show up in Reg CF and
 * Reg A+ periodic reports and in many foreign equivalents. These are
 * the standard three: HHI (market-structure), top-N shares (headline),
 * Gini (wealth-distribution).
 */

export interface ConcentrationStats {
  holderCount: number;
  totalSupply: bigint;
  hhi: number;
  hhiLabel: "competitive" | "moderate" | "highly concentrated";
  top5Share: number;
  top10Share: number;
  top25Share: number;
  gini: number;
  /** Rows ready to plot: top-25 individually, plus an "Others" bucket. */
  rows: Array<{ label: string; owner: string | null; share: number }>;
}

export function computeConcentration(
  balances: Array<{ owner: string; amount: bigint }>,
): ConcentrationStats | null {
  if (balances.length === 0) return null;

  const filtered = balances.filter((b) => b.amount > 0n);
  if (filtered.length === 0) return null;

  const sorted = [...filtered].sort((a, b) =>
    a.amount < b.amount ? 1 : a.amount > b.amount ? -1 : 0,
  );
  const total = sorted.reduce((acc, b) => acc + b.amount, 0n);
  if (total === 0n) return null;

  // HHI = Σ(share * 10_000)² / 10_000 — done with bigint-safe numerics:
  // a single share is tiny, so convert to Number after dividing.
  const totalNum = Number(total);
  const shares = sorted.map((b) => Number(b.amount) / totalNum);
  const hhi = shares.reduce((acc, s) => acc + s * s, 0) * 10_000;

  const hhiLabel: ConcentrationStats["hhiLabel"] =
    hhi < 1500 ? "competitive" : hhi <= 2500 ? "moderate" : "highly concentrated";

  const topNShare = (n: number): number =>
    shares.slice(0, Math.min(n, shares.length)).reduce((a, s) => a + s, 0);

  // Gini: 1 - 2*B where B is the area under the Lorenz curve, equivalently
  //   G = (Σ (2i - n - 1) * xi) / (n * Σxi)     with xi sorted ascending.
  const asc = [...shares].reverse();
  const n = asc.length;
  const sumX = asc.reduce((a, s) => a + s, 0);
  const gini = sumX === 0
    ? 0
    : asc.reduce((acc, x, i) => acc + (2 * (i + 1) - n - 1) * x, 0) / (n * sumX);

  // Plot rows: top-25 by share, each labeled Rank #N with truncated owner.
  const TOP_N = 25;
  const rows: ConcentrationStats["rows"] = sorted
    .slice(0, TOP_N)
    .map((b, i) => ({
      label: `#${i + 1}`,
      owner: truncateOwner(b.owner),
      share: Number(b.amount) / totalNum,
    }));
  if (sorted.length > TOP_N) {
    const rest = sorted.slice(TOP_N).reduce((acc, b) => acc + b.amount, 0n);
    rows.push({
      label: "Others",
      owner: null,
      share: Number(rest) / totalNum,
    });
  }

  return {
    holderCount: sorted.length,
    totalSupply: total,
    hhi,
    hhiLabel,
    top5Share: topNShare(5),
    top10Share: topNShare(10),
    top25Share: topNShare(25),
    gini,
    rows,
  };
}

function truncateOwner(owner: string): string {
  if (owner.length <= 10) return owner;
  return `${owner.slice(0, 4)}…${owner.slice(-4)}`;
}
