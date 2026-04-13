import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { env } from "../env.js";

// Supabase requires SSL. `prepare: false` is required when connecting via the
// pgbouncer pooler (port 6543); harmless on the direct connection (5432).
const isSupabase = env.DATABASE_URL.includes("supabase.co");
const client = postgres(env.DATABASE_URL, {
  ssl: isSupabase ? "require" : undefined,
  prepare: !isSupabase,
  max: 10,
});
export const db = drizzle(client, { schema });
export type Database = typeof db;
