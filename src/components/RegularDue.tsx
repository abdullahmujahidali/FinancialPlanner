import Link from "next/link";
import { db, t } from "@/db/client";
import { and, eq, or, isNull, lt } from "drizzle-orm";
import { postRecurring, skipRecurring } from "@/actions/recurring";
import SubmitButton from "@/components/SubmitButton";

import { Repeat } from "lucide-react";
import AmountInput from "@/components/AmountInput";

/**
 * This month's regular payments not yet added or skipped. Everything is
 * ticked; untick what wasn't paid, fix an amount that moved, add the lot.
 */
export default async function RegularDue({ householdId, month }: { householdId: number; month: string }) {
  const due = await db().select().from(t.recurring)
    .where(and(
      eq(t.recurring.householdId, householdId),
      eq(t.recurring.isArchived, false),
      or(isNull(t.recurring.lastMonth), lt(t.recurring.lastMonth, month))
    ))
    .orderBy(t.recurring.dayOfMonth);

  if (due.length === 0) return null;

  return (
    <section className="zone-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow flex items-center gap-2"><Repeat size={13} strokeWidth={2.6} /> Regular payments due</h2>
        <Link href="/settings/regular" className="text-[12px] font-bold text-muted underline-offset-4 hover:underline">Edit list</Link>
      </div>
      <form action={postRecurring} className="mt-3">
        <input type="hidden" name="month" value={month} />
        <ul>
          {due.map((r, i) => (
            <li key={r.id} className={"flex items-center gap-3 py-2.5 " + (i < due.length - 1 ? "rule-row" : "")}>
              <input type="checkbox" name="id" value={r.id} defaultChecked aria-label={`Add ${r.description}`}
                className="h-4 w-4 shrink-0 rounded accent-ink" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{r.description}</span>
                <span className="text-[12px] font-bold text-muted">day {r.dayOfMonth}</span>
              </span>
              <AmountInput name={`amount_${r.id}`} type="number" inputMode="numeric" defaultValue={Number(r.amount)}
                aria-label={`Amount for ${r.description}`} inputClassName="field num w-28 !py-2" hintPosition="none" className="shrink-0" />
              <button name="skip" value={r.id} formAction={skipRecurring} formNoValidate
                title="Not this month" className="shrink-0 text-[12px] font-bold text-muted hover:text-ink">
                Skip
              </button>
            </li>
          ))}
        </ul>
        <SubmitButton className="btn mt-4 w-full" pendingLabel="Adding…">
          Add ticked payments
        </SubmitButton>
      </form>
    </section>
  );
}
