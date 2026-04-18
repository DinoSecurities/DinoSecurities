/**
 * @dinosecurities/sdk — TypeScript SDK for DinoSecurities
 *
 * The shortest path from "npm install" to shipping an integration.
 * Exposes PDA derivation, instruction builders for the most-used
 * flows, a typed tRPC client factory, the three Anchor IDLs, and
 * hash-verification helpers for Ricardian doc workflows.
 */

export * from "./constants.js";
export * from "./pdas.js";
export * from "./instructions.js";
export * from "./client.js";
export * from "./compliance.js";
export * from "./util.js";
export {
  dinoCoreIdl,
  dinoTransferHookIdl,
  dinoGovernanceIdl,
} from "./idl.js";
