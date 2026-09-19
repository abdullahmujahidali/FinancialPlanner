"use server";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";

/**
 * Delete one uploaded attachment.
 *
 * `attachments` carries its own `household_id`, so ownership is provable
 * without joining to the parent transaction or asset — the row is matched on
 * (household, id) together and never on id alone, so a guessed id from another
 * household simply matches nothing.
 *
 * The file also shows on whatever it hangs off, so the ledger and assets pages
 * are revalidated alongside /files.
 */
export async function deleteAttachment(formData: FormData) {
  const { household } = await requireContext();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db()
    .delete(t.attachments)
    .where(and(eq(t.attachments.householdId, household.id), eq(t.attachments.id, id)));

  revalidatePath("/files");
  revalidatePath("/assets");
  revalidatePath("/ledger");
}
