import SettingsPage from "@/components/SettingsPage";
import EditableRow from "@/components/EditableRow";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { addPerson, renamePerson } from "@/actions/admin";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * People: the labels an expense can be tagged with.
 *
 * List and add-form share one white card, the form on a bg-page footer band
 * inside it, so the "add" never floats loose on the page background.
 */
export default async function PeopleSettings() {
  const { household } = await requireContext();

  const persons = await db()
    .select()
    .from(t.persons)
    .where(eq(t.persons.householdId, household.id))
    .orderBy(asc(t.persons.id));

  return (
    <SettingsPage
      title="People"
      description="People are the family members an expense can be tagged to, so you can see who a given bit of spending was actually for. Tagging is optional — a transaction left untagged simply belongs to the whole household."
    >
      {/* Add first — below the list it was a scroll away. */}
      <form action={addPerson} className="mb-4 flex items-center gap-3 rounded-[22px] bg-card p-5 lg:p-6">
        <input
          name="name"
          placeholder="e.g. a family member"
          className="field min-w-0 flex-1"
          required
        />
        <button className="btn shrink-0 gap-1.5 px-4">
          <Plus size={17} strokeWidth={2.75} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>

      <div className="overflow-hidden rounded-[22px] bg-card">
        {persons.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-6">
            <p className="text-[15px] font-bold">No people yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Add a family member above to start tagging spending to them.
            </p>
          </div>
        ) : (
          <ul>
            {persons.map((p) => (
              <EditableRow key={p.id} id={p.id} name={p.name} renameAction={renamePerson} />
            ))}
          </ul>
        )}
      </div>
    </SettingsPage>
  );
}
