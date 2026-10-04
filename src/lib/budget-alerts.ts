import { db, t } from "@/db/client";
import { and, eq, gte, like, lt, sql } from "drizzle-orm";
import { notify } from "@/actions/notifications";
import { monthKey, monthLabel, monthRange, pkr } from "@/lib/money";
import { tierFor, type Tier } from "@/lib/tiers";

/**
 * Tell the household when a month's spending crosses into a worse tier.
 *
 * Measured like the Home card's colour: total spend (one-offs included,
 * reimbursed bills not) against the budget. Only the warning tiers alert —
 * nobody needs a notification that things are fine. Each tier alerts once per
 * month; the tier is kept in the notification's link (`/?m=2026-10&alert=over`),
 * so no extra table is needed to remember what was already sent.
 *
 * Called after anything that adds or changes spending. Only this month and
 * last are checked: importing an old statement should not fire alerts about
 * a month long over.
 */

const ALERTING: Tier["key"][] = ["close", "over", "well-over", "way-over"];

const HEADLINE: Partial<Record<Tier["key"], (m: string) => string>> = {
  close: (m) => `${m} is close to the budget`,
  over: (m) => `${m} is over budget`,
  "well-over": (m) => `${m} is well over budget`,
  "way-over": (m) => `${m} is way over budget`
};

export async function checkBudgetAlerts(householdId: number, txDates: string[]) {
  try {
    const now = monthKey();
    const prev = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    const months = [...new Set(txDates.map((d) => d.slice(0, 7)))].filter((m) => m === now || m === prev);
    if (!months.length) return;

    const [household] = await db().select().from(t.households).where(eq(t.households.id, householdId));
    const budget = Number(household?.monthlyBudget ?? 0);
    if (!household || budget <= 0) return;

    for (const m of months) {
      const { from, next } = monthRange(m);
      const [row] = await db()
        .select({
          spend: sql<string>`coalesce(sum(${t.transactions.amount}),0)`,
          oneOffs: sql<string>`coalesce(sum(case when ${t.transactions.isAbnormal} then ${t.transactions.amount} else 0 end),0)`
        })
        .from(t.transactions)
        .where(and(
          eq(t.transactions.householdId, householdId),
          eq(t.transactions.type, "expense"),
          eq(t.transactions.isPassthrough, false),
          gte(t.transactions.txDate, from),
          lt(t.transactions.txDate, next)
        ));
      const spend = Number(row.spend);
      const tier = tierFor(spend / budget);
      const rank = ALERTING.indexOf(tier.key);
      if (rank < 0) continue;

      // Already told about this tier or a worse one this month?
      const sent = await db()
        .select({ href: t.notifications.href })
        .from(t.notifications)
        .where(and(
          eq(t.notifications.householdId, householdId),
          eq(t.notifications.kind, "budget"),
          like(t.notifications.href, `/?m=${m}&alert=%`)
        ));
      const sentRanks = sent.map((s) => ALERTING.indexOf((s.href ?? "").split("alert=")[1] as Tier["key"]));
      if (sentRanks.some((r) => r >= rank)) continue;

      const pct = Math.round((spend / budget) * 100);
      const oneOffs = Number(row.oneOffs);
      await notify({
        householdId,
        kind: "budget",
        title: HEADLINE[tier.key]!(monthLabel(m).split(" ")[0]),
        body:
          `${pkr(spend, { compact: true })} spent of ${pkr(budget, { compact: true })} (${pct}%)` +
          (oneOffs > 0 ? ` · ${pkr(oneOffs, { compact: true })} of it one-offs` : ""),
        href: `/?m=${m}&alert=${tier.key}`
      });
    }
  } catch (err) {
    // Best-effort, like notify itself: an alert must never fail a save. Logged
    // (and so seen by Sentry in production) rather than silently dropped.
    console.error("budget alert check failed", err);
  }
}
