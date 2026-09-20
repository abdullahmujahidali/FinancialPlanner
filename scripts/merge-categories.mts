/**
 * One-off tidy of the Sukoon household's categories.
 *
 * Two problems it fixes:
 *
 * 1. Person-shaped categories. "Kids — Haroon" encodes in a category name
 *    something the schema already models as `person_id`. Storing it twice
 *    means a row can only ever belong to one child, and the per-person
 *    breakdown cannot see any of it. Each such row is moved to a single
 *    "Kids" category and given the matching person tag, so no money moves —
 *    the fact just lands where it belongs.
 *
 * 2. Categories nobody has used. Archived, not deleted, so they can come back
 *    without losing anything.
 *
 * Runs inside one transaction and prints a plan first. Pass --apply to commit.
 *
 *   npx tsx scripts/merge-categories.mts          # dry run, changes nothing
 *   npx tsx scripts/merge-categories.mts --apply
 */
import { neon } from "@neondatabase/serverless";
import { existsSync, readFileSync } from "fs";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
const sql = neon(url);
const APPLY = process.argv.includes("--apply");
const HOUSEHOLD = "Sukoon";

/** Person-shaped category -> the category it becomes + the person to tag. */
const MERGES: Array<{ from: string; toCategory: string; person: string }> = [
  { from: "Kids — Haroon", toCategory: "Kids", person: "Haroon" },
  { from: "Kids — Fateh", toCategory: "Kids", person: "Fateh" },
  { from: "Kids — Miral", toCategory: "Kids", person: "Miral" },
  { from: "Tooba — Monthly", toCategory: "Personal / Allowance", person: "Tooba" }
];

/**
 * Unused today, and Abdullah expects to need them soon — Zakat / Charity,
 * Shopping / Clothing and Family Support are deliberately NOT in this list.
 */
const ARCHIVE = [
  "Travel / Vacation",
  "Committee / BC",
  "Freelancing (Mintvo clients)",
  "Consulting — Astel Ventures"
];

async function main() {
  const [hh] = await sql`select id, name from households where name = ${HOUSEHOLD}`;
  if (!hh) throw new Error(`No household named ${HOUSEHOLD}`);
  const hid = hh.id as number;
  console.log(`Household: ${hh.name} (id ${hid})\n`);

  const cats = await sql`select id, name from categories where household_id = ${hid}`;
  const people = await sql`select id, name from persons where household_id = ${hid}`;
  const catId = (n: string) => cats.find((c: any) => c.name === n)?.id as number | undefined;
  const personId = (n: string) => people.find((p: any) => p.name === n)?.id as number | undefined;

  console.log("MERGE — rows keep their amount and gain a person tag");
  const plan: Array<{ fromId: number; toId: number; pid: number; n: number; from: string; to: string; person: string }> = [];

  for (const m of MERGES) {
    const fromId = catId(m.from);
    if (!fromId) {
      console.log(`  (skip) ${m.from} — no such category`);
      continue;
    }
    const pid = personId(m.person);
    if (!pid) {
      console.log(`  (skip) ${m.from} — no person named ${m.person}`);
      continue;
    }

    // Create the destination category on first use.
    let toId = catId(m.toCategory);
    if (!toId) {
      if (APPLY) {
        const [made] = await sql`
          insert into categories (household_id, name) values (${hid}, ${m.toCategory})
          returning id`;
        toId = made.id as number;
        cats.push({ id: toId, name: m.toCategory } as any);
      } else {
        console.log(`  (would create category "${m.toCategory}")`);
        toId = -1;
      }
    }

    const [{ n }] = await sql`
      select count(*)::int n from transactions
      where household_id = ${hid} and category_id = ${fromId}`;
    console.log(`  ${m.from.padEnd(22)} ${String(n).padStart(2)} rows → ${m.toCategory} + person:${m.person}`);
    plan.push({ fromId, toId: toId!, pid, n, from: m.from, to: m.toCategory, person: m.person });
  }

  console.log("\nARCHIVE — hidden from pickers, history intact");
  for (const name of ARCHIVE) {
    const id = catId(name);
    if (!id) {
      console.log(`  (skip) ${name} — no such category`);
      continue;
    }
    const [{ n }] = await sql`
      select count(*)::int n from transactions
      where household_id = ${hid} and category_id = ${id}`;
    if (n > 0) {
      // Never archive something in use; that would be a silent surprise.
      console.log(`  (skip) ${name} — has ${n} rows, leaving active`);
      continue;
    }
    console.log(`  ${name}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Nothing changed. Re-run with --apply to commit.");
    return;
  }

  // --- apply, transactionally ---------------------------------------------
  const statements: any[] = [];
  for (const p of plan) {
    // Only fill in a person where the row does not already name one.
    statements.push(sql`
      update transactions set category_id = ${p.toId},
        person_id = coalesce(person_id, ${p.pid})
      where household_id = ${hid} and category_id = ${p.fromId}`);
    // Rules pointing at the old category must follow it.
    statements.push(sql`
      update import_rules set set_category_id = ${p.toId}
      where household_id = ${hid} and set_category_id = ${p.fromId}`);
  }
  for (const name of ARCHIVE) {
    const id = catId(name);
    if (!id) continue;
    statements.push(sql`
      update categories set is_archived = true
      where id = ${id} and household_id = ${hid}
        and not exists (select 1 from transactions where category_id = ${id})`);
  }
  // The emptied person-categories can now go for good.
  for (const p of plan) {
    statements.push(sql`
      delete from categories where id = ${p.fromId} and household_id = ${hid}
        and not exists (select 1 from transactions where category_id = ${p.fromId})
        and not exists (select 1 from import_rules where set_category_id = ${p.fromId})`);
  }

  await sql.transaction(statements);
  console.log("\nApplied.");

  const after = await sql`
    select c.name, count(t.id)::int n, c.is_archived
    from categories c left join transactions t on t.category_id = c.id
    where c.household_id = ${hid}
    group by c.name, c.is_archived order by n desc, c.name`;
  console.log(`\nNow ${after.filter((r: any) => !r.is_archived).length} live, ${after.filter((r: any) => r.is_archived).length} archived:`);
  for (const r of after as any[]) {
    console.log(`  ${String(r.n).padStart(3)}  ${r.name}${r.is_archived ? "  (archived)" : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
