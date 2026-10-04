/**
 * Adds `loans.asset_id`, linking a loan to the asset it is paying for
 * (installment purchases: a plot with a token payment, a car on a plan).
 *
 * Additive and idempotent, so safe to re-run and safe to apply before the code
 * that reads it ships. Run against BOTH databases, production before deploy:
 *
 *   npx tsx --env-file=.env scripts/add-asset-loans.mts
 *   DATABASE_URL="$(grep -oE 'postgresql?://[^ ]+' .env.prod-backup | head -1)" \
 *     npx tsx scripts/add-asset-loans.mts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const host = url.match(/@([^/]+)/)?.[1] ?? "unknown";
console.log(`Adding loans.asset_id on ${host}`);

await sql`
  alter table loans
  add column if not exists asset_id integer references assets(id) on delete set null`;

const [{ n }] = (await sql`select count(*) as n from loans where asset_id is not null`) as Array<{ n: string }>;
console.log(`Done. loans linked to an asset: ${n}`);
