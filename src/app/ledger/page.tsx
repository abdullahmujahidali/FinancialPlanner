import Shell from "@/components/Shell";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, desc, eq, gte, ilike, lt, SQL } from "drizzle-orm";
import { deleteTransaction, askAboutTransaction, answerQuestion } from "@/actions/ledger";
import QuestionThread from "@/components/QuestionThread";
import { pkr, monthKey, monthRange, monthLabel, monthLabelShort } from "@/lib/money";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ConfirmDelete from "@/components/ConfirmDelete";
import LedgerFilters from "@/components/LedgerFilters";

export const dynamic = "force-dynamic";

type Params = {
  m?: string;
  q?: string;
  cat?: string;
  person?: string;
  acct?: string;
  type?: string;
  flag?: string;
};

/** Only whole numbers are real ids; anything else is a stale or hand-typed URL. */
function idOf(v?: string) {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const m = sp.m || monthKey();
  const { from, next } = monthRange(m);

  const q = (sp.q || "").trim();
  const cat = idOf(sp.cat);
  const person = idOf(sp.person);
  const acct = idOf(sp.acct);
  const type = ["expense", "income", "transfer"].includes(sp.type || "") ? sp.type! : null;
  const flag = ["review", "passthrough", "abnormal"].includes(sp.flag || "") ? sp.flag! : null;

  /**
   * A search is a question about the household, not about a month — restricting
   * "biryani" to September and showing nothing reads as "you never bought
   * biryani". So a non-empty q drops the month window and says so in the header.
   */
  const searching = q.length > 0;

  const conds: SQL[] = [eq(t.transactions.householdId, household.id)];
  if (!searching) {
    conds.push(gte(t.transactions.txDate, from), lt(t.transactions.txDate, next));
  } else {
    conds.push(ilike(t.transactions.description, `%${q}%`));
  }
  if (cat) conds.push(eq(t.transactions.categoryId, cat));
  if (person) conds.push(eq(t.transactions.personId, person));
  if (acct) conds.push(eq(t.transactions.accountId, acct));
  if (type) conds.push(eq(t.transactions.type, type));
  if (flag === "review") conds.push(eq(t.transactions.needsReview, true));
  if (flag === "passthrough") conds.push(eq(t.transactions.isPassthrough, true));
  if (flag === "abnormal") conds.push(eq(t.transactions.isAbnormal, true));

  const filtered = Boolean(q || cat || person || acct || type || flag);

  // One round trip for all four: the database is ~150ms away, so sequential
  // awaits here would cost half a second of blank page.
  const [rows, categories, persons, accounts, members] = await Promise.all([
    db().select({
      tx: t.transactions, category: t.categories.name, person: t.persons.name, account: t.accounts.name
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
      .leftJoin(t.persons, eq(t.transactions.personId, t.persons.id))
      .leftJoin(t.accounts, eq(t.transactions.accountId, t.accounts.id))
      .where(and(...conds))
      .orderBy(desc(t.transactions.txDate), desc(t.transactions.id))
      .limit(400),
    db().select({ id: t.categories.id, name: t.categories.name }).from(t.categories)
      .where(eq(t.categories.householdId, household.id)).orderBy(asc(t.categories.name)),
    db().select({ id: t.persons.id, name: t.persons.name }).from(t.persons)
      .where(eq(t.persons.householdId, household.id)).orderBy(asc(t.persons.name)),
    db().select({ id: t.accounts.id, name: t.accounts.name }).from(t.accounts)
      .where(eq(t.accounts.householdId, household.id)).orderBy(asc(t.accounts.name)),
    db().select({ id: t.users.id, name: t.users.name })
      .from(t.memberships)
      .innerJoin(t.users, eq(t.users.id, t.memberships.userId))
      .where(eq(t.memberships.householdId, household.id))
  ]);

  // Who asked/answered a question, for the thread under each row.
  const userName = new Map(members.map((mb) => [mb.id, mb.name]));

  // What the list actually costs the household: spend only, reimbursed bills out.
  const shownSpend = rows.reduce(
    (s, { tx }) => (tx.type === "expense" && !tx.isPassthrough ? s + Number(tx.amount) : s),
    0
  );

  const [y, mo] = m.split("-").map(Number);
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const nextM = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;

  const heading = searching ? "Search results — all months" : monthLabel(m);

  let lastDate = "";
  return (
    <Shell title="Ledger" action={
      <div className="flex shrink-0 items-center gap-1">
        <Link href={`/ledger?m=${prev}`} aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
          <ChevronLeft size={18} strokeWidth={2.5} />
        </Link>
        <span className="whitespace-nowrap px-2 text-[13px] font-bold">{monthLabelShort(m)}</span>
        <Link href={`/ledger?m=${nextM}`} aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
          <ChevronRight size={18} strokeWidth={2.5} />
        </Link>
      </div>
    }>
      <LedgerFilters categories={categories} persons={persons} accounts={accounts} month={m} />

      {rows.length === 0 ? (
        <section className="zone-card">
          <h2 className="eyebrow text-muted">{heading}</h2>
          {filtered ? (
            <>
              <p className="mt-3 text-[15px] font-semibold text-muted">
                No entries match those filters.
              </p>
              <Link href={`/ledger?m=${m}`} className="btn mt-6">Clear filters</Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-[15px] font-semibold text-muted">
                No entries this month yet. Add one from the + tab, or import a bank CSV.
              </p>
              <Link href="/import" className="btn mt-6">Import bank CSV</Link>
            </>
          )}
        </section>
      ) : (
        <div className="overflow-hidden rounded-[22px] bg-card">
          <div className="flex items-baseline justify-between gap-3 bg-acid px-6 py-5 lg:px-8">
            <h2 className="eyebrow">{heading}</h2>
            <span className="num text-[12px] font-bold">
              {rows.length} {rows.length === 1 ? "entry" : "entries"} · {pkr(shownSpend)} spent
            </span>
          </div>
          {rows.map(({ tx, category, person, account }, i) => {
            const showDate = tx.txDate !== lastDate;
            lastDate = tx.txDate;
            return (
              <div key={tx.id}>
                {showDate && (
                  <div className="eyebrow bg-page px-6 py-2.5 text-muted lg:px-8">
                    {new Date(tx.txDate).toLocaleDateString("en-PK",
                      searching
                        ? { day: "numeric", month: "short", year: "numeric" }
                        : { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                )}
                <div className={"flex items-start justify-between gap-4 px-6 py-4 lg:px-8 "
                  + (i < rows.length - 1 && rows[i + 1].tx.txDate === tx.txDate ? "rule-row" : "")}>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{tx.description || category || tx.type}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted">
                      <span>{account}</span>
                      {category && <span>· {category}</span>}
                      {person && <span>· {person}</span>}
                      {tx.isPassthrough && <span className="tag-acid">pass-through</span>}
                      {tx.isAbnormal && <span className="tag-blush">one-off</span>}
                      {tx.needsReview && <span className="tag-blush">review</span>}
                      {tx.type === "transfer" && <span className="tag-muted">transfer</span>}
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

                <QuestionThread
                  id={tx.id}
                  question={tx.reviewNote}
                  answer={tx.reviewAnswer}
                  askedBy={tx.reviewAskedBy ? userName.get(tx.reviewAskedBy) : null}
                  answeredBy={tx.reviewAnsweredBy ? userName.get(tx.reviewAnsweredBy) : null}
                  answeredAt={tx.reviewAnsweredAt}
                  ask={askAboutTransaction}
                  answerAction={answerQuestion}
                />
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
