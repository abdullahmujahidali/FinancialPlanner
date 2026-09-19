"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { eq } from "drizzle-orm";
import { createSession, clearSession } from "@/lib/session";

const DEFAULT_CATEGORIES: Array<[string, boolean]> = [
  ["General", false], ["Groceries & food", false], ["Utilities", true],
  ["Education", false], ["Health", false], ["Transport", false],
  ["Family support", false], ["Vacations", false], ["Emergency fund", false],
  ["Fees & charges", false]
];

export async function signup(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const householdName = String(formData.get("household") || "").trim() || `${name}'s household`;
  if (!name || !email || password.length < 8) redirect("/login?e=Fill+all+fields+(password+8%2B+chars)");

  const existing = await db().select().from(t.users).where(eq(t.users.email, email)).limit(1);
  if (existing.length) redirect("/login?e=Email+already+registered");

  const [user] = await db().insert(t.users).values({ name, email, passwordHash: await bcrypt.hash(password, 10) }).returning();
  const [household] = await db().insert(t.households).values({ name: householdName }).returning();
  await db().insert(t.memberships).values({ userId: user.id, householdId: household.id, role: "owner" });
  await db().insert(t.categories).values(DEFAULT_CATEGORIES.map(([n, p]) => ({ householdId: household.id, name: n, passthroughDefault: p })));
  await db().insert(t.accounts).values({ householdId: household.id, name: "Cash wallet", kind: "cash" });
  await createSession(user.id);
  redirect("/");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const rows = await db().select().from(t.users).where(eq(t.users.email, email)).limit(1);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].passwordHash))) {
    redirect("/login?e=Wrong+email+or+password");
  }
  await createSession(rows[0].id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
