"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";

export async function updateHousehold(formData: FormData) {
  const { household, role } = await requireContext();
  if (role !== "owner") return;
  await db().update(t.households).set(({
    name: String(formData.get("name") || household.name),
    monthlyBudget: Number(formData.get("monthlyBudget") || 0).toFixed(2),
    incentivePct: Number(formData.get("incentivePct") || 10)
  } as any)).where(eq(t.households.id, household.id));
  revalidatePath("/settings"); revalidatePath("/");
}

export async function addAccount(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db().insert(t.accounts).values({ householdId: household.id, name, kind: String(formData.get("kind") || "bank") });
  revalidatePath("/settings");
}

export async function archiveAccount(formData: FormData) {
  const { household } = await requireContext();
  await db().update(t.accounts).set(({ isArchived: true } as any))
    .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.id, Number(formData.get("id")))));
  revalidatePath("/settings");
}

export async function addCategory(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db().insert(t.categories).values({
    householdId: household.id, name,
    passthroughDefault: formData.get("passthroughDefault") === "on"
  });
  revalidatePath("/settings");
}

export async function addPerson(formData: FormData) {
  const { household } = await requireContext();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db().insert(t.persons).values({ householdId: household.id, name });
  revalidatePath("/settings");
}

/** Owner adds a member: existing user by email joins; unknown email gets an account with a starter password. */
export async function addMember(formData: FormData) {
  const { household, role } = await requireContext();
  if (role !== "owner") return;
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || email.split("@")[0]).trim();
  const password = String(formData.get("password") || "");
  if (!email) redirect("/settings?e=Email+required");
  let user = (await db().select().from(t.users).where(eq(t.users.email, email)).limit(1))[0];
  if (!user) {
    if (password.length < 8) redirect("/settings?e=New+member+needs+a+starter+password+(8%2B+chars)");
    [user] = await db().insert(t.users).values({ email, name, passwordHash: await bcrypt.hash(password, 10) }).returning();
  }
  await db().insert(t.memberships).values({ userId: user.id, householdId: household.id, role: "member" }).onConflictDoNothing();
  revalidatePath("/settings"); redirect("/settings");
}

export async function deleteRule(formData: FormData) {
  const { household } = await requireContext();
  await db().delete(t.importRules)
    .where(and(eq(t.importRules.householdId, household.id), eq(t.importRules.id, Number(formData.get("id")))));
  revalidatePath("/settings");
}
