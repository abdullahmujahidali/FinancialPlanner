import { db, t } from "@/db/client";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { monthKey, monthLabelShort, pkr } from "@/lib/money";

/**
 * Goal forecasting.
 *
 * A ledger records what happened; a goal asks when. The gap between those two
 * is one division — remaining ÷ monthly pace — but the pace has to come from
 * somewhere defensible, and every edge case has to say something true rather
 * than print a confident date nobody should believe.
 *
 * Pace is the household's own budget underspend: budget − non-passthrough
 * spend, the same figure the incentive is paid on. That makes a goal's ETA and
 * Tooba's cut two views of one number, and it works from the first month
 * without anyone logging a contribution.
 *
 * The current month is excluded. On the 3rd it has almost no spend in it, so
 * including it would show a wildly optimistic pace that quietly decays as the
 * month fills — the forecast would look worse every time you opened it.
 */

/** Complete months of history required before a pace means anything. */
const MIN_MONTHS = 3;

/** The window the pace is taken from. */
const WINDOW = 3;

/**
 * Past this horizon a date stops being information.
 *
 * A 45-lakh goal against a small monthly saving arithmetically lands in the
 * 23rd century. "July 2296" is true and worthless; it reads as a bug and
 * invites nobody to do anything. Beyond ten years the honest answer is that
 * the pace is not the right order of magnitude.
 */
const HORIZON_MONTHS = 120;

export type GoalForecast = {
  goalId: number;
  name: string;
  target: number;
  saved: number;
  remaining: number;
  /** Median monthly saving, or 0 when there is nothing to save from. */
  pace: number;
  /** Null whenever no honest date can be given — `note` says why. */
  etaMonth: string | null;
  monthsToGo: number | null;
  /** Plain-language status, always present. */
  note: string;
  /** Set when the goal has a deadline: is the pace enough to make it? */
  deadline: null | {
    month: string;
    onTrack: boolean;
    /** Extra per month needed to hit the deadline; 0 when on track. */
    shortfall: number;
  };
};

/**
 * Months of budget underspend, oldest first, excluding the current month.
 *
 * A month where spend ran over budget contributes a negative number and is
 * kept: a household that overspent in two of the last three months has not
 * been saving, and averaging that away would invent progress.
 */
async function savingsHistory(householdId: number, budget: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - WINDOW, 1);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const rows = await db()
    .select({
      m: sql<string>`to_char(${t.transactions.txDate}, 'YYYY-MM')`,
      total: sql<string>`sum(${t.transactions.amount})`
    })
    .from(t.transactions)
    .where(
      and(
        eq(t.transactions.householdId, householdId),
        eq(t.transactions.type, "expense"),
        eq(t.transactions.isPassthrough, false),
        gte(t.transactions.txDate, from),
        lt(t.transactions.txDate, thisMonth)
      )
    )
    .groupBy(sql`1`);

  return rows
    .sort((a, b) => a.m.localeCompare(b.m))
    .map((r) => ({ m: r.m, saved: budget - Number(r.total) }));
}

/**
 * The middle value, not the mean.
 *
 * One Eid or one wedding is enough to swing a three-month mean badly, and the
 * resulting date would move by months on a single unusual bill. The median of
 * three points is simply the middle one, which is the robustness wanted here.
 */
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Add `n` whole months to a YYYY-MM key. */
function addMonths(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Whole months between two YYYY-MM keys, b − a. */
function monthsBetween(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export async function getGoalForecasts(
  householdId: number,
  budget: number
): Promise<GoalForecast[]> {
  const goals = await db()
    .select()
    .from(t.goals)
    .where(and(eq(t.goals.householdId, householdId), eq(t.goals.status, "active")));
  if (goals.length === 0) return [];

  // `goal_contributions` carries no household_id of its own — it is tenanted
  // through its parent goal, so the ids are constrained here.
  const [history, contribRows] = await Promise.all([
    budget > 0 ? savingsHistory(householdId, budget) : Promise.resolve([]),
    db()
      .select({
        goalId: t.goalContributions.goalId,
        total: sql<string>`coalesce(sum(${t.goalContributions.amount}),0)`
      })
      .from(t.goalContributions)
      .where(inArray(t.goalContributions.goalId, goals.map((g) => g.id)))
      .groupBy(t.goalContributions.goalId)
  ]);

  const savedBy = new Map(contribRows.map((r) => [r.goalId, Number(r.total)]));
  const pace = history.length >= MIN_MONTHS ? median(history.map((h) => h.saved)) : 0;
  const thisMonth = monthKey();

  return goals.map((g) => {
    const target = Number(g.targetAmount);
    const saved = savedBy.get(g.id) ?? 0;
    const remaining = Math.max(0, target - saved);

    const base = {
      goalId: g.id,
      name: g.name,
      target,
      saved,
      remaining,
      pace: Math.max(0, Math.round(pace)),
      etaMonth: null as string | null,
      monthsToGo: null as number | null,
      deadline: null as GoalForecast["deadline"]
    };

    // Each of these is a real state the household can be in, and each deserves
    // its own sentence rather than a dash.
    if (remaining === 0) {
      return { ...base, note: "Fully funded — ready to complete." };
    }
    if (budget <= 0) {
      return { ...base, note: "Set a monthly budget in Settings to forecast a date." };
    }
    if (history.length < MIN_MONTHS) {
      const n = history.length;
      const over = history.filter((h) => h.saved <= 0).length;
      // "Not enough months" and "the months you have went over budget" are
      // different problems with different answers, so they get different
      // sentences even though both block the forecast.
      return {
        ...base,
        note:
          over === n && n > 0
            ? `No date yet — ${n === 1 ? "the one complete month so far went" : `all ${n} complete months so far went`} over budget, and ${MIN_MONTHS} months are needed either way.`
            : `Needs ${MIN_MONTHS} complete months of history to forecast — ${n} so far.`
      };
    }
    if (pace <= 0) {
      return {
        ...base,
        note: "Spending has matched or beaten the budget lately, so there is nothing going in yet."
      };
    }

    const monthsToGo = Math.ceil(remaining / pace);

    if (monthsToGo > HORIZON_MONTHS) {
      const years = Math.round(monthsToGo / 12);
      return {
        ...base,
        note: `Over ${years} years at ${pkr(
          Math.round(pace)
        )} a month — this needs a bigger monthly saving, or a smaller target, before a date means much.`
      };
    }

    const etaMonth = addMonths(thisMonth, monthsToGo);

    let deadline: GoalForecast["deadline"] = null;
    if (g.deadline) {
      const dm = g.deadline.slice(0, 7);
      const monthsAvailable = monthsBetween(thisMonth, dm);
      const onTrack = monthsAvailable >= monthsToGo;
      // Below one remaining month the per-month shortfall is meaningless, so
      // report the whole gap instead of dividing by zero or by a fraction.
      const needPerMonth = monthsAvailable > 0 ? remaining / monthsAvailable : remaining;
      deadline = {
        month: dm,
        onTrack,
        shortfall: onTrack ? 0 : Math.round(needPerMonth - pace)
      };
    }

    return {
      ...base,
      etaMonth,
      monthsToGo,
      deadline,
      note: `About ${monthsToGo} ${monthsToGo === 1 ? "month" : "months"} at ${pkr(
        Math.round(pace)
      )} a month.`
    };
  });
}

/** "February 2028" from a YYYY-MM key, for display. */
export function etaLabel(m: string) {
  return monthLabelShort(m);
}
