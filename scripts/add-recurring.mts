/**
 * Creates the `recurring` table: regular payments (maid's salary, milk, school
 * van) that come round every month and are offered on the dashboard for one-tap
 * entry instead of being typed again.
 *
 * Idempotent. There are TWO databases and `.env` is the development one. Run
 * against production BEFORE deploying the code that reads this table:
 *
 *   npx tsx --env-file=.env scripts/add-recurring.mts
 *   DATABASE_URL="$(grep -oE 'postgresql?://[^ ]+' .env.prod-backup | head -1)" \
 *     npx tsx scripts/add-recurring.mts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);
console.log(`Applying recurring table to ${url.match(/@([^/]+)/)?.[1] ?? "unknown"}`);

await sql`
  create table if not exists recurring (
    id serial primary key,
    household_id integer not null references households(id),
    description text not null,
    type text not null default 'expense',
    amount numeric(14,2) not null,
    account_id integer not null references accounts(id),
    category_id integer references categories(id),
    person_id integer references persons(id),
    is_passthrough boolean not null default false,
    day_of_month integer not null default 1,
    last_month text,
    is_archived boolean not null default false,
    created_at timestamp not null default now()
  )`;
await sql`create index if not exists recurring_household on recurring (household_id, is_archived)`;
console.log("Done.");
