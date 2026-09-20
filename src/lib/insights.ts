import { db, t } from "@/db/client";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { monthRange, pkr } from "@/lib/money";

/**
 * Insight detection.
 *
 * Everything here answers one question: what changed that the household would
 * not otherwise notice? A number they already see on the dashboard is not an
 * insight — "you spent $4,628" is a fact. "Groceries are 30% above their own
 * three-month average" is a finding, because nobody computes that by eye.
 *
 * Each detector is deliberately conservative. A page of weak findings trains
 * people to ignore the page, so every rule has a floor on both the relative
 * change and the absolute amount: a category that doubled from $3 to $6 is
 * noise, not news.
 */

export type Insight = {
  kind: "spike" | "creep" | "duplicate" | "streak" | "trend";
  /** Ranking weight — roughly "how much money does this concern". */
  weight: number;
  title: string;
  detail: string;
  /** Deep link into the ledger, where the rows can be checked. */
  href?: string;
  /** Positive findings render in acid rather than blush. */
  good?: boolean;
};

/** Ignore anything below this; percentages on tiny sums are meaningless. */
const MIN_AMOUNT = 40;

const pct = (a: number, b: number) => ((a - b) / b) * 100;

export async function getInsights(
  householdId: number,
  month: string,
  budget: number,
  incentivePct: number
): Promise<Insight[]> {
  const { from, next } = monthRange(month);
  const H = eq(t.transactions.householdId, householdId);
  const spendOnly = and(eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false));

  // Six months of category totals, so "this month" can be compared with the
  // household's own recent normal rather than an arbitrary target.
  const sixAgo = (() => {
    const [y, mo] = month.split("-").map(Number);
    const d = new Date(y, mo - 6, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const [catRows, personRows, dupRows, monthRows] = await Promise.all([
    db()
      .select({
        name: t.categories.name,
        m: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM')`,
        total: sql<string>`sum(${t.transactions.amount})`
      })
      .from(t.transactions)
      .leftJoin(t.categories, eq(t.categories.id, t.transactions.categoryId))
      .where(and(H, spendOnly, gte(t.transactions.txDate, sixAgo), lt(t.transactions.txDate, next)))
      .groupBy(t.categories.name, sql`2`),

    db()
      .select({
        name: t.persons.name,
        m: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM')`,
        total: sql<string>`sum(${t.transactions.amount})`
      })
      .from(t.transactions)
      .leftJoin(t.persons, eq(t.persons.id, t.transactions.personId))
      .where(and(H, spendOnly, gte(t.transactions.txDate, sixAgo), lt(t.transactions.txDate, next)))
      .groupBy(t.persons.name, sql`2`),

    // Same description, same amount, same day — almost always a double charge.
    db()
      .select({
        description: t.transactions.description,
        amount: t.transactions.amount,
        txDate: t.transactions.txDate,
        n: sql<string>`count(*)`
      })
      .from(t.transactions)
      .where(and(H, spendOnly, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next)))
      .groupBy(t.transactions.description, t.transactions.amount, t.transactions.txDate)
      .having(sql`count(*) > 1`),

    db()
      .select({
        m: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM')`,
        total: sql<string>`sum(${t.transactions.amount})`
      })
      .from(t.transactions)
      .where(and(H, spendOnly, gte(t.transactions.txDate, sixAgo), lt(t.transactions.txDate, next)))
      .groupBy(sql`1`)
  ]);

  const out: Insight[] = [];

  /** Group rows into { key -> [{month, total}] } sorted oldest first. */
  const series = (rows: Array<{ name: string | null; m: string; total: string }>) => {
    const by = new Map<string, Array<{ m: string; v: number }>>();
    for (const r of rows) {
      const k = r.name ?? "Uncategorised";
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push({ m: r.m, v: Number(r.total) });
    }
    for (const v of by.values()) v.sort((a, b) => a.m.localeCompare(b.m));
    return by;
  };

  // --- Category spikes vs the household's own recent average ---------------
  for (const [name, pts] of series(catRows)) {
    const cur = pts.find((p) => p.m === month);
    const prior = pts.filter((p) => p.m !== month);
    if (!cur || prior.length < 2 || cur.v < MIN_AMOUNT) continue;

    const avg = prior.reduce((a, b) => a + b.v, 0) / prior.length;
    const delta = pct(cur.v, avg);
    if (delta >= 25 && cur.v - avg >= MIN_AMOUNT) {
      out.push({
        kind: "spike",
        weight: cur.v - avg,
        title: `${name} is ${Math.round(delta)}% above its usual`,
        detail: `Normally about ${money(avg)} a month. This month it is ${money(cur.v)} — ${money(cur.v - avg)} more than usual.`,
        href: `/ledger?m=${month}`
      });
    }

    // Three consecutive rises — a trend rather than a one-off month.
    const last4 = pts.slice(-4);
    if (last4.length === 4) {
      const rising = last4.every((p, i) => i === 0 || p.v > last4[i - 1].v);
      const growth = last4[3].v - last4[0].v;
      if (rising && growth >= MIN_AMOUNT) {
        out.push({
          kind: "trend",
          weight: growth,
          title: `${name} has climbed three months running`,
          detail: `${money(last4[0].v)} → ${money(last4[1].v)} → ${money(last4[2].v)} → ${money(last4[3].v)}. Up ${money(growth)} since ${last4[0].m}.`,
          href: `/ledger?m=${month}`
        });
      }
    }
  }

  // --- A recurring charge that stepped up and stayed there -----------------
  const recurring = await db()
    .select({
      description: t.transactions.description,
      m: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM')`,
      total: sql<string>`sum(${t.transactions.amount})`
    })
    .from(t.transactions)
    .where(and(H, spendOnly, gte(t.transactions.txDate, sixAgo), lt(t.transactions.txDate, next)))
    .groupBy(t.transactions.description, sql`2`);

  for (const [desc, pts] of series(
    recurring.map((r) => ({ name: r.description, m: r.m, total: r.total }))
  )) {
    // Needs a long enough history to tell a step change from noise.
    if (pts.length < 5) continue;
    const old = pts.slice(0, -3);
    const recent = pts.slice(-3);
    const oldAvg = old.reduce((a, b) => a + b.v, 0) / old.length;
    const newAvg = recent.reduce((a, b) => a + b.v, 0) / recent.length;
    const step = newAvg - oldAvg;

    // Every recent month at the new level = a price rise, not a spike.
    const settled = recent.every((p) => Math.abs(p.v - newAvg) / newAvg < 0.05);
    if (settled && step >= 15 && pct(newAvg, oldAvg) >= 20) {
      out.push({
        kind: "creep",
        weight: step * 6,
        title: `"${desc}" costs more than it used to`,
        detail: `It was about ${money(oldAvg)}, and has been ${money(newAvg)} for the last three months. That is ${money(step)} more every month, or ${money(step * 12)} a year.`,
        href: `/ledger?q=${encodeURIComponent(desc)}`
      });
    }
  }

  // --- Probable double charges --------------------------------------------
  for (const d of dupRows) {
    const n = Number(d.n);
    const amt = Number(d.amount);
    if (amt < 5) continue;
    out.push({
      kind: "duplicate",
      weight: amt * (n - 1) * 3,
      title: `${d.description} was charged ${n} times on the same day`,
      detail: `${n} × ${money(amt)} on ${d.txDate}. If that is a mistake it is worth ${money(amt * (n - 1))} back.`,
      href: `/ledger?q=${encodeURIComponent(d.description)}`
    });
  }

  // --- Per-person climb ----------------------------------------------------
  for (const [name, pts] of series(personRows)) {
    if (name === "Uncategorised") continue;
    const cur = pts.find((p) => p.m === month);
    const prior = pts.filter((p) => p.m !== month);
    if (!cur || prior.length < 2 || cur.v < MIN_AMOUNT) continue;
    const avg = prior.reduce((a, b) => a + b.v, 0) / prior.length;
    if (pct(cur.v, avg) >= 30 && cur.v - avg >= MIN_AMOUNT) {
      out.push({
        kind: "spike",
        weight: (cur.v - avg) * 0.8,
        title: `Spending tagged to ${name} is up ${Math.round(pct(cur.v, avg))}%`,
        detail: `${money(cur.v)} this month against a usual ${money(avg)}.`,
        href: `/ledger?m=${month}`
      });
    }
  }

  // --- The good news: a run of months under budget -------------------------
  if (budget > 0) {
    const months = monthRows
      .map((r) => ({ m: r.m, v: Number(r.total) }))
      .sort((a, b) => b.m.localeCompare(a.m));
    let streak = 0;
    let saved = 0;
    for (const mo of months) {
      if (mo.v < budget) {
        streak++;
        saved += budget - mo.v;
      } else break;
    }
    if (streak >= 3) {
      const share = (saved * incentivePct) / 100;
      out.push({
        kind: "streak",
        good: true,
        weight: saved,
        title: `Under budget ${streak} months running`,
        detail: `That is ${money(saved)} saved across those months, and ${money(share)} earned at ${incentivePct}%.`
      });
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/**
 * Insights are computed and rendered on the server, where `setCurrency` has
 * already been applied for the request, so the shared formatter is correct
 * here and these figures match the rest of the app.
 */
function money(n: number) {
  return pkr(Math.round(n));
}
