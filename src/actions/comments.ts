"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db/client";
import { requireContext } from "@/lib/session";
import { notify } from "@/actions/notifications";

/** The three things a comment can hang off. Anything else is a bad form post. */
const ENTITY_TYPES = ["transaction", "asset", "goal"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Ids arrive from form posts as strings of unknown provenance. `Number("x")` is
 * NaN, and NaN in a where clause is not a filter — it is a silent mistake. Every
 * id is squeezed through here before it can reach SQL.
 */
function posInt(v: FormDataEntryValue | null) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function entityTypeOf(v: FormDataEntryValue | null): EntityType | null {
  const s = String(v ?? "");
  return (ENTITY_TYPES as readonly string[]).includes(s) ? (s as EntityType) : null;
}

/** Where a notification about this entity should drop you. */
function hrefFor(entityType: EntityType, entityId: number) {
  if (entityType === "asset") return `/assets?focus=${entityId}`;
  if (entityType === "goal") return `/goals?focus=${entityId}`;
  return `/review?focus=${entityId}`;
}

function revalidateAll() {
  revalidatePath("/review");
  revalidatePath("/ledger");
  revalidatePath("/assets");
  revalidatePath("/", "layout");
}

/**
 * Post a comment on a transaction, asset or goal.
 *
 * Anyone named with `@Name` gets a notification addressed to them; otherwise the
 * household just sees that a comment landed.
 */
export async function addComment(formData: FormData) {
  const { user, household } = await requireContext();

  const entityType = entityTypeOf(formData.get("entityType"));
  const entityId = posInt(formData.get("entityId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!entityType || !entityId || !body) return;

  await db().insert(t.comments).values({
    householdId: household.id,
    entityType,
    entityId,
    userId: user.id,
    body
  } as any);

  // Who is in this household, so "@Tooba" can be resolved to a real person.
  const members = await db()
    .select({ id: t.users.id, name: t.users.name })
    .from(t.memberships)
    .innerJoin(t.users, eq(t.users.id, t.memberships.userId))
    .where(eq(t.memberships.householdId, household.id));

  const mentioned = members.filter(
    (m) => m.id !== user.id && new RegExp(`@${escapeRegex(m.name.split(" ")[0])}\\b`, "i").test(body)
  );

  const preview = body.length > 60 ? `${body.slice(0, 60)}…` : body;
  const href = hrefFor(entityType, entityId);

  if (mentioned.length > 0) {
    // One row per mention — the feed is household-wide, but the title names them.
    for (const m of mentioned) {
      await notify({
        householdId: household.id,
        kind: "review",
        title: `${user.name} mentioned you`,
        body: preview,
        href
      });
    }
  } else {
    await notify({
      householdId: household.id,
      kind: "review",
      title: `${user.name} commented`,
      body: preview,
      href
    });
  }

  revalidateAll();
}

/** Escape a member name before it becomes part of a mention pattern. */
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove your own comment. Someone else's is not yours to delete. */
export async function deleteComment(formData: FormData) {
  const { user, household } = await requireContext();
  const id = posInt(formData.get("id"));
  if (!id) return;

  // Reactions first: the FK cascades in Postgres, but being explicit keeps this
  // correct if the constraint ever changes.
  const [row] = await db()
    .select({ id: t.comments.id, userId: t.comments.userId })
    .from(t.comments)
    .where(and(eq(t.comments.householdId, household.id), eq(t.comments.id, id)))
    .limit(1);
  if (!row || row.userId !== user.id) return;

  await db().delete(t.commentReactions).where(eq(t.commentReactions.commentId, id));
  await db()
    .delete(t.comments)
    .where(and(eq(t.comments.householdId, household.id), eq(t.comments.id, id)));

  revalidateAll();
}

/** Add your reaction, or take it back if it is already there. */
export async function toggleReaction(formData: FormData) {
  const { user, household } = await requireContext();
  const commentId = posInt(formData.get("commentId"));
  const emoji = String(formData.get("emoji") ?? "").trim();
  if (!commentId || !emoji) return;

  // The comment must belong to this household before we write anything keyed to it.
  const [parent] = await db()
    .select({ id: t.comments.id })
    .from(t.comments)
    .where(and(eq(t.comments.householdId, household.id), eq(t.comments.id, commentId)))
    .limit(1);
  if (!parent) return;

  const [existing] = await db()
    .select({ id: t.commentReactions.id })
    .from(t.commentReactions)
    .where(
      and(
        eq(t.commentReactions.commentId, commentId),
        eq(t.commentReactions.userId, user.id),
        eq(t.commentReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing) {
    await db().delete(t.commentReactions).where(eq(t.commentReactions.id, existing.id));
  } else {
    await db().insert(t.commentReactions).values({
      commentId,
      userId: user.id,
      emoji
    } as any);
  }

  revalidateAll();
}
