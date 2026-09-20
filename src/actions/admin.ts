"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";

/**
 * Household settings.
 *
 * Anyone in the household can set the name, budget and currency — the person
 * doing the daily categorising is the one who notices when the budget is
 * wrong, and having to ask the owner to change a number makes the tool
 * theirs rather than the household's.
 *
 * The incentive percentage is the exception: it is what the day-to-day user
 * is paid, so it stays with the owner. A member's submission keeps the
 * stored value rather than being rejected outright.
 */
export async function updateHousehold(formData: FormData) {
  const { household, role } = await requireContext();
  const incentivePct = role === "owner"
    ? Number(formData.get("incentivePct") || 10)
    : household.incentivePct;
  await db().update(t.households).set(({
    name: String(formData.get("name") || household.name),
    currency: String(formData.get("currency") || household.currency),
    monthlyBudget: Number(formData.get("monthlyBudget") || 0).toFixed(2),
    incentivePct
  } as any)).where(eq(t.households.id, household.id));
  revalidatePath("/settings", "layout"); revalidatePath("/");
}

export async function addAccount(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db().insert(t.accounts).values({ householdId: household.id, name, kind: String(formData.get("kind") || "bank") });
  revalidatePath("/settings", "layout");
}

export async function archiveAccount(formData: FormData) {
  const { household } = await requireContext();
  await db().update(t.accounts).set(({ isArchived: true } as any))
    .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.id, Number(formData.get("id")))));
  revalidatePath("/settings", "layout");
}

export async function addCategory(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db().insert(t.categories).values({
    householdId: household.id, name,
    passthroughDefault: formData.get("passthroughDefault") === "on"
  });
  revalidatePath("/settings", "layout");
}

/**
 * Renaming is always safe: transactions point at the id, so the history
 * follows the new name rather than splitting.
 */
export async function renameCategory(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  const id = Number(formData.get("id"));
  if (!name || !id) return;
  await db().update(t.categories)
    .set({ name, passthroughDefault: formData.get("passthroughDefault") === "on" })
    .where(and(eq(t.categories.householdId, household.id), eq(t.categories.id, id)));
  revalidatePath("/settings", "layout");
  revalidatePath("/ledger");
}

/**
 * Archiving hides a category from the pickers without touching the rows that
 * already use it — deleting one that has history would orphan those amounts.
 */
export async function setCategoryArchived(formData: FormData) {
  const { household } = await requireContext();
  const id = Number(formData.get("id"));
  if (!id) return;
  await db().update(t.categories)
    .set({ isArchived: formData.get("archived") === "1" })
    .where(and(eq(t.categories.householdId, household.id), eq(t.categories.id, id)));
  revalidatePath("/settings", "layout");
}

export async function renamePerson(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  const id = Number(formData.get("id"));
  if (!name || !id) return;
  await db().update(t.persons).set({ name })
    .where(and(eq(t.persons.householdId, household.id), eq(t.persons.id, id)));
  revalidatePath("/settings", "layout");
}

export async function renameAccount(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  const id = Number(formData.get("id"));
  if (!name || !id) return;
  await db().update(t.accounts).set({ name })
    .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.id, id)));
  revalidatePath("/settings", "layout");
}

/** Un-archive, so a hidden account can come back. */
export async function setAccountArchived(formData: FormData) {
  const { household } = await requireContext();
  const id = Number(formData.get("id"));
  if (!id) return;
  await db().update(t.accounts)
    .set(({ isArchived: formData.get("archived") === "1" } as any))
    .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.id, id)));
  revalidatePath("/settings", "layout");
}

export async function addPerson(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db().insert(t.persons).values({ householdId: household.id, name });
  revalidatePath("/settings", "layout");
}

/** Owner adds a member: existing user by email joins; unknown email gets an account with a starter password. */
export async function addMember(formData: FormData) {
  const { household, role } = await requireContext();
  if (role !== "owner") return;
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || email.split("@")[0]).trim();
  const password = String(formData.get("password") || "");
  if (!email) redirect("/settings/members?e=Email+required");
  let user = (await db().select().from(t.users).where(eq(t.users.email, email)).limit(1))[0];
  if (!user) {
    if (password.length < 8) redirect("/settings/members?e=New+member+needs+a+starter+password+(8%2B+chars)");
    [user] = await db().insert(t.users).values({ email, name, passwordHash: await bcrypt.hash(password, 10) }).returning();
  }
  await db().insert(t.memberships).values({ userId: user.id, householdId: household.id, role: "member" }).onConflictDoNothing();
  revalidatePath("/settings", "layout"); redirect("/settings/members");
}

export async function deleteRule(formData: FormData) {
  const { household } = await requireContext();
  await db().delete(t.importRules)
    .where(and(eq(t.importRules.householdId, household.id), eq(t.importRules.id, Number(formData.get("id")))));
  revalidatePath("/settings", "layout");
}
