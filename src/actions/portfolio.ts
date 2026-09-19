"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";
import { todayStr } from "@/lib/money";

const MAX_ATTACHMENT = 2 * 1024 * 1024;

export async function addAsset(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("purchasePrice") || 0);
  if (!name || !price) redirect("/assets?e=Name+and+purchase+price+are+required");
  const purchaseDate = String(formData.get("purchaseDate") || todayStr());
  const [asset] = await db().insert(t.assets).values({
    householdId: household.id, name, purchaseDate,
    purchasePrice: price.toFixed(2), notes: String(formData.get("notes") || "") || null
  }).returning();
  await db().insert(t.assetValues).values({ assetId: asset.id, valuedOn: purchaseDate, value: price.toFixed(2) });

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
  const assetId = Number(formData.get("assetId"));
  const value = Number(formData.get("value") || 0);
  if (!value) return;
  const owned = await db().select().from(t.assets)
    .where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, assetId))).limit(1);
  if (!owned.length) return;
  await db().insert(t.assetValues).values({ assetId, valuedOn: String(formData.get("valuedOn") || todayStr()), value: value.toFixed(2) });
  await db().update(t.households).set(({ lastRevaluedAt: todayStr() } as any)).where(eq(t.households.id, household.id));
  revalidatePath("/assets"); revalidatePath("/");
}

export async function sellAsset(formData: FormData) {
  const { household } = await requireContext();
  const assetId = Number(formData.get("assetId"));
  const price = Number(formData.get("soldPrice") || 0);
  await db().update(t.assets).set(({
    status: "sold", soldDate: String(formData.get("soldDate") || todayStr()),
    soldPrice: price ? price.toFixed(2) : null
  } as any)).where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, assetId)));
  revalidatePath("/assets"); revalidatePath("/");
}

/** Ids arrive as form strings; anything that isn't a real row id is a no-op. */
function rowId(v: FormDataEntryValue | null) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function updateAsset(formData: FormData) {
  const { household } = await requireContext();
  const id = rowId(formData.get("id"));
  if (!id) return;
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("purchasePrice") || 0);
  if (!name || !price) return;
  await db().update(t.assets).set(({
    name,
    purchaseDate: String(formData.get("purchaseDate") || todayStr()),
    purchasePrice: price.toFixed(2),
    notes: String(formData.get("notes") || "") || null
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
  const name = String(formData.get("name") || "").trim();
  const target = Number(formData.get("targetAmount") || 0);
  if (!name || !target) redirect("/goals?e=Name+and+target+are+required");
  await db().insert(t.goals).values({
    householdId: household.id, name, targetAmount: target.toFixed(2),
    deadline: String(formData.get("deadline") || "") || null
  });
  revalidatePath("/goals"); redirect("/goals");
}

export async function contributeToGoal(formData: FormData) {
  const { household } = await requireContext();
  const goalId = Number(formData.get("goalId"));
  const amount = Number(formData.get("amount") || 0);
  if (!amount) return;
  const owned = await db().select().from(t.goals)
    .where(and(eq(t.goals.householdId, household.id), eq(t.goals.id, goalId))).limit(1);
  if (!owned.length) return;
  await db().insert(t.goalContributions).values({
    goalId, amount: amount.toFixed(2), onDate: todayStr(),
    note: String(formData.get("note") || "") || null
  });
  revalidatePath("/goals"); revalidatePath("/");
}

/** Goal completed -> optionally becomes an asset (the car-fund loop). */
export async function completeGoal(formData: FormData) {
  const { household } = await requireContext();
  const goalId = Number(formData.get("goalId"));
  const makeAsset = formData.get("makeAsset") === "on";
  const owned = await db().select().from(t.goals)
    .where(and(eq(t.goals.householdId, household.id), eq(t.goals.id, goalId))).limit(1);
  if (!owned.length) return;
  let linkedAssetId: number | null = null;
  if (makeAsset) {
    const price = Number(formData.get("purchasePrice") || 0) || Number(owned[0].targetAmount);
    const [asset] = await db().insert(t.assets).values({
      householdId: household.id, name: String(formData.get("assetName") || owned[0].name),
      purchaseDate: todayStr(), purchasePrice: price.toFixed(2)
    }).returning();
    await db().insert(t.assetValues).values({ assetId: asset.id, valuedOn: todayStr(), value: price.toFixed(2) });
    linkedAssetId = asset.id;
  }
  await db().update(t.goals).set(({ status: "done", linkedAssetId } as any)).where(eq(t.goals.id, goalId));
  revalidatePath("/goals"); revalidatePath("/assets"); revalidatePath("/");
}
