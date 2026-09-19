"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";

const MAX_ATTACHMENT = 2 * 1024 * 1024;

async function saveAttachment(householdId: number, file: File | null, ref: { transactionId?: number; assetId?: number }) {
  if (!file || file.size === 0) return;
  if (file.size > MAX_ATTACHMENT) return; // silently skip oversized in v1
  const buf = Buffer.from(await file.arrayBuffer());
  await db().insert(t.attachments).values({
    householdId, transactionId: ref.transactionId ?? null, assetId: ref.assetId ?? null,
    filename: file.name, mime: file.type || "application/octet-stream",
    size: file.size, data: buf.toString("base64")
  });
}

export async function addTransaction(formData: FormData) {
  const { user, household } = await requireContext();
  const type = String(formData.get("type") || "expense");
  const amount = Number(formData.get("amount") || 0);
  if (!amount || amount <= 0) redirect("/entry?e=Enter+an+amount");
  const accountId = Number(formData.get("accountId"));
  const counter = formData.get("counterAccountId");
  const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null;
  const personId = formData.get("personId") ? Number(formData.get("personId")) : null;

  const [tx] = await db().insert(t.transactions).values({
    householdId: household.id, accountId,
    type, counterAccountId: type === "transfer" && counter ? Number(counter) : null,
    amount: amount.toFixed(2),
    txDate: String(formData.get("txDate") || new Date().toISOString().slice(0, 10)),
    description: String(formData.get("description") || "").trim(),
    categoryId: type === "expense" ? categoryId : null,
    personId,
    isAbnormal: formData.get("isAbnormal") === "on",
    isPassthrough: formData.get("isPassthrough") === "on",
    needsReview: formData.get("needsReview") === "on",
    reviewNote: String(formData.get("reviewNote") || "") || null,
    source: "manual", createdBy: user.id
  }).returning();

  await saveAttachment(household.id, formData.get("receipt") as File | null, { transactionId: tx.id });
  revalidatePath("/"); revalidatePath("/ledger");
  redirect("/entry?ok=1");
}

export async function deleteTransaction(formData: FormData) {
  const { household } = await requireContext();
  const id = Number(formData.get("id"));
  await db().delete(t.attachments).where(and(eq(t.attachments.householdId, household.id), eq(t.attachments.transactionId, id)));
  await db().delete(t.transactions).where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.id, id)));
  revalidatePath("/ledger"); revalidatePath("/");
}

export async function resolveReview(formData: FormData) {
  const { household } = await requireContext();
  const id = Number(formData.get("id"));
  const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null;
  const personId = formData.get("personId") ? Number(formData.get("personId")) : null;
  const isPassthrough = formData.get("isPassthrough") === "on";
  const isAbnormal = formData.get("isAbnormal") === "on";

  const [tx] = await db().update(t.transactions).set(({
    categoryId, personId, isPassthrough, isAbnormal, needsReview: false, reviewNote: null
  } as any)).where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.id, id))).returning();

  // "remember this" -> new import rule from a stable slice of the description
  if (formData.get("remember") === "on" && tx) {
    const pattern = String(formData.get("pattern") || "").trim().toUpperCase()
      || tx.description.toUpperCase().replace(/STAN\s*\(?\d+\)?/g, "").replace(/\d{6,}/g, "").trim().slice(0, 40);
    if (pattern.length >= 4) {
      await db().insert(t.importRules).values({
        householdId: household.id, pattern,
        setCategoryId: categoryId, setPersonId: personId,
        setPassthrough: isPassthrough, setAbnormal: false, priority: 100
      });
    }
  }
  revalidatePath("/review"); revalidatePath("/"); revalidatePath("/ledger");
}
