"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { todayStr } from "@/lib/money";
import { recordLoanPayment, refreshLoanStatus, releaseLedgerRow } from "@/lib/loan-ledger";
import type { Direction } from "@/lib/match";
import { z } from "zod";
import { f, readForm } from "@/lib/forms";

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

const loanForm = z.object({
  direction: z.enum(["owed_by_us", "owed_to_us"], { error: "Pick who owes whom" }),
  counterparty: f.name("Who and how much are both required"),
  principal: f.money,
  startedOn: f.optDate,
  dueOn: f.optDate,
  note: f.text(300)
});

export async function addLoan(formData: FormData) {
  const { household, user } = await requireContext();
  const r = readForm(loanForm, formData);
  if (!r.ok) redirect("/loans?e=" + encodeURIComponent(r.error));
  const d = r.data;

  await db().insert(t.loans).values({
    householdId: household.id,
    direction: d.direction,
    counterparty: d.counterparty,
    principal: d.principal.toFixed(2),
    startedOn: d.startedOn ?? todayStr(),
    dueOn: d.dueOn ?? null,
    note: d.note || null,
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
const paymentForm = z.object({
  loanId: f.id,
  amount: f.money,
  paidOn: f.optDate,
  accountId: f.optId,
  note: f.text(300),
  back: f.text(10)
});

export async function addLoanPayment(formData: FormData) {
  const { household, user } = await requireContext();
  const r = readForm(paymentForm, formData);
  if (!r.ok) redirect("/loans?e=" + encodeURIComponent(r.error));
  const d = r.data;
  const back = d.back === "asset" ? "asset" : "loans";

  const loan = await ownedLoan(household.id, d.loanId);
  if (!loan) redirect("/loans?e=That+loan+was+not+found");

  // The account is checked against this household inside recordLoanPayment.
  await recordLoanPayment({
    loan,
    amount: d.amount,
    paidOn: d.paidOn ?? todayStr(),
    accountId: d.accountId ?? null,
    note: d.note || null,
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

  const r = readForm(loanForm.pick({ counterparty: true, principal: true, dueOn: true, note: true }), formData);
  if (!r.ok) return;
  const { counterparty, principal, dueOn, note } = r.data;

  await db()
    .update(t.loans)
    .set({
      counterparty,
      principal: principal.toFixed(2),
      dueOn: dueOn ?? null,
      note: note || null
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
