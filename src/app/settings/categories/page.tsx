import SettingsPage from "@/components/SettingsPage";
import EditableRow from "@/components/EditableRow";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq, sql } from "drizzle-orm";
import { addCategory, renameCategory, setCategoryArchived } from "@/actions/admin";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Categories: the buckets spending is sorted into.
 *
 * The add form sits at the top because adding is why people open this page —
 * below a list of twenty rows it was a scroll away. Archived categories drop
 * to their own section rather than disappearing, so nothing is lost and the
 * live list stays short enough to pick from quickly.
 */
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

  return (
    <SettingsPage
      title="Categories"
      description="The buckets your spending is sorted into. Mark one as pass-through when the bill gets reimbursed and it stays out of your budget totals. Archiving hides a category from the pickers without touching the entries that already use it."
    >
      {/* Add first — it is the reason this page gets opened. */}
      <form action={addCategory} className="mb-4 rounded-[22px] bg-card p-5 lg:p-6">
        <div className="flex items-center gap-3">
          <input name="name" placeholder="e.g. Groceries" className="field min-w-0 flex-1" required />
          <button className="btn shrink-0 gap-1.5 px-4">
            <Plus size={17} strokeWidth={2.75} />
            <span className="hidden sm:inline">Add</span>
          </button>
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
