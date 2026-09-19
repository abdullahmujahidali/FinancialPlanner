import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import CategoryDot from "@/components/CategoryDot";
import EmptyState from "@/components/EmptyState";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { pkr, monthKey, monthRange, monthLabel, monthLabelShort } from "@/lib/money";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Everything tagged to one person.
 *
 * `person_id` was only ever an input — you could tag a transaction but never
 * ask "what did this month cost for Miral?". This is the read side of that tag.
 */
export default async function PersonPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const personId = Number(id);
  if (!Number.isInteger(personId) || personId <= 0) notFound();

  const { household } = await requireContext();
  const m = sp.m || monthKey();
  const { from, next } = monthRange(m);

  const H = eq(t.transactions.householdId, household.id);
  const mine = and(H, eq(t.transactions.personId, personId));
  const inMonth = and(mine, gte(t.transactions.txDate, from), lt(t.transactions.txDate, next));
  const isSpend = and(eq(t.transactions.type, "expense"), eq(t.transactions.isPassthrough, false));

  const [[person], [monthRow], [allTimeRow], byCategory, rows] = await Promise.all([
    db().select().from(t.persons)
      .where(and(eq(t.persons.householdId, household.id), eq(t.persons.id, personId))).limit(1),

    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions).where(and(inMonth, isSpend)),

    db().select({ v: sql<string>`coalesce(sum(${t.transactions.amount}),0)` })
      .from(t.transactions).where(and(mine, isSpend)),

    db().select({ name: t.categories.name, total: sql<string>`sum(${t.transactions.amount})` })
      .from(t.transactions)
      .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
      .where(and(inMonth, isSpend))
      .groupBy(t.categories.name)
      .orderBy(desc(sql`sum(${t.transactions.amount})`)).limit(8),

    db().select({
      tx: t.transactions, category: t.categories.name, account: t.accounts.name
    }).from(t.transactions)
      .leftJoin(t.categories, eq(t.transactions.categoryId, t.categories.id))
      .leftJoin(t.accounts, eq(t.transactions.accountId, t.accounts.id))
      .where(inMonth)
      .orderBy(desc(t.transactions.txDate), desc(t.transactions.id))
      .limit(200)
  ]);

  if (!person) notFound();

  const monthSpend = Number(monthRow.v);
  const allTime = Number(allTimeRow.v);

  const [y, mo] = m.split("-").map(Number);
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const nextM = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;

  return (
    <Shell
      wide
      title={person.name}
      titleSlot={
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/settings/people"
            aria-label="Back to people"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page"
          >
            <ChevronLeft size={19} strokeWidth={2.4} />
          </Link>
          <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-[-0.03em] lg:text-[34px]">
            {person.name}
          </h1>
        </div>
      }
      action={
        <div className="flex shrink-0 items-center gap-1">
          <Link href={`/people/${personId}?m=${prev}`} aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="whitespace-nowrap px-2 text-[13px] font-bold">{monthLabelShort(m)}</span>
          <Link href={`/people/${personId}?m=${nextM}`} aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page">
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-[56%] lg:shrink-0">
          <section className="zone-acid">
            <span className="eyebrow">Tagged to {person.name} · {monthLabel(m)}</span>
            <div className="money-xl mt-4 text-[48px] lg:text-[64px]">{pkr(monthSpend)}</div>
            <p className="mt-3 text-[13px] font-bold">
              {pkr(allTime, { compact: true })} all time
            </p>
          </section>

          {rows.length === 0 ? (
            <EmptyState
              Icon={Users}
              title="Nothing tagged this month"
              body={`No transaction this month is tagged to ${person.name}. Tag one from the ledger or when adding an entry.`}
            />
          ) : (
            <div className="overflow-hidden rounded-[22px] bg-card">
              <div className="flex items-baseline justify-between bg-acid px-6 py-4">
                <h2 className="eyebrow">Entries</h2>
                <span className="num text-[12px] font-bold">{rows.length}</span>
              </div>
              {rows.map(({ tx, category, account }, i) => (
                <div
                  key={tx.id}
                  className={"flex items-start justify-between gap-3 px-6 py-4 " + (i < rows.length - 1 ? "rule-row" : "")}
                >
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-[15px] font-semibold" title={tx.description || ""}>
                      {tx.description || category || tx.type}
                    </div>
                    <div className="mt-1 text-[12px] font-semibold text-muted">
                      <span className="num">{tx.txDate}</span>
                      {account ? ` · ${account}` : ""}
                      {category ? ` · ${category}` : ""}
                    </div>
                  </div>
                  <span className={"money shrink-0 text-[15px] font-bold " + (tx.type === "income" ? "text-good" : "")}>
                    {tx.type === "income" ? "+" : ""}{pkr(Number(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          {byCategory.length > 0 && (
            <section className="overflow-hidden rounded-[22px] bg-card">
              <h2 className="eyebrow px-6 pb-2 pt-6">Where it went</h2>
              <ul className="px-6 pb-2">
                {byCategory.map((c, i) => (
                  <li
                    key={i}
                    className={"flex items-center justify-between gap-3 py-3.5 text-[15px] " + (i < byCategory.length - 1 ? "rule-row" : "")}
                  >
                    <span className="flex min-w-0 items-center gap-3 font-semibold">
                      <CategoryDot name={c.name ?? "Uncategorised"} index={i} />
                      <span className="truncate">{c.name ?? "Uncategorised"}</span>
                    </span>
                    <span className="num shrink-0 font-bold">{pkr(Number(c.total))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Shell>
  );
}
