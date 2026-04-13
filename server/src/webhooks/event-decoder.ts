import { BorshEventCoder, type Idl } from "@coral-xyz/anchor";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";

export interface DinoEvent {
  name: string;
  data: any;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Anchor event log line format:
 *   "Program data: <base64-encoded(8-byte-disc + borsh-event-data)>"
 *
 * We try each program's IDL coder until one decodes successfully. Unknown
 * data lines are silently skipped — common cases are non-event program
 * logs that happen to be base64-shaped.
 */
const coders = loadCoders();

function loadCoders(): { id: string; coder: BorshEventCoder }[] {
  const idlDir = path.resolve(__dirname, "../../../programs/target/idl");
  const programs = [
    { id: env.DINO_CORE_PROGRAM_ID, file: "dino_core.json" },
    { id: env.DINO_GOV_PROGRAM_ID, file: "dino_governance.json" },
    { id: env.DINO_HOOK_PROGRAM_ID, file: "dino_transfer_hook.json" },
  ];
  const out: { id: string; coder: BorshEventCoder }[] = [];
  for (const p of programs) {
    const fp = path.join(idlDir, p.file);
    if (!fs.existsSync(fp)) continue;
    try {
      const idl = JSON.parse(fs.readFileSync(fp, "utf8")) as Idl;
      out.push({ id: p.id, coder: new BorshEventCoder(idl) });
    } catch (err) {
      console.warn(`failed to load IDL ${p.file}:`, err);
    }
  }
  return out;
}

const EVENT_PREFIX = "Program data: ";

export function decodeProgramEvents(logs: string[]): DinoEvent[] {
  const events: DinoEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith(EVENT_PREFIX)) continue;
    const data = line.slice(EVENT_PREFIX.length).trim();
    for (const { coder } of coders) {
      try {
        const decoded = coder.decode(data);
        if (decoded) {
          events.push({ name: decoded.name, data: decoded.data });
          break;
        }
      } catch {
        // Try the next coder.
      }
    }
  }
  return events;
}
