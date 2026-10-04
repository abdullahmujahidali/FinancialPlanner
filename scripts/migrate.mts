/**
 * Apply pending migrations from ./drizzle — the only way schema changes reach
 * a database. Replaces the old one-off scripts/add-*.mts files, which had to be
 * remembered and run by hand against each database and let dev and production
 * drift apart.
 *
 *   npm run db:migrate         # development (.env)
 *   npm run db:migrate:prod    # production  (.env.prod-backup)
 *
 * To change the schema: edit src/db/schema.ts, run `npm run db:generate`,
 * commit the new drizzle/*.sql, then migrate production BEFORE pushing the code.
 *
 * Both databases predate this setup. On a database that already has tables but
 * no migration history, 0000_baseline is recorded as applied rather than run,
 * because its tables are already there. A fresh database runs it in full.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);
const host = url.match(/@([^/]+)/)?.[1] ?? "unknown";
console.log(`Migrating ${host}`);

const migrationsFolder = "drizzle";
const files = readMigrationFiles({ migrationsFolder });

await sql`create schema if not exists drizzle`;
await sql`
  create table if not exists drizzle.__drizzle_migrations (
    id serial primary key,
    hash text not null,
    created_at bigint
  )`;

const [{ n }] = (await sql`select count(*)::int as n from drizzle.__drizzle_migrations`) as Array<{ n: number }>;
if (n === 0) {
  const [{ t }] = (await sql`select to_regclass('public.households') as t`) as Array<{ t: string | null }>;
  if (t) {
    const base = files[0];
    await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${base.hash}, ${base.folderMillis})`;
    console.log("Existing database: recorded 0000_baseline as already applied.");
  }
}

await migrate(drizzle(sql), { migrationsFolder });

const done = (await sql`select count(*)::int as n from drizzle.__drizzle_migrations`) as Array<{ n: number }>;
console.log(`Done. ${done[0].n} of ${files.length} migrations recorded.`);
