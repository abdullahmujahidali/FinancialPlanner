"use server";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { monthKey } from "@/lib/money";
import { z } from "zod";
import { f, ownsRefs, readForm } from "@/lib/forms";
import { checkBudgetAlerts } from "@/lib/budget-alerts";

const refresh = () => {
  revalidatePath("/"); revalidatePath("/ledger"); revalidatePath("/settings", "layout");
};

export async function addRecurring(formData: FormData) {
  const { household } = await requireContext();
  const r = readForm(z.object({
    description: f.name("Describe the payment", 200),
    amount: f.money,
    accountId: f.id,
    type: z.enum(["expense", "income"]).catch("expense"),
    dayOfMonth: z.coerce.number().int().catch(1),
    categoryId: f.optId,
    personId: f.optId,
    isPassthrough: f.checkbox
  }), formData);
  if (!r.ok) return;
  const d = r.data;
  const categoryId = d.type === "expense" ? d.categoryId ?? null : null;
  const personId = d.personId ?? null;
  if (!(await ownsRefs(household.id, { accountIds: [d.accountId], categoryIds: [categoryId], personIds: [personId] }))) return;
  await db().insert(t.recurring).values({
    householdId: household.id, description: d.description, type: d.type,
    amount: d.amount.toFixed(2), accountId: d.accountId,
    categoryId, personId,
    isPassthrough: d.isPassthrough,
    dayOfMonth: Math.min(28, Math.max(1, d.dayOfMonth))
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
  const r = readForm(z.object({ amount: f.money }), formData);
  if (!r.ok) return;
  const { amount } = r.data;
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
  const m = f.month.safeParse(formData.get("month") || monthKey());
  if (!m.success) return;
  const month = m.data;
  const ids = formData.getAll("id").map(Number).filter(Boolean);
  if (!ids.length) return;

  const rows = await db().select().from(t.recurring)
    .where(and(eq(t.recurring.householdId, household.id), eq(t.recurring.isArchived, false)));

  for (const r of rows.filter((r) => ids.includes(r.id) && r.lastMonth !== month)) {
    const o = f.optMoney.safeParse(formData.get(`amount_${r.id}`));
    const override = o.success ? o.data ?? 0 : 0;
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
  await checkBudgetAlerts(household.id, [`${month}-01`]);
  refresh();
}

/** Not this month — already in the bank statement, or simply not paid. */
export async function skipRecurring(formData: FormData) {
  const { household } = await requireContext();
  const m = f.month.safeParse(formData.get("month") || monthKey());
  if (!m.success) return;
  const month = m.data;
  // Sent from a skip button inside the "Add selected" form, so the row id
  // comes in as `skip` — `id` there holds every ticked row.
  const id = Number(formData.get("skip"));
  if (!id) return;
  await db().update(t.recurring).set({ lastMonth: month })
    .where(and(eq(t.recurring.householdId, household.id), eq(t.recurring.id, id)));
  refresh();
}
