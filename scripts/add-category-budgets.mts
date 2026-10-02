/**
 * Adds `categories.monthly_budget`: an optional per-category share of the
 * household budget (Petrol Rs 40,000, Groceries Rs 60,000 …), so the dashboard
 * can show each category against its own plan, not only the grand total.
 *
 * Idempotent. Run against production BEFORE deploying the code that reads it:
 *
 *   npx tsx --env-file=.env scripts/add-category-budgets.mts
 *   DATABASE_URL="$(grep -oE 'postgresql?://[^ ]+' .env.prod-backup | head -1)" \
 *     npx tsx scripts/add-category-budgets.mts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);
console.log(`Adding categories.monthly_budget on ${url.match(/@([^/]+)/)?.[1] ?? "unknown"}`);
await sql`alter table categories add column if not exists monthly_budget numeric(14,2)`;
console.log("Done.");
