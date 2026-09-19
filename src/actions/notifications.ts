"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db/client";
import { requireContext } from "@/lib/session";

/** Clear the bell for this household. */
export async function markAllRead() {
  const { household } = await requireContext();
  await db()
    .update(t.notifications)
    .set({ readAt: new Date() } as any)
    .where(and(eq(t.notifications.householdId, household.id), isNull(t.notifications.readAt)));
  revalidatePath("/", "layout");
}

/**
 * Record an event for the household's activity feed.
 *
 * Deliberately best-effort: a notification failing must never take down the
 * action that produced it (an import, a goal completing).
 */
export async function notify(opts: {
  householdId: number;
  kind: "import" | "review" | "budget" | "goal" | "asset";
  title: string;
  body?: string;
  href?: string;
}) {
  try {
    await db().insert(t.notifications).values({
      householdId: opts.householdId,
      kind: opts.kind,
      title: opts.title,
      body: opts.body ?? null,
      href: opts.href ?? null
    } as any);
  } catch {
    // swallow — the feed is not worth failing a real operation over
  }
}
