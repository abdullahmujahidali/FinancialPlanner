import Shell from "@/components/Shell";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { deleteTransaction } from "@/actions/ledger";
import { pkr, monthKey, monthRange, monthLabel, monthLabelShort } from "@/lib/money";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ConfirmDelete from "@/components/ConfirmDelete";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const m = sp.m || monthKey();
  const { from, next } = monthRange(m);

  const rows = await db().select({
    tx: t.transactions, category: t.categories.name, person: t.persons.name, account: t.accounts.name
  }).from(t.transactions)
    .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
    .leftJoin(t.persons, eq(t.transactions.personId, t.persons.id))
    .leftJoin(t.accounts, eq(t.transactions.accountId, t.accounts.id))
    .where(and(eq(t.transactions.householdId, household.id), gte(t.transactions.txDate, from), lt(t.transactions.txDate, next)))
    .orderBy(desc(t.transactions.txDate), desc(t.transactions.id))
    .limit(400);

  const [y, mo] = m.split("-").map(Number);
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const nextM = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;

  let lastDate = "";
  return (
    <Shell title="Ledger" action={
      <div className="flex shrink-0 items-center gap-1.5">
        <Link href={`/ledger?m=${prev}`} aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center border-2 border-line bg-card transition-all hover:shadow-hardsm">
          <ChevronLeft size={17} strokeWidth={2.75} />
        </Link>
        <span className="whitespace-nowrap px-1 text-[13px] font-bold">{monthLabelShort(m)}</span>
        <Link href={`/ledger?m=${nextM}`} aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center border-2 border-line bg-card transition-all hover:shadow-hardsm">
          <ChevronRight size={17} strokeWidth={2.75} />
        </Link>
      </div>
    }>
      {rows.length === 0 ? (
        <div className="block-card p-6">
          <h2 className="eyebrow">{monthLabel(m)}</h2>
          <p className="mt-2 text-[15px] font-semibold text-muted">
            No entries this month yet. Add one from the + tab, or import a bank CSV.
          </p>
          <Link href="/import" className="btn btn-sm mt-4">Import bank CSV</Link>
        </div>
      ) : (
        <div className="block-card">
          <div className="flex items-baseline justify-between border-b-2 border-line bg-acid px-4 py-3 lg:px-5">
            <h2 className="eyebrow">{monthLabel(m)}</h2>
            <span className="num text-[12px] font-bold">{rows.length} entries</span>
          </div>
          {rows.map(({ tx, category, person, account }, i) => {
            const showDate = tx.txDate !== lastDate;
            lastDate = tx.txDate;
            return (
              <div key={tx.id} className={i < rows.length - 1 ? "rule-row" : ""}>
                {showDate && (
                  <div className="eyebrow border-b-2 border-line bg-paper px-4 py-2 text-muted lg:px-5">
                    {new Date(tx.txDate).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 px-4 py-3 lg:px-5">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{tx.description || category || tx.type}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-muted">
                      <span>{account}</span>
                      {category && <span>· {category}</span>}
                      {person && <span>· {person}</span>}
                      {tx.isPassthrough && <span className="tag bg-acid text-ink">pass-through</span>}
                      {tx.isAbnormal && <span className="tag bg-blush text-ink">one-off</span>}
                      {tx.needsReview && <span className="tag bg-blush text-ink">review</span>}
                      {tx.type === "transfer" && <span className="tag bg-paper text-ink">transfer</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={"num text-[15px] font-bold " + (tx.type === "income" ? "text-good" : "")}>
                      {tx.type === "income" ? "+" : ""}{pkr(Number(tx.amount))}
                    </span>
                    <ConfirmDelete
                      id={tx.id}
                      label={tx.description || category || tx.type}
                      action={deleteTransaction}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
