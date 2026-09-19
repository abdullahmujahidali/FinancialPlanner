import Link from "next/link";
import Shell from "@/components/Shell";
import CategoryDot from "@/components/CategoryDot";
import BarChart from "@/components/BarChart";
import Donut from "@/components/Donut";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { pkr, monthKey, monthRange, monthLabel, monthLabelShort } from "@/lib/money";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const m = sp.m || monthKey();
  const { from, next } = monthRange(m);
  const H = eq(t.transactions.householdId, household.id);
  const inMonth = and(H, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next));

  // Six-month income/expense trend for the bar chart.
  const trendFrom = (() => {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 6, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  // Every query below is independent, and the DB is a ~230ms round trip away —
  // awaiting them in sequence cost seconds per page view. Fire them together.
  const [
    [spendRow],
    [incomeRow],
    [reviewRow],
    byCategory,
    byPerson,
    trendRows,
    netWorthRows,
    activeGoals
  ] = await Promise.all([
    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions)
      .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false))),

    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions).where(and(inMonth, eq(t.transactions.type, "income"))),

    db().select({ v: sql<string>`count(*)` })
      .from(t.transactions).where(and(H, eq(t.transactions.needsReview, true))),

    db().select({
      name: t.categories.name, total: sql<string>`sum(${t.transactions.amount})`
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
      .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
      .groupBy(t.categories.name)
      .orderBy(desc(sql`sum(${t.transactions.amount})`)).limit(6),

    db().select({
      name: t.persons.name, total: sql<string>`sum(${t.transactions.amount})`
    }).from(t.transactions)
      .leftJoin(t.persons, eq(t.transactions.personId, t.persons.id))
      .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
      .groupBy(t.persons.name)
      .orderBy(desc(sql`sum(${t.transactions.amount})`)),

    db().select({
      ym: sql<string>`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'income' then ${t.transactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and not ${t.transactions.isPassthrough} then ${t.transactions.amount} else 0 end), 0)`
    }).from(t.transactions)
      .where(and(H, gte(t.transactions.txDate, trendFrom), lt(t.transactions.txDate, next)))
      .groupBy(sql`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`),

    db().execute(sql`
      select coalesce(sum(v.value), 0) as total from ${t.assets} a
      join lateral (
        select value from ${t.assetValues} av where av.asset_id = a.id order by av.valued_on desc, av.id desc limit 1
      ) v on true
      where a.household_id = ${household.id} and a.status = 'active'`),

    db().select().from(t.goals)
      .where(and(eq(t.goals.householdId, household.id), eq(t.goals.status, "active"))).limit(4)
  ]);

  const trend = trendRows.map((r) => {
    const [yy, mm] = r.ym.split("-").map(Number);
    return {
      label: new Date(yy, mm - 1, 1).toLocaleDateString("en-PK", { month: "short" }),
      income: Number(r.income),
      expense: Number(r.expense)
    };
  });
  const currentLabel = new Date(Number(m.split("-")[0]), Number(m.split("-")[1]) - 1, 1)
    .toLocaleDateString("en-PK", { month: "short" });

  const netWorth = Number((netWorthRows.rows?.[0] as any)?.total ?? 0);

  // One grouped query for every goal's saved total, instead of one per goal.
  const goalSums = new Map<number, number>();
  if (activeGoals.length) {
    const sums = await db().select({
      goalId: t.goalContributions.goalId,
      v: sql<string>`coalesce(sum(${t.goalContributions.amount}),0)`
    }).from(t.goalContributions)
      .where(inArray(t.goalContributions.goalId, activeGoals.map((g) => g.id)))
      .groupBy(t.goalContributions.goalId);
    for (const s of sums) goalSums.set(s.goalId, Number(s.v));
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

  const catData = byCategory.map((c) => ({ name: c.name ?? "Uncategorised", value: Number(c.total) }));

  return (
    <Shell
      wide
      title={household.name}
      action={
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href={`/?m=${prev}`} aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center border-2 border-line bg-card transition-all hover:shadow-hardsm">
            <ChevronLeft size={17} strokeWidth={2.75} />
          </Link>
          <span className="whitespace-nowrap px-1 text-[13px] font-bold">{monthLabelShort(m)}</span>
          <Link href={`/?m=${nextM}`} aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center border-2 border-line bg-card transition-all hover:shadow-hardsm">
            <ChevronRight size={17} strokeWidth={2.75} />
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* left column: hero, alerts, trend, net worth, goals */}
        <div className="flex flex-col gap-4 lg:w-[58%] lg:shrink-0">
        {/* ── Hero: the month's spend against budget ───────────────────── */}
        <section>
          <div className={"border-2 border-line p-5 lg:p-7 " + (over ? "bg-blush" : "bg-acid")}>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Spent · {monthLabel(m)}</span>
              <span className="num text-[12px] font-bold">of {pkr(budget, { compact: true })}</span>
            </div>
            <div className="money-xl mt-3 text-[54px] lg:text-[76px]">{pkr(spend)}</div>

            <div className="mt-5 h-5 border-2 border-line bg-card">
              <div className={"h-full " + (over ? "hatch" : "bg-ink")} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[12px] font-bold">
              <span>{pct}% of budget used</span>
              <span>{over ? `Over by ${pkr(spend - budget, { compact: true })}` : `${pkr(budget - spend, { compact: true })} left`}</span>
            </div>
          </div>

          {/* three-up figures, black block */}
          <div className="grid grid-cols-3 border-2 border-t-0 border-line bg-ink text-card">
            {[
              ["Income", pkr(income, { compact: true }), ""],
              ["Saved", pkr(savings, { compact: true }), ""],
              [`Incentive ${household.incentivePct}%`, pkr(incentive, { compact: true }), "text-acid"]
            ].map(([label, value, tone], i) => (
              <div key={i} className={"px-4 py-3.5 " + (i < 2 ? "border-r-2 border-card/20" : "")}>
                <div className="eyebrow text-card/55">{label}</div>
                <div className={"money mt-1 text-[19px] font-bold " + tone}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Alerts ───────────────────────────────────────────────────── */}
        {(reviewCount > 0 || (staleDays !== null && staleDays > 90)) && (
          <div className="space-y-3">
            {reviewCount > 0 && (
              <Link href="/review"
                className="flex items-center justify-between gap-3 border-2 border-line bg-blush px-4 py-3.5 text-[14px] font-bold transition-all hover:shadow-hard">
                <span>{reviewCount} transaction{reviewCount > 1 ? "s" : ""} waiting for review</span>
                <ArrowRight size={18} strokeWidth={2.75} />
              </Link>
            )}
            {staleDays !== null && staleDays > 90 && (
              <Link href="/assets"
                className="flex items-center justify-between gap-3 border-2 border-line bg-card px-4 py-3.5 text-[14px] font-bold transition-all hover:shadow-hard">
                <span>Asset values {staleDays} days old — quarterly check due</span>
                <ArrowRight size={18} strokeWidth={2.75} />
              </Link>
            )}
          </div>
        )}

        {/* ── Income vs expense ────────────────────────────────────────── */}
        <section>
          <div className="block-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="eyebrow">Income vs spend</h2>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 border-2 border-line bg-acid" />In</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 border-2 border-line bg-ink" />Out</span>
              </div>
            </div>
            {trend.length > 1 ? (
              <BarChart data={trend} current={currentLabel} />
            ) : (
              <p className="py-8 text-center text-sm font-semibold text-muted">
                One month of data so far — the trend appears once{" "}
                {monthLabelShort(nextM)} has entries.
              </p>
            )}
          </div>
        </section>

        {/* ── Net worth ────────────────────────────────────────────────── */}
        <section>
          <Link href="/assets"
            className="flex items-center justify-between gap-3 border-2 border-line bg-ink px-5 py-5 text-card transition-all hover:shadow-hard">
            <span className="eyebrow text-card/55">Net worth</span>
            <span className="flex items-center gap-3">
              <span className="money text-[26px] font-bold text-acid">{pkr(netWorth, { compact: true })}</span>
              <ArrowRight size={18} strokeWidth={2.75} />
            </span>
          </Link>
        </section>

        {/* ── Goals ────────────────────────────────────────────────────── */}
        {activeGoals.length > 0 && (
          <section>
            <h2 className="eyebrow mb-2.5">Goals</h2>
            <div className="space-y-3">
              {activeGoals.map((g) => {
                const saved = goalSums.get(g.id) ?? 0;
                const gp = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
                return (
                  <Link key={g.id} href="/goals" className="block border-2 border-line bg-card p-4 transition-all hover:shadow-hard">
                    <div className="flex justify-between text-[15px]">
                      <span className="font-bold">{g.name}</span>
                      <span className="num font-bold text-muted">
                        {pkr(saved, { compact: true })} / {pkr(Number(g.targetAmount), { compact: true })}
                      </span>
                    </div>
                    <div className="mt-2.5 h-4 border-2 border-line bg-paper">
                      <div className="h-full bg-acid" style={{ width: `${gp}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        </div>

        {/* right column: category breakdown + per-person split */}
        <div className="flex flex-col gap-4 lg:min-w-0 lg:flex-1">
        {/* ── Donut: where it went ─────────────────────────────────────── */}
        <section>
          {catData.length > 0 ? (
            <div className="border-2 border-line bg-card">
              <div className="border-b-2 border-line bg-blush px-5 py-3">
                <h2 className="eyebrow">Where it went</h2>
              </div>
              <div className="bg-blush px-5 pb-6 pt-2">
                <Donut data={catData} total={spend} label="Total spent" />
              </div>
              <ul>
                {byCategory.map((c, i) => {
                  const label = c.name ?? "Uncategorised";
                  const share = spend > 0 ? Math.round((Number(c.total) / spend) * 100) : 0;
                  return (
                    <li key={i}
                      className={"flex items-center justify-between gap-3 px-5 py-3 text-[15px] " + (i < byCategory.length - 1 ? "rule-row" : "")}>
                      <span className="flex min-w-0 items-center gap-2.5 font-medium">
                        <CategoryDot name={label} />
                        <span className="truncate">{label}</span>
                        <span className="shrink-0 text-[12px] font-bold text-muted">{share}%</span>
                      </span>
                      <span className="num shrink-0 font-bold">{pkr(Number(c.total))}</span>
                    </li>
                  );
                })}
              </ul>
              {/* Unlabelled spend swamps the chart until the queue is cleared. */}
              {byCategory.some((c) => !c.name) && reviewCount > 0 && (
                <Link href="/review"
                  className="flex items-center justify-between gap-3 border-t-2 border-line bg-acid px-5 py-3.5 text-[13px] font-bold transition-all hover:shadow-hard">
                  <span>Categorise {reviewCount} entries to sharpen this</span>
                  <ArrowRight size={16} strokeWidth={2.75} />
                </Link>
              )}
            </div>
          ) : (
            <div className="block-card p-5 text-sm text-muted">No spending recorded this month yet.</div>
          )}
        </section>

        {/* ── By person ────────────────────────────────────────────────── */}
        {byPerson.some((p) => p.name) && (
          <section>
            <div className="block-card">
              <h2 className="eyebrow border-b-2 border-line px-5 py-3">By person</h2>
              <ul>
                {byPerson.map((p, i) => (
                  <li key={i}
                    className={"flex justify-between px-5 py-3 text-[15px] " + (i < byPerson.length - 1 ? "rule-row" : "")}>
                    <span className="font-medium">{p.name ?? "Household"}</span>
                    <span className="num font-bold">{pkr(Number(p.total))}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        </div>
      </div>

      <div className="mt-4 flex gap-3">
          <Link href="/import" className="btn-quiet flex-1">Import bank CSV</Link>
          <Link href="/settings" className="btn-quiet flex-1">Settings</Link>
      </div>
    </Shell>
  );
}
