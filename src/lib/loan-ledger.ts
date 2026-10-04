import { db, t } from "@/db/client";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { todayStr } from "@/lib/money";
import {
  MATCH_WINDOW_DAYS,
  canBeLoanPayment,
  loanTransferAmount,
  pickMatch,
  shiftDate,
  type Direction
} from "@/lib/match";

/**
 * Where loan payments meet the ledger.
 *
 * The rule both functions enforce: one payment, one ledger row. Whichever
 * arrives second — the payment typed in on the loan, or the bank row from an
 * imported statement — attaches to the first instead of adding another.
 *
 * Plain server helpers, not server actions: a "use server" file would expose
 * every export here as an endpoint any browser could call.
 */

type Loan = { id: number; householdId: number; direction: string; counterparty: string; principal: string };

/** The fields a ledger row needs to stop being spending (or income) and become a loan payment. */
function asLoanTransfer(direction: Direction, amount: number) {
  return {
    type: "transfer",
    amount: loanTransferAmount(direction, amount).toFixed(2),
    counterAccountId: null,
    categoryId: null,
    isAbnormal: false,
    isPassthrough: false,
    needsReview: false,
    reviewNote: null
  };
}

/** Ids among `txIds` that a loan payment already points at. */
async function linkedTxIds(txIds: number[]) {
  if (!txIds.length) return new Set<number>();
  const rows = await db()
    .select({ id: t.loanPayments.transactionId })
    .from(t.loanPayments)
    .where(inArray(t.loanPayments.transactionId, txIds));
  return new Set(rows.map((r) => r.id).filter((v): v is number => v !== null));
}

/**
 * Record a payment against a loan, writing or adopting its ledger row.
 *
 * With an account chosen, a row already on that account for the same amount
 * within a few days — usually the bank import, which got there first — is
 * converted into the payment's transfer rather than a second row being
 * written. With no account the payment lives on the loan alone (cash handed
 * over in person); a later import can still claim it, see `matchImportedRows`.
 */
export async function recordLoanPayment(opts: {
  loan: Loan;
  amount: number;
  paidOn: string;
  accountId: number | null;
  note: string | null;
  userId: number;
}): Promise<{ adopted: boolean }> {
  const { loan, amount, paidOn, note, userId } = opts;
  const direction = loan.direction as Direction;
  let transactionId: number | null = null;
  let adopted = false;

  if (opts.accountId) {
    const [account] = await db()
      .select({ id: t.accounts.id })
      .from(t.accounts)
      .where(and(eq(t.accounts.householdId, loan.householdId), eq(t.accounts.id, opts.accountId)));

    if (account) {
      const nearby = await db()
        .select({
          id: t.transactions.id,
          type: t.transactions.type,
          amount: t.transactions.amount,
          txDate: t.transactions.txDate,
          counterAccountId: t.transactions.counterAccountId
        })
        .from(t.transactions)
        .where(
          and(
            eq(t.transactions.householdId, loan.householdId),
            eq(t.transactions.accountId, account.id),
            gte(t.transactions.txDate, shiftDate(paidOn, -MATCH_WINDOW_DAYS)),
            lte(t.transactions.txDate, shiftDate(paidOn, MATCH_WINDOW_DAYS))
          )
        );
      const taken = await linkedTxIds(nearby.map((r) => r.id));
      const match = pickMatch(
        nearby
          .map((r) => ({ ...r, amount: Number(r.amount), date: r.txDate }))
          .filter((r) => !taken.has(r.id) && canBeLoanPayment(direction, r)),
        amount,
        paidOn
      );

      if (match) {
        await db()
          .update(t.transactions)
          .set(asLoanTransfer(direction, amount) as any)
          .where(and(eq(t.transactions.householdId, loan.householdId), eq(t.transactions.id, match.id)));
        transactionId = match.id;
        adopted = true;
      } else {
        const [tx] = await db()
          .insert(t.transactions)
          .values({
            householdId: loan.householdId,
            accountId: account.id,
            type: "transfer",
            amount: loanTransferAmount(direction, amount).toFixed(2),
            txDate: paidOn,
            description:
              direction === "owed_by_us"
                ? `Loan repayment to ${loan.counterparty}`
                : `Loan repaid by ${loan.counterparty}`,
            createdBy: userId
          })
          .returning();
        transactionId = tx.id;
      }
    }
  }

  await db().insert(t.loanPayments).values({
    loanId: loan.id,
    amount: amount.toFixed(2),
    paidOn,
    note,
    transactionId,
    createdBy: userId
  });

  await refreshLoanStatus(loan.id, Number(loan.principal));
  return { adopted };
}

/**
 * A loan settles itself once its payments cover the principal, and un-settles
 * if a payment is later removed. Deriving the status from the payments means
 * the two can never disagree.
 */
export async function refreshLoanStatus(loanId: number, principal: number) {
  const [paid] = await db()
    .select({ v: sql<string>`coalesce(sum(${t.loanPayments.amount}),0)` })
    .from(t.loanPayments)
    .where(eq(t.loanPayments.loanId, loanId));

  const settled = Number(paid.v) >= principal;
  await db()
    .update(t.loans)
    .set({ status: settled ? "settled" : "open", settledOn: settled ? todayStr() : null })
    .where(eq(t.loans.id, loanId));
}

/**
 * After an import: claim freshly imported rows that are really loan payments.
 *
 * A payment is claimable when it has no ledger row yet (recorded as cash), or
 * when its row is one typed in by hand on this same account — the bank's copy
 * is the better record, it carries the fingerprint that stops re-imports, so
 * it replaces the manual one. Returns how many rows were claimed.
 */
