import SettingsPage from "@/components/SettingsPage";
import SubmitButton from "@/components/SubmitButton";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { addRecurring, setRecurringArchived, updateRecurringAmount } from "@/actions/recurring";
import { pkr } from "@/lib/money";
import { Plus, Archive, ArchiveRestore, Check } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Regular payments: the things paid every month that no bank statement
 * carries — cash to the maid, the milkman, the school van. Set up once here,
 * then the dashboard offers them each month for one tap.
 */
export default async function RegularSettings() {
  const { household } = await requireContext();
  const H = household.id;

  const [rows, accounts, categories, persons] = await Promise.all([
    db().select().from(t.recurring).where(eq(t.recurring.householdId, H))
      .orderBy(asc(t.recurring.dayOfMonth), asc(t.recurring.description)),
    db().select().from(t.accounts).where(and(eq(t.accounts.householdId, H), eq(t.accounts.isArchived, false))),
    db().select().from(t.categories).where(and(eq(t.categories.householdId, H), eq(t.categories.isArchived, false)))
      .orderBy(asc(t.categories.name)),
    db().select().from(t.persons).where(eq(t.persons.householdId, H)).orderBy(asc(t.persons.name))
  ]);

  const acct = new Map(accounts.map((a) => [a.id, a.name]));
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const person = new Map(persons.map((p) => [p.id, p.name]));
  const live = rows.filter((r) => !r.isArchived);
  const archived = rows.filter((r) => r.isArchived);
  const monthly = live.filter((r) => r.type === "expense").reduce((a, r) => a + Number(r.amount), 0);
  const cash = accounts.find((a) => a.kind === "cash");

  return (
    <SettingsPage
      title="Regular payments"
      description="Things paid every month — the maid, the milkman, the school van. Set them up once and the home screen offers them each month, so they are added in one tap instead of typed again. Leave out anything the bank statement already carries (LESCO, school fees by transfer): importing adds those, and adding them here too would count them twice."
    >
      <form action={addRecurring} className="mb-6 rounded-[22px] bg-card p-5 lg:p-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <input name="description" placeholder="e.g. Maid salary" className="field" required />
          <input name="amount" type="number" inputMode="numeric" min="1" placeholder="Amount" className="field num" required />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow text-muted">Paid from</span>
            <select name="accountId" className="field mt-1.5" defaultValue={cash?.id ?? accounts[0]?.id}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow text-muted">Category</span>
            <select name="categoryId" className="field mt-1.5" defaultValue="">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow text-muted">For</span>
            <select name="personId" className="field mt-1.5" defaultValue="">
              <option value="">Whole household</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow text-muted">Usually paid on day</span>
            <input name="dayOfMonth" type="number" min="1" max="28" defaultValue="1" className="field num mt-1.5" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-[13px] font-bold">
            <input type="checkbox" name="isPassthrough" className="h-4 w-4 rounded accent-ink" />
            Pass-through (reimbursed)
          </label>
          <SubmitButton className="btn gap-1.5 px-4" pendingLabel="Adding…">
            <Plus size={17} strokeWidth={2.75} /> Add
          </SubmitButton>
        </div>
      </form>

      {live.length > 0 && (
        <>
          <h2 className="eyebrow mb-3">
            {live.length} regular · {pkr(monthly)} a month
          </h2>
          <div className="overflow-hidden rounded-[22px] bg-card">
            <ul>
              {live.map((r) => (
                <li key={r.id} className="rule-row flex flex-wrap items-center gap-3 px-5 py-3.5 last:border-0 lg:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{r.description}</span>
                    <span className="block text-[12.5px] font-medium text-muted">
                      Day {r.dayOfMonth} · {acct.get(r.accountId) ?? "—"}
                      {r.categoryId && <> · {cat.get(r.categoryId)}</>}
                      {r.personId && <> · {person.get(r.personId)}</>}
                      {r.isPassthrough && <> · pass-through</>}
                    </span>
                  </span>
                  <form action={updateRecurringAmount} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="amount" type="number" inputMode="numeric" defaultValue={Number(r.amount)}
                      aria-label={`Amount for ${r.description}`} className="field num w-28 !py-2" />
                    <button className="btn-quiet btn-sm" aria-label="Save amount"><Check size={15} strokeWidth={2.8} /></button>
                  </form>
                  <form action={setRecurringArchived}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="archived" value="1" />
                    <button title="Stop — keeps the entries already added" aria-label={`Stop ${r.description}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink">
                      <Archive size={14} strokeWidth={2.3} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="eyebrow mb-3 mt-8 text-muted">Stopped · {archived.length}</h2>
          <div className="overflow-hidden rounded-[22px] bg-card">
            <ul>
              {archived.map((r) => (
                <li key={r.id} className="rule-row flex items-center gap-3 px-5 py-3 text-muted last:border-0 lg:px-6">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.description}</span>
                  <span className="num text-[13px] font-bold">{pkr(Number(r.amount))}</span>
                  <form action={setRecurringArchived}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="archived" value="0" />
                    <button title="Restart" aria-label={`Restart ${r.description}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-page hover:text-ink">
                      <ArchiveRestore size={14} strokeWidth={2.3} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </SettingsPage>
  );
}
