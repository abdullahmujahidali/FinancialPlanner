import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import { requireContext } from "@/lib/session";
import { getInsights, getMonthBrief, defaultInsightsMonth, type Insight, type MonthBrief } from "@/lib/insights";
import { monthLabel, monthLabelShort, pkr } from "@/lib/money";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Repeat,
  Copy,
  Trophy,
  ArrowUpRight,
  Sparkles,
  Target
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Insights — what changed that nobody would otherwise notice.
 *
 * Everything here is derived from the household's own history: a category is
 * "high" only against its own recent average, never against a generic
 * benchmark, because no two households spend alike. Findings link back to the
 * ledger so a claim can always be checked against the rows behind it.
 */
export default async function InsightsPage({
  searchParams
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const m = sp.m || defaultInsightsMonth();
  const budget = Number(household.monthlyBudget);

  const [insights, brief] = await Promise.all([
    getInsights(household.id, m, budget, household.incentivePct),
    getMonthBrief(household.id, m, budget)
  ]);

  const prev = shiftMonth(m, -1);
  const next = shiftMonth(m, 1);
  const empty = brief.spend === 0 && brief.income === 0 && brief.passthrough === 0;

  return (
    <Shell
      back={{ href: "/", label: "Home" }}
      title="Insights"
      action={
        <div className="flex items-center gap-1">
          <Link href={`/insights?m=${prev}`} className="btn-quiet btn-sm" aria-label="Previous month">
            <ChevronLeft size={16} />
          </Link>
          <span className="px-2 text-[13px] font-bold">{monthLabel(m)}</span>
          <Link href={`/insights?m=${next}`} className="btn-quiet btn-sm" aria-label="Next month">
            <ChevronRight size={16} />
          </Link>
        </div>
      }
    >
      {empty ? (
        <EmptyState
          Icon={Sparkles}
          title={`Nothing recorded for ${monthLabel(m)}`}
          body="Import that month's bank statement, or step back a month with the arrows above."
          action={
            <Link href="/import" className="btn">
              Import a statement
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          <Brief brief={brief} month={m} incentivePct={household.incentivePct} />
          <WhereItWent brief={brief} month={m} />
          <Biggest brief={brief} />
          {brief.people.some((p) => p.id) && <People brief={brief} month={m} />}

          <section>
            <h2 className="eyebrow mb-3 mt-8">What changed</h2>
            {insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((ins, i) => (
                  <Card key={i} insight={ins} />
                ))}
              </div>
            ) : brief.historyMonths === 0 ? (
              <NeedsHistory month={m} />
            ) : (
              <p className="zone-card text-[14px] font-medium leading-relaxed text-muted">
                Nothing stands out against {brief.historyMonths === 1 ? "last month" : `the last ${brief.historyMonths} months`}.
                No category jumped, nothing was charged twice, and no regular bill went up.
              </p>
            )}
            {insights.length > 0 && brief.historyMonths < 3 && (
              <p className="mt-3 text-[13px] font-medium leading-relaxed text-muted">
                Based on {brief.historyMonths === 1 ? "one earlier month" : `${brief.historyMonths} earlier months`}.
                Importing older statements makes these comparisons more reliable straight away.
              </p>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}

/** Spent against budget: the first question anyone asks about a month. */
function Brief({ brief, month, incentivePct }: { brief: MonthBrief; month: string; incentivePct: number }) {
  const { spend, budget } = brief;
  const left = budget - spend;
  const used = budget > 0 ? Math.min(100, (spend / budget) * 100) : 0;
  const running = brief.daysElapsed > 0 && brief.daysElapsed < brief.daysInMonth;
  const projected = running && brief.daysElapsed >= 7 ? (spend / brief.daysElapsed) * brief.daysInMonth : null;
  const vsLast = brief.lastMonth != null && brief.lastMonth > 0 ? spend - brief.lastMonth : null;

  return (
    <section className={left >= 0 ? "zone-acid" : "zone-blush"}>
      <h2 className="eyebrow">{running ? "So far this month" : "The month in brief"}</h2>
      <p className="mt-3 font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] lg:text-[30px]">
        {pkr(spend)} spent
        {budget > 0 && <span className="text-ink/60"> of {pkr(budget)}</span>}
      </p>

      {budget > 0 && (
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-ink" style={{ width: `${used}%` }} />
        </div>
      )}

      <ul className="mt-4 space-y-1.5 text-[14px] font-semibold leading-relaxed text-ink/80">
        {budget > 0 &&
          (left >= 0 ? (
            <li>
              {pkr(left)} {running ? "left in the budget" : "saved"}
              {!running && incentivePct > 0 && <> · {pkr(Math.round((left * incentivePct) / 100))} incentive at {incentivePct}%</>}
            </li>
          ) : (
            <li>{pkr(-left)} over budget</li>
          ))}
        {projected != null && budget > 0 && (
          <li>
            At this pace the month ends near {pkr(Math.round(projected))}
            {projected > budget ? `, ${pkr(Math.round(projected - budget))} over` : ", inside the budget"}.
          </li>
        )}
        {vsLast != null && !running && (
          <li>
            {pkr(Math.abs(vsLast))} {vsLast > 0 ? "more" : "less"} than {monthLabelShort(shiftMonth(month, -1))}
          </li>
        )}
        {brief.abnormal > 0 && (
          <li>
            {pkr(brief.abnormal)} of it was one-offs — {pkr(spend - brief.abnormal)} without them
          </li>
        )}
        {brief.passthrough > 0 && <li>{pkr(brief.passthrough)} in reimbursed bills, left out of the total</li>}
        {brief.income > 0 && <li>{pkr(brief.income)} came in</li>}
      </ul>

      {(brief.uncategorised.count > 0 || brief.needsReview > 0) && (
        <Link
          href="/review"
          className="mt-5 flex items-center justify-between gap-3 rounded-[14px] bg-ink px-4 py-3 text-[13px] font-bold text-acid"
        >
          <span>
            {brief.uncategorised.count > 0
              ? `${brief.uncategorised.count} entries (${pkr(brief.uncategorised.total)}) have no category yet`
              : `${brief.needsReview} entries waiting for review`}
          </span>
          <ArrowRight size={16} strokeWidth={2.5} />
        </Link>
      )}
    </section>
  );
}

function WhereItWent({ brief, month }: { brief: MonthBrief; month: string }) {
  if (brief.categories.length === 0) return null;
  const top3 = brief.categories.slice(0, 3);
  const top3Share = brief.spend > 0 ? Math.round((top3.reduce((a, c) => a + c.total, 0) / brief.spend) * 100) : 0;

  return (
    <section className="zone-card">
      <h2 className="eyebrow">Where it went</h2>
      {brief.categories.length > 3 && (
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-muted">
          {top3.map((c) => c.name).join(", ").replace(/, ([^,]*)$/, " and $1")} took {top3Share}% of the month.
        </p>
      )}
      <ul className="mt-3">
        {brief.categories.map((c, i) => {
          const share = brief.spend > 0 ? (c.total / brief.spend) * 100 : 0;
          return (
            <li key={i} className={i < brief.categories.length - 1 ? "rule-row" : ""}>
              <Link
                href={`/ledger?m=${month}${c.id ? `&cat=${c.id}` : "&flag=review"}`}
                className="-mx-2 block rounded-[12px] px-2 py-3 transition hover:bg-page"
              >
                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="min-w-0 truncate font-semibold">{c.name}</span>
                  <span className="num shrink-0 font-bold">{pkr(c.total)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-page">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${share}%` }} />
                  </div>
                  <span className="w-[7ch] shrink-0 text-right text-[12px] font-bold text-muted">
                    {Math.round(share)}% · {c.count}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Biggest({ brief }: { brief: MonthBrief }) {
  if (brief.biggest.length === 0) return null;
  return (
    <section className="zone-card">
      <h2 className="eyebrow">Biggest single expenses</h2>
      <ul className="mt-3">
        {brief.biggest.map((b, i) => (
          <li key={b.id} className={i < brief.biggest.length - 1 ? "rule-row" : ""}>
            <Link
              href={`/ledger/${b.id}`}
              className="-mx-2 flex items-center justify-between gap-3 rounded-[12px] px-2 py-3 transition hover:bg-page"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{b.description || "—"}</span>
                <span className="text-[12px] font-bold text-muted">
                  {b.txDate} · {b.category ?? "Uncategorised"}
                </span>
              </span>
              <span className="num shrink-0 text-[15px] font-bold">{pkr(b.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function People({ brief, month }: { brief: MonthBrief; month: string }) {
  return (
    <section className="zone-card">
      <h2 className="eyebrow">Who it was for</h2>
      <ul className="mt-3">
        {brief.people.map((p, i) => {
          const share = brief.spend > 0 ? Math.round((p.total / brief.spend) * 100) : 0;
          const row = (
            <>
              <span className="font-semibold">{p.name}</span>
              <span className="flex items-baseline gap-3">
                <span className="text-[12px] font-bold text-muted">{share}%</span>
                <span className="num font-bold">{pkr(p.total)}</span>
              </span>
            </>
          );
          const cls =
            "flex items-center justify-between gap-3 py-3 text-[15px] " +
            (i < brief.people.length - 1 ? "rule-row " : "");
          return (
            <li key={i}>
              {p.id ? (
                <Link href={`/people/${p.id}?m=${month}`} className={cls + "-mx-2 rounded-[12px] px-2 transition hover:bg-page"}>
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
  );
}

/**
 * Comparisons need an earlier month. Waiting a month for one is the slow
 * route; the bank already holds the history, so point at the import.
 */
function NeedsHistory({ month }: { month: string }) {
  const a = monthLabel(shiftMonth(month, -2)).split(" ")[0];
  const b = monthLabel(shiftMonth(month, -1)).split(" ")[0];
  return (
    <div className="zone-card">
      <p className="text-[15px] font-bold">Comparisons start once there is an earlier month to compare with.</p>
      <p className="mt-2 text-[14px] font-medium leading-relaxed text-muted">
        There is no need to wait for it. Download the {a} and {b} statements from Meezan and
        import them — spikes, rising bills and double charges show up here as soon as they are in.
      </p>
      <Link href="/import" className="btn mt-4 inline-flex gap-1.5">
        Import older statements <ArrowRight size={15} />
      </Link>
    </div>
  );
}

const ICONS = {
  spike: ArrowUpRight,
  trend: TrendingUp,
  creep: Repeat,
  duplicate: Copy,
  streak: Trophy,
  goal: Target
} as const;

function Card({ insight }: { insight: Insight }) {
  const Icon = ICONS[insight.kind];
  const good = insight.good;

  return (
    <article className={good ? "zone-acid" : "card p-6 shadow-soft lg:p-7"}>
      <div className="flex items-start gap-4">
        <span
          className={
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] " +
            (good ? "bg-ink text-acid" : "bg-page text-ink")
          }
        >
          <Icon size={18} strokeWidth={2.4} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold leading-snug tracking-[-0.02em]">
            {insight.title}
          </h2>
          <p
            className={
              "mt-1.5 text-[14px] font-medium leading-relaxed " +
              (good ? "text-ink/75" : "text-muted")
            }
          >
            {insight.detail}
          </p>

          {insight.href && (
            <Link
              href={insight.href}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold underline decoration-2 underline-offset-4"
            >
              See the rows <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
