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
          <span className="shrink-0 rounded-full bg-blush px-3.5 py-1.5 text-[13px] font-bold text-ink">
            {pending.length} left
          </span>
        ) : undefined
      }
    >
      {pending.length === 0 ? (
        <section className="zone-acid text-center">
          <Check size={34} strokeWidth={3} className="mx-auto" />
          <p className="mt-4 font-display text-[26px] font-extrabold tracking-[-0.03em]">All clear</p>
          <p className="mt-1.5 text-[14px] font-semibold text-ink/65">Nothing waiting for review.</p>
        </section>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {pending.map((tx) => (
            <form key={tx.id} action={resolveReview} className="min-w-0 rounded-[22px] bg-card p-6">
              <input type="hidden" name="id" value={tx.id} />

              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold">{tx.description || "(no description)"}</div>
                  <div className="mt-1 text-[12px] font-semibold text-muted">
                    {tx.txDate}{tx.reviewNote ? ` · ${tx.reviewNote}` : ""}
                  </div>
                </div>
                <span className={"money shrink-0 text-[19px] font-bold " + (tx.type === "income" ? "text-good" : "")}>
                  {tx.type === "income" ? "+" : ""}{pkr(Number(tx.amount))}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select name="categoryId" className="field text-[14px]" defaultValue={tx.categoryId ?? ""}>
                  <option value="">Category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select name="personId" className="field text-[14px]" defaultValue={tx.personId ?? ""}>
                  <option value="">Household</option>
                  {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px] font-semibold">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isPassthrough" defaultChecked={tx.isPassthrough} className="h-4 w-4 rounded accent-ink" /> pass-through
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isAbnormal" defaultChecked={tx.isAbnormal} className="h-4 w-4 rounded accent-ink" /> one-off
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded accent-ink" /> remember as a rule
                </label>
              </div>

              <button className="btn mt-6 w-full">Save</button>
            </form>
          ))}
        </div>
      )}
    </Shell>
  );
}
