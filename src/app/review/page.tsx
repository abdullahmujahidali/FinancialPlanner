import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { resolveReview } from "@/actions/ledger";
import { pkr } from "@/lib/money";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { household } = await requireContext();
  const [pending, categories, persons, accounts] = await Promise.all([
    db().select().from(t.transactions)
      .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.needsReview, true)))
      .orderBy(asc(t.transactions.txDate)).limit(100),
    db().select().from(t.categories).where(eq(t.categories.householdId, household.id)).orderBy(asc(t.categories.name)),
    db().select().from(t.persons).where(eq(t.persons.householdId, household.id)).orderBy(asc(t.persons.id)),
    db().select().from(t.accounts).where(eq(t.accounts.householdId, household.id))
  ]);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <Shell
      wide
      title="Review queue"
      action={
        pending.length > 0 ? (
          <span className="shrink-0 rounded-full bg-blush px-3.5 py-1.5 text-[13px] font-bold text-ink">
            {pending.length} left
          </span>
        ) : undefined
      }
    >
      <p className="mb-6 max-w-[70ch] text-[14px] font-medium leading-relaxed text-muted">
        Imported rows we couldn&rsquo;t sort on our own. Pick a category, save, and if you tick
        &ldquo;remember as a rule&rdquo; the same merchant is sorted automatically next time.
      </p>

      {pending.length === 0 ? (
        <EmptyState
          Icon={Check}
          tone="acid"
          title="All clear"
          body="Nothing is waiting for review. New imports land here only when a row doesn't match an existing rule."
        />
      ) : (
        <div className="overflow-hidden rounded-[22px] bg-card">
          {pending.map((tx, i) => (
            <form
              key={tx.id}
              action={resolveReview}
              className={
                "min-w-0 px-5 py-5 lg:px-7 " + (i < pending.length - 1 ? "rule-row" : "")
              }
            >
              <input type="hidden" name="id" value={tx.id} />

              {/* Line 1 — what it is, and how much. */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold">
                    {tx.description || "(no description)"}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] font-semibold text-muted">
                    <span className="num">{tx.txDate}</span>
                    {" · "}
                    {accountName.get(tx.accountId) ?? "Unknown account"}
                    {tx.reviewNote ? ` · ${tx.reviewNote}` : ""}
                  </div>
                </div>
                <span
                  className={
                    "money shrink-0 text-[18px] font-bold " + (tx.type === "income" ? "text-good" : "")
                  }
                >
                  {tx.type === "income" ? "+" : ""}
                  {pkr(Number(tx.amount))}
                </span>
              </div>

              {/* Line 2 — the whole decision, on one wrapping line. */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  name="categoryId"
                  className="field w-auto min-w-[150px] max-w-full flex-1 py-2 text-[14px] sm:w-[180px] sm:flex-none"
                  defaultValue={tx.categoryId ?? ""}
                >
                  <option value="">Category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <select
                  name="personId"
                  className="field w-auto min-w-[130px] max-w-full flex-1 py-2 text-[14px] sm:w-[150px] sm:flex-none"
                  defaultValue={tx.personId ?? ""}
                >
                  <option value="">Household</option>
                  {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <label className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
                  <input type="checkbox" name="isPassthrough" defaultChecked={tx.isPassthrough}
                    className="h-4 w-4 rounded accent-ink" />
                  pass-through
                </label>
                <label className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
                  <input type="checkbox" name="isAbnormal" defaultChecked={tx.isAbnormal}
                    className="h-4 w-4 rounded accent-ink" />
                  one-off
                </label>
                <label className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
                  <input type="checkbox" name="remember" defaultChecked
                    className="h-4 w-4 rounded accent-ink" />
                  remember as a rule
                </label>

                <button className="btn btn-sm ml-auto shrink-0">Save</button>
              </div>
            </form>
          ))}
        </div>
      )}
    </Shell>
  );
}
