"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { notify } from "@/actions/notifications";
import { z } from "zod";
import { f, ownsRefs, readForm } from "@/lib/forms";
import { todayStr } from "@/lib/money";

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

const txForm = z.object({
  type: z.enum(["expense", "refund", "income", "transfer"]).default("expense"),
  amount: f.money,
  accountId: f.id.catch(0),
  counterAccountId: f.optId,
  categoryId: f.optId,
  personId: f.optId,
  txDate: f.optDate,
  description: f.text(300),
  isAbnormal: f.checkbox,
  isPassthrough: f.checkbox,
  needsReview: f.checkbox
});

/**
 * One validated entry, as the database stores it. A refund is a negative
 * expense in the original's category, so every total, balance and budget nets
 * it out with no special casing. Returns an error message instead when the
 * form is wrong or points at something that isn't this household's.
 */
async function readEntry(householdId: number, formData: FormData) {
  const r = readForm(txForm, formData);
  if (!r.ok) return { error: r.error } as const;
  const d = r.data;
  if (!d.accountId) return { error: "Pick an account" } as const;
  const refund = d.type === "refund";
  const type = refund ? "expense" : d.type;
  const counterAccountId = type === "transfer" ? d.counterAccountId ?? null : null;
  if (counterAccountId === d.accountId) return { error: "A transfer needs two different accounts" } as const;
  const categoryId = type === "expense" ? d.categoryId ?? null : null;
  const personId = d.personId ?? null;
  const owned = await ownsRefs(householdId, {
    accountIds: [d.accountId, counterAccountId], categoryIds: [categoryId], personIds: [personId]
  });
  if (!owned) return { error: "That account, category or person was not found" } as const;
  return {
    entry: {
      type, refund, accountId: d.accountId, counterAccountId, categoryId, personId,
      entered: d.amount,
      txDate: d.txDate ?? todayStr(),
      description: d.description,
      isAbnormal: d.isAbnormal, isPassthrough: d.isPassthrough, needsReview: d.needsReview
    }
  } as const;
}

export async function addTransaction(formData: FormData) {
  const { user, household } = await requireContext();
  const r = await readEntry(household.id, formData);
  if (r.error !== undefined) redirect("/entry?e=" + encodeURIComponent(r.error));
  const e = r.entry;

  const [tx] = await db().insert(t.transactions).values({
    householdId: household.id, accountId: e.accountId,
    type: e.type, counterAccountId: e.counterAccountId,
    amount: (e.refund ? -e.entered : e.entered).toFixed(2),
    txDate: e.txDate,
    description: e.description,
    categoryId: e.categoryId,
    personId: e.personId,
    isAbnormal: e.isAbnormal,
    isPassthrough: e.isPassthrough,
    needsReview: e.needsReview,
    reviewNote: String(formData.get("reviewNote") || "").trim().slice(0, 1000) || null,
    source: "manual", createdBy: user.id
  }).returning();

  await saveAttachment(household.id, formData.get("receipt") as File | null, { transactionId: tx.id });
  revalidatePath("/"); revalidatePath("/ledger"); revalidatePath("/entry");
  // Confirm with the actual figure, not a bare "Saved." — and land on the
  // ledger where the new row is visible, so the entry is self-evidently there.
  const saved = new URLSearchParams({
    saved: String(Math.abs(Number(tx.amount))),
    m: tx.txDate.slice(0, 7)
  });
  redirect(`/ledger?${saved.toString()}`);
}

/**
 * Correct an existing transaction.
 *
 * Without this, fixing a mistyped amount or a wrong category means delete and
 * re-add — which throws away the row's comments and its import-batch link.
 * Open to any household member, exactly like add and delete.
 */
