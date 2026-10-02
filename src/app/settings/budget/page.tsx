import Link from "next/link";
import SettingsPage from "@/components/SettingsPage";
import SubmitButton from "@/components/SubmitButton";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { saveCategoryBudgets } from "@/actions/admin";
import { pkr, monthKey, monthLabel, monthRange } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Budget breakdown: the household budget split across categories — Petrol
 * Rs 40,000, Groceries Rs 60,000 — so each one can be watched on its own.
 * Last month's actual spend sits beside each field as a starting point.
 */
export default async function BudgetSettings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const now = new Date();
  const last = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const { from, next } = monthRange(last);

  const [allCats, actual, kinds] = await Promise.all([
    db().select().from(t.categories)
      .where(and(eq(t.categories.householdId, household.id), eq(t.categories.isArchived, false)))
      .orderBy(asc(t.categories.name)),
    db().select({ id: t.transactions.categoryId, v: sql<string>`sum(${t.transactions.amount})` })
      .from(t.transactions)
      .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.type, "expense"),
        eq(t.transactions.isPassthrough, false), gte(t.transactions.txDate, from), lt(t.transactions.txDate, next)))
      .groupBy(t.transactions.categoryId),
    // Which categories have only ever held income — Salary has no budget.
    db().select({
      id: t.transactions.categoryId,
      exp: sql<string>`count(*) filter (where ${t.transactions.type} = 'expense')`,
      inc: sql<string>`count(*) filter (where ${t.transactions.type} = 'income')`
    }).from(t.transactions)
      .where(eq(t.transactions.householdId, household.id))
      .groupBy(t.transactions.categoryId)
  ]);
  const incomeOnly = new Set(kinds.filter((k) => Number(k.inc) > 0 && Number(k.exp) === 0).map((k) => k.id));
  const cats = allCats.filter((c) => !incomeOnly.has(c.id));
  const spent = new Map(actual.map((a) => [a.id, Number(a.v)]));
  const budget = Number(household.monthlyBudget);
  const planned = cats.reduce((a, c) => a + Number(c.monthlyBudget ?? 0), 0);
  const gap = budget - planned;

  return (
    <SettingsPage
      title="Budget breakdown"
      description="Split the monthly budget across categories so each one can be watched on its own — the home screen then shows every category against its plan. Leave a category blank if it doesn't need one."
    >
      {sp.saved && <p className="mb-4 rounded-[18px] bg-acid px-5 py-4 text-[14px] font-bold">Saved.</p>}

      <div className={"mb-4 rounded-[18px] px-5 py-4 text-[14px] font-bold " + (gap < 0 ? "bg-blush" : "bg-card")}>
        {pkr(planned)} planned of the {pkr(budget)} budget
        {gap > 0 && <span className="text-muted"> · {pkr(gap)} not given to any category</span>}
        {gap < 0 && <> · {pkr(-gap)} more than the budget. <Link href="/settings/household" className="underline">Change the budget</Link></>}
      </div>

      <form action={saveCategoryBudgets}>
        <div className="overflow-hidden rounded-[22px] bg-card">
          <ul>
            {cats.map((c) => (
              <li key={c.id} className="rule-row flex items-center gap-3 px-5 py-3 last:border-0 lg:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                  <span className="block text-[12px] font-bold text-muted">
                    {spent.get(c.id) ? `${monthLabel(last)}: ${pkr(spent.get(c.id)!)}` : `Nothing in ${monthLabel(last)}`}
                    {c.passthroughDefault && " · pass-through"}
                  </span>
                </span>
                <input name={`b_${c.id}`} type="number" inputMode="numeric" min="0" step="1"
                  defaultValue={c.monthlyBudget != null ? Number(c.monthlyBudget) : ""}
                  placeholder="—" aria-label={`Monthly budget for ${c.name}`}
                  className="field num w-32 shrink-0 text-right" />
              </li>
            ))}
          </ul>
        </div>
        {/* Sticky so Save is reachable without scrolling past twenty rows —
            on a phone it rides just above the tab bar. */}
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-4 lg:bottom-6">
          <SubmitButton className="btn w-full shadow-soft sm:w-auto sm:px-8" pendingLabel="Saving…">Save breakdown</SubmitButton>
        </div>
      </form>
    </SettingsPage>
  );
}
