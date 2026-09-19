import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { addTransaction } from "@/actions/ledger";
import { todayStr } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function EntryPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const [accounts, categories, persons] = await Promise.all([
    db().select().from(t.accounts).where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false))).orderBy(asc(t.accounts.id)),
    db().select().from(t.categories).where(eq(t.categories.householdId, household.id)).orderBy(asc(t.categories.name)),
    db().select().from(t.persons).where(eq(t.persons.householdId, household.id)).orderBy(asc(t.persons.id))
  ]);

  return (
    <Shell title="Add entry">
      {sp.ok && (
        <p className="mb-5 rounded-[18px] bg-acid px-6 py-4 text-[14px] font-bold">Saved.</p>
      )}
      {sp.e && (
        <p className="mb-5 rounded-[18px] bg-blush px-6 py-4 text-[14px] font-bold">{sp.e}</p>
      )}

      <form action={addTransaction} className="space-y-5">
        {/* type switch — rounded segmented pills */}
        <div className="grid grid-cols-3 gap-1.5 rounded-full bg-card p-1.5">
          {[["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]].map(([v, label], i) => (
            <label key={v}>
              <input type="radio" name="type" value={v} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block cursor-pointer rounded-full py-2.5 text-center text-[14px] font-bold transition peer-checked:bg-ink peer-checked:text-acid">
                {label}
              </span>
            </label>
          ))}
        </div>

        {/* the amount — the one thing this screen is for */}
        <div className="zone-acid">
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
            className="money-xl mt-3 w-full border-0 bg-transparent p-0 text-[56px] outline-none placeholder:text-ink/25 lg:text-[72px]"
          />
        </div>

        <div className="grid gap-5 rounded-[22px] bg-card p-6 lg:grid-cols-2 lg:p-8">
          <label className="block">
            <span className="eyebrow text-muted">From / account</span>
            <select name="accountId" className="field mt-2">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow text-muted">Date</span>
            <input name="txDate" type="date" defaultValue={todayStr()} className="field mt-2" />
          </label>

          <label className="block">
            <span className="eyebrow text-muted">To (transfers only)</span>
            <select name="counterAccountId" className="field mt-2">
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow text-muted">Category</span>
            <select name="categoryId" className="field mt-2">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="eyebrow text-muted">Person <span className="font-semibold normal-case tracking-normal text-muted">— default is the whole household</span></span>
            <select name="personId" className="field mt-2">
              <option value="">Household</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="eyebrow text-muted">Note</span>
            <input name="description" placeholder="Optional" className="field mt-2" />
          </label>
        </div>

        <fieldset className="rounded-[22px] bg-card p-6 lg:p-8">
          <legend className="eyebrow text-muted">Flags</legend>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3.5 text-[14px] font-semibold">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isAbnormal" className="h-4 w-4 rounded accent-ink" /> One-off / abnormal
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isPassthrough" className="h-4 w-4 rounded accent-ink" /> Pass-through (reimbursed)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="needsReview" className="h-4 w-4 rounded accent-ink" /> Flag a question
            </label>
          </div>
        </fieldset>

        <label className="block rounded-[22px] bg-card p-6 lg:p-8">
          <span className="eyebrow text-muted">Receipt / photo <span className="font-semibold normal-case tracking-normal">— up to 2 MB</span></span>
          <input name="receipt" type="file" accept="image/*,.pdf" className="field mt-3 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:text-[13px] file:font-bold file:text-acid" />
        </label>

        <button className="btn w-full py-4 text-[16px]">Save entry</button>
      </form>
    </Shell>
  );
}
