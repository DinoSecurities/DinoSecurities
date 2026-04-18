/**
 * Minimal: derive every PDA relevant to a (mint, holder) interaction.
 *
 *   MINT=…  HOLDER=…  CORE=…  HOOK=…  npx tsx examples/derive-pdas.ts
 */
import { PublicKey } from "@solana/web3.js";
import { derivePdas } from "@dinosecurities/sdk";

const { MINT, HOLDER, CORE, HOOK } = process.env;
if (!MINT || !HOLDER || !CORE || !HOOK) {
  console.error("set MINT, HOLDER, CORE (dino_core program id), HOOK (dino_transfer_hook program id)");
  process.exit(1);
}

const pdas = derivePdas({
  mint: new PublicKey(MINT),
  holder: new PublicKey(HOLDER),
  coreProgramId: new PublicKey(CORE),
  hookProgramId: new PublicKey(HOOK),
});

console.log(JSON.stringify(
  Object.fromEntries(
    Object.entries(pdas).map(([k, v]) => [k, v?.toBase58?.() ?? null]),
  ),
  null,
  2,
));
