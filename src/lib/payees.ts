import { db, t } from "@/db/client";
import { eq } from "drizzle-orm";
import { prettyDescription } from "@/lib/describe";

/**
 * Returns a function that names an entry: the household's own payee name if
 * one was given for this exact description, otherwise the cleaned-up bank
 * text. One small query per page.
 */
export async function getNamer(householdId: number) {
  const rows = await db().select({ match: t.payees.match, name: t.payees.name })
    .from(t.payees).where(eq(t.payees.householdId, householdId));
  const names = new Map(rows.map((r) => [r.match, r.name]));
  return (description: string | null | undefined, fallback = "") =>
    (description && names.get(description)) || prettyDescription(description || "") || fallback;
}
