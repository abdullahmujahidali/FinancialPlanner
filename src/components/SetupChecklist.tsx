import Link from "next/link";
import { db, t } from "@/db/client";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { Check, ArrowRight, CircleAlert } from "lucide-react";

/**
 * "Needs attention": the parts of the book that are not set up yet, and what
 * each one costs while it isn't. Features nobody has configured are invisible
 * features — Tooba had never seen the budget breakdown or regular payments
 * because nothing pointed at them. Done items stay ticked so progress shows;
 * the whole card disappears once everything is done.
 */
export default async function SetupChecklist({
  householdId,
  reviewCount,
  goalsWithoutSavings,
  activeGoals
}: {
  householdId: number;
  reviewCount: number;
  goalsWithoutSavings: number;
  activeGoals: number;
}) {
  const H = householdId;
  const [[noOpening], [plans], [regular], [months], [uncat]] = await Promise.all([
    db().select({ v: sql<string>`count(*)` }).from(t.accounts)
      .where(and(eq(t.accounts.householdId, H), eq(t.accounts.isArchived, false), isNull(t.accounts.openingBalance))),
    db().select({ v: sql<string>`count(*)` }).from(t.categories)
      .where(and(eq(t.categories.householdId, H), isNotNull(t.categories.monthlyBudget))),
    db().select({ v: sql<string>`count(*)` }).from(t.recurring)
      .where(and(eq(t.recurring.householdId, H), eq(t.recurring.isArchived, false))),
    db().select({ v: sql<string>`count(distinct to_char(${t.transactions.txDate}, 'YYYY-MM'))` }).from(t.transactions)
      .where(eq(t.transactions.householdId, H)),
    db().select({ v: sql<string>`count(*)` }).from(t.transactions)
      .where(and(eq(t.transactions.householdId, H), eq(t.transactions.type, "expense"), isNull(t.transactions.categoryId)))
  ]);

  const items: Array<{ done: boolean; title: string; why: string; href: string; cta: string }> = [
    {
      done: Number(noOpening.v) === 0,
      title: "Set opening balances",
      why: `${noOpening.v} account${Number(noOpening.v) === 1 ? " has" : "s have"} none, so money on hand and net worth are guesses.`,
      href: "/settings/accounts",
      cta: "Set balances"
    },
    {
      done: Number(months.v) >= 3,
      title: "Import older statements",
      why: `Only ${months.v} month${Number(months.v) === 1 ? "" : "s"} of history. Insights and goal dates need about three to compare against.`,
      href: "/import",
      cta: "Import"
    },
    {
      done: Number(plans.v) > 0,
      title: "Split the budget by category",
      why: "Without it you can only see the total, not which category is running over.",
      href: "/settings/budget",
      cta: "Set category budgets"
    },
    {
      done: Number(regular.v) > 0,
      title: "Add regular payments",
      why: "Maid, milk, school van — set once and they're offered every month instead of typed again.",
      href: "/settings/regular",
      cta: "Add them"
    },
    {
      done: reviewCount === 0 && Number(uncat.v) === 0,
      title: "Categorise every entry",
      why: `${Math.max(reviewCount, Number(uncat.v))} entr${Math.max(reviewCount, Number(uncat.v)) === 1 ? "y has" : "ies have"} no category, so they don't show up where the money went.`,
      href: "/review",
      cta: "Review"
    },
    {
      done: activeGoals > 0 && goalsWithoutSavings < activeGoals,
      title: activeGoals > 0 ? "Start saving into a goal" : "Add a goal",
      why: activeGoals > 0
        ? "Every goal is still at Rs 0 — move last month's leftover into one."
        : "A goal turns monthly savings into something you can watch fill up.",
      href: "/goals",
      cta: activeGoals > 0 ? "Open goals" : "Add a goal"
    }
  ];

  const open = items.filter((i) => !i.done);
  if (open.length === 0) return null;
  const doneCount = items.length - open.length;

  return (
    <section className="overflow-hidden rounded-[22px] bg-card ring-2 ring-blush">
      <div className="flex items-center justify-between gap-3 bg-blush px-6 py-4 lg:px-7">
        <h2 className="eyebrow flex items-center gap-2">
          <CircleAlert size={14} strokeWidth={2.6} /> Needs attention
        </h2>
        <span className="text-[12px] font-bold">{doneCount} of {items.length} set up</span>
      </div>
      <div className="h-1.5 bg-blush/30">
        <div className="h-full bg-ink" style={{ width: `${(doneCount / items.length) * 100}%` }} />
      </div>
      <ul className="px-6 py-2 lg:px-7">
        {[...open, ...items.filter((i) => i.done)].map((i, n, all) => (
          <li key={i.title} className={n < all.length - 1 ? "rule-row" : ""}>
            {i.done ? (
              <div className="flex items-center gap-3 py-2.5 text-muted">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acid text-ink">
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="text-[13.5px] font-semibold line-through decoration-1">{i.title}</span>
              </div>
            ) : (
              <Link href={i.href} className="-mx-2 flex items-start gap-3 rounded-[12px] px-2 py-3 transition hover:bg-page">
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-blush" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold">{i.title}</span>
                  <span className="mt-0.5 block text-[12.5px] font-medium leading-snug text-muted">{i.why}</span>
                </span>
                <span className="mt-0.5 hidden shrink-0 items-center gap-1 text-[12.5px] font-bold sm:flex">
                  {i.cta} <ArrowRight size={14} strokeWidth={2.5} />
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
