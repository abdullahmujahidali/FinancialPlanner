/**
 * Creates the `loans` and `loan_payments` tables.
 *
 * Idempotent (IF NOT EXISTS throughout), so it is safe to re-run and safe to
 * apply to a database that already has them.
 *
 * There are TWO databases and `.env` is the development one. This must be run
 * against BOTH, production first or at least before the code that reads these
 * tables is deployed:
 *
 *   npx tsx --env-file=.env scripts/add-loans.mts
 *   DATABASE_URL="$(grep -oE 'postgresql?://[^ ]+' .env.prod-backup | head -1)" \
 *     npx tsx scripts/add-loans.mts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const host = url.match(/@([^/]+)/)?.[1] ?? "unknown";
console.log(`Applying loan tables to ${host}`);

await sql`
  create table if not exists loans (
    id serial primary key,
    household_id integer not null references households(id),
    direction text not null,
    counterparty text not null,
    principal numeric(14,2) not null,
    started_on date not null,
    due_on date,
    note text,
    status text not null default 'open',
    settled_on date,
    created_by integer references users(id),
    created_at timestamp not null default now()
  )`;

await sql`create index if not exists loans_household on loans (household_id, status)`;

await sql`
  create table if not exists loan_payments (
    id serial primary key,
    loan_id integer not null references loans(id),
    amount numeric(14,2) not null,
    paid_on date not null,
    note text,
    transaction_id integer references transactions(id),
    created_by integer references users(id),
    created_at timestamp not null default now()
  )`;

await sql`create index if not exists loan_payments_loan on loan_payments (loan_id)`;

const [{ loans, payments }] = await sql`
  select
    (select count(*) from loans) as loans,
    (select count(*) from loan_payments) as payments` as Array<{
  loans: string;
  payments: string;
}>;

console.log(`Done. loans=${loans} loan_payments=${payments}`);
