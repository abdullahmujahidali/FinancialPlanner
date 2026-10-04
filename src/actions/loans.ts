"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { todayStr } from "@/lib/money";
import { recordLoanPayment, refreshLoanStatus, releaseLedgerRow } from "@/lib/loan-ledger";
import type { Direction } from "@/lib/match";

const DIRECTIONS = new Set(["owed_by_us", "owed_to_us"]);

/** Ids arrive as form strings; anything that isn't a real row id is a no-op. */
function rowId(v: FormDataEntryValue | null) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Loans belong to a household, and `loan_payments` is tenanted only through
 * its parent loan — the same trap as `goal_contributions`. Every payment write
 * therefore confirms the loan belongs to this household first.
 */
async function ownedLoan(householdId: number, loanId: number) {
  const [loan] = await db()
    .select()
    .from(t.loans)
    .where(and(eq(t.loans.householdId, householdId), eq(t.loans.id, loanId)));
  return loan ?? null;
}

export async function addLoan(formData: FormData) {
  const { household, user } = await requireContext();
  const counterparty = String(formData.get("counterparty") || "").trim();
  const principal = Number(formData.get("principal") || 0);
  const direction = String(formData.get("direction") || "");

  if (!counterparty || !principal || !DIRECTIONS.has(direction)) {
    redirect("/loans?e=Who+and+how+much+are+both+required");
  }

  await db().insert(t.loans).values({
    householdId: household.id,
    direction,
    counterparty,
    principal: principal.toFixed(2),
    startedOn: String(formData.get("startedOn") || todayStr()),
    dueOn: String(formData.get("dueOn") || "") || null,
    note: String(formData.get("note") || "").trim() || null,
    createdBy: user.id
  });

  revalidatePath("/loans");
  revalidatePath("/");
  revalidatePath("/assets");
  redirect("/loans");
}

/**
 * Record money moving against a loan.
 *
 * When an account is chosen the payment gets a ledger row as a `transfer` —
 * money leaving for a repayment is not spending, and counting it as such would
 * inflate the month and eat the incentive. If the bank import already brought
 * that row in, it is adopted rather than doubled (see `recordLoanPayment`).
 * When no account is chosen the payment is recorded on the loan alone, which
 * is how cash handed over in person gets logged.
 */
export async function addLoanPayment(formData: FormData) {
  const { household, user } = await requireContext();
  const loanId = rowId(formData.get("loanId"));
  const amount = Number(formData.get("amount") || 0);
  const back = String(formData.get("back") || "") === "asset" ? "asset" : "loans";
  if (!loanId || !amount || amount <= 0) redirect("/loans?e=Enter+an+amount");

  const loan = await ownedLoan(household.id, loanId);
  if (!loan) redirect("/loans?e=That+loan+was+not+found");

  await recordLoanPayment({
    loan,
    amount,
    paidOn: String(formData.get("paidOn") || todayStr()),
    accountId: rowId(formData.get("accountId")),
    note: String(formData.get("note") || "").trim() || null,
    userId: user.id
  });

  revalidatePath("/loans");
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath("/ledger");
  if (loan.assetId) revalidatePath(`/assets/${loan.assetId}`);
  if (back === "asset" && loan.assetId) redirect(`/assets/${loan.assetId}`);
}

export async function deleteLoanPayment(formData: FormData) {
  const { household } = await requireContext();
  const paymentId = rowId(formData.get("paymentId"));
  if (!paymentId) return;

  const [payment] = await db()
    .select()
    .from(t.loanPayments)
    .where(eq(t.loanPayments.id, paymentId));
  if (!payment) return;

  const loan = await ownedLoan(household.id, payment.loanId);
  if (!loan) return;

  await db().delete(t.loanPayments).where(eq(t.loanPayments.id, paymentId));

  // A row the payment wrote goes with it, otherwise the account balance keeps
  // a movement that no longer happened. An adopted bank row stays.
  if (payment.transactionId) {
    await releaseLedgerRow(household.id, payment.transactionId, loan.direction as Direction);
  }

  await refreshLoanStatus(loan.id, Number(loan.principal));

  revalidatePath("/loans");
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath("/ledger");
}

export async function updateLoan(formData: FormData) {
  const { household } = await requireContext();
  const id = rowId(formData.get("id"));
  if (!id) return;

  const counterparty = String(formData.get("counterparty") || "").trim();
  const principal = Number(formData.get("principal") || 0);
  if (!counterparty || !principal) return;

  await db()
    .update(t.loans)
    .set({
      counterparty,
      principal: principal.toFixed(2),
      dueOn: String(formData.get("dueOn") || "") || null,
      note: String(formData.get("note") || "").trim() || null
    })
    .where(and(eq(t.loans.householdId, household.id), eq(t.loans.id, id)));

  await refreshLoanStatus(id, principal);

  revalidatePath("/loans");
  revalidatePath("/");
  revalidatePath("/assets");
}

/**
 * Deleting a loan takes its payments with it, and any ledger rows they wrote
 * (bank rows they adopted stay, back in the review queue).
 *
 * Loans are deletable where assets are not: an asset carries a purchase price
 * and a value history that the net worth figure is built on, while a loan
 * entered by mistake has no history worth keeping. A settled loan stays on the
 * page as a record; this is for the ones that should never have existed.
 */
export async function deleteLoan(formData: FormData) {
  const { household } = await requireContext();
  const id = rowId(formData.get("id"));
  if (!id) return;

  const loan = await ownedLoan(household.id, id);
  if (!loan) return;

  const payments = await db()
    .select()
    .from(t.loanPayments)
    .where(eq(t.loanPayments.loanId, loan.id));

  const txIds = payments.map((p) => p.transactionId).filter((v): v is number => v !== null);

  await db().delete(t.loanPayments).where(eq(t.loanPayments.loanId, loan.id));

  for (const txId of txIds) {
    await releaseLedgerRow(household.id, txId, loan.direction as Direction);
  }

  await db().delete(t.loans).where(eq(t.loans.id, loan.id));

  revalidatePath("/loans");
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath("/ledger");
}
