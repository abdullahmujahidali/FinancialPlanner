import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { deleteTransaction, quickAddCategory, quickAddPerson, updateTransaction } from "@/actions/ledger";
import SearchableSelect from "@/components/SearchableSelect";
import FlagToggles from "@/components/FlagToggles";
import SubmitButton from "@/components/SubmitButton";
import ConfirmDelete from "@/components/ConfirmDelete";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const txId = Number(id);
  if (!Number.isInteger(txId) || txId <= 0) notFound();

  const { household } = await requireContext();

  // One round trip for all four — the database is ~150ms away.
  const [[tx], accounts, categories, persons] = await Promise.all([
    db().select().from(t.transactions)
      .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.id, txId)))
      .limit(1),
    db().select().from(t.accounts)
      .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false)))
      .orderBy(asc(t.accounts.id)),
    db().select().from(t.categories)
      .where(eq(t.categories.householdId, household.id)).orderBy(asc(t.categories.name)),
    db().select().from(t.persons)
      .where(eq(t.persons.householdId, household.id)).orderBy(asc(t.persons.id))
  ]);

  // Missing, or another household's — either way it is not theirs to see.
  if (!tx) notFound();

  const label =
    tx.description || (tx.type === "transfer" ? "Transfer" : tx.type === "income" ? "Income" : "Expense");

  return (
    <Shell
      title="Edit entry"
      titleSlot={
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/ledger"
            aria-label="Back to ledger"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page"
          >
            <ChevronLeft size={19} strokeWidth={2.4} />
          </Link>
          <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-[-0.03em] lg:text-[34px]">
            Edit entry
          </h1>
        </div>
      }
    >
      {sp.e && (
        <p className="mb-5 rounded-[18px] bg-blush px-6 py-4 text-[14px] font-bold">{sp.e}</p>
      )}

      <form action={updateTransaction} className="space-y-5">
        <input type="hidden" name="id" value={tx.id} />

        {/* type switch — rounded segmented pills */}
        <div className="grid grid-cols-3 gap-1.5 rounded-full bg-card p-1.5">
          {[["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]].map(([v, label]) => (
            <label key={v}>
              <input type="radio" name="type" value={v} defaultChecked={tx.type === v} className="peer sr-only" />
              <span className="block cursor-pointer rounded-full py-2.5 text-center text-[14px] font-bold transition peer-checked:bg-ink peer-checked:text-acid">
                {label}
              </span>
            </label>
          ))}
        </div>

        {/* the amount — the one thing this screen is for */}
        <div className="zone-acid">
          <label htmlFor="amount" className="eyebrow">Amount (PKR)</label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="numeric"
            step="0.01"
            min="1"
            placeholder="0"
            required
            defaultValue={Number(tx.amount)}
            className="money-xl mt-3 w-full border-0 bg-transparent p-0 text-[56px] outline-none placeholder:text-ink/25 lg:text-[72px]"
          />
        </div>

        <div className="grid gap-5 rounded-[22px] bg-card p-6 lg:grid-cols-2 lg:p-8">
          <SearchableSelect
            name="accountId"
            label="From / account"
            options={accounts.map((a) => ({ id: a.id, name: a.name }))}
            defaultValue={tx.accountId}
            placeholder="Search accounts…"
          />

          <label className="block">
            <span className="eyebrow text-muted">Date</span>
            <input name="txDate" type="date" defaultValue={tx.txDate} className="field mt-2" />
          </label>

          <SearchableSelect
            name="counterAccountId"
            label="To (transfers only)"
            options={accounts.map((a) => ({ id: a.id, name: a.name }))}
            defaultValue={tx.counterAccountId}
            emptyLabel="—"
            placeholder="Search accounts…"
          />

          <SearchableSelect
            name="categoryId"
            label="Category"
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
            defaultValue={tx.categoryId}
            emptyLabel="—"
            placeholder="Search or type a new one…"
            allowCreate={{ action: quickAddCategory, label: "Create" }}
          />

          <div className="lg:col-span-2">
            <SearchableSelect
              name="personId"
              label="Person"
              hint={<span className="font-semibold normal-case tracking-normal text-muted"> — default is the whole household</span>}
              options={persons.map((p) => ({ id: p.id, name: p.name }))}
              defaultValue={tx.personId}
              emptyLabel="Household"
              placeholder="Search or type a new one…"
              allowCreate={{ action: quickAddPerson, label: "Create" }}
            />
          </div>

          <label className="block lg:col-span-2">
            <span className="eyebrow text-muted">Note</span>
            <input name="description" defaultValue={tx.description ?? ""} placeholder="Optional" className="field mt-2" />
          </label>
        </div>

        <FlagToggles
          defaults={{
            isAbnormal: tx.isAbnormal,
            isPassthrough: tx.isPassthrough,
            needsReview: tx.needsReview
          }}
        />

        <label className="block rounded-[22px] bg-card p-6 lg:p-8">
          <span className="eyebrow text-muted">Receipt / photo <span className="font-semibold normal-case tracking-normal">— up to 2 MB, adds to any already attached</span></span>
          <input name="receipt" type="file" accept="image/*,.pdf" className="field mt-3 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:text-[13px] file:font-bold file:text-acid" />
        </label>

        <SubmitButton className="btn flex w-full items-center justify-center gap-2 py-4 text-[16px]" pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </form>

      {/* Quiet danger zone: deleting is a different decision from editing, so it
          sits apart from the form rather than beside Save. The delete form is a
          SIBLING of the form above — never nested inside it. */}
      <section className="mt-8 rounded-[22px] bg-card p-6 lg:p-8">
        <h2 className="eyebrow text-muted">Danger zone</h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-[14px] text-muted">
            Delete this entry permanently, along with its receipts. It cannot be undone.
          </p>
          <ConfirmDelete id={tx.id} label={label} action={deleteTransaction} noun="transaction" />
        </div>
      </section>
    </Shell>
  );
}
