import type { Idl } from "@coral-xyz/anchor";
import dinoCoreJson from "../idl/dino_core.json";
import dinoTransferHookJson from "../idl/dino_transfer_hook.json";
import dinoGovernanceJson from "../idl/dino_governance.json";

/**
 * The three Anchor IDLs, snapshotted at SDK build time from the
 * canonical copies under src/idl/ in the DinoSecurities monorepo.
 *
 * These are regenerated on `npm run prebuild`. When the programs
 * upgrade, republish the SDK with a matching semver bump; the IDLs
 * are part of the public surface.
 */
export const dinoCoreIdl = dinoCoreJson as Idl;
export const dinoTransferHookIdl = dinoTransferHookJson as Idl;
export const dinoGovernanceIdl = dinoGovernanceJson as Idl;
