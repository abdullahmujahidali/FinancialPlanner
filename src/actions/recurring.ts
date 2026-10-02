"use server";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { monthKey } from "@/lib/money";

const refresh = () => {
  revalidatePath("/"); revalidatePath("/ledger"); revalidatePath("/settings", "layout");
};

const idOrNull = (v: FormDataEntryValue | null) => (v ? Number(v) || null : null);

export async function addRecurring(formData: FormData) {
  const { household } = await requireContext();
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const accountId = Number(formData.get("accountId"));
  const type = formData.get("type") === "income" ? "income" : "expense";
  if (!description || !(amount > 0) || !accountId) return;
  const day = Math.min(28, Math.max(1, Number(formData.get("dayOfMonth") || 1)));
  await db().insert(t.recurring).values({
    householdId: household.id, description, type,
    amount: amount.toFixed(2), accountId,
    categoryId: type === "expense" ? idOrNull(formData.get("categoryId")) : null,
    personId: idOrNull(formData.get("personId")),
    isPassthrough: formData.get("isPassthrough") === "on",
    dayOfMonth: day
  });
  refresh();
}

export async function setRecurringArchived(formData: FormData) {
  const { household } = await requireContext();
  await db().update(t.recurring).set({ isArchived: formData.get("archived") === "1" })
    .where(and(eq(t.recurring.householdId, household.id), eq(t.recurring.id, Number(formData.get("id")))));
  refresh();
}

export async function updateRecurringAmount(formData: FormData) {
  const { household } = await requireContext();
  const amount = Number(formData.get("amount") || 0);
  if (!(amount > 0)) return;
  await db().update(t.recurring).set({ amount: amount.toFixed(2) })
    .where(and(eq(t.recurring.householdId, household.id), eq(t.recurring.id, Number(formData.get("id")))));
  refresh();
}

/**
 * Add this month's entry for one regular payment, or several at once (the
 * "Add all" button posts every id). The amount can be overridden per row for
 * the month without changing the saved default.
 */
export async function postRecurring(formData: FormData) {
  const { household, user } = await requireContext();
  const month = String(formData.get("month") || monthKey());
  const ids = formData.getAll("id").map(Number).filter(Boolean);
  if (!ids.length) return;

  const rows = await db().select().from(t.recurring)
    .where(and(eq(t.recurring.householdId, household.id), eq(t.recurring.isArchived, false)));

  for (const r of rows.filter((r) => ids.includes(r.id) && r.lastMonth !== month)) {
    const override = Number(formData.get(`amount_${r.id}`) || 0);
    const amount = override > 0 ? override : Number(r.amount);
    const [y, mo] = month.split("-").map(Number);
    const day = Math.min(r.dayOfMonth, new Date(y, mo, 0).getDate());
    await db().batch([
      db().insert(t.transactions).values({
        householdId: household.id, accountId: r.accountId, type: r.type,
        amount: amount.toFixed(2),
        txDate: `${month}-${String(day).padStart(2, "0")}`,
        description: r.description,
        categoryId: r.type === "expense" ? r.categoryId : null,
        personId: r.personId,
        isPassthrough: r.isPassthrough,
        source: "manual", createdBy: user.id
      }),
      db().update(t.recurring).set({ lastMonth: month }).where(eq(t.recurring.id, r.id))
    ]);
  }
  refresh();
}

/** Not this month — already in the bank statement, or simply not paid. */
export async function skipRecurring(formData: FormData) {
  const { household } = await requireContext();
  const month = String(formData.get("month") || monthKey());
  // Sent from a skip button inside the "Add selected" form, so the row id
  // comes in as `skip` — `id` there holds every ticked row.
  const id = Number(formData.get("skip"));
  if (!id) return;
  await db().update(t.recurring).set({ lastMonth: month })
    .where(and(eq(t.recurring.householdId, household.id), eq(t.recurring.id, id)));
  refresh();
}
