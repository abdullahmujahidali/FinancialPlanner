import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { desc, eq, sql } from "drizzle-orm";
import { addGoal, contributeToGoal, completeGoal } from "@/actions/portfolio";
import { pkr } from "@/lib/money";
import { Plus, Check, Target } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
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
      {sp.e && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">{sp.e}</p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Goal cards ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:w-1/2 lg:shrink-0">
          {goals.length === 0 && (
            <EmptyState
              Icon={Target}
              title="No goals yet"
              body="A goal is a savings target — a car, a plot, a trip — that you put money aside for and watch fill up. Use the New goal form to add your first one."
            />
          )}

          {goals.map((g) => {
            const saved = sums.get(g.id) ?? 0;
            const pct = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
            const done = g.status === "done";
            return (
              <div key={g.id}
                className={"overflow-hidden rounded-[22px] bg-card " + (done ? "opacity-60" : "")}>
                <div className="p-6 lg:p-8">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5 text-[17px] font-bold">
                      <span className="truncate">{g.name}</span>
                      {done && <span className="tag-acid shrink-0">done</span>}
                    </span>
                    <span className="num shrink-0 text-[13px] font-bold text-muted">
                      {pkr(saved, { compact: true })} / {pkr(Number(g.targetAmount), { compact: true })}
                    </span>
                  </div>
                  {g.deadline && (
                    <div className="eyebrow mt-2 text-muted">by {g.deadline}</div>
                  )}
                  <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-page">
                    <div className="h-full rounded-full bg-acid" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-3 text-[13px] font-bold">{pct}% saved</div>
                </div>

                {!done && (
                  <div className="space-y-5 bg-page p-6 lg:p-8">
                    <form action={contributeToGoal} className="flex gap-2.5">
                      <input type="hidden" name="goalId" value={g.id} />
                      <input name="amount" type="number" inputMode="numeric" placeholder="Add savings"
                        className="field num min-w-0" />
                      <input name="note" placeholder="note" className="field min-w-0" />
                      <button className="btn shrink-0 px-4" aria-label="Add contribution">
                        <Plus size={17} strokeWidth={2.75} />
                      </button>
                    </form>

                    <form action={completeGoal} className="space-y-3">
                      <input type="hidden" name="goalId" value={g.id} />
                      <label className="flex items-center gap-2 text-[13px] font-bold">
                        <input type="checkbox" name="makeAsset" defaultChecked className="h-4 w-4 rounded accent-ink" />
                        Convert to asset
                      </label>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <input name="assetName" placeholder="Asset name"
                          className="field min-w-0 flex-1" />
                        <input name="purchasePrice" type="number" inputMode="numeric" placeholder="Price"
                          className="field num w-24 shrink-0 grow-0 px-3" />
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
        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          <section className="zone-acid lg:sticky lg:top-8">
            <h2 className="eyebrow">New goal</h2>
            <form action={addGoal} className="mt-6 space-y-4">
              <input name="name" placeholder="e.g. New car, emergency fund" className="field" required />
              <div className="grid grid-cols-2 gap-3">
                <input name="targetAmount" type="number" inputMode="numeric" placeholder="Target (PKR)"
                  className="field num" required />
                <input name="deadline" type="date" className="field" />
              </div>
              <button className="btn w-full">
                <Plus size={17} strokeWidth={2.75} />
                Add goal
              </button>
            </form>
          </section>
        </div>
      </div>
    </Shell>
  );
}
