import Shell from "@/components/Shell";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { deleteTransaction } from "@/actions/ledger";
import { pkr, monthKey, monthRange, monthLabel } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }: { searchParams: { m?: string } }) {
  const { household } = await requireContext();
  const m = searchParams.m || monthKey();
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
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/ledger?m=${prev}`} className="btn-quiet px-2">‹</Link>
        <span className="text-muted">{monthLabel(m)}</span>
        <Link href={`/ledger?m=${nextM}`} className="btn-quiet px-2">›</Link>
      </div>
    }>
      {rows.length === 0 && <p className="text-muted">No entries this month yet. Add one from the + tab, or import a bank CSV.</p>}
      <div className="rounded-lg border border-line bg-card">
        {rows.map(({ tx, category, person, account }, i) => {
          const showDate = tx.txDate !== lastDate;
          lastDate = tx.txDate;
          return (
            <div key={tx.id} className={i < rows.length - 1 ? "rule-row" : ""}>
              {showDate && <div className="bg-paper px-4 py-1 text-xs text-muted">{new Date(tx.txDate).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}</div>}
              <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[15px]">{tx.description || category || tx.type}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{account}</span>
                    {category && <span>· {category}</span>}
                    {person && <span>· {person}</span>}
                    {tx.isPassthrough && <span className="tag bg-brandsoft text-brand">pass-through</span>}
                    {tx.isAbnormal && <span className="tag bg-flagsoft text-flag">one-off</span>}
                    {tx.needsReview && <span className="tag bg-flagsoft text-flag">review</span>}
                    {tx.type === "transfer" && <span className="tag bg-paper text-muted">transfer</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={"num text-[15px] font-medium " + (tx.type === "income" ? "text-brand" : "")}>
                    {tx.type === "income" ? "+" : ""}{pkr(Number(tx.amount))}
                  </span>
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={tx.id} />
                    <button className="text-xs text-muted underline">delete</button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
