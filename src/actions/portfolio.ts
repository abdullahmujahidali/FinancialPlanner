"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { todayStr } from "@/lib/money";
import { startInstallments } from "@/lib/loan-ledger";
import { z } from "zod";
import { f, readForm } from "@/lib/forms";

const MAX_ATTACHMENT = 2 * 1024 * 1024;

/** Ids arrive as form strings; anything that isn't a real row id is a no-op. */
function rowId(v: FormDataEntryValue | null) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const assetForm = z.object({
  name: f.name("Name and purchase price are required"),
  purchasePrice: f.money,
  purchaseDate: f.optDate,
  notes: f.text(500)
});

/** The "still paying for it?" fields, shared by the add form and the asset page. */
const installmentForm = z.object({
  seller: f.text(120),
  paidSoFar: f.optMoney,
  paidFrom: f.optId,
  paidOn: f.optDate
});

/** Null when no seller was given: the asset was paid for outright. */
function installmentFields(formData: FormData, price: number) {
  const r = readForm(installmentForm, formData);
  if (!r.ok) return { error: r.error } as const;
  const d = r.data;
  if (!d.seller) return null;
  // The account is checked against this household inside recordLoanPayment.
  return {
    seller: d.seller,
    paidSoFar: Math.min(d.paidSoFar ?? 0, price),
    paidFrom: d.paidFrom ?? null,
    paidOn: d.paidOn ?? todayStr()
  };
}

export async function addAsset(formData: FormData) {
  const { household, user } = await requireContext();
  const r = readForm(assetForm, formData);
  if (!r.ok) redirect("/assets?e=" + encodeURIComponent(r.error));
  const { name, purchasePrice: price, notes } = r.data;
  const purchaseDate = r.data.purchaseDate ?? todayStr();
  const plan = installmentFields(formData, price);
  if (plan && "error" in plan) redirect("/assets?e=" + encodeURIComponent(plan.error ?? ""));
  const [asset] = await db().insert(t.assets).values({
    householdId: household.id, name, purchaseDate,
    purchasePrice: price.toFixed(2), notes: notes || null
  }).returning();
  await db().insert(t.assetValues).values({ assetId: asset.id, valuedOn: purchaseDate, value: price.toFixed(2) });

  if (plan) {
    await startInstallments({ householdId: household.id, userId: user.id, asset, ...plan });
    revalidatePath("/loans"); revalidatePath("/ledger");
  }

  const file = formData.get("photo") as File | null;
  if (file && file.size > 0 && file.size <= MAX_ATTACHMENT) {
    const buf = Buffer.from(await file.arrayBuffer());
    await db().insert(t.attachments).values({
      householdId: household.id, assetId: asset.id, filename: file.name,
      mime: file.type || "application/octet-stream", size: file.size, data: buf.toString("base64")
    });
  }
  revalidatePath("/assets"); revalidatePath("/");
  redirect("/assets");
}

export async function revalueAsset(formData: FormData) {
  const { household } = await requireContext();
  const r = readForm(z.object({ assetId: f.id, value: f.money, valuedOn: f.optDate }), formData);
  if (!r.ok) return;
  const { assetId, value } = r.data;
  const owned = await db().select().from(t.assets)
    .where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, assetId))).limit(1);
  if (!owned.length) return;
  await db().insert(t.assetValues).values({ assetId, valuedOn: r.data.valuedOn ?? todayStr(), value: value.toFixed(2) });
  await db().update(t.households).set(({ lastRevaluedAt: todayStr() } as any)).where(eq(t.households.id, household.id));
  revalidatePath("/assets"); revalidatePath("/");
}

export async function sellAsset(formData: FormData) {
  const { household } = await requireContext();
  const r = readForm(z.object({ assetId: f.id, soldPrice: f.optMoney, soldDate: f.optDate }), formData);
  if (!r.ok) return;
  const { assetId, soldPrice: price } = r.data;
  await db().update(t.assets).set(({
    status: "sold", soldDate: r.data.soldDate ?? todayStr(),
    soldPrice: price ? price.toFixed(2) : null
  } as any)).where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, assetId)));
  revalidatePath("/assets"); revalidatePath("/");
}

/** Set up installments on an asset already on the books. */
export async function addInstallments(formData: FormData) {
  const { household, user } = await requireContext();
  const id = rowId(formData.get("assetId"));
  if (!id) return;
  const [asset] = await db().select().from(t.assets)
    .where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, id))).limit(1);
  if (!asset) return;
  const plan = installmentFields(formData, Number(asset.purchasePrice));
  if (!plan || "error" in plan) return;
  await startInstallments({ householdId: household.id, userId: user.id, asset, ...plan });
  revalidatePath(`/assets/${id}`); revalidatePath("/assets"); revalidatePath("/loans");
  revalidatePath("/ledger"); revalidatePath("/");
}

