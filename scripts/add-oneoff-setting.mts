/**
 * Adds `households.exclude_one_offs` (default true): whether entries flagged
 * one-off are left out of the budget, savings and incentive. The total spent
 * always includes them; only what is measured against the budget changes.
 *
 * Idempotent. Run against production BEFORE deploying the code that reads it:
 *
 *   npx tsx --env-file=.env scripts/add-oneoff-setting.mts
 *   DATABASE_URL="$(grep -oE 'postgresql?://[^ ]+' .env.prod-backup | head -1)" \
 *     npx tsx scripts/add-oneoff-setting.mts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);
console.log(`Adding households.exclude_one_offs on ${url.match(/@([^/]+)/)?.[1] ?? "unknown"}`);
await sql`alter table households add column if not exists exclude_one_offs boolean not null default true`;
console.log("Done.");
