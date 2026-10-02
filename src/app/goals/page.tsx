import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { addGoal, contributeToGoal, completeGoal } from "@/actions/portfolio";
import { pkr, monthKey, monthLabel, monthRange } from "@/lib/money";
import { Plus, Check, Target } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { getGoalForecasts, etaLabel } from "@/lib/forecast";

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

  // Last month's leftover, offered as a one-tap contribution. Without this the
  // goals sit at zero until someone remembers to type savings in by hand.
  const now = new Date();
  const lastM = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const { from: lf, next: ln } = monthRange(lastM);
  const sweepNote = `Left over from ${monthLabel(lastM)}`;
  const openGoals = goals.filter((g) => g.status !== "done");
  const [[flow], swept] = await Promise.all([
    db().select({
      income: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'income' then ${t.transactions.amount} end), 0)`,
      out: sql<string>`coalesce(sum(case when ${t.transactions.type} = 'expense' then ${t.transactions.amount} end), 0)`
    }).from(t.transactions)
      .where(and(eq(t.transactions.householdId, household.id), gte(t.transactions.txDate, lf), lt(t.transactions.txDate, ln))),
    openGoals.length
      ? db().select({ v: sql<string>`coalesce(sum(${t.goalContributions.amount}),0)` }).from(t.goalContributions)
          .where(and(inArray(t.goalContributions.goalId, goals.map((g) => g.id)), eq(t.goalContributions.note, sweepNote)))
      : Promise.resolve([{ v: "0" }])
  ]);
  const leftover = Math.round(Number(flow.income) - Number(flow.out) - Number(swept[0].v));

  const forecasts = await getGoalForecasts(household.id, Number(household.monthlyBudget));
  const fc = new Map(forecasts.map((f) => [f.goalId, f]));
  // Every ETA assumes the whole monthly saving goes to that one goal, so with
  // more than one goal open the dates cannot all be true at once. Say so once,
  // rather than silently implying they can.
  const competing = forecasts.filter((f) => f.etaMonth).length > 1;
  // When nothing can be forecast yet the reason is the same for every goal, so
  // it is said once above the list rather than repeated on each card.
  const blocked = forecasts.length > 0 && forecasts.every((f) => !f.etaMonth);
  const blockedWhy = blocked ? forecasts[0].note : null;

  return (
    <Shell
      back={{ href: "/", label: "Home" }} wide title="Goals">
      {sp.e && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">{sp.e}</p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Goal cards ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:w-1/2 lg:shrink-0">
          {openGoals.length > 0 && leftover > 0 && (
            <section className="zone-acid">
              <h2 className="eyebrow">{monthLabel(lastM)} left over</h2>
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-ink/75">
                {pkr(Number(flow.income))} came in and {pkr(Number(flow.out))} went out
                {Number(swept[0].v) > 0 && <>, and {pkr(Number(swept[0].v))} is already in goals</>}.
                That leaves {pkr(leftover)} — put some of it toward a goal.
              </p>
              <form action={contributeToGoal} className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_9rem_auto]">
                <input type="hidden" name="note" value={sweepNote} />
                <select name="goalId" className="field" required>
                  {openGoals.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <input name="amount" type="number" inputMode="numeric" defaultValue={leftover} max={leftover}
                  className="field num" />
                <button className="btn px-4">
                  <Plus size={17} strokeWidth={2.75} /> Add
                </button>
              </form>
            </section>
          )}

          {blockedWhy && (
            <p className="rounded-[14px] bg-page px-4 py-3 text-[13px] font-bold leading-snug">
              {blockedWhy}
            </p>
          )}

          {competing && (
            <p className="rounded-[14px] bg-page px-4 py-3 text-[13px] font-bold leading-snug">
              Each date below assumes the whole monthly saving goes to that goal. With more
              than one goal open they cannot all land on time.
            </p>
          )}

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
            const f = fc.get(g.id);
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
                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-[13px] font-bold">{pct}% saved</span>
                    {!done && f?.etaMonth && (
                      <span className="num text-[13px] font-bold">
                        on track for {etaLabel(f.etaMonth)}
                      </span>
                    )}
                  </div>

                  {!done && f && !blocked && (
                    <div className="mt-2 space-y-1.5 text-[13px] leading-snug text-muted">
                      <p>{f.note}</p>
                      {f.deadline && f.etaMonth && !f.deadline.onTrack && (
                        <p className="font-bold text-ink">
                          That misses {etaLabel(f.deadline.month)} — it needs{" "}
                          {pkr(f.deadline.shortfall)} more a month to land on time.
                        </p>
                      )}
                      {f.deadline && f.etaMonth && f.deadline.onTrack && (
                        <p>Comfortably inside the {etaLabel(f.deadline.month)} deadline.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Adding savings is the common action; completing happens
                    once. Both stay folded so the page reads as goals, not forms. */}
                {!done && (
                  <div className="flex flex-wrap items-start gap-2 border-t border-line px-6 py-3 lg:px-8">
                    <details className="min-w-0 flex-1">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-page px-4 py-2 text-[13px] font-bold transition hover:bg-line">
                        <Plus size={14} strokeWidth={2.8} /> Add savings
                      </summary>
                      <form action={contributeToGoal} className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
                        <input type="hidden" name="goalId" value={g.id} />
                        <input name="amount" type="number" inputMode="numeric" placeholder="Amount" required
                          className="field num" />
                        <input name="note" placeholder="Note (optional)" className="field" />
                        <button className="btn px-5">Save</button>
                      </form>
                    </details>
                    <details className="min-w-0">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-muted transition hover:bg-page hover:text-ink">
                        <Check size={14} strokeWidth={3} /> Reached it
                      </summary>
                      <form action={completeGoal} className="mt-3 space-y-2.5">
                        <input type="hidden" name="goalId" value={g.id} />
                        <label className="flex items-center gap-2 text-[13px] font-bold">
                          <input type="checkbox" name="makeAsset" defaultChecked className="h-4 w-4 rounded accent-ink" />
                          Add what was bought as an asset
                        </label>
                        <input name="assetName" placeholder="Asset name, e.g. New car" className="field" />
                        <input name="purchasePrice" type="number" inputMode="numeric" placeholder="Price paid" className="field num" />
                        <button className="btn w-full">Mark goal complete</button>
                      </form>
                    </details>
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
