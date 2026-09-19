import SettingsPage from "@/components/SettingsPage";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { addCategory } from "@/actions/admin";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Categories: the buckets spending is sorted into.
 *
 * Rows rather than a chip cloud, because each category carries a second fact —
 * whether it defaults to pass-through — that needs room to be read.
 */
export default async function CategoriesSettings() {
  const { household } = await requireContext();

  const categories = await db()
    .select()
    .from(t.categories)
    .where(eq(t.categories.householdId, household.id))
    .orderBy(asc(t.categories.name));

  return (
    <SettingsPage
      title="Categories"
      description="Categories are the buckets your spending is sorted into. Mark one as pass-through when the bill gets reimbursed — LESCO, PTCL, society dues — and it stays out of your budget totals."
    >
      <div className="overflow-hidden rounded-[22px] bg-card">
        {categories.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-6">
            <p className="text-[15px] font-bold">No categories yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Add your first bucket below — groceries, fuel, utilities.
            </p>
          </div>
        ) : (
          <ul>
            {categories.map((c, i) => (
              <li
                key={c.id}
                className={
                  "flex items-center gap-3 px-5 py-4 lg:px-6 " +
                  (i < categories.length - 1 ? "rule-row" : "")
                }
              >
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{c.name}</span>
                {c.passthroughDefault && <span className="tag-acid shrink-0">pass-through</span>}
              </li>
            ))}
          </ul>
        )}

        <form action={addCategory} className="bg-page p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <input
              name="name"
              placeholder="e.g. Groceries"
              className="field min-w-0 flex-1"
              required
            />
            <button className="btn shrink-0 px-4" aria-label="Add category">
              <Plus size={17} strokeWidth={2.75} />
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2.5 text-[13px] font-bold">
            <input
              type="checkbox"
              name="passthroughDefault"
              className="h-4 w-4 rounded accent-ink"
            />
            Pass-through — reimbursed, so keep it out of budget totals
          </label>
        </form>
      </div>
    </SettingsPage>
  );
}
