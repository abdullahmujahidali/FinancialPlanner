import Link from "next/link";
import Shell from "@/components/Shell";
import BarChart from "@/components/BarChart";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import RegularDue from "@/components/RegularDue";
import { getSetupItems } from "@/components/SetupChecklist";
import WhatsNew from "@/components/WhatsNew";
import SpendPace from "@/components/SpendPace";
import { getInsights } from "@/lib/insights";
import { getNamer } from "@/lib/payees";
import { pkr, monthKey, monthRange, monthLabel, monthLabelShort } from "@/lib/money";
import { getBalances } from "@/lib/balances";
import { getGoalForecasts, etaLabel } from "@/lib/forecast";
import { getLoanNet } from "@/lib/loans";
import { ChevronLeft, ChevronRight, ArrowRight, Plus, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { household, user } = await requireContext();
  const nameOf = await getNamer(household.id);
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
    [oneOffRow],
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

    // One-offs stay in the spend total; this is only so the hero can also say
    // what an ordinary month looked like without the hospital bill.
    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions)
      .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false),
        eq(t.transactions.isAbnormal, true))),

    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions).where(and(inMonth, eq(t.transactions.type, "income"))),

    db().select({ v: sql<string>`count(*)` })
      .from(t.transactions).where(and(H, eq(t.transactions.needsReview, true))),

    db().select({
      id: t.categories.id, name: t.categories.name, plan: t.categories.monthlyBudget,
      total: sql<string>`sum(${t.transactions.amount})`
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
      .where(and(inMonth, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false)))
      .groupBy(t.categories.id, t.categories.name, t.categories.monthlyBudget)
      .orderBy(desc(sql`sum(${t.transactions.amount})`)).limit(8),

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

  const assetTotal = Number((netWorthRows.rows?.[0] as any)?.total ?? 0);
  // Net worth is things owned plus money actually held, less what is owed out
  // and plus what is owed in — the same arithmetic the Assets page does.
  const { total: cash, incomplete: cashUnknown } = await getBalances(household.id);
  const {
    net: loanNet,
    weOwe,
    owedToUs,
    overdue: overdueLoans
  } = await getLoanNet(household.id);
  const netWorth = assetTotal + cash + loanNet;

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

  // The forecast always looks forward from today, so it is only shown on the
  // current month. On a past month it would sit there unchanged, reading as a
  // claim about that month rather than about now.
  const goalFc = new Map(
    m === monthKey()
      ? (await getGoalForecasts(household.id, Number(household.monthlyBudget), household.excludeOneOffs))
          .map((f) => [f.goalId, f] as const)
      : []
  );

  const budget = Number(household.monthlyBudget);

  // Day-by-day spend for this month and the one before, for the pace chart;
  // the latest entries; and the strongest finding from Insights.
  const [py, pmo] = m.split("-").map(Number);
  const prevKey = monthKey(new Date(py, pmo - 2, 1));
  const prevFrom = monthRange(prevKey).from;
  const spendExpr = and(H, eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false));
  const [dailyRows, recent, topInsights, [dueRow]] = await Promise.all([
    db().select({
      d: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM-DD')`,
      v: sql<string>`sum(${t.transactions.amount})`
    }).from(t.transactions)
      .where(and(spendExpr, gte(t.transactions.txDate, prevFrom), lt(t.transactions.txDate, next)))
      .groupBy(sql`1`),
    db().select({
      id: t.transactions.id, description: t.transactions.description, amount: t.transactions.amount,
      type: t.transactions.type, txDate: t.transactions.txDate, category: t.categories.name
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.categories.id, t.transactions.categoryId))
      .where(inMonth)
      .orderBy(desc(t.transactions.txDate), desc(t.transactions.id)).limit(5),
    getInsights(household.id, m, budget, household.incentivePct, household.excludeOneOffs).catch(() => []),
    // Regular payments not yet added this month are money already spoken
    // for — "left" overstates what can actually be spent until they are in.
    db().select({ v: sql<string>`coalesce(sum(${t.recurring.amount}), 0)` }).from(t.recurring)
      .where(and(eq(t.recurring.householdId, household.id), eq(t.recurring.isArchived, false),
        eq(t.recurring.type, "expense"), eq(t.recurring.isPassthrough, false),
        sql`(${t.recurring.lastMonth} is null or ${t.recurring.lastMonth} < ${m})`))
  ]);
  const committed = m === monthKey() ? Number(dueRow?.v ?? 0) : 0;
  const cumulative = (key: string, days: number) => {
    const out: number[] = [];
    let run = 0;
    for (let d = 1; d <= days; d++) {
      const row = dailyRows.find((r) => r.d === `${key}-${String(d).padStart(2, "0")}`);
      run += row ? Number(row.v) : 0;
      out.push(run);
    }
    return out;
  };
  const daysInMonth = new Date(py, pmo, 0).getDate();
  const nowKey = monthKey();
  const dayNow = m === nowKey ? new Date().getDate() : m < nowKey ? daysInMonth : 0;
  const daily = cumulative(m, daysInMonth);
  const lastDaily = dailyRows.some((r) => r.d.startsWith(prevKey))
    ? cumulative(prevKey, new Date(py, pmo - 1, 0).getDate())
    : null;
  const daysLeft = m === nowKey ? daysInMonth - dayNow + 1 : 0;
  const firstName = (user.name || "").split(" ")[0];

  const spend = Number(spendRow.v);
  const income = Number(incomeRow.v);
  const oneOffs = Number(oneOffRow.v);
  const routine = spend - oneOffs;
  // A month still running has nothing "saved" yet — on the 2nd it would
  // otherwise claim the whole budget as savings and pay the incentive on it.
  const running = m >= monthKey();
  // What is measured against the budget: everything, or everything but
  // one-offs (household setting). `spend` stays the true total.
  const exclude = household.excludeOneOffs;
  const counted = exclude ? routine : spend;
  const savings = Math.max(0, budget - counted);
  const incentive = Math.round(savings * household.incentivePct / 100);
  const routineIncentive = Math.round(Math.max(0, budget - routine) * household.incentivePct / 100);
  const reviewCount = Number(reviewRow.v);
  const pct = budget > 0 ? Math.min(100, Math.round((counted / budget) * 100)) : 0;
  const over = budget > 0 && counted > budget;

  const staleDays = household.lastRevaluedAt
    ? Math.floor((Date.now() - new Date(household.lastRevaluedAt).getTime()) / 86400000)
    : null;

  const [y, mo] = m.split("-").map(Number);
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const nextM = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;

  // Latest entries and the per-person list share a column beside goals; when
  // neither has anything to show, goals take the full width.
  const hasSide = recent.length > 0 || byPerson.some((p) => p.name);


  const setup = await getSetupItems({
    householdId: household.id,
    reviewCount,
    activeGoals: activeGoals.length,
    goalsWithoutSavings: activeGoals.filter((g) => !((goalSums.get(g.id) ?? 0) > 0)).length
  });
  const setupOpen = setup.filter((i) => !i.done);
  const pacePct = dayNow > 0 ? Math.min(100, (dayNow / daysInMonth) * 100) : 0;
  const safeLeft = Math.max(0, budget - counted - committed);
  const status: { label: string; tone: string } =
    budget <= 0 ? { label: "No budget set", tone: "bg-page text-muted" }
    : over ? { label: "Over budget", tone: "bg-blush text-ink" }
    : running && pct > pacePct + 5 ? { label: "Ahead of pace", tone: "bg-blush/60 text-ink" }
    : { label: running ? "On track" : "Within budget", tone: "bg-acid text-ink" };

  const card = "rounded-[20px] bg-card p-5 lg:p-6";
  const head = "mb-4 flex items-center justify-between gap-3";
  const h2 = "text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink";
  const more = "text-[12px] font-bold text-muted transition hover:text-ink";

  return (
    <Shell
      wide
      title={household.name}
      action={
        <div className="flex shrink-0 items-center gap-1">
          <Link href={`/?m=${prev}`} aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-line">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="whitespace-nowrap px-2 text-[13px] font-bold">{monthLabelShort(m)}</span>
          <Link href={`/?m=${nextM}`} aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-line">
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
      }
    >
      <div className="-mt-2 mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-muted">
          {firstName ? `Salaam, ${firstName}. ` : ""}
          {m === nowKey
            ? budget > 0 && !over
              ? `${pkr(Math.round(safeLeft / Math.max(1, daysLeft)))} a day keeps ${monthLabel(m).split(" ")[0]} in budget.`
              : over ? "The budget is used up for this month." : `Day ${dayNow} of ${daysInMonth}.`
            : m < nowKey ? `Looking back at ${monthLabel(m)}.` : `${monthLabel(m)} hasn't started.`}
        </p>
        <div className="flex gap-2">
          <Link href="/entry" className="btn btn-sm gap-1.5"><Plus size={15} strokeWidth={2.75} /> Expense</Link>
          <Link href="/import" className="btn-quiet btn-sm gap-1.5"><Upload size={15} strokeWidth={2.4} /> Import</Link>
        </div>
      </div>

      <WhatsNew />

      {/*
        One card language throughout: white cards, the same header, colour
        only where it means something (lime = on track / progress, blush =
        over). Rows are equal-height pairs so nothing leaves a hole.
      */}
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        {/* ── The month ─────────────────────────────────────────────────── */}
        <section className={card + " lg:col-span-8"}>
          <div className={head}>
            <h2 className={h2}>{monthLabel(m)}{running && dayNow > 0 ? ` · day ${dayNow} of ${daysInMonth}` : ""}</h2>
            <span className={"rounded-full px-3 py-1 text-[12px] font-bold " + status.tone}>{status.label}</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="money text-[40px] font-extrabold leading-none tracking-[-0.04em] lg:text-[52px]">{pkr(spend)}</span>
            <span className="text-[15px] font-semibold text-muted">
              spent{exclude && oneOffs > 0 ? ` · ${pkr(counted, { compact: true })} counts against` : " of"} {pkr(budget, { compact: true })}
            </span>
          </div>

          {/* The bar shows spend; the tick shows where spend "should" be by today. */}
          <div className="relative mt-5 h-3 rounded-full bg-page">
            <div className={"h-full rounded-full " + (over ? "bg-blush" : "bg-acid")} style={{ width: `${pct}%` }} />
            {running && dayNow > 0 && (
              <span className="absolute -top-1 h-5 w-[3px] rounded-full bg-ink" style={{ left: `calc(${pacePct}% - 1.5px)` }}
                title="Where spending would be at an even pace" />
            )}
          </div>
          <div className="mt-2 flex justify-between text-[12px] font-bold text-muted">
            <span>{pct}% used{running && dayNow > 0 ? ` · ${Math.round(pacePct)}% of the month gone` : ""}</span>
            <span className={over ? "text-over" : ""}>
              {over ? `${pkr(counted - budget, { compact: true })} over` : `${pkr(budget - counted, { compact: true })} left`}
            </span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
            {[
              ["Income", pkr(income, { compact: true }), "", running ? "so far" : "this month"],
              running
                ? ["Safe per day", pkr(Math.round(safeLeft / Math.max(1, daysLeft)), { compact: true }), safeLeft > 0 ? "" : "text-over",
                  committed > 0 ? `after ${pkr(committed, { compact: true })} regular` : `${daysLeft} days left`]
                : ["Kept", pkr(income - spend, { compact: true }), income - spend >= 0 ? "text-good" : "text-over", "income − spending"],
              ["One-offs", pkr(oneOffs, { compact: true }), "",
                oneOffs === 0 ? "none this month" : exclude ? "not counted in budget" : `${pkr(routine, { compact: true })} without`],
              running
                ? [`Incentive ${household.incentivePct}%`, "—", "text-muted", "at month end"]
                : [`Incentive ${household.incentivePct}%`, pkr(incentive, { compact: true }), incentive > 0 ? "text-good" : "text-muted",
                  !exclude && over && oneOffs > 0 && routineIncentive > 0 ? `${pkr(routineIncentive, { compact: true })} without one-offs` : "of what's saved"]
            ].map(([label, value, tone, hint], i) => (
              <div key={i} className={"px-0 sm:px-4 " + (i % 4 !== 0 ? "sm:border-l sm:border-line" : "sm:pl-0")}>
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">{label}</dt>
                <dd className={"money mt-1 text-[20px] font-extrabold " + tone}>{value}</dd>
                <dd className="text-[11.5px] font-semibold text-muted">{hint}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── To do ─────────────────────────────────────────────────────── */}
        <section className={card + " lg:col-span-4"}>
          <div className={head}>
            <h2 className={h2}>To do</h2>
            {setupOpen.length > 0 && (
              <span className="text-[12px] font-bold text-muted">{setup.length - setupOpen.length} of {setup.length} set up</span>
            )}
          </div>
          <ul className="-mx-2">
            {reviewCount > 0 && (
              <TodoRow href="/review" dot="bg-blush" title={`${reviewCount} ${reviewCount === 1 ? "entry" : "entries"} to review`} why="Imported rows that need a category." />
            )}
            {m === nowKey && lastDaily && spend === 0 && (
              <TodoRow href={`/insights?m=${prevKey}`} dot="bg-acid" title={`Review ${monthLabel(prevKey)}`}
                why={`${pkr(lastDaily[lastDaily.length - 1], { compact: true })} spent — where it went and what changed.`} />
            )}
            {topInsights[0] && (
              <TodoRow href={`/insights?m=${m}`} dot={topInsights[0].good ? "bg-acid" : "bg-blush"} title={topInsights[0].title} why={topInsights[0].detail} />
            )}
            {staleDays !== null && staleDays > 90 && (
              <TodoRow href="/assets" dot="bg-blush" title="Revalue assets" why={`Values are ${staleDays} days old.`} />
            )}
            {setupOpen.map((i) => (
              <TodoRow key={i.title} href={i.href} dot="border-2 border-muted/60" title={i.title} why={i.why} />
            ))}
            {reviewCount === 0 && setupOpen.length === 0 && !topInsights[0] && (
              <li className="px-2 py-6 text-center text-[14px] font-semibold text-muted">Nothing waiting. All set up.</li>
            )}
          </ul>
        </section>

        {m === nowKey && (
          <div className="lg:col-span-12 empty:hidden">
            <RegularDue householdId={household.id} month={m} />
          </div>
        )}

        {/* ── Pace ──────────────────────────────────────────────────────── */}
        <section className={card + " lg:col-span-8"}>
          <div className={head}>
            <h2 className={h2}>Spending pace</h2>
            <Link href={`/insights?m=${m}`} className={more}>Insights →</Link>
          </div>
          {dayNow > 0 ? (
            <SpendPace daily={daily} lastDaily={lastDaily} budget={budget} daysInMonth={daysInMonth} today={dayNow} />
          ) : (
            <p className="py-10 text-center text-[14px] font-semibold text-muted">This month hasn&rsquo;t started.</p>
          )}
        </section>

        {/* ── Categories ────────────────────────────────────────────────── */}
        <section className={card + " lg:col-span-4"}>
          <div className={head}>
            <h2 className={h2}>Categories</h2>
            <Link href={byCategory.some((c) => c.plan != null) ? `/ledger?m=${m}` : "/settings/budget"} className={more}>
              {byCategory.some((c) => c.plan != null) ? "Ledger →" : "Set budgets →"}
            </Link>
          </div>
          {byCategory.length === 0 ? (
            <p className="py-10 text-center text-[14px] font-semibold text-muted">No spending yet this month.</p>
          ) : (
            <ul className="space-y-3.5">
              {byCategory.map((c, i) => {
                const total = Number(c.total);
                const plan = c.plan != null ? Number(c.plan) : null;
                const width = plan ? Math.min(100, (total / plan) * 100) : spend > 0 ? (total / spend) * 100 : 0;
                const overPlan = plan != null && total > plan;
                return (
                  <li key={i}>
                    <Link href={`/ledger?m=${m}${c.id ? `&cat=${c.id}` : ""}`} className="block">
                      <div className="flex items-baseline justify-between gap-3 text-[14px]">
                        <span className="truncate font-semibold">{c.name ?? "Uncategorised"}</span>
                        <span className="num shrink-0 font-bold">
                          {pkr(total, { compact: true })}
                          {plan != null && <span className="font-semibold text-muted"> / {pkr(plan, { compact: true })}</span>}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-page">
                        <div className={"h-full rounded-full " + (overPlan ? "bg-over" : plan != null ? "bg-ink" : "bg-ink/60")}
                          style={{ width: `${width}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Latest entries ────────────────────────────────────────────── */}
        <section className={card + " lg:col-span-8"}>
          <div className={head}>
            <h2 className={h2}>Latest entries</h2>
            <Link href={`/ledger?m=${m}`} className={more}>All →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-[14px] font-semibold text-muted">Nothing entered this month yet.</p>
          ) : (
            <ul className="-mx-2">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/ledger/${r.id}`} className="flex items-center justify-between gap-3 rounded-[12px] px-2 py-2.5 transition hover:bg-page">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">
                        {nameOf(r.description, r.category || (r.type === "income" ? "Income" : "Entry"))}
                      </span>
                      <span className="text-[12px] font-semibold text-muted">
                        {new Date(r.txDate + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {r.type === "transfer" ? " · transfer" : r.category ? ` · ${r.category}` : r.type === "expense" ? " · no category" : ""}
                      </span>
                    </span>
                    <span className={"num shrink-0 text-[14px] font-bold " + (r.type === "income" ? "text-good" : r.type === "transfer" ? "text-muted" : "")}>
                      {r.type === "income" ? "+" : ""}{pkr(Number(r.amount))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Position: cash, net worth, loans ──────────────────────────── */}
        <section className={card + " lg:col-span-4"}>
          <div className={head}>
            <h2 className={h2}>Your position</h2>
          </div>
          <ul className="-mx-2">
            <PositionRow href="/settings/accounts" label="Money on hand" value={pkr(cash, { compact: true })}
              note={cashUnknown ? "Opening balance missing" : "All accounts"} warn={cashUnknown} />
            <PositionRow href="/assets" label="Net worth" value={pkr(netWorth, { compact: true })}
              note={`${pkr(assetTotal, { compact: true })} in assets`} />
            {(weOwe > 0 || owedToUs > 0) && (
              <PositionRow href="/loans" label="Loans" value={(loanNet < 0 ? "−" : "+") + pkr(Math.abs(loanNet), { compact: true })}
                note={[weOwe > 0 && `you owe ${pkr(weOwe, { compact: true })}`, owedToUs > 0 && `owed ${pkr(owedToUs, { compact: true })}`].filter(Boolean).join(" · ") + (overdueLoans > 0 ? " · overdue" : "")}
                warn={overdueLoans > 0} />
            )}
          </ul>
          {byPerson.some((p) => p.name) && (
            <>
              <h3 className="mb-2 mt-5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">Spent on</h3>
              <ul className="space-y-1.5">
                {byPerson.map((p, i) => (
                  <li key={i} className="flex justify-between text-[13.5px]">
                    {p.id ? <Link href={`/people/${p.id}?m=${m}`} className="font-semibold hover:underline">{p.name}</Link>
                      : <span className="font-semibold">Household</span>}
                    <span className="num font-bold">{pkr(Number(p.total), { compact: true })}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ── Goals ─────────────────────────────────────────────────────── */}
        <section className={card + " lg:col-span-12"}>
          <div className={head}>
            <h2 className={h2}>Goals</h2>
            <Link href="/goals" className={more}>{activeGoals.length > 0 ? "Manage →" : "Add a goal →"}</Link>
          </div>
          {activeGoals.length === 0 ? (
            <p className="text-[14px] text-muted">No savings goals yet — a car, a plot, an emergency fund.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {activeGoals.map((g) => {
                const saved = goalSums.get(g.id) ?? 0;
                const gp = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
                const f = goalFc.get(g.id);
                return (
                  <Link key={g.id} href="/goals" className="rounded-[14px] bg-page p-4 transition hover:bg-line">
                    <div className="truncate text-[14px] font-bold">{g.name}</div>
                    <div className="num mt-1 text-[12.5px] font-semibold text-muted">
                      {pkr(saved, { compact: true })} of {pkr(Number(g.targetAmount), { compact: true })}
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${gp}%` }} />
                    </div>
                    <div className="mt-2 text-[12px] font-bold text-muted">
                      {f?.etaMonth ? (f.deadline && !f.deadline.onTrack ? `late — ${etaLabel(f.etaMonth)}` : `on track for ${etaLabel(f.etaMonth)}`) : `${gp}% saved`}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {trend.length > 1 && (
          <section className={card + " lg:col-span-12"}>
            <div className={head}>
              <h2 className={h2}>Income vs spend</h2>
              <div className="flex items-center gap-4 text-[12px] font-bold">
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-acid" />In</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />Out</span>
              </div>
            </div>
            <BarChart data={trend} current={currentLabel} />
          </section>
        )}
      </div>
    </Shell>
  );
}

function TodoRow({ href, dot, title, why }: { href: string; dot: string; title: string; why: string }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-3 rounded-[12px] px-2 py-2.5 transition hover:bg-page">
        <span className={"mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full " + dot} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold leading-snug">{title}</span>
          <span className="mt-0.5 line-clamp-2 block text-[12.5px] font-medium leading-snug text-muted">{why}</span>
        </span>
        <ArrowRight size={15} strokeWidth={2.4} className="mt-1 shrink-0 text-muted" />
      </Link>
    </li>
  );
}

function PositionRow({ href, label, value, note, warn }: { href: string; label: string; value: string; note: string; warn?: boolean }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 rounded-[12px] px-2 py-2.5 transition hover:bg-page">
        <span className="min-w-0">
          <span className="block text-[13.5px] font-bold">{label}</span>
          <span className={"block truncate text-[12px] font-semibold " + (warn ? "text-over" : "text-muted")}>{note}</span>
        </span>
        <span className="money shrink-0 text-[20px] font-extrabold">{value}</span>
      </Link>
    </li>
  );
}
