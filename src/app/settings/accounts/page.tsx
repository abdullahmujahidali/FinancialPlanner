import SettingsPage from "@/components/SettingsPage";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { addAccount, archiveAccount } from "@/actions/admin";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Accounts: the places money actually sits.
 *
 * The list and its add-form share one white card — the add-form sits on a
 * bg-page footer band inside it, so nothing floats loose on the page.
 */
export default async function AccountsSettings() {
  const { household } = await requireContext();

  const accounts = await db()
    .select()
    .from(t.accounts)
    .where(eq(t.accounts.householdId, household.id))
    .orderBy(asc(t.accounts.id));

  return (
    <SettingsPage
      title="Accounts"
      description="Accounts are where money sits — each bank account plus the cash wallet you carry. Archiving hides an account you no longer use without deleting any of its history."
    >
      <div className="overflow-hidden rounded-[22px] bg-card">
        {accounts.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-6">
            <p className="text-[15px] font-bold">No accounts yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Add your first bank account or cash wallet below.
            </p>
          </div>
        ) : (
          <ul>
            {accounts.map((a, i) => (
              <li
                key={a.id}
                className={
                  "flex items-center gap-3 px-5 py-4 lg:px-6 " +
                  (i < accounts.length - 1 ? "rule-row" : "")
                }
              >
                <span
                  className={
                    "min-w-0 flex-1 truncate text-[15px] font-bold " +
                    (a.isArchived ? "text-muted line-through" : "")
                  }
                >
                  {a.name}
                </span>
                <span className="tag-muted shrink-0">{a.kind}</span>
                {!a.isArchived && a.kind !== "cash" && (
                  <form action={archiveAccount} className="shrink-0">
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn-quiet btn-sm">archive</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={addAccount} className="flex items-center gap-3 border-t border-line bg-card p-5 lg:p-6">
          <input
            name="name"
            placeholder="e.g. Bank Al Habib"
            className="field min-w-0 flex-1"
            required
          />
          <select
            name="kind"
            aria-label="Account kind"
            className="field shrink-0 basis-[110px] [width:110px]"
          >
            <option value="bank">bank</option>
            <option value="cash">cash</option>
          </select>
          <button className="btn shrink-0 px-4" aria-label="Add account">
            <Plus size={17} strokeWidth={2.75} />
          </button>
        </form>
      </div>
    </SettingsPage>
  );
}
