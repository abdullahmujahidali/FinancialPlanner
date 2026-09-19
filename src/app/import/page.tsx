import Shell from "@/components/Shell";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, eq, ne } from "drizzle-orm";
import { importStatement } from "@/actions/importer";
import { pkr } from "@/lib/money";
import { ArrowRight, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

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
    <Shell wide title="Import statement">
      {searchParams.e && (
        <p className="mb-4 border-2 border-line bg-blush px-3 py-2.5 text-sm font-bold">{searchParams.e}</p>
      )}

      {batch && (
        <div className="mb-4 border-2 border-line bg-card">
          <div className="flex items-center gap-2 border-b-2 border-line bg-acid px-5 py-3">
            <CheckCircle2 size={16} strokeWidth={2.75} />
            <h2 className="eyebrow min-w-0 truncate">Imported {batch.filename}</h2>
          </div>
          <ul className="text-[14px]">
            <li className="rule-row px-5 py-3 font-semibold">
              <span className="num font-bold">{batch.importedCount}</span> new ·{" "}
              <span className="num font-bold">{batch.duplicateCount}</span> already in the ledger ·{" "}
              <span className="num font-bold">{batch.ignoredCount}</span> reversal rows netted out
            </li>
            {batch.openingBalance && (
              <li className="num rule-row px-5 py-3 font-semibold">
                Opening {pkr(Number(batch.openingBalance))} → closing {pkr(Number(batch.closingBalance))}
              </li>
            )}
            {batch.balanceOk === true && (
              <li className="rule-row flex items-center gap-2 px-5 py-3 font-bold">
                <CheckCircle2 size={15} strokeWidth={2.75} className="shrink-0" />
                Balance tie-out passed — every row accounted for.
              </li>
            )}
            {batch.balanceOk === false && (
              <li className="rule-row flex items-center gap-2 bg-blush px-5 py-3 font-bold">
                <AlertTriangle size={15} strokeWidth={2.75} className="shrink-0" />
                Balance tie-out failed — the file may be truncated. Re-export and try again.
              </li>
            )}
          </ul>
          <Link href="/review"
            className="flex items-center justify-between gap-3 px-5 py-3.5 text-[14px] font-bold transition-all hover:shadow-hard">
            <span>Go to review queue</span>
            <ArrowRight size={18} strokeWidth={2.75} />
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="block-card">
          <h2 className="eyebrow border-b-2 border-line px-5 py-3">Upload</h2>
          <form action={importStatement} className="space-y-4 p-4 lg:p-5">
            {accounts.length === 0 && (
              <p className="border-2 border-line bg-blush px-3 py-2.5 text-sm font-bold">
                Add a bank account in Settings first.
              </p>
            )}
            <label className="block">
              <span className="eyebrow text-muted">Bank account this statement belongs to</span>
              <select name="accountId" className="field mt-1.5">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow text-muted">Statement CSV (Meezan export format)</span>
              <input name="file" type="file" accept=".csv,text/csv" className="field mt-1.5 py-2.5" required />
            </label>
            <button className="btn w-full">
              <Upload size={16} strokeWidth={2.75} />
              Upload and import
            </button>
          </form>
        </section>

        <section className="block-card">
          <h2 className="eyebrow border-b-2 border-line bg-blush px-5 py-3">What happens on import</h2>
          <p className="p-4 text-[14px] font-medium leading-relaxed lg:p-5">
            Duplicates are skipped automatically, reversal pairs are netted, bank charges are filed under fees, ATM
            withdrawals become transfers into the cash wallet, and your saved rules categorise the rest. Anything
            unrecognised waits in the review queue — categorise it once, tick “remember”, and next month it&apos;s
            automatic.
          </p>
        </section>
      </div>
    </Shell>
  );
}
