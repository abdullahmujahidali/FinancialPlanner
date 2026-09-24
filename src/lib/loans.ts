import { db, t } from "@/db/client";
import { eq, inArray, sql } from "drizzle-orm";

/**
 * Loan balances.
 *
 * Every figure here is derived from the payments rather than stored, so a
 * balance can never drift from the payments that produced it — the same choice
 * `balances.ts` makes for accounts.
 */

export type LoanRow = {
  id: number;
  direction: "owed_by_us" | "owed_to_us";
  counterparty: string;
  principal: number;
  paid: number;
  /** What is still outstanding; never negative, even if overpaid. */
  outstanding: number;
  /** Paid beyond the principal, which usually means a typo worth surfacing. */
  overpaid: number;
  startedOn: string;
  dueOn: string | null;
  note: string | null;
  status: string;
  settledOn: string | null;
};

export type LoanTotals = {
  loans: LoanRow[];
  /** Still owed by this household — subtracts from net worth. */
  weOwe: number;
  /** Still owed to this household — adds to net worth. */
  owedToUs: number;
  /** owedToUs − weOwe, the single figure net worth needs. */
  net: number;
  /** Open loans past their due date, oldest first. */
  overdue: LoanRow[];
};

export async function getLoans(householdId: number): Promise<LoanTotals> {
  const rows = await db()
    .select()
    .from(t.loans)
    .where(eq(t.loans.householdId, householdId));

  if (rows.length === 0) {
    return { loans: [], weOwe: 0, owedToUs: 0, net: 0, overdue: [] };
  }

  // `loan_payments` carries no household_id — it is tenanted through its
  // parent loan, so the ids are constrained here.
  const paidRows = await db()
    .select({
      loanId: t.loanPayments.loanId,
      v: sql<string>`coalesce(sum(${t.loanPayments.amount}),0)`
    })
    .from(t.loanPayments)
    .where(inArray(t.loanPayments.loanId, rows.map((r) => r.id)))
    .groupBy(t.loanPayments.loanId);

  const paidBy = new Map(paidRows.map((r) => [r.loanId, Number(r.v)]));

  const loans: LoanRow[] = rows
    .map((r) => {
      const principal = Number(r.principal);
      const paid = paidBy.get(r.id) ?? 0;
      return {
        id: r.id,
        direction: r.direction as LoanRow["direction"],
        counterparty: r.counterparty,
        principal,
        paid,
        outstanding: Math.max(0, principal - paid),
        overpaid: Math.max(0, paid - principal),
        startedOn: r.startedOn,
        dueOn: r.dueOn,
        note: r.note,
        status: r.status,
        settledOn: r.settledOn
      };
    })
    // Open first, then the largest outstanding, so what needs attention leads.
    .sort((a, b) => {
      const openA = a.outstanding > 0 ? 0 : 1;
      const openB = b.outstanding > 0 ? 0 : 1;
      if (openA !== openB) return openA - openB;
      if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
      return b.startedOn.localeCompare(a.startedOn);
    });

  const sum = (dir: LoanRow["direction"]) =>
    loans.filter((l) => l.direction === dir).reduce((s, l) => s + l.outstanding, 0);

  const weOwe = sum("owed_by_us");
  const owedToUs = sum("owed_to_us");

  const today = new Date().toISOString().slice(0, 10);
  const overdue = loans
    .filter((l) => l.outstanding > 0 && l.dueOn && l.dueOn < today)
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));

  return { loans, weOwe, owedToUs, net: owedToUs - weOwe, overdue };
}

/**
 * Just the net figure, for callers that only need to adjust net worth.
 *
 * Kept separate so the dashboard does not pull every loan row and its payment
 * history to render one line.
 */
export async function getLoanNet(householdId: number) {
  const rows = await db()
    .select({
      direction: t.loans.direction,
      principal: t.loans.principal,
      paid: sql<string>`coalesce((
        select sum(p.amount) from ${t.loanPayments} p where p.loan_id = ${t.loans.id}
      ),0)`
    })
    .from(t.loans)
    .where(eq(t.loans.householdId, householdId));

  let weOwe = 0;
  let owedToUs = 0;
  for (const r of rows) {
    const outstanding = Math.max(0, Number(r.principal) - Number(r.paid));
    if (r.direction === "owed_by_us") weOwe += outstanding;
    else owedToUs += outstanding;
  }
  return { weOwe, owedToUs, net: owedToUs - weOwe };
}
