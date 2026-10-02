/**
 * Creates `payees`: a household's own name for a bank description
 * ("Raast P2P Fund transfer to MUHAMMAD SHAHID IQBAL PK35…" -> "Milkman").
 * Matched on the exact description, so every past and future entry from that
 * payee shows the name. Display only — stored descriptions never change.
 *
 * Idempotent. Run against production BEFORE deploying the code that reads it:
 *
 *   npx tsx --env-file=.env scripts/add-payees.mts
 *   DATABASE_URL="$(grep -oE 'postgresql?://[^ ]+' .env.prod-backup | head -1)" \
 *     npx tsx scripts/add-payees.mts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);
console.log(`Applying payees table to ${url.match(/@([^/]+)/)?.[1] ?? "unknown"}`);
await sql`
  create table if not exists payees (
    id serial primary key,
    household_id integer not null references households(id),
    match text not null,
    name text not null,
    created_at timestamp not null default now()
  )`;
await sql`create unique index if not exists payees_match on payees (household_id, match)`;
console.log("Done.");
