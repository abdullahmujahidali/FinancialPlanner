import { t } from "@/db/client";
import { and, eq } from "drizzle-orm";

/**
 * The spend that is measured against the budget — and so decides savings and
 * the incentive. Reimbursed bills never count. One-offs count only when the
 * household has chosen that (`excludeOneOffs = false`); by default a hospital
 * bill does not cost the person keeping the book their incentive.
 *
 * Every page that works out savings uses this one condition, so Home, Year,
 * Insights and goal forecasts cannot disagree.
 */
export function budgetedSpend(excludeOneOffs: boolean) {
  return excludeOneOffs
    ? and(eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false), eq(t.transactions.isAbnormal, false))
    : and(eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false));
}
