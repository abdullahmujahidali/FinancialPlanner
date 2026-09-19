import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { desc, eq, sql } from "drizzle-orm";
import { addGoal, contributeToGoal, completeGoal } from "@/actions/portfolio";
import { pkr } from "@/lib/money";
import { Plus, Check, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GoalsPage({ searchParams }: { searchParams: { e?: string } }) {
  const { household } = await requireContext();
  const goals = await db().select().from(t.goals)
    .where(eq(t.goals.householdId, household.id)).orderBy(desc(t.goals.id));
  const sums = new Map<number, number>();
  for (const g of goals) {
    const [s] = await db().select({ v: sql<string>`coalesce(sum(${t.goalContributions.amount}),0)` })
      .from(t.goalContributions).where(eq(t.goalContributions.goalId, g.id));
    sums.set(g.id, Number(s.v));
  }

  return (
    <Shell wide title="Goals">
      {searchParams.e && (
        <p className="mb-4 border-2 border-line bg-blush px-3 py-2.5 text-sm font-bold">{searchParams.e}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ── Goal cards ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          {goals.length === 0 && (
            <div className="block-card flex items-center gap-3 p-5 text-sm font-semibold text-muted">
              <Target size={18} strokeWidth={2.75} />
              No goals yet — add one on the right.
            </div>
          )}

          {goals.map((g) => {
            const saved = sums.get(g.id) ?? 0;
            const pct = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
            const done = g.status === "done";
            return (
              <div key={g.id} className={"block-card " + (done ? "opacity-60" : "")}>
                <div className="border-b-2 border-line p-4 lg:p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[16px] font-bold">
                      <span className="truncate">{g.name}</span>
                      {done && <span className="tag shrink-0 bg-acid">done</span>}
                    </span>
                    <span className="num shrink-0 text-[13px] font-bold text-muted">
                      {pkr(saved, { compact: true })} / {pkr(Number(g.targetAmount), { compact: true })}
                    </span>
                  </div>
                  {g.deadline && (
                    <div className="eyebrow mt-1.5 text-muted">by {g.deadline}</div>
                  )}
                  <div className="mt-3 h-4 border-2 border-line bg-paper">
                    <div className="h-full bg-acid" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 text-[12px] font-bold">{pct}% saved</div>
                </div>

                {!done && (
                  <div className="space-y-3 p-4 lg:p-5">
                    <form action={contributeToGoal} className="flex gap-2">
                      <input type="hidden" name="goalId" value={g.id} />
                      <input name="amount" type="number" inputMode="numeric" placeholder="Add savings"
                        className="field num min-w-0 px-3 py-2 text-sm" />
                      <input name="note" placeholder="note" className="field min-w-0 px-3 py-2 text-sm" />
                      <button className="btn btn-sm shrink-0" aria-label="Add contribution">
                        <Plus size={15} strokeWidth={3} />
                      </button>
                    </form>

                    <form action={completeGoal} className="space-y-2 border-t-2 border-line pt-3">
                      <input type="hidden" name="goalId" value={g.id} />
                      <label className="flex items-center gap-2 text-[12px] font-bold">
                        <input type="checkbox" name="makeAsset" defaultChecked className="h-4 w-4 accent-ink" />
                        Convert to asset
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input name="assetName" placeholder="Asset name"
                          className="field min-w-0 flex-1 px-3 py-2 text-sm" />
                        <input name="purchasePrice" type="number" inputMode="numeric" placeholder="Price"
                          className="field num w-24 shrink-0 grow-0 px-3 py-2 text-sm" />
                        <button className="btn-quiet btn-sm shrink-0">
                          <Check size={15} strokeWidth={3} />
                          Complete
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── New goal ─────────────────────────────────────────────────── */}
        <section className="block-card lg:sticky lg:top-8">
          <h2 className="eyebrow border-b-2 border-line bg-acid px-5 py-3">New goal</h2>
          <form action={addGoal} className="space-y-3 p-4 lg:p-5">
            <input name="name" placeholder="e.g. Family car" className="field" required />
            <div className="grid grid-cols-2 gap-2">
              <input name="targetAmount" type="number" inputMode="numeric" placeholder="Target (PKR)"
                className="field num" required />
              <input name="deadline" type="date" className="field" />
            </div>
            <button className="btn w-full">
              <Plus size={16} strokeWidth={3} />
              Add goal
            </button>
          </form>
        </section>
      </div>
    </Shell>
  );
}
