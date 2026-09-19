"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { parseMeezan } from "@/lib/meezan";
import { classifyRows, type Rule } from "@/lib/rules";
import { notify } from "@/actions/notifications";

export async function importStatement(formData: FormData) {
  const { user, household } = await requireContext();
  const file = formData.get("file") as File | null;
  const accountId = Number(formData.get("accountId"));
  if (!file || !accountId) redirect("/import?e=Pick+a+bank+account+and+a+CSV+file");

  const text = await file.text();
  const parsed = parseMeezan(text, household.id, accountId);
  if (!parsed.rows.length) redirect("/import?e=" + encodeURIComponent(parsed.errors[0] || "No rows found in file"));

  const ruleRows = await db().select().from(t.importRules).where(eq(t.importRules.householdId, household.id));
  const rules: Rule[] = ruleRows.map(r => ({
    id: r.id, pattern: r.pattern, setCategoryId: r.setCategoryId, setPersonId: r.setPersonId,
    setPassthrough: r.setPassthrough, setAbnormal: r.setAbnormal, priority: r.priority
  }));
  const fees = await db().select().from(t.categories)
    .where(and(eq(t.categories.householdId, household.id), eq(t.categories.name, "Fees & charges"))).limit(1);
  const cash = await db().select().from(t.accounts)
    .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.kind, "cash"))).limit(1);

  const classified = classifyRows(parsed.rows, rules, fees[0]?.id ?? null);

  const [batch] = await db().insert(t.importBatches).values({
    householdId: household.id, accountId, filename: file.name,
    openingBalance: parsed.opening?.toFixed(2) ?? null,
    closingBalance: parsed.closing?.toFixed(2) ?? null,
    rowCount: parsed.rows.length
  }).returning();

  let imported = 0, dups = 0, ignored = 0;
  for (const c of classified) {
    if (c.action === "ignore") { ignored++; continue; }
    const amount = (c.row.debit || c.row.credit).toFixed(2);
    const values = {
      householdId: household.id, accountId,
      type: c.action === "transfer_cash" ? "transfer" : c.action,
      counterAccountId: c.action === "transfer_cash" ? (cash[0]?.id ?? null) : null,
      amount, txDate: c.row.bookingDate, description: c.row.description,
      categoryId: c.categoryId, personId: c.personId,
      isAbnormal: c.isAbnormal, isPassthrough: c.isPassthrough,
      needsReview: c.needsReview, reviewNote: c.note,
      source: "import", importBatchId: batch.id,
      docNo: c.row.docNo || null, fingerprint: c.row.fingerprint, createdBy: user.id
    };
    const res = await db().insert(t.transactions).values(values).onConflictDoNothing().returning({ id: t.transactions.id });
    if (res.length) imported++; else dups++;
  }

  // balance tie-out: opening + credits - debits should equal closing
  let balanceOk: boolean | null = null;
  if (parsed.opening != null && parsed.closing != null) {
    const net = parsed.rows.reduce((s, r) => s + r.credit - r.debit, 0);
    balanceOk = Math.abs(parsed.opening + net - parsed.closing) < 0.05;
  }
  await db().update(t.importBatches)
    .set(({ importedCount: imported, duplicateCount: dups, ignoredCount: ignored, balanceOk } as any))
    .where(eq(t.importBatches.id, batch.id));

  // Record the import in the household's activity feed.
  const needsReview = await db()
    .select({ v: sql<string>`count(*)` })
    .from(t.transactions)
    .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.needsReview, true)));
  await notify({
    householdId: household.id,
    kind: "import",
    title: `${imported} transaction${imported === 1 ? "" : "s"} imported`,
    body:
      `${file.name}${dups ? ` · ${dups} duplicate${dups === 1 ? "" : "s"} skipped` : ""}` +
      (balanceOk === false ? " · balance tie-out did NOT match" : balanceOk ? " · balance tie-out passed" : ""),
    href: "/ledger"
  });
  const pending = Number(needsReview[0]?.v ?? 0);
  if (pending > 0) {
    await notify({
      householdId: household.id,
      kind: "review",
      title: `${pending} transaction${pending === 1 ? "" : "s"} need categorising`,
      body: "Imported rows that didn't match an existing rule.",
      href: "/review"
    });
  }

  revalidatePath("/", "layout"); revalidatePath("/ledger"); revalidatePath("/review");
  redirect(`/import?done=${batch.id}`);
}
