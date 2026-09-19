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
      {searchParams.ok && (
        <p className="mb-4 border-2 border-line bg-acid px-3 py-2.5 text-sm font-bold">Saved.</p>
      )}
      {searchParams.e && (
        <p className="mb-4 border-2 border-line bg-blush px-3 py-2.5 text-sm font-bold">{searchParams.e}</p>
      )}

      <form action={addTransaction} className="space-y-5">
        {/* type switch — hard segmented blocks */}
        <div className="grid grid-cols-3 border-2 border-line">
          {[["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]].map(([v, label], i) => (
            <label key={v} className={i < 2 ? "border-r-2 border-line" : ""}>
              <input type="radio" name="type" value={v} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block cursor-pointer bg-card py-3 text-center text-sm font-bold transition-colors peer-checked:bg-ink peer-checked:text-acid">
                {label}
              </span>
            </label>
          ))}
        </div>

        {/* the amount — the one thing this screen is for */}
        <div className="border-2 border-line bg-acid px-4 pb-5 pt-4">
          <label htmlFor="amount" className="eyebrow">Amount (PKR)</label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="numeric"
            step="0.01"
            min="1"
            placeholder="0"
            required
            autoFocus
            className="money-xl mt-1 w-full border-0 bg-transparent p-0 text-[52px] outline-none placeholder:text-ink/25 lg:text-[64px]"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="eyebrow">From / account</span>
            <select name="accountId" className="field mt-1.5">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow">Date</span>
            <input name="txDate" type="date" defaultValue={todayStr()} className="field mt-1.5" />
          </label>

          <label className="block">
            <span className="eyebrow">To (transfers only)</span>
            <select name="counterAccountId" className="field mt-1.5">
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow">Category</span>
            <select name="categoryId" className="field mt-1.5">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="eyebrow">Person <span className="font-semibold normal-case tracking-normal text-muted">— default is the whole household</span></span>
            <select name="personId" className="field mt-1.5">
              <option value="">Household</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="eyebrow">Note</span>
            <input name="description" placeholder="Optional" className="field mt-1.5" />
          </label>
        </div>

        <fieldset className="border-2 border-line bg-card p-4">
          <legend className="eyebrow px-1">Flags</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isAbnormal" className="h-4 w-4 accent-ink" /> One-off / abnormal
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isPassthrough" className="h-4 w-4 accent-ink" /> Pass-through (reimbursed)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="needsReview" className="h-4 w-4 accent-ink" /> Flag a question
            </label>
          </div>
        </fieldset>

        <label className="block">
          <span className="eyebrow">Receipt / photo <span className="font-semibold normal-case tracking-normal text-muted">— up to 2 MB</span></span>
          <input name="receipt" type="file" accept="image/*,.pdf" className="field mt-1.5 file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1 file:text-sm file:font-bold file:text-acid" />
        </label>

        <button className="btn w-full text-[16px]">Save entry</button>
      </form>
    </Shell>
  );
}