export async function matchImportedRows(
  householdId: number,
  accountId: number,
  imported: Array<{ id: number; type: string; amount: number; txDate: string }>
): Promise<number> {
  const rows = imported.filter((r) => (r.type === "expense" || r.type === "income") && r.amount > 0);
  if (!rows.length) return 0;

  const loans = await db()
    .select({ id: t.loans.id, direction: t.loans.direction })
    .from(t.loans)
    .where(eq(t.loans.householdId, householdId));
  if (!loans.length) return 0;
  const directionOf = new Map(loans.map((l) => [l.id, l.direction as Direction]));

  const dates = rows.map((r) => r.txDate).sort();
  const payments = await db()
    .select()
    .from(t.loanPayments)
    .where(
      and(
        inArray(t.loanPayments.loanId, loans.map((l) => l.id)),
        gte(t.loanPayments.paidOn, shiftDate(dates[0], -MATCH_WINDOW_DAYS)),
        lte(t.loanPayments.paidOn, shiftDate(dates[dates.length - 1], MATCH_WINDOW_DAYS))
      )
    );
  if (!payments.length) return 0;

  const linkedIds = payments.map((p) => p.transactionId).filter((v): v is number => v !== null);
  const linked = linkedIds.length
    ? await db()
        .select({ id: t.transactions.id, source: t.transactions.source, accountId: t.transactions.accountId })
        .from(t.transactions)
        .where(and(eq(t.transactions.householdId, householdId), inArray(t.transactions.id, linkedIds)))
    : [];
  const linkedById = new Map(linked.map((l) => [l.id, l]));

  const claimable = payments.filter((p) => {
    if (p.transactionId === null) return true;
    const tx = linkedById.get(p.transactionId);
    return !!tx && tx.source === "manual" && tx.accountId === accountId;
  });

  const used = new Set<number>();
  let matched = 0;
  for (const row of rows) {
    const candidates = claimable
      .filter((p) => !used.has(p.id))
      .filter((p) => canBeLoanPayment(directionOf.get(p.loanId)!, { ...row, counterAccountId: null }))
      .map((p) => ({ id: p.id, amount: Number(p.amount), date: p.paidOn, payment: p }));
    const hit = pickMatch(candidates, row.amount, row.txDate);
    if (!hit) continue;
    used.add(hit.id);

    const direction = directionOf.get(hit.payment.loanId)!;
    await db()
      .update(t.transactions)
      .set(asLoanTransfer(direction, row.amount) as any)
      .where(and(eq(t.transactions.householdId, householdId), eq(t.transactions.id, row.id)));
    await db().update(t.loanPayments).set({ transactionId: row.id }).where(eq(t.loanPayments.id, hit.id));

    // The hand-typed copy goes, but anything hung on it moves to the bank row first.
    const old = hit.payment.transactionId;
    if (old !== null) {
      await db().update(t.attachments).set({ transactionId: row.id })
        .where(and(eq(t.attachments.householdId, householdId), eq(t.attachments.transactionId, old)));
      await db().update(t.comments).set({ entityId: row.id })
        .where(and(eq(t.comments.householdId, householdId), eq(t.comments.entityType, "transaction"), eq(t.comments.entityId, old)));
      await db().delete(t.transactions)
        .where(and(eq(t.transactions.householdId, householdId), eq(t.transactions.id, old)));
    }
    matched++;
  }
  return matched;
}

/**
 * Undo a payment's hold on its ledger row, when the payment or its loan is
 * deleted.
 *
 * A row the payment wrote itself goes with it. A row adopted from a bank
 * import does not — it is the bank's record of real money and its fingerprint
 * is what stops the next import bringing it back. It reverts to plain money
 * out (or in) and goes to the review queue for someone to categorise.
 */
export async function releaseLedgerRow(householdId: number, txId: number, direction: Direction) {
  const [tx] = await db()
    .select({ source: t.transactions.source, amount: t.transactions.amount })
    .from(t.transactions)
    .where(and(eq(t.transactions.householdId, householdId), eq(t.transactions.id, txId)));
  if (!tx) return;

  if (tx.source === "import") {
    await db()
      .update(t.transactions)
      .set({
        type: direction === "owed_by_us" ? "expense" : "income",
        amount: Math.abs(Number(tx.amount)).toFixed(2),
        needsReview: true
      } as any)
      .where(and(eq(t.transactions.householdId, householdId), eq(t.transactions.id, txId)));
  } else {
    await db()
      .delete(t.transactions)
      .where(and(eq(t.transactions.householdId, householdId), eq(t.transactions.id, txId)));
  }
}

/**
 * An asset bought in installments: the asset carries the full price, and a
 * loan to the seller carries what is still to pay. Anything already paid (the
 * token) is recorded as the loan's first payment, so it reaches the ledger as
 * a transfer — never as spending — and net worth does not jump by the full
 * price on day one.
 */
export async function startInstallments(opts: {
  householdId: number;
  userId: number;
  asset: { id: number; name: string; purchasePrice: string; purchaseDate: string };
  seller: string;
  paidSoFar: number;
  paidFrom: number | null;
  paidOn: string;
}) {
  const [loan] = await db()
    .insert(t.loans)
    .values({
      householdId: opts.householdId,
      direction: "owed_by_us",
      counterparty: opts.seller,
      principal: opts.asset.purchasePrice,
      startedOn: opts.asset.purchaseDate,
      note: `Installments on ${opts.asset.name}`,
      assetId: opts.asset.id,
      createdBy: opts.userId
    })
    .returning();

  if (opts.paidSoFar > 0) {
    await recordLoanPayment({
      loan,
      amount: opts.paidSoFar,
      paidOn: opts.paidOn,
      accountId: opts.paidFrom,
      note: "Paid so far",
      userId: opts.userId
    });
  }
  return loan;
}
