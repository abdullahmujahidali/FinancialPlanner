import Link from "next/link";
import Shell from "@/components/Shell";
import CategoryDot from "@/components/CategoryDot";
import Donut from "@/components/Donut";
import YearBars from "@/components/YearBars";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { pkr, todayStr } from "@/lib/money";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function YearOverview({
  searchParams
}: {
  searchParams: Promise<{ y?: string }>;
}) {
  const sp = await searchParams;
  const { household } = await requireContext();

  const parsed = Number(sp.y);
  const year = Number.isInteger(parsed) && parsed > 1970 && parsed < 3000
    ? parsed
    : new Date().getFullYear();

  const from = `${year}-01-01`;
  const next = `${year + 1}-01-01`;

  const H = eq(t.transactions.householdId, household.id);
  const inYear = and(H, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next));
  // Transfers are never spend, and reimbursed bills never count against budget.
  const isSpend = and(eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false));

  // The DB is a round trip away — every query here is independent, so they go
  // out together rather than stacking latency twelve months deep.
  const [[spendRow], [incomeRow], byCategory, monthRows, yearGoals] = await Promise.all([
    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions).where(and(inYear, isSpend)),

    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions).where(and(inYear, eq(t.transactions.type, "income"))),

    db().select({
      name: t.categories.name, total: sql<string>`sum(${t.transactions.amount})`
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
      .where(and(inYear, isSpend))
      .groupBy(t.categories.name)
      .orderBy(desc(sql`sum(${t.transactions.amount})`)).limit(6),

    db().select({
      ym: sql<string>`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'income' then ${t.transactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and not ${t.transactions.isPassthrough} then ${t.transactions.amount} else 0 end), 0)`
    }).from(t.transactions)
      .where(inYear)
      .groupBy(sql`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`),

    db().select().from(t.goals)
      .where(and(
        eq(t.goals.householdId, household.id),
        gte(t.goals.deadline, from),
        lt(t.goals.deadline, next)
      ))
      .orderBy(t.goals.deadline)
  ]);

  // One grouped query for every goal's saved total, never one query per goal.
  const goalSums = new Map<number, number>();
  if (yearGoals.length) {
    const sums = await db().select({
      goalId: t.goalContributions.goalId,
      v: sql<string>`coalesce(sum(${t.goalContributions.amount}),0)`
    }).from(t.goalContributions)
      .where(inArray(t.goalContributions.goalId, yearGoals.map((g) => g.id)))
      .groupBy(t.goalContributions.goalId);
    for (const s of sums) goalSums.set(s.goalId, Number(s.v));
  }

  // Fill the gaps: a year with three months of data should still read as a
  // year, not as a three-bar chart.
  const found = new Map(monthRows.map((r) => [r.ym, r]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const row = found.get(key);
    const d = new Date(year, i, 1);
    return {
      key,
      label: d.toLocaleDateString("en-PK", { month: "short" }),
      short: d.toLocaleDateString("en-PK", { month: "narrow" }),
      income: row ? Number(row.income) : 0,
      expense: row ? Number(row.expense) : 0,
      hasData: !!row
    };
  });

  const withData = months.filter((m) => m.hasData && (m.expense > 0 || m.income > 0));
  const busiest = withData.length
    ? withData.reduce((a, b) => (b.expense > a.expense ? b : a))
    : null;
  const quietest = withData.length
    ? withData.reduce((a, b) => (b.expense < a.expense ? b : a))
    : null;

  const monthlyBudget = Number(household.monthlyBudget);
  const spend = Number(spendRow.v);
  const income = Number(incomeRow.v);

  // Only budget for months that have actually happened. Charging the full
  // twelve months in September claimed ~37 lakh of "savings" from months that
  // had not been lived through yet, which made the incentive fiction too.
  const now2 = new Date();
  const elapsed = year < now2.getFullYear()
    ? 12
    : year > now2.getFullYear()
      ? 0
      : now2.getMonth() + 1;
  const budget = monthlyBudget * elapsed;
  const partial = elapsed > 0 && elapsed < 12;

  // Savings is money that actually came in and did not go out — not budget
  // headroom. Budget headroom is shown separately by the progress bar.
  const savings = Math.max(0, income - spend);
  const incentive = Math.round((savings * household.incentivePct) / 100);
  const pct = budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
  const over = budget > 0 && spend > budget;

  const catData = byCategory.map((c) => ({ name: c.name ?? "Uncategorised", value: Number(c.total) }));

  const now = new Date();
  const currentLabel = now.getFullYear() === year
    ? now.toLocaleDateString("en-PK", { month: "short" })
    : undefined;
  const today = todayStr();

  return (
    <Shell
      wide
      title={`Year ${year}`}
      action={
        <div className="flex shrink-0 items-center gap-1">
          <Link href={`/year?y=${year - 1}`} aria-label="Previous year"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="num whitespace-nowrap px-2 text-[13px] font-bold">{year}</span>
          <Link href={`/year?y=${year + 1}`} aria-label="Next year"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-[56%] lg:shrink-0 xl:w-[58%]">

          {/* ── Hero: the year's spend against twelve months of budget ────── */}
          <section className={over ? "zone-blush" : "zone-acid"}>
            <span className="eyebrow">Spent · {year}</span>
            <div className="money-xl mt-4 text-[60px] lg:text-[84px]">{pkr(spend)}</div>

            <div className="mt-7 h-2.5 overflow-hidden rounded-full bg-ink/15">
              <div className={"h-full rounded-full " + (over ? "hatch" : "bg-ink")} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-[13px] font-bold">
              <span>
                {pct}% of {pkr(budget, { compact: true })}
                {partial ? ` budget so far (${elapsed} ${elapsed === 1 ? "month" : "months"})` : " yearly budget"}
              </span>
              <span>
                {over
                  ? `Over by ${pkr(spend - budget, { compact: true })}`
                  : `${pkr(budget - spend, { compact: true })} left`}
              </span>
            </div>
          </section>

          {/* ── Three-up figures, black zone ─────────────────────────────── */}
          <section className="zone-ink !py-7">
            <div className="grid grid-cols-3 gap-4">
              {[
                ["Income", pkr(income, { compact: true }), "text-white", "everything that came in"],
                ["Saved", pkr(savings, { compact: true }), "text-white", "income minus spend"],
                [
                  `Incentive ${household.incentivePct}%`,
                  pkr(incentive, { compact: true }),
                  "text-acid",
                  savings > 0 ? `${household.incentivePct}% of what's saved` : "nothing saved yet"
                ]
              ].map(([label, value, tone, hint], i) => (
                <div key={i}>
                  <div className="eyebrow text-white/45">{label}</div>
                  <div className={"money mt-2 text-[22px] font-bold lg:text-[26px] " + tone}>{value}</div>
                  <div className="mt-1 text-[11px] font-semibold leading-tight text-white/40">{hint}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Twelve months ────────────────────────────────────────────── */}
          <section className="zone-card">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="eyebrow">Month by month</h2>
              <div className="flex items-center gap-4 text-[12px] font-bold">
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-acid" />In</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />Out</span>
              </div>
            </div>
            <YearBars data={months} current={currentLabel} />
          </section>

          {/* ── Busiest / quietest month ─────────────────────────────────── */}
          {busiest && quietest && busiest.label !== quietest.label && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[18px] bg-card px-5 py-5 lg:px-6">
                <div className="eyebrow text-muted">Highest spend</div>
                <div className="mt-2 text-[15px] font-bold">{busiest.label} {year}</div>
                <div className="money mt-1 text-[22px] font-bold">{pkr(busiest.expense, { compact: true })}</div>
              </div>
              <div className="rounded-[18px] bg-card px-5 py-5 lg:px-6">
                <div className="eyebrow text-muted">Lowest spend</div>
                <div className="mt-2 text-[15px] font-bold">{quietest.label} {year}</div>
                <div className="money mt-1 text-[22px] font-bold">{pkr(quietest.expense, { compact: true })}</div>
              </div>
            </div>
          )}

          {/* ── Goals landing in this year ───────────────────────────────── */}
          <section className="zone-card">
            <h2 className="eyebrow mb-5">Goals due in {year}</h2>
            {yearGoals.length === 0 ? (
              <p className="text-[14px] font-semibold text-muted">
                No goal has a deadline in {year}.{" "}
                <Link href="/goals" className="font-bold text-ink underline underline-offset-2">Set one</Link>
              </p>
            ) : (
              <div className="space-y-5">
                {yearGoals.map((g, i) => {
                  const saved = goalSums.get(g.id) ?? 0;
                  const target = Number(g.targetAmount);
                  const gp = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
                  const days = g.deadline
                    ? Math.round(
                        (new Date(g.deadline + "T00:00:00").getTime() -
                          new Date(today + "T00:00:00").getTime()) / 86400000
                      )
                    : null;
                  const note = g.status === "done"
                    ? "Completed"
                    : days === null ? ""
                      : days < 0 ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
                        : days === 0 ? "Due today"
                          : `Due in ${days} day${days === 1 ? "" : "s"}`;
                  return (
                    <Link key={g.id} href="/goals"
                      className={"block " + (i < yearGoals.length - 1 ? "rule-row pb-5" : "")}>
                      <div className="flex justify-between gap-3 text-[15px]">
                        <span className="truncate font-bold">{g.name}</span>
                        <span className="num shrink-0 font-bold text-muted">
                          {pkr(saved, { compact: true })} / {pkr(target, { compact: true })}
                        </span>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-page">
                        <div className="h-full rounded-full bg-acid" style={{ width: `${gp}%` }} />
                      </div>
                      {note && (
                        <div className={"mt-2 text-[12px] font-bold " + (days !== null && days < 0 && g.status !== "done" ? "text-over" : "text-muted")}>
                          {note}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column: where the year went ──────────────────────────── */}
        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          {catData.length > 0 ? (
            <section className="overflow-hidden rounded-[22px] bg-card">
              <div className="bg-card px-6 pb-8 pt-6 lg:px-8">
                <h2 className="eyebrow">Where it went</h2>
                <div className="mt-5">
                  <Donut data={catData} total={spend} label={`Spent in ${year}`} currency={household.currency} />
                </div>
              </div>

              <ul className="px-6 py-2 lg:px-8">
                {byCategory.map((c, i) => {
                  const label = c.name ?? "Uncategorised";
                  const share = spend > 0 ? Math.round((Number(c.total) / spend) * 100) : 0;
                  return (
                    <li key={i}
                      className={"flex items-center justify-between gap-3 py-4 text-[15px] " + (i < byCategory.length - 1 ? "rule-row" : "")}>
                      <span className="flex min-w-0 items-center gap-3 font-semibold">
                        <CategoryDot name={label} index={i} />
                        <span className="truncate">{label}</span>
                        <span className="shrink-0 text-[12px] font-bold text-muted">{share}%</span>
                      </span>
                      <span className="num shrink-0 font-bold">{pkr(Number(c.total))}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className="zone-card text-[14px] font-semibold text-muted">
              Nothing recorded for {year} yet.
            </section>
          )}

          <Link href="/ledger"
            className="flex items-center justify-between gap-3 rounded-[22px] bg-ink px-6 py-6 text-white transition hover:bg-ink2 lg:px-8">
            <span className="eyebrow text-white/45">Every entry in {year}</span>
            <ArrowRight size={19} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </Shell>
  );
}
