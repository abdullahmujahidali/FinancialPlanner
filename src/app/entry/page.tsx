import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { addTransaction } from "@/actions/ledger";
import { todayStr } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function EntryPage({ searchParams }: { searchParams: { ok?: string; e?: string } }) {
  const { household } = await requireContext();
  const [accounts, categories, persons] = await Promise.all([
    db().select().from(t.accounts).where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false))).orderBy(asc(t.accounts.id)),
    db().select().from(t.categories).where(eq(t.categories.householdId, household.id)).orderBy(asc(t.categories.name)),
    db().select().from(t.persons).where(eq(t.persons.householdId, household.id)).orderBy(asc(t.persons.id))
  ]);

  return (
    <Shell title="Add entry">
      {searchParams.ok && <p className="mb-4 rounded bg-brandsoft px-3 py-2 text-sm text-brand">Saved.</p>}
      {searchParams.e && <p className="mb-4 rounded bg-oversoft px-3 py-2 text-sm text-over">{searchParams.e}</p>}
      <form action={addTransaction} className="space-y-4">
        <div className="flex gap-2">
          {[["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]].map(([v, label], i) => (
            <label key={v} className="flex-1">
              <input type="radio" name="type" value={v} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block cursor-pointer rounded border border-line bg-card py-2 text-center text-sm peer-checked:border-brand peer-checked:bg-brandsoft peer-checked:text-brand">{label}</span>
            </label>
          ))}
        </div>

        <input name="amount" type="number" inputMode="numeric" step="0.01" min="1" placeholder="0"
          className="field num text-center text-[34px] font-semibold" required autoFocus />

        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-muted">From / account
            <select name="accountId" className="field mt-1">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-muted">Date
            <input name="txDate" type="date" defaultValue={todayStr()} className="field mt-1" />
          </label>
        </div>

        <label className="block text-sm text-muted">To (transfers only)
          <select name="counterAccountId" className="field mt-1">
            <option value="">—</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>

        <label className="block text-sm text-muted">Category
          <select name="categoryId" className="field mt-1">
            <option value="">—</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="block text-sm text-muted">Person (optional — default is the whole household)
          <select name="personId" className="field mt-1">
            <option value="">Household</option>
            {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <input name="description" placeholder="Note (optional)" className="field" />

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="isAbnormal" className="h-4 w-4 accent-[#9A6700]" /> One-off / abnormal</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="isPassthrough" className="h-4 w-4 accent-[#0E6E4C]" /> Pass-through (reimbursed)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="needsReview" className="h-4 w-4 accent-[#9A6700]" /> Flag a question</label>
        </div>

        <label className="block text-sm text-muted">Receipt / photo (optional, up to 2 MB)
          <input name="receipt" type="file" accept="image/*,.pdf" className="field mt-1" />
        </label>

        <button className="btn w-full">Save entry</button>
      </form>
    </Shell>
  );
}
