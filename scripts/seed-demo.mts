/**
 * Seeds a self-contained DEMO household used only for marketing screenshots.
 *
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-demo.mts
 *
 * It is deliberately separate from the real household: a generic family name,
 * USD so the landing page reads internationally, six months of fully
 * categorised history, an under-budget month with real savings, and goals and
 * assets that are partly complete. Nothing here touches the Mujahid household.
 *
 * Re-running wipes and rebuilds only this household, so screenshots stay
 * reproducible.
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
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

const EMAIL = "demo@example.com";
const PASS = "demodemo123";
const HOUSEHOLD = "The Rivera Family";

/** Screenshots are taken "as of" this month so the figures never drift. */
const TODAY = new Date();
const MONTHS = 6;

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const day = (d: Date, n: number) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
const monthsBack = (n: number) => new Date(TODAY.getFullYear(), TODAY.getMonth() - n, 1);

async function wipe() {
  const [hh] = await db.select().from(t.households).where(eq(t.households.name, HOUSEHOLD)).limit(1);
  if (!hh) return;

  // Children first — every table hangs off household or its rows.
  const goals = await db.select().from(t.goals).where(eq(t.goals.householdId, hh.id));
  if (goals.length)
    await db.delete(t.goalContributions).where(inArray(t.goalContributions.goalId, goals.map((g) => g.id)));
  const assets = await db.select().from(t.assets).where(eq(t.assets.householdId, hh.id));
  if (assets.length)
    await db.delete(t.assetValues).where(inArray(t.assetValues.assetId, assets.map((a) => a.id)));

  await db.delete(t.comments).where(eq(t.comments.householdId, hh.id));
  await db.delete(t.notifications).where(eq(t.notifications.householdId, hh.id));
  await db.delete(t.attachments).where(eq(t.attachments.householdId, hh.id));
  await db.delete(t.transactions).where(eq(t.transactions.householdId, hh.id));
  await db.delete(t.importRules).where(eq(t.importRules.householdId, hh.id));
  await db.delete(t.importBatches).where(eq(t.importBatches.householdId, hh.id));
  await db.delete(t.goals).where(eq(t.goals.householdId, hh.id));
  await db.delete(t.assets).where(eq(t.assets.householdId, hh.id));
  await db.delete(t.categories).where(eq(t.categories.householdId, hh.id));
  await db.delete(t.accounts).where(eq(t.accounts.householdId, hh.id));
  await db.delete(t.persons).where(eq(t.persons.householdId, hh.id));
  await db.delete(t.memberships).where(eq(t.memberships.householdId, hh.id));
  await db.delete(t.households).where(eq(t.households.id, hh.id));
  console.log("Wiped previous demo household.");
}

