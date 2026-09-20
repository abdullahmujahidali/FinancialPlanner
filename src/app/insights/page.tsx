import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import { requireContext } from "@/lib/session";
import { getInsights, type Insight } from "@/lib/insights";
import { monthKey, monthLabel } from "@/lib/money";
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
  const m = sp.m || monthKey();

  const insights = await getInsights(
    household.id,
    m,
    Number(household.monthlyBudget),
    household.incentivePct
  );

  const prev = shiftMonth(m, -1);
  const next = shiftMonth(m, 1);

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
      {insights.length === 0 ? (
        <EmptyState
          Icon={Sparkles}
          title="Nothing unusual this month"
          body="Insights compare each category against its own recent average, so they need a few months of history before they have anything to say. Import another statement or two and check back."
        />
      ) : (
        <>
          <p className="mb-5 max-w-[60ch] text-[14px] font-medium leading-relaxed text-muted">
            Compared against this household&rsquo;s own last few months. Each one links to the
            rows behind it, so you can check the claim.
          </p>
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <Card key={i} insight={ins} />
            ))}
          </div>
        </>
      )}
    </Shell>
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
