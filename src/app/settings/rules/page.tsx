import Link from "next/link";
import SettingsPage from "@/components/SettingsPage";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { deleteRule } from "@/actions/admin";
import { X } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Import rules: learned shortcuts for the importer.
 *
 * Read-only apart from deletion — rules are born in the review queue, so the
 * card's footer band points there instead of offering an add-form that would
 * ask for a raw bank string out of context.
 */
export default async function RulesSettings() {
  const { household } = await requireContext();

  const [rules, categories, persons] = await Promise.all([
    db()
      .select()
      .from(t.importRules)
      .where(eq(t.importRules.householdId, household.id))
      .orderBy(asc(t.importRules.priority)),
    db().select().from(t.categories).where(eq(t.categories.householdId, household.id)),
    db().select().from(t.persons).where(eq(t.persons.householdId, household.id))
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const personName = new Map(persons.map((p) => [p.id, p.name]));

  return (
    <SettingsPage
      title="Import rules"
      description="A rule auto-categorises future imported bank rows whose description contains the matched text — so the same bill never has to be sorted twice. LESCO always lands in Utilities, the school fee always lands under the right child."
    >
      <div className="overflow-hidden rounded-[22px] bg-card">
        {rules.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-6">
            <p className="text-[15px] font-bold">No rules yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Rules appear here once you start teaching the importer from the review queue.
            </p>
          </div>
        ) : (
          <ul>
            {rules.map((r, i) => {
              const sets = [
                r.setCategoryId != null ? categoryName.get(r.setCategoryId) : null,
                r.setPersonId != null ? personName.get(r.setPersonId) : null,
                r.setPassthrough ? "pass-through" : null,
                r.setAbnormal ? "one-off" : null
              ].filter(Boolean) as string[];

              return (
                <li
                  key={r.id}
                  className={
                    "flex items-center gap-3 px-5 py-4 lg:px-6 " +
                    (i < rules.length - 1 ? "rule-row" : "")
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px] font-semibold">
                      {r.pattern}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">
                      {sets.length > 0 ? `sets ${sets.join(" · ")}` : "sets nothing yet"}
                    </span>
                  </span>

                  <form action={deleteRule} className="shrink-0">
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-blush"
                      aria-label={`Remove rule ${r.pattern}`}
                    >
                      <X size={16} strokeWidth={2.75} />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <div className="bg-page p-5 text-[13px] text-muted lg:p-6">
          There is no add form here on purpose. Rules are learned: when you categorise a
          transaction in the{" "}
          <Link href="/review" className="font-bold text-ink underline underline-offset-2">
            review queue
          </Link>
          , tick <span className="font-bold text-ink">remember as a rule</span> and the match is
          saved for every import after it.
        </div>
      </div>
    </SettingsPage>
  );
}
