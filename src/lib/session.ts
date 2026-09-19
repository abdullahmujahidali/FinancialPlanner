import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, t } from "@/db/client";
import { eq } from "drizzle-orm";

const COOKIE = "hb_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me");

export async function createSession(userId: number) {
  const jwt = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("90d")
    .sign(secret());
  cookies().set(COOKIE, jwt, {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90, path: "/"
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function currentUserId(): Promise<number | null> {
  const c = cookies().get(COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    return payload.uid as number;
  } catch {
    return null;
  }
}

/** User + their household (first membership). Redirects to /login when signed out. */
export async function requireContext() {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const rows = await db()
    .select({ user: t.users, membership: t.memberships, household: t.households })
    .from(t.users)
    .innerJoin(t.memberships, eq(t.memberships.userId, t.users.id))
    .innerJoin(t.households, eq(t.households.id, t.memberships.householdId))
    .where(eq(t.users.id, uid!))
    .limit(1);
  if (!rows.length) redirect("/login");
  return { user: rows[0].user, household: rows[0].household, role: rows[0].membership.role };
}