export async function updateAsset(formData: FormData) {
  const { household } = await requireContext();
  const id = rowId(formData.get("id"));
  if (!id) return;
  const r = readForm(assetForm, formData);
  if (!r.ok) return;
  const { name, purchasePrice: price, notes } = r.data;
  await db().update(t.assets).set(({
    name,
    purchaseDate: r.data.purchaseDate ?? todayStr(),
    purchasePrice: price.toFixed(2),
    notes: notes || null
  } as any)).where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, id)));
  revalidatePath("/assets"); revalidatePath("/"); revalidatePath("/year");
}

/**
 * asset_values has no ON DELETE CASCADE, so the history rows have to go first
 * or the foreign key blocks the parent delete.
 */
export async function deleteAsset(formData: FormData) {
  const { household } = await requireContext();
  const id = rowId(formData.get("id"));
  if (!id) return;
  const owned = await db().select({ id: t.assets.id }).from(t.assets)
    .where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, id))).limit(1);
  if (!owned.length) return;

  await db().delete(t.assetValues).where(eq(t.assetValues.assetId, id));
  await db().delete(t.attachments)
    .where(and(eq(t.attachments.householdId, household.id), eq(t.attachments.assetId, id)));
  await db().delete(t.assets)
    .where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, id)));

  revalidatePath("/assets"); revalidatePath("/"); revalidatePath("/year");
  redirect("/assets");
}

/** One revaluation row. Ownership is proven through its parent asset. */
export async function deleteAssetValue(formData: FormData) {
  const { household } = await requireContext();
  const id = rowId(formData.get("id"));
  if (!id) return;
  const [row] = await db()
    .select({ id: t.assetValues.id })
    .from(t.assetValues)
    .innerJoin(t.assets, eq(t.assets.id, t.assetValues.assetId))
    .where(and(eq(t.assetValues.id, id), eq(t.assets.householdId, household.id)))
    .limit(1);
  if (!row) return;
  await db().delete(t.assetValues).where(eq(t.assetValues.id, id));
  revalidatePath("/assets"); revalidatePath("/"); revalidatePath("/year");
}

export async function addGoal(formData: FormData) {
  const { household } = await requireContext();
  const r = readForm(z.object({
    name: f.name("Name and target are required"), targetAmount: f.money, deadline: f.optDate
  }), formData);
  if (!r.ok) redirect("/goals?e=" + encodeURIComponent(r.error));
  const { name, targetAmount: target, deadline } = r.data;
  await db().insert(t.goals).values({
    householdId: household.id, name, targetAmount: target.toFixed(2),
    deadline: deadline ?? null
  });
  revalidatePath("/goals"); redirect("/goals");
}

export async function contributeToGoal(formData: FormData) {
  const { household } = await requireContext();
  const r = readForm(z.object({ goalId: f.id, amount: f.money, note: f.text(300) }), formData);
  if (!r.ok) return;
  const { goalId, amount } = r.data;
  const owned = await db().select().from(t.goals)
    .where(and(eq(t.goals.householdId, household.id), eq(t.goals.id, goalId))).limit(1);
  if (!owned.length) return;
  await db().insert(t.goalContributions).values({
    goalId, amount: amount.toFixed(2), onDate: todayStr(),
    note: r.data.note || null
  });
  revalidatePath("/goals"); revalidatePath("/");
}

/** Goal completed -> optionally becomes an asset (the car-fund loop). */
export async function completeGoal(formData: FormData) {
  const { household } = await requireContext();
  const r = readForm(z.object({
    goalId: f.id, makeAsset: f.checkbox, purchasePrice: f.optMoney, assetName: f.text(120)
  }), formData);
  if (!r.ok) return;
  const { goalId, makeAsset } = r.data;
  const owned = await db().select().from(t.goals)
    .where(and(eq(t.goals.householdId, household.id), eq(t.goals.id, goalId))).limit(1);
  if (!owned.length) return;
  let linkedAssetId: number | null = null;
  if (makeAsset) {
    const price = r.data.purchasePrice || Number(owned[0].targetAmount);
    const [asset] = await db().insert(t.assets).values({
      householdId: household.id, name: r.data.assetName || owned[0].name,
      purchaseDate: todayStr(), purchasePrice: price.toFixed(2)
    }).returning();
    await db().insert(t.assetValues).values({ assetId: asset.id, valuedOn: todayStr(), value: price.toFixed(2) });
    linkedAssetId = asset.id;
  }
  await db().update(t.goals).set(({ status: "done", linkedAssetId } as any)).where(eq(t.goals.id, goalId));
  revalidatePath("/goals"); revalidatePath("/assets"); revalidatePath("/");
}
