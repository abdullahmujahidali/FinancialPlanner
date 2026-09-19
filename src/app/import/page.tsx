import Shell from "@/components/Shell";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, eq, ne } from "drizzle-orm";
import { importStatement } from "@/actions/importer";
import { pkr } from "@/lib/money";
import { ArrowRight, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ e?: string; done?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const accounts = await db().select().from(t.accounts)
    .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false), ne(t.accounts.kind, "cash")));

  let batch = null as null | typeof t.importBatches.$inferSelect;
  if (sp.done) {
    const rows = await db().select().from(t.importBatches)
      .where(and(eq(t.importBatches.householdId, household.id), eq(t.importBatches.id, Number(sp.done)))).limit(1);
    batch = rows[0] ?? null;
  }

  return (
    <Shell wide title="Import statement">
      {sp.e && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">{sp.e}</p>
      )}

      {batch && (
        <div className="mb-5 overflow-hidden rounded-[22px] bg-card">
          <div className="flex items-center gap-2.5 bg-acid px-6 py-5 lg:px-8">
            <CheckCircle2 size={17} strokeWidth={2.75} className="shrink-0" />
            <h2 className="eyebrow min-w-0 truncate">Imported {batch.filename}</h2>
          </div>
          <ul className="px-6 text-[14px] lg:px-8">
            <li className="rule-row py-4 font-semibold">
              <span className="num font-bold">{batch.importedCount}</span> new ·{" "}
              <span className="num font-bold">{batch.duplicateCount}</span> already in the ledger ·{" "}
              <span className="num font-bold">{batch.ignoredCount}</span> reversal rows netted out
            </li>
            {batch.openingBalance && (
              <li className="num rule-row py-4 font-semibold">
                Opening {pkr(Number(batch.openingBalance))} → closing {pkr(Number(batch.closingBalance))}
              </li>
            )}
            {batch.balanceOk === true && (
              <li className="rule-row flex items-center gap-2.5 py-4 font-bold">
                <CheckCircle2 size={16} strokeWidth={2.75} className="shrink-0" />
                Balance tie-out passed — every row accounted for.
              </li>
            )}
            {batch.balanceOk === false && (
              <li className="my-3 flex items-center gap-2.5 rounded-[14px] bg-blush px-4 py-3 font-bold">
                <AlertTriangle size={16} strokeWidth={2.75} className="shrink-0" />
                Balance tie-out failed — the file may be truncated. Re-export and try again.
              </li>
            )}
          </ul>
          <Link href="/review"
            className="flex items-center justify-between gap-3 px-6 py-5 text-[14px] font-bold transition hover:bg-page lg:px-8">
            <span>Go to review queue</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-1/2 lg:shrink-0">
          <section className="zone-card">
            <h2 className="eyebrow">Upload</h2>
            <form action={importStatement} className="mt-6 space-y-5">
              {accounts.length === 0 && (
                <p className="rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">
                  Add a bank account in Settings first.
                </p>
              )}
              <label className="block">
                <span className="eyebrow text-muted">Bank account this statement belongs to</span>
                <select name="accountId" className="field mt-2">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="eyebrow text-muted">Statement CSV (Meezan export format)</span>
                <input name="file" type="file" accept=".csv,text/csv" className="field mt-2 py-2.5" required />
              </label>
              <button className="btn w-full">
                <Upload size={16} strokeWidth={2.75} />
                Upload and import
              </button>
            </form>
          </section>
        </div>

        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          <section className="zone-blush">
            <h2 className="eyebrow">What happens on import</h2>
            <p className="mt-5 text-[15px] font-medium leading-relaxed">
              Duplicates are skipped automatically, reversal pairs are netted, bank charges are filed under fees, ATM
              withdrawals become transfers into the cash wallet, and your saved rules categorise the rest. Anything
              unrecognised waits in the review queue — categorise it once, tick “remember”, and next month it&apos;s
              automatic.
            </p>
          </section>
        </div>
      </div>
    </Shell>
  );
}
