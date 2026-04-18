/**
 * Minimal: list every SecuritySeries on the DinoSecurities platform.
 *
 *   npx tsx examples/list-series.ts
 */
import { createDinoClient } from "@dinosecurities/sdk";

const dino = createDinoClient();

async function main() {
  const { items } = await dino.securities.list.query({ page: 1, limit: 20 });
  for (const s of items) {
    console.log(`${s.symbol.padEnd(8)} ${s.name}  mint=${s.mintAddress}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
