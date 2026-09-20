import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { addTransaction, quickAddCategory, quickAddPerson } from "@/actions/ledger";
import { todayStr } from "@/lib/money";
import SearchableSelect from "@/components/SearchableSelect";
import FlagToggles from "@/components/FlagToggles";

export const dynamic = "force-dynamic";

export default async function EntryPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const [accounts, categories, persons] = await Promise.all([
    db().select().from(t.accounts).where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false))).orderBy(asc(t.accounts.id)),
    db().select().from(t.categories)
      .where(and(eq(t.categories.householdId, household.id), eq(t.categories.isArchived, false)))
      .orderBy(asc(t.categories.name)),
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
          <SearchableSelect
            name="accountId"
            label="From / account"
            options={accounts.map((a) => ({ id: a.id, name: a.name }))}
            defaultValue={accounts[0]?.id ?? null}
            placeholder="Search accounts…"
          />

          <label className="block">
            <span className="eyebrow text-muted">Date</span>
            <input name="txDate" type="date" defaultValue={todayStr()} className="field mt-2" />
          </label>

          <SearchableSelect
            name="counterAccountId"
            label="To (transfers only)"
            options={accounts.map((a) => ({ id: a.id, name: a.name }))}
            emptyLabel="—"
            placeholder="Search accounts…"
          />

          <SearchableSelect
            name="categoryId"
            label="Category"
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
            emptyLabel="—"
            placeholder="Search or type a new one…"
            allowCreate={{ action: quickAddCategory, label: "Create" }}
          />

          <div className="lg:col-span-2">
            <SearchableSelect
              name="personId"
              label="Person"
              hint={<span className="font-semibold normal-case tracking-normal text-muted"> — default is the whole household</span>}
              options={persons.map((p) => ({ id: p.id, name: p.name }))}
              emptyLabel="Household"
              placeholder="Search or type a new one…"
              allowCreate={{ action: quickAddPerson, label: "Create" }}
            />
          </div>

          <label className="block lg:col-span-2">
            <span className="eyebrow text-muted">Note</span>
            <input name="description" placeholder="Optional" className="field mt-2" />
          </label>
        </div>

        <FlagToggles />

        <label className="block rounded-[22px] bg-card p-6 lg:p-8">
          <span className="eyebrow text-muted">Receipt / photo <span className="font-semibold normal-case tracking-normal">— up to 2 MB</span></span>
          <input name="receipt" type="file" accept="image/*,.pdf" className="field mt-3 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:text-[13px] file:font-bold file:text-acid" />
        </label>

        <button className="btn w-full py-4 text-[16px]">Save entry</button>
      </form>
    </Shell>
  );
}
