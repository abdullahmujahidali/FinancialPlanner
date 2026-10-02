import { db, t } from "@/db/client";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { monthKey, monthLabelShort, monthRange, pkr } from "@/lib/money";
import { getGoalForecasts } from "@/lib/forecast";

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
  kind: "spike" | "creep" | "duplicate" | "streak" | "trend" | "goal";
  /** Ranking weight — roughly "how much money does this concern". */
  weight: number;
  title: string;
  detail: string;
  /** Deep link into the ledger, where the rows can be checked. */
  href?: string;
  /** Positive findings render in acid rather than blush. */
  good?: boolean;
};

/**
 * Ignore anything below this; percentages on tiny sums are meaningless. The
 * real floor scales with the budget (0.2% of it — Rs 700 on a 3.5 lakh
 * budget), because a fixed 40 is noise in rupees and news in dollars.
 */
const MIN_FLOOR = 40;

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
  const MIN_AMOUNT = Math.max(MIN_FLOOR, budget * 0.002);

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
    if (!cur || prior.length < 1 || cur.v < MIN_AMOUNT) continue;

    // With one earlier month there is no "usual" yet, only last month — say
    // so, and ask for a bigger jump before calling it news.
    const single = prior.length === 1;
    const avg = prior.reduce((a, b) => a + b.v, 0) / prior.length;
    const delta = pct(cur.v, avg);
    if (delta >= (single ? 40 : 25) && cur.v - avg >= MIN_AMOUNT) {
      out.push({
        kind: "spike",
        weight: cur.v - avg,
        title: single
          ? `${name} is up ${Math.round(delta)}% on last month`
          : `${name} is ${Math.round(delta)}% above its usual`,
        detail: single
          ? `${money(avg)} last month, ${money(cur.v)} this month — ${money(cur.v - avg)} more.`
          : `Normally about ${money(avg)} a month. This month it is ${money(cur.v)} — ${money(cur.v - avg)} more than usual.`,
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

  // --- Categories past their own planned amount ----------------------------
  const plans = await db()
    .select({ id: t.categories.id, name: t.categories.name, plan: t.categories.monthlyBudget })
    .from(t.categories)
    .where(and(eq(t.categories.householdId, householdId), sql`${t.categories.monthlyBudget} is not null`));
  if (plans.length) {
    const spentBy = await db()
      .select({ id: t.transactions.categoryId, v: sql<string>`sum(${t.transactions.amount})` })
      .from(t.transactions)
      .where(and(H, spendOnly, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next)))
      .groupBy(t.transactions.categoryId);
    for (const p of plans) {
      const plan = Number(p.plan);
      const v = Number(spentBy.find((r) => r.id === p.id)?.v ?? 0);
      if (v - plan >= MIN_AMOUNT) {
        out.push({
          kind: "spike",
          weight: (v - plan) * 1.2,
          title: `${p.name} is ${money(v - plan)} over its plan`,
          detail: `Planned ${money(plan)} for the month, spent ${money(v)} so far.`,
          href: `/ledger?m=${month}&cat=${p.id}`
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
    if (settled && step >= MIN_AMOUNT / 3 && pct(newAvg, oldAvg) >= 20) {
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
    if (amt < MIN_AMOUNT / 8) continue;
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

  // --- A goal whose pace will not meet its own deadline --------------------
  //
  // Only deadlines are reported. A goal with no date cannot be late, and
  // "this will take 31 months" is on the goals page already — an insight has
  // to be something the household would not otherwise see.
  if (budget > 0 && month === monthKey()) {
    for (const f of await getGoalForecasts(householdId, budget)) {
      if (!f.deadline || f.deadline.onTrack || !f.etaMonth) continue;
      if (f.deadline.shortfall < MIN_AMOUNT) continue;
      out.push({
        kind: "goal",
        weight: f.deadline.shortfall * 6,
        title: `"${f.name}" will not make its deadline at this pace`,
        detail: `Saving ${money(f.pace)} a month puts it at ${monthLabelShort(
          f.etaMonth
        )}, past the ${monthLabelShort(f.deadline.month)} target. Closing the gap takes ${money(
          f.deadline.shortfall
        )} more a month.`,
        href: "/goals"
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

/**
 * A month in brief — the answers that need no history at all.
 *
 * The detectors above compare a month against the household's own past, so a
 * household with one imported month gets an empty page from them. That is
 * exactly when the person keeping the book is asked "where did September go?"
 * and needs an answer. Everything here is computed from the one month alone,
 * against the budget, and is the same arithmetic the dashboard uses.
 */
export type MonthBrief = {
  spend: number;
  budget: number;
  income: number;
  /** Reimbursed bills, excluded from `spend`. */
  passthrough: number;
  /** Rows flagged one-off; included in `spend`. */
  abnormal: number;
  uncategorised: { count: number; total: number };
  needsReview: number;
  categories: Array<{ id: number | null; name: string; total: number; count: number }>;
  people: Array<{ id: number | null; name: string; total: number }>;
  biggest: Array<{ id: number; description: string; amount: number; txDate: string; category: string | null }>;
  /** Spend for the month before, when there is any. */
  lastMonth: number | null;
  /** Months before this one (within six) that have any spend at all. */
  historyMonths: number;
  /** Days of the month covered so far, and the month's length. */
  daysElapsed: number;
  daysInMonth: number;
};

export async function getMonthBrief(householdId: number, month: string, budget: number): Promise<MonthBrief> {
  const { from, next } = monthRange(month);
  const H = eq(t.transactions.householdId, householdId);
  const inMonth = and(H, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next));
  const spendOnly = and(eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false));

  const [y, mo] = month.split("-").map(Number);
  const prevFrom = monthRange(monthKey(new Date(y, mo - 2, 1))).from;
  const sixAgo = monthRange(monthKey(new Date(y, mo - 7, 1))).from;

  const [totals, cats, people, biggest, history] = await Promise.all([
    db()
      .select({
        spend: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and not ${t.transactions.isPassthrough} then ${t.transactions.amount} end), 0)`,
        income: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'income' then ${t.transactions.amount} end), 0)`,
        passthrough: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and ${t.transactions.isPassthrough} then ${t.transactions.amount} end), 0)`,
        abnormal: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and not ${t.transactions.isPassthrough} and ${t.transactions.isAbnormal} then ${t.transactions.amount} end), 0)`,
        uncatCount: sql<string>`count(case when ${t.transactions.type} = 'expense' and ${t.transactions.categoryId} is null then 1 end)`,
        uncatTotal: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and ${t.transactions.categoryId} is null then ${t.transactions.amount} end), 0)`,
        review: sql<string>`count(case when ${t.transactions.needsReview} then 1 end)`
      })
      .from(t.transactions)
      .where(inMonth),

    db()
      .select({
        id: t.transactions.categoryId,
        name: t.categories.name,
        total: sql<string>`sum(${t.transactions.amount})`,
        count: sql<string>`count(*)`
      })
      .from(t.transactions)
      .leftJoin(t.categories, eq(t.categories.id, t.transactions.categoryId))
      .where(and(inMonth, spendOnly))
      .groupBy(t.transactions.categoryId, t.categories.name)
      .orderBy(sql`3 desc`),

    db()
      .select({
        id: t.transactions.personId,
        name: t.persons.name,
        total: sql<string>`sum(${t.transactions.amount})`
      })
      .from(t.transactions)
      .leftJoin(t.persons, eq(t.persons.id, t.transactions.personId))
      .where(and(inMonth, spendOnly))
      .groupBy(t.transactions.personId, t.persons.name)
      .orderBy(sql`3 desc`),

    db()
      .select({
        id: t.transactions.id,
        description: t.transactions.description,
        amount: t.transactions.amount,
        txDate: t.transactions.txDate,
        category: t.categories.name
      })
      .from(t.transactions)
      .leftJoin(t.categories, eq(t.categories.id, t.transactions.categoryId))
      .where(and(inMonth, spendOnly))
      .orderBy(sql`${t.transactions.amount} desc`)
      .limit(5),

    db()
      .select({
        m: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM')`,
        total: sql<string>`sum(${t.transactions.amount})`
      })
      .from(t.transactions)
      .where(and(H, spendOnly, gte(t.transactions.txDate, sixAgo), lt(t.transactions.txDate, from)))
      .groupBy(sql`1`)
  ]);

  const tot = totals[0];
  const prevKey = prevFrom.slice(0, 7);
  const prev = history.find((h) => h.m === prevKey);

  const now = new Date();
  const daysInMonth = new Date(y, mo, 0).getDate();
  const daysElapsed =
    month === monthKey(now) ? now.getDate() : month < monthKey(now) ? daysInMonth : 0;

  return {
    spend: Number(tot?.spend ?? 0),
    budget,
    income: Number(tot?.income ?? 0),
    passthrough: Number(tot?.passthrough ?? 0),
    abnormal: Number(tot?.abnormal ?? 0),
    uncategorised: { count: Number(tot?.uncatCount ?? 0), total: Number(tot?.uncatTotal ?? 0) },
    needsReview: Number(tot?.review ?? 0),
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name ?? "Uncategorised",
      total: Number(c.total),
      count: Number(c.count)
    })),
    people: people.map((p) => ({ id: p.id, name: p.name ?? "Whole household", total: Number(p.total) })),
    biggest: biggest.map((b) => ({
      id: b.id,
      description: b.description,
      amount: Number(b.amount),
      txDate: String(b.txDate),
      category: b.category
    })),
    lastMonth: prev ? Number(prev.total) : null,
    historyMonths: history.filter((h) => Number(h.total) > 0).length,
    daysElapsed,
    daysInMonth
  };
}

/**
 * The month Insights opens on. In the first week of a month the current one
 * holds a handful of rows and nothing worth reading, so it opens on the month
 * that just closed — the one people are actually asking about.
 */
export function defaultInsightsMonth(now = new Date()) {
  return now.getDate() <= 7 ? monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)) : monthKey(now);
}
