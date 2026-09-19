"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
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
 * Ids arrive from form posts, so they are strings of unknown provenance. A
 * non-numeric one must not widen the where clause to "every row".
 */
function idOf(fd: FormData) {
  const n = Number(fd.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Mark one notification read. */
export async function markRead(formData: FormData) {
  const { household } = await requireContext();
  const id = idOf(formData);
  if (!id) return;
  await db()
    .update(t.notifications)
    .set({ readAt: new Date() } as any)
    .where(and(eq(t.notifications.householdId, household.id), eq(t.notifications.id, id)));
  revalidatePath("/", "layout");
}

/** Put one notification back in the unread pile. */
export async function markUnread(formData: FormData) {
  const { household } = await requireContext();
  const id = idOf(formData);
  if (!id) return;
  await db()
    .update(t.notifications)
    .set({ readAt: null } as any)
    .where(and(eq(t.notifications.householdId, household.id), eq(t.notifications.id, id)));
  revalidatePath("/", "layout");
}

/** Remove one notification from the feed for good. */
export async function dismiss(formData: FormData) {
  const { household } = await requireContext();
  const id = idOf(formData);
  if (!id) return;
  await db()
    .delete(t.notifications)
    .where(and(eq(t.notifications.householdId, household.id), eq(t.notifications.id, id)));
  revalidatePath("/", "layout");
}

/**
 * Empty the read pile. Unread rows survive deliberately — "clear" should never
 * throw away something nobody has looked at yet.
 */
export async function clearAll() {
  const { household } = await requireContext();
  await db()
    .delete(t.notifications)
    .where(and(eq(t.notifications.householdId, household.id), isNotNull(t.notifications.readAt)));
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