async function main() {
  await wipe();

  let [user] = await db.select().from(t.users).where(eq(t.users.email, EMAIL)).limit(1);
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: EMAIL, name: "Ana Rivera", passwordHash: await bcrypt.hash(PASS, 10) })
      .returning();
  }

  const [hh] = await db
    .insert(t.households)
    .values({ name: HOUSEHOLD, currency: "USD", monthlyBudget: "6400", incentivePct: 10 })
    .returning();
  await db.insert(t.memberships).values({ userId: user.id, householdId: hh.id, role: "owner" });

  const people = await db
    .insert(t.persons)
    .values(["Ana", "Marco", "Sofia", "Leo"].map((name) => ({ householdId: hh.id, name })))
    .returning();
  const who = (n: string) => people.find((p) => p.name === n)!.id;

  const accounts = await db
    .insert(t.accounts)
    .values([
      { householdId: hh.id, name: "Main checking", kind: "bank" },
      { householdId: hh.id, name: "Joint savings", kind: "bank" },
      { householdId: hh.id, name: "Credit card", kind: "bank" },
      { householdId: hh.id, name: "Cash wallet", kind: "cash" }
    ])
    .returning();
  const acc = (n: string) => accounts.find((a) => a.name === n)!.id;

  const cats = await db
    .insert(t.categories)
    .values([
      { householdId: hh.id, name: "Groceries & food" },
      { householdId: hh.id, name: "Utilities", passthroughDefault: true },
      { householdId: hh.id, name: "Transport" },
      { householdId: hh.id, name: "Kids' education" },
      { householdId: hh.id, name: "Health" },
      { householdId: hh.id, name: "Home & repairs" },
      { householdId: hh.id, name: "Mobile & internet" },
      { householdId: hh.id, name: "Eating out" },
      { householdId: hh.id, name: "Clothing" },
      { householdId: hh.id, name: "Fees & charges" }
    ])
    .returning();
  const cat = (n: string) => cats.find((c) => c.name === n)!.id;

  /**
   * A month of believable, fully-categorised activity. Amounts wobble a little
   * per month so the year chart has shape instead of six identical bars.
   */
  type Row = {
    d: number;
    desc: string;
    amt: number;
    cat: string;
    acct?: string;
    person?: string;
    pass?: boolean;
  };
  const template: Row[] = [
    // Housing and the fixed bills a family actually carries.
    { d: 1, desc: "Mortgage payment", amt: 1685.0, cat: "Home & repairs" },
    { d: 4, desc: "City Power & Light", amt: 168.5, cat: "Utilities", pass: true },
    { d: 5, desc: "Natural gas", amt: 74.2, cat: "Utilities", pass: true },
    { d: 17, desc: "Water & sewer", amt: 61.4, cat: "Utilities", pass: true },
    { d: 9, desc: "Fiber internet", amt: 79.0, cat: "Mobile & internet" },
    { d: 22, desc: "Mobile plan — family", amt: 148.0, cat: "Mobile & internet" },
    { d: 7, desc: "Home insurance", amt: 132.0, cat: "Home & repairs" },

    // Groceries — the biggest variable line, spread across the month.
    { d: 2, desc: "Whole Foods Market", amt: 182.4, cat: "Groceries & food" },
    { d: 8, desc: "Trader Joe's", amt: 121.75, cat: "Groceries & food" },
    { d: 15, desc: "Costco run", amt: 246.1, cat: "Groceries & food" },
    { d: 23, desc: "Safeway", amt: 134.55, cat: "Groceries & food" },
    { d: 29, desc: "Farmers market", amt: 68.3, cat: "Groceries & food" },

    // Kids.
    { d: 11, desc: "Oakridge Elementary — tuition", amt: 620.0, cat: "Kids' education", person: "Leo" },
    { d: 13, desc: "Piano lessons", amt: 160.0, cat: "Kids' education", person: "Sofia" },
    { d: 19, desc: "After-school club", amt: 145.0, cat: "Kids' education", person: "Leo" },

    // Getting around.
    { d: 5, desc: "Shell station", amt: 64.2, cat: "Transport", person: "Marco" },
    { d: 14, desc: "Metro transit pass", amt: 58.0, cat: "Transport", person: "Ana" },
    { d: 27, desc: "Gas station", amt: 59.7, cat: "Transport", person: "Marco" },
    { d: 21, desc: "Car insurance", amt: 142.0, cat: "Transport" },

    // Health.
    { d: 6, desc: "Riverside Pharmacy", amt: 38.9, cat: "Health", person: "Sofia" },
    { d: 18, desc: "Dr. Alvarez — checkup", amt: 95.0, cat: "Health", person: "Leo" },
    { d: 24, desc: "Dental cleaning", amt: 128.0, cat: "Health", person: "Ana" },

    // The rest of life.
    { d: 12, desc: "Corner Bistro", amt: 86.3, cat: "Eating out" },
    { d: 26, desc: "Pizza night", amt: 43.2, cat: "Eating out" },
    { d: 16, desc: "Sunday brunch", amt: 72.4, cat: "Eating out" },
    { d: 20, desc: "Hardware store — faucet", amt: 112.8, cat: "Home & repairs" },
    { d: 25, desc: "Kids' shoes", amt: 78.9, cat: "Clothing", person: "Sofia" },
    { d: 10, desc: "Winter jackets", amt: 164.0, cat: "Clothing" },
    { d: 28, desc: "Account maintenance fee", amt: 6.0, cat: "Fees & charges" }
  ];

  const tx: Array<typeof t.transactions.$inferInsert> = [];
  for (let back = MONTHS - 1; back >= 0; back--) {
    const m = monthsBack(back);
    // Gentle month-to-month variation, plus a seasonal bump in the middle.
    const wobble = 1 + (((back * 37) % 11) - 5) / 100;
    const bump = back === 2 ? 1.18 : 1;

    for (const r of template) {
      tx.push({
        householdId: hh.id,
        accountId: acc(r.acct ?? "Main checking"),
        type: "expense",
        txDate: day(m, r.d),
        amount: (r.amt * wobble * bump).toFixed(2),
        description: r.desc,
        categoryId: cat(r.cat),
        personId: r.person ? who(r.person) : null,
        isPassthrough: !!r.pass,
        source: "import"
      });
    }

    // Two salaries and a transfer to savings — every month.
    tx.push({
      householdId: hh.id,
      accountId: acc("Main checking"),
      type: "income",
      txDate: day(m, 1),
      amount: "5200.00",
      description: "Payroll — Ana",
      personId: who("Ana"),
      source: "import"
    });
    tx.push({
      householdId: hh.id,
      accountId: acc("Main checking"),
      type: "income",
      txDate: day(m, 1),
      amount: "3100.00",
      description: "Payroll — Marco",
      personId: who("Marco"),
      source: "import"
    });
    tx.push({
      householdId: hh.id,
      accountId: acc("Main checking"),
      counterAccountId: acc("Joint savings"),
      type: "transfer",
      txDate: day(m, 3),
      amount: "1200.00",
      description: "Monthly transfer to savings",
      source: "import"
    });
    tx.push({
      householdId: hh.id,
      accountId: acc("Main checking"),
      counterAccountId: acc("Cash wallet"),
      type: "transfer",
      txDate: day(m, 10),
      amount: "200.00",
      description: "ATM withdrawal",
      source: "import"
    });
  }
  await db.insert(t.transactions).values(tx);

  // Assets, each with a value history so net worth has a real trend.
  const [car] = await db
    .insert(t.assets)
    .values({
      householdId: hh.id,
      name: "Family car",
      purchaseDate: day(monthsBack(40), 12),
      purchasePrice: "28500",
      notes: "Bought used, one owner."
    })
    .returning();
  const [home] = await db
    .insert(t.assets)
    .values({
      householdId: hh.id,
      name: "Home",
      purchaseDate: day(monthsBack(70), 5),
      purchasePrice: "312000"
    })
    .returning();

  await db.insert(t.assetValues).values([
    { assetId: car.id, valuedOn: day(monthsBack(12), 15), value: "21000" },
    { assetId: car.id, valuedOn: day(monthsBack(1), 15), value: "19400" },
    { assetId: home.id, valuedOn: day(monthsBack(12), 15), value: "368000" },
    { assetId: home.id, valuedOn: day(monthsBack(1), 15), value: "395000" }
  ]);

  // Goals: one nearly there, one just started, one already met.
  const [reno] = await db
    .insert(t.goals)
    .values({
      householdId: hh.id,
      name: "Kitchen renovation",
      targetAmount: "12000",
      deadline: day(monthsBack(-8), 1)
    })
    .returning();
  const [trip] = await db
    .insert(t.goals)
    .values({
      householdId: hh.id,
      name: "Summer trip",
      targetAmount: "4500",
      deadline: day(monthsBack(-5), 1)
    })
    .returning();
  const [buffer] = await db
    .insert(t.goals)
    .values({ householdId: hh.id, name: "Emergency buffer", targetAmount: "6000", status: "done" })
    .returning();

  const contribs: Array<typeof t.goalContributions.$inferInsert> = [];
  for (let back = MONTHS - 1; back >= 0; back--) {
    const m = monthsBack(back);
    contribs.push({ goalId: reno.id, amount: "1500.00", onDate: day(m, 5), note: "Monthly set-aside" });
    if (back < 3) contribs.push({ goalId: trip.id, amount: "600.00", onDate: day(m, 5) });
  }
  contribs.push({ goalId: buffer.id, amount: "6000.00", onDate: day(monthsBack(7), 20), note: "Fully funded" });
  await db.insert(t.goalContributions).values(contribs);

  // A couple of rules, so the Settings/rules screen isn't empty.
  await db.insert(t.importRules).values([
    { householdId: hh.id, pattern: "WHOLE FOODS", setCategoryId: cat("Groceries & food"), priority: 10 },
    { householdId: hh.id, pattern: "CITY POWER", setCategoryId: cat("Utilities"), setPassthrough: true, priority: 10 },
    { householdId: hh.id, pattern: "SHELL", setCategoryId: cat("Transport"), priority: 20 },
    { householdId: hh.id, pattern: "OAKRIDGE", setCategoryId: cat("Kids' education"), priority: 20 }
  ] as any);

  console.log(`Demo household ready — ${tx.length} transactions across ${MONTHS} months.`);
  console.log(`  sign in: ${EMAIL} / ${PASS}`);
  console.log(`  month shown: ${ym(TODAY)}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
