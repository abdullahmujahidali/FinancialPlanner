import Link from "next/link";
import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { pkr, monthKey, monthRange, monthLabel } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: { m?: string } }) {
  const { household } = await requireContext();
  const m = searchParams.m || monthKey();
  const { from, next } = monthRange(m);
  const H = eq(t.transactions.householdId, household.id);
  const inMonth = and(H, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next));

  const [spendRow] = await db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
    .from(t.transactions)
    .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)));
  const [incomeRow] = await db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
    .from(t.transactions).where(and(inMonth, eq(t.transactions.type, "income")));
  const [reviewRow] = await db().select({ v: sql<string>`count(*)` })
    .from(t.transactions).where(and(H, eq(t.transactions.needsReview, true)));

  const byCategory = await db().select({
    name: t.categories.name,
    total: sql<string>`sum(${t.transactions.amount})`
  }).from(t.transactions)
    .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
    .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
    .groupBy(t.categories.name)
    .orderBy(desc(sql`sum(${t.transactions.amount})`))
    .limit(6);

  const byPerson = await db().select({
    name: t.persons.name,
    total: sql<string>`sum(${t.transactions.amount})`
  }).from(t.transactions)
    .leftJoin(t.persons, eq(t.transactions.personId, t.persons.id))
    .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
    .groupBy(t.persons.name)
    .orderBy(desc(sql`sum(${t.transactions.amount})`));

  // net worth: latest value per active asset
  const netWorthRows = await db().execute(sql`
    select coalesce(sum(v.value), 0) as total from ${t.assets} a
    join lateral (
      select value from ${t.assetValues} av where av.asset_id = a.id order by av.valued_on desc, av.id desc limit 1
    ) v on true
    where a.household_id = ${household.id} and a.status = 'active'`);
  const netWorth = Number((netWorthRows.rows?.[0] as any)?.total ?? 0);

  const activeGoals = await db().select().from(t.goals)
    .where(and(eq(t.goals.householdId, household.id), eq(t.goals.status, "active"))).limit(4);
  const goalSums = new Map<number, number>();
  for (const g of activeGoals) {
    const [s] = await db().select({ v: sql<string>`coalesce(sum(${t.goalContributions.amount}),0)` })
      .from(t.goalContributions).where(eq(t.goalContributions.goalId, g.id));
    goalSums.set(g.id, Number(s.v));
  }

  const budget = Number(household.monthlyBudget);
  const spend = Number(spendRow.v);
  const income = Number(incomeRow.v);
  const savings = Math.max(0, budget - spend);
  const incentive = Math.round(savings * household.incentivePct / 100);
  const reviewCount = Number(reviewRow.v);
  const pct = budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
  const over = budget > 0 && spend > budget;

  const staleDays = household.lastRevaluedAt
    ? Math.floor((Date.now() - new Date(household.lastRevaluedAt).getTime()) / 86400000)
    : null;

  const [y, mo] = m.split("-").map(Number);
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const nextM = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;

  return (
    <Shell title={household.name} action={
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/?m=${prev}`} className="btn-quiet px-2">‹</Link>
        <span className="text-muted">{monthLabel(m)}</span>
        <Link href={`/?m=${nextM}`} className="btn-quiet px-2">›</Link>
      </div>
    }>
      {reviewCount > 0 && (
        <Link href="/review" className="mb-4 flex items-center justify-between rounded border border-flag/30 bg-flagsoft px-3 py-2.5 text-sm text-flag">
          <span>{reviewCount} transaction{reviewCount > 1 ? "s" : ""} waiting for review</span>
          <span>Review ›</span>
        </Link>
      )}
      {staleDays !== null && staleDays > 90 && (
        <Link href="/assets" className="mb-4 block rounded border border-line bg-card px-3 py-2.5 text-sm text-muted">
          Asset values last updated {staleDays} days ago — quarterly check due ›
        </Link>
      )}

      <section className="mb-5 rounded-lg border border-line bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Spent this month</span>
          <span className="text-sm text-muted num">budget {pkr(budget, { compact: true })}</span>
        </div>
        <div className={"num mt-1 text-[34px] font-semibold leading-tight " + (over ? "text-over" : "")}>{pkr(spend)}</div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
          <div className={"h-full " + (over ? "bg-over" : "bg-brand")} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
          <div><div className="text-muted">Income</div><div className="num font-medium">{pkr(income, { compact: true })}</div></div>
          <div><div className="text-muted">Saved</div><div className="num font-medium">{pkr(savings, { compact: true })}</div></div>
          <div><div className="text-muted">Incentive {household.incentivePct}%</div><div className="num font-medium text-brand">{pkr(incentive, { compact: true })}</div></div>
        </div>
      </section>

      <section className="mb-5 flex items-baseline justify-between rounded-lg border border-line bg-card p-4">
        <span className="text-sm text-muted">Net worth</span>
        <Link href="/assets" className="num text-xl font-semibold">{pkr(netWorth, { compact: true })}</Link>
      </section>

      {byCategory.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-medium text-muted">Where it went</h2>
          <div className="rounded-lg border border-line bg-card">
            {byCategory.map((c, i) => (
              <div key={i} className={"flex justify-between px-4 py-2.5 text-[15px] " + (i < byCategory.length - 1 ? "rule-row" : "")}>
                <span>{c.name ?? "Uncategorised"}</span>
                <span className="num font-medium">{pkr(Number(c.total))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {byPerson.some(p => p.name) && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-medium text-muted">By person</h2>
          <div className="rounded-lg border border-line bg-card">
            {byPerson.map((p, i) => (
              <div key={i} className={"flex justify-between px-4 py-2.5 text-[15px] " + (i < byPerson.length - 1 ? "rule-row" : "")}>
                <span>{p.name ?? "Household"}</span>
                <span className="num font-medium">{pkr(Number(p.total))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeGoals.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-medium text-muted">Goals</h2>
          <div className="space-y-2">
            {activeGoals.map((g) => {
              const saved = goalSums.get(g.id) ?? 0;
              const gp = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
              return (
                <Link key={g.id} href="/goals" className="block rounded-lg border border-line bg-card p-3.5">
                  <div className="flex justify-between text-[15px]">
                    <span className="font-medium">{g.name}</span>
                    <span className="num text-muted">{pkr(saved, { compact: true })} / {pkr(Number(g.targetAmount), { compact: true })}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div className="h-full bg-brand" style={{ width: `${gp}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <Link href="/import" className="btn-quiet flex-1">Import bank CSV</Link>
        <Link href="/settings" className="btn-quiet flex-1">Settings</Link>
      </div>
    </Shell>
  );
}
