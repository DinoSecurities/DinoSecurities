import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  trustedXrplCredentialIssuers,
  xrplCredentialVerifications,
} from "../db/schema.js";
import { hasBinding } from "./xrpl-bindings.js";

/**
 * XRPL Credentials (XLS-70d) verification. An alternate source of KYC
 * attestation to the platform's own oracle: an issuer on XRPL — e.g.
 * a regulated KYC provider with an XRPL identity — issues a Credential
 * object on-ledger to the holder's XRPL address. We query the ledger,
 * check the credential's issuer is on our allow-list, confirm it has
 * been accepted by the subject and is unexpired, and log the decision.
 *
 * This is a verifier-only surface. The register_holder on-chain path
 * still requires the KYC oracle's co-sign; what changes is what the
 * oracle is willing to co-sign for. With this in place the oracle has
 * two trusted inputs instead of one.
 *
 * No XRPL SDK dependency — the ledger exposes a plain JSON-RPC surface
 * that's easier to hit directly than to wrap.
 */

const NETWORKS: Record<string, string> = {
  mainnet: "https://xrplcluster.com/",
  testnet: "https://s.altnet.rippletest.net:51234/",
  devnet: "https://s.devnet.rippletest.net:51234/",
};

// XLS-70 ledger flag: credential has been accepted by the subject.
const LSF_ACCEPTED = 0x00010000;

export interface RawCredential {
  LedgerEntryType: "Credential";
  Issuer: string;
  Subject: string;
  CredentialType: string;
  Expiration?: number;
  URI?: string;
  Flags: number;
  [k: string]: unknown;
}

export interface VerifyInput {
  xrplAddress: string;
  network: "mainnet" | "testnet" | "devnet";
  requiredType?: string; // hex-encoded credentialType; if omitted, any allowed type matches
  solanaWallet?: string;
  checkedBy?: string;
  /**
   * When true, skip the wallet-binding enforcement below. Admin-only
   * ad-hoc verifications set this to `true` so they can probe any XRPL
   * address without a proved binding. Everything else — in particular
   * the register_holder integration — must leave this false.
   */
  skipBindingCheck?: boolean;
}

export interface VerifyResult {
  clean: boolean;
  reason?: string;
  credential?: RawCredential;
  trustedIssuerId?: number;
}

/**
 * Ripple Epoch is 2000-01-01T00:00:00Z in seconds. Credential.Expiration
 * is seconds since that epoch. Convert to a JS Date for comparison.
 */
const RIPPLE_EPOCH_OFFSET_SECONDS = 946_684_800;
function expiresAtJs(rippleSeconds: number | undefined): Date | null {
  if (rippleSeconds === undefined) return null;
  return new Date((rippleSeconds + RIPPLE_EPOCH_OFFSET_SECONDS) * 1000);
}

async function rpc(network: string, method: string, params: unknown): Promise<any> {
  const url = NETWORKS[network];
  if (!url) throw new Error(`unknown XRPL network: ${network}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params: [params] }),
  });
  if (!resp.ok) throw new Error(`XRPL RPC ${method} HTTP ${resp.status}`);
  const json = (await resp.json()) as { result?: { status?: string; error?: string; [k: string]: unknown } };
  if (!json.result) throw new Error(`XRPL RPC ${method}: malformed response`);
  if (json.result.status === "error") {
    throw new Error(`XRPL RPC ${method}: ${json.result.error ?? "unknown"}`);
  }
  return json.result;
}

/**
 * Pull every Credential ledger object currently held by `xrplAddress` as
 * the subject. Pages via marker until the ledger stops returning one.
 */
async function listCredentials(
  xrplAddress: string,
  network: string,
): Promise<RawCredential[]> {
  const all: RawCredential[] = [];
  let marker: unknown = undefined;
  for (let page = 0; page < 10; page++) {
    const res = await rpc(network, "account_objects", {
      account: xrplAddress,
      type: "credential",
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    });
    const objs = (res.account_objects ?? []) as RawCredential[];
    all.push(...objs.filter((o) => o.LedgerEntryType === "Credential"));
    if (!res.marker) break;
    marker = res.marker;
  }
  return all;
}

export async function verifyXrplCredential(input: VerifyInput): Promise<VerifyResult> {
  const trustedRows = await db
    .select()
    .from(trustedXrplCredentialIssuers)
    .where(
      and(
        eq(trustedXrplCredentialIssuers.network, input.network),
        eq(trustedXrplCredentialIssuers.active, true),
      ),
    );

  const record = async (result: VerifyResult, xrplIssuer?: string) => {
    await db.insert(xrplCredentialVerifications).values({
      solanaWallet: input.solanaWallet ?? null,
      xrplAddress: input.xrplAddress,
      xrplIssuer: xrplIssuer ?? null,
      credentialType: input.requiredType ?? null,
      network: input.network,
      clean: result.clean,
      reason: result.reason ?? null,
      rawCredential: result.credential ?? null,
      checkedBy: input.checkedBy ?? null,
    });
    return result;
  };

  if (trustedRows.length === 0) {
    return record({ clean: false, reason: "no trusted XRPL issuers configured for this network" });
  }

  if (!input.skipBindingCheck) {
    if (!input.solanaWallet) {
      return record({
        clean: false,
        reason: "solanaWallet required for binding-checked verification",
      });
    }
    const bound = await hasBinding(input.solanaWallet, input.xrplAddress);
    if (!bound) {
      return record({
        clean: false,
        reason: "no proved binding between this Solana wallet and XRPL address",
      });
    }
  }

  let credentials: RawCredential[];
  try {
    credentials = await listCredentials(input.xrplAddress, input.network);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return record({ clean: false, reason: `XRPL RPC failure: ${message}` });
  }

  if (credentials.length === 0) {
    return record({ clean: false, reason: "subject holds no credentials on this network" });
  }

  const now = new Date();

  for (const cred of credentials) {
    const trusted = trustedRows.find(
      (r) => r.xrplAddress === cred.Issuer &&
        (r.credentialTypes.length === 0 || r.credentialTypes.includes(cred.CredentialType)),
    );
    if (!trusted) continue;

    if (input.requiredType && cred.CredentialType !== input.requiredType) continue;

    if ((cred.Flags & LSF_ACCEPTED) === 0) continue;

    const expiresAt = expiresAtJs(cred.Expiration);
    if (expiresAt && expiresAt <= now) continue;

    return record(
      { clean: true, credential: cred, trustedIssuerId: trusted.id },
      cred.Issuer,
    );
  }

  return record({
    clean: false,
    reason: "no credential from a trusted issuer is currently valid for this subject",
  });
}
