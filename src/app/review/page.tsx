import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { resolveReview } from "@/actions/ledger";
import { pkr } from "@/lib/money";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { household } = await requireContext();
  const [pending, categories, persons] = await Promise.all([
    db().select().from(t.transactions)
      .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.needsReview, true)))
      .orderBy(asc(t.transactions.txDate)).limit(100),
    db().select().from(t.categories).where(eq(t.categories.householdId, household.id)).orderBy(asc(t.categories.name)),
    db().select().from(t.persons).where(eq(t.persons.householdId, household.id)).orderBy(asc(t.persons.id))
  ]);

  return (
    <Shell
      wide
      title="Review queue"
      action={
        pending.length > 0 ? (
          <span className="shrink-0 border-2 border-line bg-blush px-2.5 py-1 text-[13px] font-bold">
            {pending.length} left
          </span>
        ) : undefined
      }
    >
      {pending.length === 0 ? (
        <div className="border-2 border-line bg-acid p-8 text-center">
          <Check size={34} strokeWidth={3} className="mx-auto" />
          <p className="mt-3 font-display text-[22px] font-extrabold tracking-tight">All clear</p>
          <p className="mt-1 text-sm font-semibold">Nothing waiting for review.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((tx) => (
            <form key={tx.id} action={resolveReview} className="border-2 border-line bg-card p-4">
              <input type="hidden" name="id" value={tx.id} />

              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold">{tx.description || "(no description)"}</div>
                  <div className="mt-0.5 text-xs font-semibold text-muted">
                    {tx.txDate}{tx.reviewNote ? ` · ${tx.reviewNote}` : ""}
                  </div>
                </div>
                <span className={"money shrink-0 text-[17px] font-bold " + (tx.type === "income" ? "text-good" : "")}>
                  {tx.type === "income" ? "+" : ""}{pkr(Number(tx.amount))}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select name="categoryId" className="field py-2 text-sm" defaultValue={tx.categoryId ?? ""}>
                  <option value="">Category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select name="personId" className="field py-2 text-sm" defaultValue={tx.personId ?? ""}>
                  <option value="">Household</option>
                  {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="isPassthrough" defaultChecked={tx.isPassthrough} className="h-4 w-4 accent-ink" /> pass-through
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="isAbnormal" defaultChecked={tx.isAbnormal} className="h-4 w-4 accent-ink" /> one-off
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-ink" /> remember as a rule
                </label>
              </div>

              <button className="btn btn-sm mt-3 w-full">Save</button>
            </form>
          ))}
        </div>
      )}
    </Shell>
  );
}
