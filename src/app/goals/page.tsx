import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { desc, eq, sql } from "drizzle-orm";
import { addGoal, contributeToGoal, completeGoal } from "@/actions/portfolio";
import { pkr } from "@/lib/money";

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
    <Shell title="Goals">
      {searchParams.e && <p className="mb-4 rounded-xl bg-oversoft px-3 py-2 text-sm text-over">{searchParams.e}</p>}
      <div className="mb-6 space-y-3">
        {goals.map((g) => {
          const saved = sums.get(g.id) ?? 0;
          const pct = Math.min(100, Math.round((saved / Number(g.targetAmount)) * 100));
          const done = g.status === "done";
          return (
            <div key={g.id} className={"panel p-4 " + (done ? "opacity-60" : "")}>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{g.name}{done && <span className="tag ml-2 bg-brandsoft text-brand">done</span>}</span>
                <span className="num text-sm text-muted">{pkr(saved, { compact: true })} / {pkr(Number(g.targetAmount), { compact: true })}</span>
              </div>
              {g.deadline && <div className="mt-0.5 text-xs text-muted">by {g.deadline}</div>}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              {!done && (
                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  <form action={contributeToGoal} className="flex gap-1.5">
                    <input type="hidden" name="goalId" value={g.id} />
                    <input name="amount" type="number" inputMode="numeric" placeholder="Add savings" className="field num min-w-0 px-2 py-1.5 text-sm" />
                    <input name="note" placeholder="note" className="field min-w-0 px-2 py-1.5 text-sm" />
                    <button className="btn-quiet shrink-0">Add</button>
                  </form>
                  <form action={completeGoal} className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="hidden" name="goalId" value={g.id} />
                    <label className="flex items-center gap-1.5"><input type="checkbox" name="makeAsset" defaultChecked className="h-4 w-4 accent-[#0E6E4C]" /> convert to asset</label>
                    <input name="assetName" placeholder="Asset name" className="field min-w-0 flex-1 px-2 py-1.5" />
                    <input name="purchasePrice" type="number" inputMode="numeric" placeholder="Price" className="field num w-24 px-2 py-1.5" />
                    <button className="btn-quiet">Complete goal</button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-medium">New goal</h2>
        <form action={addGoal} className="space-y-3">
          <input name="name" placeholder="e.g. Family car" className="field" required />
          <div className="grid grid-cols-2 gap-2">
            <input name="targetAmount" type="number" inputMode="numeric" placeholder="Target (PKR)" className="field num" required />
            <input name="deadline" type="date" className="field" />
          </div>
          <button className="btn w-full">Add goal</button>
        </form>
      </section>
    </Shell>
  );
}
