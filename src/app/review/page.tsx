import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { resolveReview } from "@/actions/ledger";
import { pkr } from "@/lib/money";

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
    <Shell title="Review queue">
      {pending.length === 0 && <p className="text-muted">All clear — nothing waiting for review.</p>}
      <div className="space-y-3">
        {pending.map((tx) => (
          <form key={tx.id} action={resolveReview} className="rounded-lg border border-line bg-card p-3.5">
            <input type="hidden" name="id" value={tx.id} />
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm">{tx.description || "(no description)"}</div>
                <div className="text-xs text-muted">{tx.txDate}{tx.reviewNote ? ` · ${tx.reviewNote}` : ""}</div>
              </div>
              <span className={"num shrink-0 font-medium " + (tx.type === "income" ? "text-brand" : "")}>
                {tx.type === "income" ? "+" : ""}{pkr(Number(tx.amount))}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select name="categoryId" className="field text-sm" defaultValue={tx.categoryId ?? ""}>
                <option value="">Category…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select name="personId" className="field text-sm" defaultValue={tx.personId ?? ""}>
                <option value="">Household</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5"><input type="checkbox" name="isPassthrough" defaultChecked={tx.isPassthrough} className="h-4 w-4 accent-[#0E6E4C]" /> pass-through</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" name="isAbnormal" defaultChecked={tx.isAbnormal} className="h-4 w-4 accent-[#9A6700]" /> one-off</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-[#0E6E4C]" /> remember as a rule</label>
            </div>
            <button className="btn-quiet mt-2 w-full">Save</button>
          </form>
        ))}
      </div>
    </Shell>
  );
}
