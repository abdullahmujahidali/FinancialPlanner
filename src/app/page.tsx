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
      id: t.persons.id, name: t.persons.name, total: sql<string>`sum(${t.transactions.amount})`
    }).from(t.transactions)
      .leftJoin(t.persons, eq(t.transactions.personId, t.persons.id))
      .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
      .groupBy(t.persons.id, t.persons.name)
      .orderBy(desc(sql`sum(${t.transactions.amount})`)),

    db().select({
      ym: sql<string>`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'income' then ${t.transactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and not ${t.transactions.isPassthrough} then ${t.transactions.amount} else 0 end), 0)`
    }).from(t.transactions)
      .where(and(H, gte(t.transactions.txDate, trendFrom), lt(t.transactions.txDate, next)))
      .groupBy(sql`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${t.transactions.txDate}::date, 'YYYY-MM')`),

    // LEFT join + coalesce: an asset with no revaluation yet is still worth
    // roughly what it cost. An inner join dropped those to zero here while the
    // assets page counted them, so the two pages disagreed on net worth.
    db().execute(sql`
      select coalesce(sum(coalesce(v.value, a.purchase_price)), 0) as total from ${t.assets} a
      left join lateral (
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
        <div className="flex shrink-0 items-center gap-1">
          <Link href={`/?m=${prev}`} aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="whitespace-nowrap px-2 text-[13px] font-bold">{monthLabelShort(m)}</span>
          <Link href={`/?m=${nextM}`} aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-[56%] lg:shrink-0 xl:w-[58%]">

          {/* ── Hero zone: the month's spend against budget ──────────────── */}
          <section className={over ? "zone-blush" : "zone-acid"}>
            <span className="eyebrow">Spent · {monthLabel(m)}</span>
            <div className="money-xl mt-4 text-[60px] lg:text-[84px]">{pkr(spend)}</div>

            <div className="mt-7 h-2.5 overflow-hidden rounded-full bg-ink/15">
              <div className={"h-full rounded-full " + (over ? "hatch" : "bg-ink")} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-[13px] font-bold">
              <span>{pct}% of {pkr(budget, { compact: true })} budget</span>
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
                ["Income", pkr(income, { compact: true }), "text-white", null],
                [
                  "Saved",
                  pkr(savings, { compact: true }),
                  "text-white",
                  over ? "budget exceeded" : `of ${pkr(budget, { compact: true })} budget`
                ],
                [
                  `Incentive ${household.incentivePct}%`,
                  pkr(incentive, { compact: true }),
                  over ? "text-white/40" : "text-acid",
                  // A zero here is a real result, not a bug — say which.
                  over ? "nothing saved this month" : `${household.incentivePct}% of what's saved`
                ]
              ].map(([label, value, tone, hint], i) => (
                <div key={i}>
                  <div className="eyebrow text-white/45">{label}</div>
                  <div className={"money mt-2 text-[22px] font-bold lg:text-[26px] " + tone}>{value}</div>
                  {hint && <div className="mt-1 text-[11px] font-semibold text-white/35">{hint}</div>}
                </div>
              ))}
            </div>
          </section>

          {/* ── Alerts ───────────────────────────────────────────────────── */}
          {reviewCount > 0 && (
            <Link href="/review"
              className="flex items-center justify-between gap-3 rounded-[18px] bg-blush px-6 py-5 text-[15px] font-bold transition hover:bg-blushdim">
              <span>{reviewCount} transaction{reviewCount > 1 ? "s" : ""} waiting for review</span>
              <ArrowRight size={19} strokeWidth={2.5} />
            </Link>
          )}
          {staleDays !== null && staleDays > 90 && (
            <Link href="/assets"
              className="flex items-center justify-between gap-3 rounded-[18px] bg-card px-6 py-5 text-[15px] font-bold transition hover:bg-page">
              <span>Asset values {staleDays} days old — quarterly check due</span>
              <ArrowRight size={19} strokeWidth={2.5} />
            </Link>
          )}

          {/* ── Income vs spend ──────────────────────────────────────────── */}
          <section className="zone-card">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="eyebrow">Income vs spend</h2>
              <div className="flex items-center gap-4 text-[12px] font-bold">
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-acid" />In</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />Out</span>
              </div>
            </div>
            {trend.length > 0 ? (
              <>
                <BarChart data={trend} current={currentLabel} />
                {trend.length === 1 && (
                  // One month is still a comparison worth seeing; only say the
                  // trend is thin, rather than showing an empty card.
                  <p className="mt-5 text-center text-[13px] font-semibold text-muted">
                    One month so far — more bars appear as the months go by.
                  </p>
                )}
              </>
            ) : (
              <p className="py-10 text-center text-[14px] font-semibold text-muted">
                No entries yet this month.
              </p>
            )}
          </section>

          {/* ── Net worth ────────────────────────────────────────────────── */}
          <Link href="/assets"
            className="flex items-center justify-between gap-3 rounded-[22px] bg-ink px-6 py-6 text-white transition hover:bg-ink2 lg:px-8">
            <span className="eyebrow text-white/45">Net worth</span>
            <span className="flex items-center gap-3">
              <span className="money text-[28px] font-bold text-acid">{pkr(netWorth, { compact: true })}</span>
              <ArrowRight size={19} strokeWidth={2.5} />
            </span>
          </Link>

          {/* ── Goals ────────────────────────────────────────────────────── */}
          <section className="zone-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="eyebrow">Goals</h2>
              <Link href="/goals" className="text-[12px] font-bold text-muted transition hover:text-ink">
                {activeGoals.length > 0 ? "Manage" : "Add a goal"}
              </Link>
            </div>
            {activeGoals.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-muted">
                No savings goals yet. Set one — a car, a plot, an emergency fund — and its progress
                shows here every time you open the app.
              </p>
            ) : (
              <div className="space-y-5">
                {activeGoals.map((g) => {
                  const saved = goalSums.get(g.id) ?? 0;
                  const gp = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
                  return (
                    <Link key={g.id} href="/goals" className="block">
                      <div className="flex justify-between text-[15px]">
                        <span className="font-bold">{g.name}</span>
                        <span className="num font-bold text-muted">
                          {pkr(saved, { compact: true })} / {pkr(Number(g.targetAmount), { compact: true })}
                        </span>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-page">
                        <div className="h-full rounded-full bg-acid" style={{ width: `${gp}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column: where it went ─────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          {catData.length > 0 ? (
            <section className="overflow-hidden rounded-[22px] bg-card">
              <div className="bg-card px-6 pb-8 pt-6 lg:px-8">
                <h2 className="eyebrow">Where it went</h2>
                <div className="mt-5">
                  <Donut data={catData} total={spend} label="Total spent" currency={household.currency} />
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

              {byCategory.some((c) => !c.name) && reviewCount > 0 && (
                <Link href="/review"
                  className="flex items-center justify-between gap-3 bg-acid px-6 py-4 text-[13px] font-bold transition hover:bg-aciddim lg:px-8">
                  <span>Categorise {reviewCount} entries to sharpen this</span>
                  <ArrowRight size={17} strokeWidth={2.5} />
                </Link>
              )}
            </section>
          ) : (
            <section className="zone-card text-[14px] font-semibold text-muted">
              No spending recorded this month yet.
            </section>
          )}

          {byPerson.some((p) => p.name) && (
            <section className="zone-card">
              <h2 className="eyebrow">By person</h2>
              {/* Someone with only reimbursed spending shows nothing here, which
                  looks like a bug unless we say why. */}
              <p className="mb-3 mt-2 text-[13px] leading-relaxed text-muted">
                Spending tagged to each person. Reimbursed bills are left out, so a
                person only appears once something was actually paid for them.
              </p>
              <ul>
                {byPerson.map((p, i) => {
                  const row = (
                    <>
                      <span className="font-semibold">{p.name ?? "Household"}</span>
                      <span className="num font-bold">{pkr(Number(p.total))}</span>
                    </>
                  );
                  const cls =
                    "flex items-center justify-between gap-3 py-4 text-[15px] " +
                    (i < byPerson.length - 1 ? "rule-row " : "");
                  return (
                    <li key={i}>
                      {p.id ? (
                        <Link href={`/people/${p.id}?m=${m}`} className={cls + "-mx-2 rounded-[12px] px-2 transition hover:bg-page"}>
                          {row}
                        </Link>
                      ) : (
                        <div className={cls}>{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex gap-3">
            <Link href="/import" className="btn-quiet flex-1">Import bank CSV</Link>
            <Link href="/settings" className="btn-quiet flex-1">Settings</Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}
