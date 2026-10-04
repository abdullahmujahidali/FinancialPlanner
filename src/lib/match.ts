/**
 * Pairing a loan payment with the bank row for the same money.
 *
 * A repayment can reach the ledger twice: once when it is recorded on the
 * loan, and again when the bank statement is imported. Left alone the import
 * counts it as spending (or as income, for money received), which inflates the
 * month and moves the account balance a second time. These helpers decide
 * which two records are the same rupees; the database work lives in
 * `loan-ledger.ts`. Kept free of any database import so they can be tested.
 */

/** Bank booking dates lag the day money was handed over by a few days at most. */
export const MATCH_WINDOW_DAYS = 5;

export type Direction = "owed_by_us" | "owed_to_us";

/** Whole days between two ISO dates, ignoring which comes first. */
export function daysApart(a: string, b: string) {
  const ms = Math.abs(Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z"));
  return Math.round(ms / 86_400_000);
}

/** Shift an ISO date by whole days. */
export function shiftDate(d: string, days: number) {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}

/** Paisa-exact: 100000 and "100000.00" are the same amount, 100000.5 is not. */
export function sameAmount(a: number, b: number) {
  return Math.round(Math.abs(a) * 100) === Math.round(Math.abs(b) * 100);
}

/**
 * The closest-dated candidate for the same amount within the window, or null.
 * Ties go to the lowest id, so the oldest unmatched row is used up first and a
 * re-run picks the same one.
 */
export function pickMatch<T extends { id: number; amount: number; date: string }>(
  candidates: T[],
  amount: number,
  date: string,
  windowDays = MATCH_WINDOW_DAYS
): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const c of candidates) {
    if (!sameAmount(c.amount, amount)) continue;
    const gap = daysApart(c.date, date);
    if (gap > windowDays) continue;
    if (gap < bestGap || (gap === bestGap && best && c.id < best.id)) {
      best = c;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Which ledger rows can be the bank's view of a loan payment.
 *
 * Paying a loan off is money out: an expense the importer guessed at, or an
 * outgoing transfer. Being repaid is money in: income, or an incoming
 * transfer (stored negative — see `loanTransferAmount`). Transfers to one of
 * the household's own accounts are never loan payments.
 */
export function canBeLoanPayment(
  direction: Direction,
  tx: { type: string; amount: number; counterAccountId: number | null }
) {
  if (tx.type === "transfer") {
    if (tx.counterAccountId != null) return false;
    return direction === "owed_by_us" ? tx.amount > 0 : tx.amount < 0;
  }
  return direction === "owed_by_us"
    ? tx.type === "expense" && tx.amount > 0
    : tx.type === "income" && tx.amount > 0;
}

/**
 * The signed amount a loan payment is stored at in the ledger.
 *
 * A transfer debits `accountId` and credits `counterAccountId`. A loan payment
 * has no counter account — the other side is a person — so money coming IN is
 * stored negative, which `balances.ts` turns into a credit. The same
 * convention refunds use (a negative expense).
 */
export function loanTransferAmount(direction: Direction, amount: number) {
  const a = Math.abs(amount);
  return direction === "owed_by_us" ? a : -a;
}

/** Outstanding and overpaid for one loan; outstanding never goes negative. */
export function loanBalance(principal: number, paid: number) {
  return {
    outstanding: Math.max(0, principal - paid),
    overpaid: Math.max(0, paid - principal)
  };
}
