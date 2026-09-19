/**
 * Seeds the Mujahid household: owner + Tooba, accounts, buckets, people,
 * and the import rules mined from the real Meezan statement.
 *
 *   DATABASE_URL=postgres://... npm run seed
 * Optional: SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD, SEED_MEMBER_EMAIL, SEED_MEMBER_PASSWORD
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { existsSync, readFileSync } from "fs";
import * as t from "../src/db/schema";

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
const db = drizzle(neon(url), { schema: t });

const OWNER_EMAIL =
  process.env.SEED_OWNER_EMAIL || "abdullahmujahidali1@gmail.com";
const OWNER_PASS = process.env.SEED_OWNER_PASSWORD || "testpass123";
const MEMBER_EMAIL =
  process.env.SEED_MEMBER_EMAIL || "toobashahzad06@gmail.com";
const MEMBER_PASS = process.env.SEED_MEMBER_PASSWORD || "testpass123";

async function main() {
  const existing = await db
    .select()
    .from(t.users)
    .where(eq(t.users.email, OWNER_EMAIL))
    .limit(1);
  if (existing.length) {
    console.log("Seed already ran (owner exists). Nothing to do.");
    return;
  }

  const [owner] = await db
    .insert(t.users)
    .values({
      email: OWNER_EMAIL,
      name: "Abdullah",
      passwordHash: await bcrypt.hash(OWNER_PASS, 10),
    })
    .returning();
  const [member] = await db
    .insert(t.users)
    .values({
      email: MEMBER_EMAIL,
      name: "Tooba",
      passwordHash: await bcrypt.hash(MEMBER_PASS, 10),
    })
    .returning();

  const [hh] = await db
    .insert(t.households)
    .values({
      name: "Abdullah Family",
      monthlyBudget: "350000",
      incentivePct: 10,
    })
    .returning();
  await db.insert(t.memberships).values([
    { userId: owner.id, householdId: hh.id, role: "owner" },
    { userId: member.id, householdId: hh.id, role: "member" },
  ]);

  await db.insert(t.persons).values(
    ["Abdullah", "Tooba", "Miral", "Haroon"].map((name) => ({
      householdId: hh.id,
      name,
    })),
  );

  const accounts = await db
    .insert(t.accounts)
    .values([
      { householdId: hh.id, name: "Meezan Bank", kind: "bank" },
      { householdId: hh.id, name: "Bank Al Habib", kind: "bank" },
      { householdId: hh.id, name: "Faysal Bank", kind: "bank" },
      { householdId: hh.id, name: "MCB", kind: "bank" },
      { householdId: hh.id, name: "Cash wallet", kind: "cash" },
    ])
    .returning();
  void accounts;

  const cats = await db
    .insert(t.categories)
    .values([
      { householdId: hh.id, name: "House construction" },
      { householdId: hh.id, name: "Kids' education" },
      { householdId: hh.id, name: "Vacations" },
      { householdId: hh.id, name: "General / day-to-day" },
      { householdId: hh.id, name: "Emergency fund" },
      { householdId: hh.id, name: "Groceries & food" },
      { householdId: hh.id, name: "Utilities", passthroughDefault: true },
      { householdId: hh.id, name: "Health" },
      { householdId: hh.id, name: "Transport" },
      { householdId: hh.id, name: "Family support" },
      { householdId: hh.id, name: "Mobile & internet" },
      { householdId: hh.id, name: "Fees & charges" },
    ])
    .returning();
  const cat = (n: string) => cats.find((c) => c.name === n)!.id;

  // rules mined from the real Sep-2026 Meezan export
  await db.insert(t.importRules).values([
    {
      householdId: hh.id,
      pattern: "LESCO",
      setCategoryId: cat("Utilities"),
      setPassthrough: true,
      priority: 10,
    },
    {
      householdId: hh.id,
      pattern: "PTCL",
      setCategoryId: cat("Utilities"),
      setPassthrough: true,
      priority: 10,
    },
    {
      householdId: hh.id,
      pattern: "SNGPL",
      setCategoryId: cat("Utilities"),
      setPassthrough: true,
      priority: 10,
    },
    {
      householdId: hh.id,
      pattern: "1BILL",
      setCategoryId: cat("Utilities"),
      setPassthrough: true,
      priority: 20,
    },
    {
      householdId: hh.id,
      pattern: "ZONG",
      setCategoryId: cat("Mobile & internet"),
      priority: 30,
    },
    {
      householdId: hh.id,
      pattern: "JAZZ",
      setCategoryId: cat("Mobile & internet"),
      priority: 30,
    },
    {
      householdId: hh.id,
      pattern: "UFONE",
      setCategoryId: cat("Mobile & internet"),
      priority: 30,
    },
    {
      householdId: hh.id,
      pattern: "LAHORE GRAMMAR SCHOOL",
      setCategoryId: cat("Kids' education"),
      priority: 40,
    },
    {
      householdId: hh.id,
      pattern: "MUJAHID ALI",
      setCategoryId: cat("Family support"),
      priority: 40,
    },
    {
      householdId: hh.id,
      pattern: "MCDONALDS",
      setCategoryId: cat("Groceries & food"),
      priority: 60,
    },
  ] as any);

  console.log("Seeded. Sign in as:");
  console.log(`  owner:  ${OWNER_EMAIL} / ${OWNER_PASS}`);
  console.log(`  member: ${MEMBER_EMAIL} / ${MEMBER_PASS}`);
  console.log(
    "Change both passwords after first login. Add your assets and goals with real figures in the app.",
  );
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
