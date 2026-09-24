import Shell from "@/components/Shell";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, desc, eq, gte, ilike, inArray, lt, SQL } from "drizzle-orm";
import { deleteTransaction } from "@/actions/ledger";
import { addComment, deleteComment, toggleReaction } from "@/actions/comments";
import CommentThread, { groupThreads } from "@/components/CommentThread";
import { pkr, monthKey, monthRange, monthLabel, monthLabelShort } from "@/lib/money";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus } from "lucide-react";
import ConfirmDelete from "@/components/ConfirmDelete";
import LedgerFilters from "@/components/LedgerFilters";
import ViewToggle from "@/components/ViewToggle";
import LedgerTable from "@/components/LedgerTable";
import SavedToast from "@/components/SavedToast";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

type Params = {
  m?: string;
  /** Amount just saved, so the ledger can confirm it landed. */
  saved?: string;
  q?: string;
  cat?: string;
  person?: string;
  acct?: string;
  type?: string;
  flag?: string;
  /** Layout density: the card list, or the compact table. */
  view?: string;
  /** Table sort column and direction; sorting happens in SQL. */
  sort?: string;
  dir?: string;
};

/** Only whole numbers are real ids; anything else is a stale or hand-typed URL. */
function idOf(v?: string) {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { user, household } = await requireContext();
  const m = sp.m || monthKey();
  const { from, next } = monthRange(m);

  const q = (sp.q || "").trim();
  const cat = idOf(sp.cat);
  const person = idOf(sp.person);
  const acct = idOf(sp.acct);
  const type = ["expense", "income", "transfer"].includes(sp.type || "") ? sp.type! : null;
  const flag = ["review", "passthrough", "abnormal"].includes(sp.flag || "") ? sp.flag! : null;
  const view: "list" | "table" = sp.view === "table" ? "table" : "list";

  /**
   * Sorting runs in Postgres rather than the browser so it covers every row
   * the filters matched, not just what happens to be rendered. Date descending
   * is the ledger's natural order and stays the default.
   */
  const SORTS = {
    date: t.transactions.txDate,
    description: t.transactions.description,
    amount: t.transactions.amount
  } as const;
  const sortKey = (Object.keys(SORTS) as Array<keyof typeof SORTS>).includes(
    sp.sort as keyof typeof SORTS
  )
    ? (sp.sort as keyof typeof SORTS)
    : "date";
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const orderFn = dir === "asc" ? asc : desc;

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
  const [rows, categories, persons, accounts, membersList] = await Promise.all([
    db().select({
      tx: t.transactions, category: t.categories.name, person: t.persons.name, account: t.accounts.name
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
      .leftJoin(t.persons, eq(t.transactions.personId, t.persons.id))
      .leftJoin(t.accounts, eq(t.transactions.accountId, t.accounts.id))
      .where(and(...conds))
      .orderBy(orderFn(SORTS[sortKey]), desc(t.transactions.id))
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

  /**
   * Comments for the rows actually on screen. Which rows those are is only known
   * after the query above, so this is a second round trip — but two queries for
   * the whole page, never one per row.
   */
  const ids = rows.map(({ tx }) => tx.id);
  const commentRows = ids.length
    ? await db().select({
        id: t.comments.id, body: t.comments.body, createdAt: t.comments.createdAt,
        userId: t.comments.userId, entityId: t.comments.entityId, authorName: t.users.name
      }).from(t.comments)
        .innerJoin(t.users, eq(t.users.id, t.comments.userId))
        .where(and(
          eq(t.comments.householdId, household.id),
          eq(t.comments.entityType, "transaction"),
          inArray(t.comments.entityId, ids)
        ))
    : [];

  // inArray([]) is invalid SQL on some drivers, so both lookups are guarded.
  const reactionRows = commentRows.length
    ? await db().select({
        commentId: t.commentReactions.commentId,
        userId: t.commentReactions.userId,
        emoji: t.commentReactions.emoji
      }).from(t.commentReactions)
        .where(inArray(t.commentReactions.commentId, commentRows.map((c) => c.id)))
    : [];

  const threads = groupThreads(commentRows, reactionRows, user.id);

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
    // The table earns the full width; the card list reads better narrow.
    <Shell wide={view === "table"} title="Ledger" action={
      <>
        {/* The month picker stays whole: it is one unit that must never be
            split or clipped, so it wraps as a block. */}
        <div className="flex items-center gap-1 rounded-full bg-card p-1">
          <Link href={`/ledger?m=${prev}`} aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition hover:bg-page">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="whitespace-nowrap px-1 text-[13px] font-bold">{monthLabelShort(m)}</span>
          <Link href={`/ledger?m=${nextM}`} aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition hover:bg-page">
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
        <ViewToggle view={view} />
        {/* The phone already has a + tab in the bottom bar, so this is the
            desktop affordance only and does not compete for narrow space. */}
        <Link href="/entry" className="btn btn-sm hidden gap-1.5 sm:inline-flex" aria-label="Add entry">
          <Plus size={15} strokeWidth={2.6} />
          <span>Add entry</span>
        </Link>
      </>
    }>
      {sp.saved && (
        <Suspense fallback={null}>
          <SavedToast label={`Saved ${pkr(Number(sp.saved))}`} />
        </Suspense>
      )}

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
          {view === "table" ? (
            <LedgerTable
              rows={rows}
              showYear={searching}
              sort={sortKey}
              dir={dir}
              query={sp}
            />
          ) : (
          rows.map(({ tx, category, person, account }, i) => {
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
                <div className={"flex items-start justify-between gap-3 px-5 py-4 sm:gap-4 sm:px-6 lg:px-8 "
                  + (i < rows.length - 1 && rows[i + 1].tx.txDate === tx.txDate ? "rule-row" : "")}>
                  <div className="min-w-0">
                    {/* Two lines rather than a hard truncate: a bank description
                        is the only handle a row has, and "Raast P2P Fund trans…"
                        identifies nothing. */}
                    <div className="line-clamp-2 text-[15px] font-semibold">{tx.description || category || (tx.type === "transfer" ? "Transfer" : tx.type === "income" ? "Income" : "Expense")}</div>
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
                  <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                    <span className={"num text-[15px] font-bold " + (tx.type === "income" ? "text-good" : "")}>
                      {tx.type === "income" ? "+" : ""}{pkr(Number(tx.amount))}
                    </span>
                    {/* Deleting is rare; reading the row is constant. On a phone
                        the bin hides behind ⋯ so its width goes to the
                        description; from sm: up it sits in the row as before.
                        Still reachable on a phone — there is no other delete. */}
                    <details className="group relative sm:hidden">
                      <summary
                        aria-label={`More actions for ${tx.description || category || (tx.type === "transfer" ? "Transfer" : tx.type === "income" ? "Income" : "Expense")}`}
                        className="flex h-8 w-7 cursor-pointer list-none items-center justify-center rounded-full text-muted transition group-open:bg-page"
                      >
                        <MoreHorizontal size={16} strokeWidth={2.4} />
                      </summary>
                      {/* Edit and delete are siblings here: a <form> (inside
                          ConfirmDelete) must never sit inside an <a>. */}
                      <div className="absolute right-0 z-10 mt-1 flex items-center rounded-full bg-card p-0.5 shadow-soft">
                        <Link
                          href={`/ledger/${tx.id}`}
                          aria-label={`Edit ${tx.description || category || (tx.type === "transfer" ? "Transfer" : tx.type === "income" ? "Income" : "Expense")}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
                        >
                          <Pencil size={15} strokeWidth={2.2} />
                        </Link>
                        <ConfirmDelete
                          id={tx.id}
                          label={tx.description || category || (tx.type === "transfer" ? "Transfer" : tx.type === "income" ? "Income" : "Expense")}
                          action={deleteTransaction}
                          noun="transaction"
                        />
                      </div>
                    </details>

                    <Link
                      href={`/ledger/${tx.id}`}
                      aria-label={`Edit ${tx.description || category || (tx.type === "transfer" ? "Transfer" : tx.type === "income" ? "Income" : "Expense")}`}
                      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink sm:flex"
                    >
                      <Pencil size={15} strokeWidth={2.2} />
                    </Link>

                    <span className="hidden sm:block">
                      <ConfirmDelete
                        id={tx.id}
                        label={tx.description || category || (tx.type === "transfer" ? "Transfer" : tx.type === "income" ? "Income" : "Expense")}
                        action={deleteTransaction}
                        noun="transaction"
                      />
                    </span>
                  </div>
                </div>

                {/* Compact: silent unless this row actually has notes, and then
                    one folded line — an open composer under all 56 rows is what
                    broke the list's rhythm. Only padded when it renders. */}
                {(threads.get(tx.id)?.length ?? 0) > 0 && (
                  <div className="px-5 pb-4 sm:px-6 lg:px-8">
                    <CommentThread
                      entityType="transaction"
                      entityId={tx.id}
                      comments={threads.get(tx.id) ?? []}
                      currentUserId={user.id}
                      members={membersList}
                      addAction={addComment}
                      deleteAction={deleteComment}
                      reactAction={toggleReaction}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      )}
    </Shell>
  );
}