export async function updateTransaction(formData: FormData) {
  const { household } = await requireContext();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const r = await readEntry(household.id, formData);
  if (r.error !== undefined) redirect(`/ledger/${id}?e=` + encodeURIComponent(r.error));
  const e = r.entry;
  // A loan repayment received is a transfer in with no "to" account, stored
  // negative (see loanTransferAmount). The form shows it positive.
  const inbound = e.type === "transfer" && !e.counterAccountId && formData.get("inbound") === "1";
  const amount = e.refund || inbound ? -e.entered : e.entered;

  const [tx] = await db().update(t.transactions).set(({
    type: e.type,
    amount: amount.toFixed(2),
    txDate: e.txDate,
    description: e.description,
    categoryId: e.categoryId,
    personId: e.personId,
    accountId: e.accountId,
    counterAccountId: e.counterAccountId,
    isAbnormal: e.isAbnormal,
    isPassthrough: e.isPassthrough,
    needsReview: e.needsReview
  } as any))
    .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.id, id)))
    .returning();

  if (!tx) redirect("/ledger");

  // Payee name: set, change or clear the household's name for this bank text.
  if (formData.has("payee") && tx.description) {
    const name = String(formData.get("payee") || "").trim();
    if (name) {
      await db().insert(t.payees).values({ householdId: household.id, match: tx.description, name })
        .onConflictDoUpdate({ target: [t.payees.householdId, t.payees.match], set: { name } });
    } else {
      await db().delete(t.payees)
        .where(and(eq(t.payees.householdId, household.id), eq(t.payees.match, tx.description)));
    }
  }

  await saveAttachment(household.id, formData.get("receipt") as File | null, { transactionId: tx.id });
  revalidatePath("/"); revalidatePath("/ledger"); revalidatePath("/review"); revalidatePath("/year");

  const saved = new URLSearchParams({
    saved: String(Math.abs(Number(tx.amount))),
    m: tx.txDate.slice(0, 7)
  });
  redirect(`/ledger?${saved.toString()}`);
}

/**
 * Create a category from the entry form.
 *
 * Without this you have to abandon a half-typed entry, go to Settings, add the
 * category, and start over — so entries got filed under whatever already
 * existed. Returns the new row so the picker can select it immediately.
 */
export async function quickAddCategory(formData: FormData): Promise<{ id: number; name: string } | void> {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const [row] = await db()
    .insert(t.categories)
    .values({ householdId: household.id, name })
    .returning();

  revalidatePath("/entry"); revalidatePath("/settings");
  return { id: row.id, name: row.name };
}

/** Same as quickAddCategory, for people. */
export async function quickAddPerson(formData: FormData): Promise<{ id: number; name: string } | void> {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const [row] = await db()
    .insert(t.persons)
    .values({ householdId: household.id, name })
    .returning();

  revalidatePath("/entry"); revalidatePath("/settings");
  return { id: row.id, name: row.name };
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
  if (!(await ownsRefs(household.id, { categoryIds: [categoryId], personIds: [personId] }))) return;

  const [tx] = await db().update(t.transactions).set(({
    categoryId, personId, isPassthrough, isAbnormal, needsReview: false, reviewNote: null
  } as any)).where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.id, id))).returning();

  // Naming the payee while reviewing: the moment the row is being looked at.
  const payeeName = String(formData.get("payee") || "").trim();
  if (payeeName && tx?.description) {
    await db().insert(t.payees).values({ householdId: household.id, match: tx.description, name: payeeName })
      .onConflictDoUpdate({ target: [t.payees.householdId, t.payees.match], set: { name: payeeName } });
  }

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

/**
 * Ask a question about a transaction.
 *
 * Tooba does the day-to-day categorising and often can't tell what a bank row
 * was for. Flagging it here puts it in the review queue AND notifies the
 * household, so the question doesn't sit unseen.
 */
export async function askAboutTransaction(formData: FormData) {
  const { household, user } = await requireContext();
  const id = Number(formData.get("id"));
  const question = String(formData.get("question") || "").trim();
  if (!id || !question) return;

  const [tx] = await db()
    .update(t.transactions)
    .set(({
      needsReview: true,
      reviewNote: question,
      reviewAskedBy: user.id,
      reviewAnswer: null,
      reviewAnsweredBy: null,
      reviewAnsweredAt: null
    } as any))
    .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.id, id)))
    .returning();

  if (tx) {
    await notify({
      householdId: household.id,
      kind: "review",
      title: `${user.name} asked about a transaction`,
      body: `“${question}” — ${tx.description?.slice(0, 60) || "transaction"}`,
      href: `/review?focus=${id}`
    });
  }
  revalidatePath("/review"); revalidatePath("/ledger"); revalidatePath("/", "layout");
}

/** Answer a flagged question. The asker is notified; the flag stays until they resolve it. */
export async function answerQuestion(formData: FormData) {
  const { household, user } = await requireContext();
  const id = Number(formData.get("id"));
  const answer = String(formData.get("answer") || "").trim();
  if (!id || !answer) return;

  const [tx] = await db()
    .update(t.transactions)
    .set(({ reviewAnswer: answer, reviewAnsweredBy: user.id, reviewAnsweredAt: new Date() } as any))
    .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.id, id)))
    .returning();

  if (tx) {
    await notify({
      householdId: household.id,
      kind: "review",
      title: `${user.name} answered your question`,
      body: `“${answer}” — ${tx.description?.slice(0, 60) || "transaction"}`,
      href: `/review?focus=${id}`
    });
  }
  revalidatePath("/review"); revalidatePath("/ledger"); revalidatePath("/", "layout");
}
