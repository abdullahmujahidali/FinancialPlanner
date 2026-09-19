import Shell from "@/components/Shell";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, eq, ne } from "drizzle-orm";
import { importStatement } from "@/actions/importer";
import { pkr } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: { e?: string; done?: string } }) {
  const { household } = await requireContext();
  const accounts = await db().select().from(t.accounts)
    .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false), ne(t.accounts.kind, "cash")));

  let batch = null as null | typeof t.importBatches.$inferSelect;
  if (searchParams.done) {
    const rows = await db().select().from(t.importBatches)
      .where(and(eq(t.importBatches.householdId, household.id), eq(t.importBatches.id, Number(searchParams.done)))).limit(1);
    batch = rows[0] ?? null;
  }

  return (
    <Shell title="Import statement">
      {searchParams.e && <p className="mb-4 rounded-xl bg-oversoft px-3 py-2 text-sm text-over">{searchParams.e}</p>}

      {batch && (
        <div className="mb-5 panel p-4 text-sm">
          <p className="mb-2 font-medium">Imported {batch.filename}</p>
          <ul className="space-y-1 text-muted">
            <li>{batch.importedCount} new · {batch.duplicateCount} already in the ledger · {batch.ignoredCount} reversal rows netted out</li>
            {batch.openingBalance && <li className="num">Opening {pkr(Number(batch.openingBalance))} → closing {pkr(Number(batch.closingBalance))}</li>}
            {batch.balanceOk === true && <li className="text-brand">Balance tie-out passed — every row accounted for.</li>}
            {batch.balanceOk === false && <li className="text-over">Balance tie-out failed — the file may be truncated. Re-export and try again.</li>}
          </ul>
          <Link href="/review" className="btn mt-3 w-full">Go to review queue</Link>
        </div>
      )}

      <form action={importStatement} className="space-y-4">
        {accounts.length === 0 && (
          <p className="rounded-xl bg-flagsoft px-3 py-2 text-sm text-flag">Add a bank account in Settings first.</p>
        )}
        <label className="block text-sm text-muted">Bank account this statement belongs to
          <select name="accountId" className="field mt-1">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block text-sm text-muted">Statement CSV (Meezan export format)
          <input name="file" type="file" accept=".csv,text/csv" className="field mt-1" required />
        </label>
        <button className="btn w-full">Upload and import</button>
      </form>

      <div className="mt-6 panel p-4 text-sm text-muted">
        <p className="mb-1 font-medium text-ink">What happens on import</p>
        <p>Duplicates are skipped automatically, reversal pairs are netted, bank charges are filed under fees, ATM withdrawals become transfers into the cash wallet, and your saved rules categorise the rest. Anything unrecognised waits in the review queue — categorise it once, tick “remember”, and next month it's automatic.</p>
      </div>
    </Shell>
  );
}
