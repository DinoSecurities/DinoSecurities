/**
 * Minimal: run the Transfer Hook compliance check off-chain against
 * a (wallet, mint) pair. Returns a step-by-step pass/fail breakdown
 * without submitting a transaction.
 *
 *   WALLET=…  MINT=…  npx tsx examples/simulate-compliance.ts
 */
import { simulateCompliance } from "@dinosecurities/sdk";

const wallet = process.env.WALLET;
const mint = process.env.MINT;
if (!wallet || !mint) {
  console.error("set WALLET and MINT env vars");
  process.exit(1);
}

async function main() {
  const result = await simulateCompliance({ wallet: wallet!, mint: mint! });
  console.log(`overall: ${result.overall}`);
  for (const c of result.checks) {
    const mark = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "·";
    console.log(`  ${mark} ${c.name}${c.detail ? " — " + c.detail : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
