import Link from "next/link";
import Shell from "@/components/Shell";
import CategoryDot from "@/components/CategoryDot";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { pkr, monthKey, monthRange, monthLabel, monthLabelShort } from "@/lib/money";

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
    name: t.categories.name, total: sql<string>`sum(${t.transactions.amount})`
  }).from(t.transactions)
    .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
    .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
    .groupBy(t.categories.name)
    .orderBy(desc(sql`sum(${t.transactions.amount})`)).limit(6);

  const byPerson = await db().select({
    name: t.persons.name, total: sql<string>`sum(${t.transactions.amount})`
  }).from(t.transactions)
    .leftJoin(t.persons, eq(t.transactions.personId, t.persons.id))
    .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
    .groupBy(t.persons.name)
    .orderBy(desc(sql`sum(${t.transactions.amount})`));

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
      <div className="flex shrink-0 items-center gap-1 text-sm">
        <Link href={`/?m=${prev}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card">‹</Link>
        <span className="whitespace-nowrap px-1 text-muted">{monthLabelShort(m)}</span>
        <Link href={`/?m=${nextM}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card">›</Link>
      </div>
    }>
      {/* hero: the family's month, in one dark panel */}
      <section className="mb-4 overflow-hidden rounded-3xl bg-forest text-cream shadow-[0_12px_32px_rgba(11,59,42,0.28)]">
        <div className="p-5 pb-4">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-cream/60">Spent · {monthLabel(m)}</span>
            <span className="num text-cream/60">of {pkr(budget, { compact: true })} budget</span>
          </div>
          <div className={"money mt-2 text-[46px] leading-none " + (over ? "text-[#F2B8A5]" : "")}>
            {pkr(spend)}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cream/15">
            <div className={"h-full rounded-full " + (over ? "bg-[#E58F73]" : "bg-gold")} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-cream/10 bg-forest2/60 px-5 py-3.5 text-sm">
          <div><div className="text-[12px] text-cream/55">Income</div><div className="money mt-0.5 text-[17px]">{pkr(income, { compact: true })}</div></div>
          <div><div className="text-[12px] text-cream/55">Saved</div><div className="money mt-0.5 text-[17px]">{pkr(savings, { compact: true })}</div></div>
          <div><div className="text-[12px] text-cream/55">Incentive {household.incentivePct}%</div><div className="money mt-0.5 text-[17px] text-gold">{pkr(incentive, { compact: true })}</div></div>
        </div>
      </section>

      {reviewCount > 0 && (
        <Link href="/review" className="mb-4 flex items-center justify-between rounded-2xl border border-flag/25 bg-flagsoft px-4 py-3 text-sm text-flag">
          <span className="font-medium">{reviewCount} transaction{reviewCount > 1 ? "s" : ""} waiting for review</span>
          <span aria-hidden>›</span>
        </Link>
      )}
      {staleDays !== null && staleDays > 90 && (
        <Link href="/assets" className="panel mb-4 block px-4 py-3 text-sm text-muted">
          Asset values last updated {staleDays} days ago — quarterly check due ›
        </Link>
      )}

      <Link href="/assets" className="panel mb-4 flex items-baseline justify-between px-4 py-4">
        <span className="text-sm text-muted">Net worth</span>
        <span className="money text-[22px]">{pkr(netWorth, { compact: true })}</span>
      </Link>

      {byCategory.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 px-1 text-[13px] font-medium text-muted">Where it went</h2>
          <div className="panel">
            {byCategory.map((c, i) => (
              <div key={i} className={"flex items-center justify-between gap-3 px-4 py-3 text-[15px] " + (i < byCategory.length - 1 ? "rule-row" : "")}>
                <span className="flex items-center gap-2.5"><CategoryDot name={c.name ?? "Uncategorised"} />{c.name ?? "Uncategorised"}</span>
                <span className="num font-medium">{pkr(Number(c.total))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {byPerson.some(p => p.name) && (
        <section className="mb-4">
          <h2 className="mb-2 px-1 text-[13px] font-medium text-muted">By person</h2>
          <div className="panel">
            {byPerson.map((p, i) => (
              <div key={i} className={"flex justify-between px-4 py-3 text-[15px] " + (i < byPerson.length - 1 ? "rule-row" : "")}>
                <span>{p.name ?? "Household"}</span>
                <span className="num font-medium">{pkr(Number(p.total))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeGoals.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 px-1 text-[13px] font-medium text-muted">Goals</h2>
          <div className="space-y-2.5">
            {activeGoals.map((g) => {
              const saved = goalSums.get(g.id) ?? 0;
              const gp = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
              return (
                <Link key={g.id} href="/goals" className="panel block p-4">
                  <div className="flex justify-between text-[15px]">
                    <span className="font-medium">{g.name}</span>
                    <span className="num text-muted">{pkr(saved, { compact: true })} / {pkr(Number(g.targetAmount), { compact: true })}</span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${gp}%` }} />
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
