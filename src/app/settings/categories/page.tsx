import SettingsPage from "@/components/SettingsPage";
import EditableRow from "@/components/EditableRow";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq, sql } from "drizzle-orm";
import { addCategory, renameCategory, setCategoryArchived, mergeCategory, addSuggestedCategories } from "@/actions/admin";
import SubmitButton from "@/components/SubmitButton";
import { Plus, Merge } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Categories: the buckets spending is sorted into.
 *
 * The add form sits at the top because adding is why people open this page —
 * below a list of twenty rows it was a scroll away. Archived categories drop
 * to their own section rather than disappearing, so nothing is lost and the
 * live list stays short enough to pick from quickly.
 */
/**
 * Buckets most households end up needing. Each is offered only when no
 * existing category already covers it, judged by the keywords — "Shopping /
 * Clothing" covers Clothing, so Clothing is not suggested twice.
 */
const SUGGESTIONS: Array<{ name: string; hint: string; covers: string[] }> = [
  { name: "Gifts & Occasions", hint: "Eid, weddings, birthdays, salami", covers: ["gift", "occasion", "eid", "wedding"] },
  { name: "Household Staff", hint: "Maid, driver, cook, guard", covers: ["staff", "maid", "driver", "servant"] },
  { name: "Personal Care", hint: "Salon, barber, cosmetics", covers: ["personal care", "salon", "beauty", "grooming"] },
  { name: "Clothing", hint: "Clothes, shoes, tailoring", covers: ["cloth", "apparel"] },
  { name: "Mobile & Internet", hint: "Packages, PTCL, fibre", covers: ["mobile", "internet"] },
  { name: "Car Maintenance", hint: "Service, tyres, tuning, token tax", covers: ["car", "vehicle"] },
  { name: "Electronics & Appliances", hint: "Phones, AC, fridge, repairs", covers: ["electronic", "appliance"] },
  { name: "Outings & Entertainment", hint: "Parks, cinema, trips out", covers: ["outing", "entertain", "leisure"] },
  { name: "Insurance / Takaful", hint: "Health, car, life cover", covers: ["insur", "takaful"] },
  { name: "Charity / Sadqa", hint: "Sadqa, donations, Zakat", covers: ["charity", "sadq", "zakat", "donation"] }
];

export default async function CategoriesSettings() {
  const { household } = await requireContext();

  const categories = await db()
    .select({
      id: t.categories.id,
      name: t.categories.name,
      passthroughDefault: t.categories.passthroughDefault,
      isArchived: t.categories.isArchived,
      used: sql<number>`count(${t.transactions.id})`
    })
    .from(t.categories)
    // A left join keeps categories that have no entries yet.
    .leftJoin(t.transactions, eq(t.transactions.categoryId, t.categories.id))
    .where(eq(t.categories.householdId, household.id))
    .groupBy(t.categories.id)
    .orderBy(asc(t.categories.name));

  const live = categories.filter((c) => !c.isArchived);
  const archived = categories.filter((c) => c.isArchived);
  const lower = categories.map((c) => c.name.toLowerCase());
  const suggestions = SUGGESTIONS.filter((sg) => !lower.some((n) => sg.covers.some((k) => n.includes(k))));

  return (
    <SettingsPage
      title="Categories"
      description="The buckets your spending is sorted into. Mark one as pass-through when the bill gets reimbursed and it stays out of your budget totals. Archiving hides a category from the pickers without touching the entries that already use it."
    >
      {/* Add first — it is the reason this page gets opened. */}
      <form action={addCategory} className="mb-4 rounded-[22px] bg-card p-5 lg:p-6">
        <div className="flex items-center gap-3">
          <input name="name" placeholder="e.g. Groceries" className="field min-w-0 flex-1" required />
          <SubmitButton className="btn shrink-0 gap-1.5 px-4">
            <Plus size={17} strokeWidth={2.75} />
            <span className="hidden sm:inline">Add</span>
          </SubmitButton>
        </div>
        <label className="mt-3 flex items-center gap-2.5 text-[13px] font-bold">
          <input type="checkbox" name="passthroughDefault" className="h-4 w-4 rounded accent-ink" />
          Pass-through — reimbursed, so keep it out of budget totals
        </label>
      </form>

      <div className="overflow-hidden rounded-[22px] bg-card">
        {live.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-6">
            <p className="text-[15px] font-bold">No categories yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Add your first bucket above — groceries, fuel, utilities.
            </p>
          </div>
        ) : (
          <ul>
            {live.map((c) => (
              <EditableRow
                key={c.id}
                id={c.id}
                name={c.name}
                archived={false}
                renameAction={renameCategory}
                archiveAction={setCategoryArchived}
                showPassthrough
                passthrough={c.passthroughDefault}
                badge={
                  <span className="flex shrink-0 items-center gap-2">
                    {c.passthroughDefault && <span className="tag-acid">pass-through</span>}
                    <span className="num text-[12px] font-bold text-muted">
                      {Number(c.used) || 0}
                    </span>
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </div>

      {suggestions.length > 0 && (
        <form action={addSuggestedCategories} className="mt-8">
          <h2 className="eyebrow mb-1">Commonly missing</h2>
          <p className="mb-3 text-[13px] font-medium leading-relaxed text-muted">
            Tick any that fit how you spend, then add them together.
          </p>
          <div className="overflow-hidden rounded-[22px] bg-card">
            <ul>
              {suggestions.map((sg) => (
                <li key={sg.name} className="rule-row last:border-0">
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-3.5 lg:px-6">
                    <input type="checkbox" name="name" value={sg.name} className="h-4 w-4 rounded accent-ink" />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{sg.name}</span>
                      <span className="block text-[12.5px] font-medium text-muted">{sg.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <SubmitButton className="btn mt-3 gap-1.5" pendingLabel="Adding…">
            <Plus size={16} strokeWidth={2.75} /> Add selected
          </SubmitButton>
        </form>
      )}

      {live.length > 1 && (
        <form action={mergeCategory} className="mt-8">
          <h2 className="eyebrow mb-1">Merge two categories</h2>
          <p className="mb-3 text-[13px] font-medium leading-relaxed text-muted">
            Every entry and import rule in the first moves to the second, and the first is archived.
            No amounts change. Use it when two buckets mean the same thing.
          </p>
          <div className="rounded-[22px] bg-card p-5 lg:p-6">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <select name="id" required className="field" defaultValue="">
                <option value="" disabled>Move everything from…</option>
                {live.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({Number(c.used) || 0})
                  </option>
                ))}
              </select>
              <span className="text-center text-[13px] font-bold text-muted">into</span>
              <select name="into" required className="field" defaultValue="">
                <option value="" disabled>…this category</option>
                {live.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton className="btn mt-4 gap-1.5" pendingLabel="Merging…">
              <Merge size={16} strokeWidth={2.5} /> Merge
            </SubmitButton>
          </div>
        </form>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="eyebrow mt-8 mb-3 text-muted">Archived · {archived.length}</h2>
          <div className="overflow-hidden rounded-[22px] bg-card">
            <ul>
              {archived.map((c) => (
                <EditableRow
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  archived
                  renameAction={renameCategory}
                  archiveAction={setCategoryArchived}
                  showPassthrough
                  passthrough={c.passthroughDefault}
                />
              ))}
            </ul>
          </div>
        </>
      )}
    </SettingsPage>
  );
}
