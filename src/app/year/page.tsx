import Link from "next/link";
import Shell from "@/components/Shell";
import MonthBars from "@/components/MonthBars";
import { Card, CardHead, Stat, StatRow, BarRow, Pill } from "@/components/ui";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { pkr, monthKey } from "@/lib/money";
import { prettyDescription } from "@/lib/describe";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * The year in numbers. Every figure is per tracked month: a month with no
 * entries is not a month anyone saved in, so it is neither budgeted nor
 * credited (one September import must not look like nine months under
 * budget). Savings and the incentive follow the household's one-off rule,
 * the same as Home.
 */
export default async function YearOverview({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();

  const parsed = Number(sp.y);
  const year = Number.isInteger(parsed) && parsed > 1970 && parsed < 3000 ? parsed : new Date().getFullYear();
  const from = `${year}-01-01`;
  const next = `${year + 1}-01-01`;
  const H = eq(t.transactions.householdId, household.id);
  const inYear = and(H, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next));
  const isSpend = and(eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false));
  const exclude = household.excludeOneOffs;

  const [monthRows, byCategory, biggest, yearGoals] = await Promise.all([
    db().select({
      ym: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'income' then ${t.transactions.amount} end), 0)`,
      spend: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and not ${t.transactions.isPassthrough} then ${t.transactions.amount} end), 0)`,
      oneOff: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' and not ${t.transactions.isPassthrough} and ${t.transactions.isAbnormal} then ${t.transactions.amount} end), 0)`
    }).from(t.transactions).where(inYear).groupBy(sql`1`),

    db().select({
      id: t.transactions.categoryId, name: t.categories.name,
      total: sql<string>`sum(${t.transactions.amount})`, n: sql<string>`count(*)`
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.categories.id, t.transactions.categoryId))
      .where(and(inYear, isSpend))
      .groupBy(t.transactions.categoryId, t.categories.name)
      .orderBy(desc(sql`sum(${t.transactions.amount})`)),

    db().select({
      id: t.transactions.id, description: t.transactions.description, amount: t.transactions.amount,
      txDate: t.transactions.txDate, category: t.categories.name, oneOff: t.transactions.isAbnormal
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.categories.id, t.transactions.categoryId))
      .where(and(inYear, isSpend))
      .orderBy(desc(t.transactions.amount)).limit(5),

    db().select().from(t.goals)
      .where(and(eq(t.goals.householdId, household.id), gte(t.goals.deadline, from), lt(t.goals.deadline, next)))
      .orderBy(t.goals.deadline)
  ]);

  const goalSums = new Map<number, number>();
  if (yearGoals.length) {
    const sums = await db().select({
      goalId: t.goalContributions.goalId, v: sql<string>`coalesce(sum(${t.goalContributions.amount}),0)`
    }).from(t.goalContributions)
      .where(inArray(t.goalContributions.goalId, yearGoals.map((g) => g.id)))
      .groupBy(t.goalContributions.goalId);
    for (const s of sums) goalSums.set(s.goalId, Number(s.v));
  }

  const budget = Number(household.monthlyBudget);
  const pct = household.incentivePct;
  const found = new Map(monthRows.map((r) => [r.ym, r]));
  const nowKey = monthKey();
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const r = found.get(key);
    const spend = r ? Number(r.spend) : 0;
    const oneOff = r ? Number(r.oneOff) : 0;
    const counted = exclude ? spend - oneOff : spend;
    const closed = key < nowKey;
    const saved = r && closed ? Math.max(0, budget - counted) : 0;
    return {
      key, label: new Date(year, i, 1).toLocaleDateString("en-GB", { month: "short" }),
      spend, oneOff, counted, income: r ? Number(r.income) : 0, hasData: !!r, closed,
      saved, incentive: Math.round((saved * pct) / 100)
    };
  });
  const tracked = months.filter((m) => m.hasData);
  const spend = tracked.reduce((a, m) => a + m.spend, 0);
  const income = tracked.reduce((a, m) => a + m.income, 0);
  const oneOffs = tracked.reduce((a, m) => a + m.oneOff, 0);
  const kept = income - spend;
  const rate = income > 0 ? Math.round((kept / income) * 100) : null;
  const avg = tracked.length ? spend / tracked.length : 0;
  const avgCounted = tracked.length ? tracked.reduce((a, m) => a + m.counted, 0) / tracked.length : 0;
  const saved = months.reduce((a, m) => a + m.saved, 0);
  const incentive = months.reduce((a, m) => a + m.incentive, 0);
  const underCount = months.filter((m) => m.hasData && m.closed && m.counted <= budget).length;
  const closedCount = months.filter((m) => m.hasData && m.closed).length;

  return (
    <Shell
      wide
      title={`${year}`}
      action={
        <div className="flex shrink-0 items-center gap-1">
          <Link href={`/year?y=${year - 1}`} aria-label="Previous year"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-line">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="num px-2 text-[13px] font-bold">{year}</span>
          <Link href={`/year?y=${year + 1}`} aria-label="Next year"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-line">
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
      }
    >
      {tracked.length === 0 ? (
        <Card><p className="py-10 text-center text-[15px] font-semibold text-muted">Nothing recorded in {year}.</p></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          <Card className="lg:col-span-12">
            <CardHead title={`${year} so far`} right={
              closedCount > 0 ? <Pill tone={underCount === closedCount ? "good" : underCount === 0 ? "bad" : "warn"}>
                {underCount} of {closedCount} month{closedCount === 1 ? "" : "s"} under budget
              </Pill> : undefined
            } />
            <StatRow cols={6}>
              <Stat label="Spent" value={pkr(spend, { compact: true })} sub={`${tracked.length} month${tracked.length === 1 ? "" : "s"} tracked`} />
              <Stat label="Income" value={pkr(income, { compact: true })} />
              <Stat label="Kept" value={pkr(kept, { compact: true })} tone={kept >= 0 ? "text-good" : "text-over"} sub={rate != null ? `${rate}% of income` : undefined} />
              <Stat label="Avg / month" value={pkr(avg, { compact: true })}
                sub={exclude && avgCounted !== avg ? `${pkr(avgCounted, { compact: true })} in budget` : budget > 0 ? `budget ${pkr(budget, { compact: true })}` : undefined}
                tone={budget > 0 && avgCounted > budget ? "text-over" : ""} />
              <Stat label="One-offs" value={pkr(oneOffs, { compact: true })} sub={exclude ? "outside budget" : "inside budget"} />
              <Stat label={`Incentive ${pct}%`} value={pkr(incentive, { compact: true })} tone={incentive > 0 ? "text-good" : "text-muted"}
                sub={`on ${pkr(saved, { compact: true })} saved`} />
            </StatRow>
          </Card>

          <Card className="lg:col-span-12">
            <CardHead title="Month by month" />
            <MonthBars months={months.map((m) => ({ key: m.key, label: m.label, spend: m.counted, oneOff: m.spend - m.counted, income: m.income, hasData: m.hasData }))}
              budget={budget} current={nowKey.startsWith(String(year)) ? nowKey : undefined} />

            {/* The same months as numbers — an analyst wants the table, not just the shape. */}
            <div className="-mx-5 mt-6 overflow-x-auto px-5 lg:-mx-6 lg:px-6">
              <table className="w-full min-w-[520px] text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                    <th className="pb-2 font-bold">Month</th>
                    <th className="pb-2 text-right font-bold">Spent</th>
                    <th className="pb-2 text-right font-bold">vs budget</th>
                    <th className="pb-2 text-right font-bold">Income</th>
                    <th className="pb-2 text-right font-bold">Kept</th>
                    <th className="pb-2 text-right font-bold">Incentive</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {months.filter((m) => m.hasData).map((m) => {
                    const diff = budget - m.counted;
                    return (
                      <tr key={m.key} className="border-t border-line">
                        <td className="py-2.5 font-semibold">
                          <Link href={`/?m=${m.key}`} className="hover:underline">{m.label}</Link>
                          {!m.closed && <span className="ml-1.5 text-[11px] font-bold text-muted">so far</span>}
                        </td>
                        <td className="py-2.5 text-right font-bold">{pkr(m.spend, { compact: true })}</td>
                        <td className={"py-2.5 text-right font-bold " + (diff >= 0 ? "text-good" : "text-over")}>
                          {budget > 0 ? (diff >= 0 ? "−" : "+") + pkr(Math.abs(diff), { compact: true }) : "—"}
                        </td>
                        <td className="py-2.5 text-right">{pkr(m.income, { compact: true })}</td>
                        <td className={"py-2.5 text-right " + (m.income - m.spend >= 0 ? "" : "text-over")}>{pkr(m.income - m.spend, { compact: true })}</td>
                        <td className="py-2.5 text-right">{m.closed ? pkr(m.incentive, { compact: true }) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="lg:col-span-7">
            <CardHead title="Where it went" href={`/insights?m=${tracked[tracked.length - 1].key}`} link="Insights" />
            <ul className="space-y-3.5">
              {byCategory.slice(0, 10).map((c, i) => {
                const total = Number(c.total);
                return (
                  <BarRow key={i} href={c.id ? `/ledger?cat=${c.id}&m=${tracked[tracked.length - 1].key}` : undefined}
                    label={c.name ?? "Uncategorised"} value={pkr(total, { compact: true })}
                    sub={`${spend > 0 ? Math.round((total / spend) * 100) : 0}% · ${pkr(total / tracked.length, { compact: true })}/mo`}
                    pct={byCategory.length ? (total / Number(byCategory[0].total)) * 100 : 0} />
                );
              })}
            </ul>
          </Card>

          <Card className="lg:col-span-5">
            <CardHead title="Biggest expenses" />
            <ul className="-mx-2">
              {biggest.map((b) => (
                <li key={b.id}>
                  <Link href={`/ledger/${b.id}`} className="flex items-center justify-between gap-3 rounded-[12px] px-2 py-2.5 transition hover:bg-page">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{prettyDescription(b.description) || "—"}</span>
                      <span className="text-[12px] font-semibold text-muted">
                        {new Date(b.txDate + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {b.category ? ` · ${b.category}` : ""}{b.oneOff ? " · one-off" : ""}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[14px] font-bold">{pkr(Number(b.amount), { compact: true })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {yearGoals.length > 0 && (
            <Card className="lg:col-span-12">
              <CardHead title={`Goals due in ${year}`} href="/goals" link="Goals" />
              <ul className="grid gap-3.5 sm:grid-cols-2">
                {yearGoals.map((g) => {
                  const s = goalSums.get(g.id) ?? 0;
                  const target = Number(g.targetAmount);
                  return (
                    <BarRow key={g.id} href="/goals" label={g.name} value={`${pkr(s, { compact: true })} / ${pkr(target, { compact: true })}`}
                      sub={`due ${new Date(g.deadline + "T00:00").toLocaleDateString("en-GB", { month: "short" })}`}
                      pct={target > 0 ? (s / target) * 100 : 0} tone="bg-acid" />
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}
    </Shell>
  );
}
