import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import { Card, CardHead, Stat, StatRow, BarRow, Pill } from "@/components/ui";
import { requireContext } from "@/lib/session";
import { getInsights, getMonthBrief, defaultInsightsMonth, type Insight } from "@/lib/insights";
import { monthLabel, monthLabelShort, pkr } from "@/lib/money";
import { getNamer } from "@/lib/payees";
import {
  ChevronLeft, ChevronRight, TrendingUp, Repeat, Copy, Trophy, ArrowUpRight, Sparkles, Target, ArrowRight
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Insights — the month as numbers. Figures first, a few words of label, and
 * every row links to the entries behind it. Findings compare the household
 * against its own history (and its own category plans), never a benchmark.
 */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const nameOf = await getNamer(household.id);
  const m = sp.m || defaultInsightsMonth();
  const budget = Number(household.monthlyBudget);
  const exclude = household.excludeOneOffs;

  const [insights, b] = await Promise.all([
    getInsights(household.id, m, budget, household.incentivePct, exclude),
    getMonthBrief(household.id, m, budget)
  ]);

  const prev = shiftMonth(m, -1);
  const next = shiftMonth(m, 1);
  const empty = b.spend === 0 && b.income === 0 && b.passthrough === 0;

  const counted = exclude ? b.spend - b.abnormal : b.spend;
  const left = budget - counted;
  const running = b.daysElapsed > 0 && b.daysElapsed < b.daysInMonth;
  const projected = running && b.daysElapsed >= 7 ? (counted / b.daysElapsed) * b.daysInMonth : null;
  const kept = b.income - b.spend;
  const vsLast = b.lastMonth != null && b.lastMonth > 0 ? Math.round(((b.spend - b.lastMonth) / b.lastMonth) * 100) : null;
  const top = b.categories[0];
  const incentive = !running && left > 0 ? Math.round((left * household.incentivePct) / 100) : 0;

  return (
    <Shell
      wide
      back={{ href: "/", label: "Home" }}
      title="Insights"
      action={
        <div className="flex items-center gap-1">
          <Link href={`/insights?m=${prev}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-card transition hover:bg-line" aria-label="Previous month">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="px-2 text-[13px] font-bold">{monthLabelShort(m)}</span>
          <Link href={`/insights?m=${next}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-card transition hover:bg-line" aria-label="Next month">
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
      }
    >
      {empty ? (
        <EmptyState Icon={Sparkles} title={`Nothing recorded for ${monthLabel(m)}`}
          body="Step back a month with the arrows, or import that month's statement."
          action={<Link href="/import" className="btn">Import a statement</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          {/* ── The month in numbers ──────────────────────────────────── */}
          <Card className="lg:col-span-12">
            <CardHead title={monthLabel(m) + (running ? " · so far" : "")} right={
              budget > 0 ? <Pill tone={left >= 0 ? "good" : "bad"}>
                {left >= 0 ? `${pkr(left, { compact: true })} under budget` : `${pkr(-left, { compact: true })} over budget`}
              </Pill> : undefined
            } />
            <StatRow cols={6}>
              <Stat label="Spent" value={pkr(b.spend, { compact: true })}
                sub={vsLast != null ? `${vsLast >= 0 ? "+" : ""}${vsLast}% vs ${monthLabelShort(prev).split(" ")[0]}` : `of ${pkr(budget, { compact: true })}`}
                tone={vsLast != null && vsLast > 10 ? "text-over" : ""} />
              <Stat label={exclude ? "Counted in budget" : "Budget used"} value={budget > 0 ? `${Math.round((counted / budget) * 100)}%` : "—"}
                sub={pkr(counted, { compact: true })} tone={left < 0 ? "text-over" : ""} />
              <Stat label="One-offs" value={pkr(b.abnormal, { compact: true })}
                sub={b.spend > 0 ? `${Math.round((b.abnormal / b.spend) * 100)}% of spend` : undefined} />
              <Stat label="Income" value={pkr(b.income, { compact: true })} sub={`kept ${pkr(kept, { compact: true })}`}
                tone={kept < 0 ? "text-over" : ""} />
              {projected != null
                ? <Stat label="Month-end pace" value={pkr(projected, { compact: true })} tone={projected > budget ? "text-over" : "text-good"}
                    sub={projected > budget ? `${pkr(projected - budget, { compact: true })} over` : "inside budget"} />
                : <Stat label={`Incentive ${household.incentivePct}%`} value={running ? "—" : pkr(incentive, { compact: true })}
                    tone={incentive > 0 ? "text-good" : "text-muted"} sub={running ? "at month end" : undefined} />}
              <Stat label="Top category" value={top ? `${Math.round((top.total / Math.max(1, b.spend)) * 100)}%` : "—"} sub={top?.name} />
            </StatRow>

            {(b.uncategorised.count > 0 || b.passthrough > 0) && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 text-[12.5px] font-bold">
                {b.uncategorised.count > 0 && (
                  <Link href="/review" className="rounded-full bg-blush px-3 py-1.5">
                    {b.uncategorised.count} uncategorised · {pkr(b.uncategorised.total, { compact: true })} →
                  </Link>
                )}
                {b.passthrough > 0 && (
                  <Link href={`/ledger?m=${m}&flag=passthrough`} className="rounded-full bg-page px-3 py-1.5 text-muted">
                    {pkr(b.passthrough, { compact: true })} reimbursed, not counted →
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* ── Findings: one number each ─────────────────────────────── */}
          <Card className="lg:col-span-12">
            <CardHead title="What changed" right={
              b.historyMonths < 2 ? <span className="text-[12px] font-bold text-muted">
                vs {b.historyMonths === 0 ? "your category budgets" : "last month"}
              </span> : undefined
            } />
            {insights.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-page px-4 py-3">
                <span className="text-[13.5px] font-semibold text-muted">
                  {b.historyMonths === 0
                    ? "No earlier month yet. Category budgets are checked meanwhile."
                    : "Nothing unusual: no jumps, no double charges, no rising bills."}
                </span>
                {b.historyMonths === 0 && (
                  <Link href="/settings/budget" className="text-[13px] font-bold">Set category budgets →</Link>
                )}
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights.map((ins, i) => <Finding key={i} insight={ins} />)}
              </ul>
            )}
          </Card>

          {/* ── Categories with deltas and plans ──────────────────────── */}
          <Card className="lg:col-span-7">
            <CardHead title="Categories" right={
              <span className="text-[12px] font-bold text-muted">
                {b.categories.some((c) => c.prev != null) ? `vs ${monthLabelShort(prev).split(" ")[0]}` : "share"}
              </span>
            } />
            <ul className="space-y-3.5">
              {b.categories.map((c, i) => {
                const delta = c.prev != null && c.prev > 0 ? Math.round(((c.total - c.prev) / c.prev) * 100) : null;
                const sub = c.plan != null
                  ? `${Math.round((c.total / c.plan) * 100)}% of ${pkr(c.plan, { compact: true })}`
                  : delta != null ? `${delta >= 0 ? "+" : ""}${delta}%`
                  : c.prev === 0 ? "new" : `${Math.round((c.total / Math.max(1, b.spend)) * 100)}%`;
                return (
                  <BarRow key={i} href={`/ledger?m=${m}${c.id ? `&cat=${c.id}` : "&flag=review"}`}
                    label={c.name} value={pkr(c.total, { compact: true })} sub={`${c.count} · ${sub}`}
                    pct={c.plan ? (c.total / c.plan) * 100 : (c.total / Math.max(1, b.categories[0].total)) * 100}
                    tone={c.plan != null && c.total > c.plan ? "bg-over" : "bg-ink"} />
                );
              })}
            </ul>
          </Card>

          <div className="flex flex-col gap-4 lg:col-span-5 lg:gap-5">
            <Card>
              <CardHead title="Biggest expenses" href={`/ledger?m=${m}`} link="Ledger" />
              <ul className="-mx-2">
                {b.biggest.map((x) => (
                  <li key={x.id}>
                    <Link href={`/ledger/${x.id}`} className="flex items-center justify-between gap-3 rounded-[12px] px-2 py-2 transition hover:bg-page">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">{nameOf(x.description, "—")}</span>
                        <span className="text-[12px] font-semibold text-muted">
                          {new Date(x.txDate + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          {x.category ? ` · ${x.category}` : ""}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[14px] font-bold">{pkr(x.amount, { compact: true })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            {b.people.length > 0 && (
              <Card>
                <CardHead title="Spent on" />
                <ul className="space-y-3.5">
                  {b.people.map((p, i) => (
                    <BarRow key={i} href={p.id ? `/people/${p.id}?m=${m}` : undefined} label={p.name}
                      value={pkr(p.total, { compact: true })} sub={`${Math.round((p.total / Math.max(1, b.spend)) * 100)}%`}
                      pct={(p.total / Math.max(1, b.people[0].total)) * 100} tone="bg-ink/70" />
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

const ICONS = { spike: ArrowUpRight, trend: TrendingUp, creep: Repeat, duplicate: Copy, streak: Trophy, goal: Target } as const;

/** A finding as a tile: the number first, a one-line title, a link to the rows. */
function Finding({ insight }: { insight: Insight }) {
  const Icon = ICONS[insight.kind];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={"money text-[24px] font-extrabold leading-none " + (insight.good ? "text-good" : "text-over")}>
          {insight.value ?? ""}
        </span>
        <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full " + (insight.good ? "bg-acid" : "bg-blush/50")}>
          <Icon size={15} strokeWidth={2.5} />
        </span>
      </div>
      <p className="mt-2 text-[14px] font-bold leading-snug">{insight.title}</p>
      <p className="mt-1 line-clamp-2 text-[12.5px] font-medium leading-snug text-muted">{insight.detail}</p>
      {insight.href && (
        <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-muted">See rows <ArrowRight size={12} /></span>
      )}
    </>
  );
  return (
    <li className="rounded-[14px] bg-page p-4">
      {insight.href ? <Link href={insight.href} className="block">{body}</Link> : body}
    </li>
  );
}

function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
