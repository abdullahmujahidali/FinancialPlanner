import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { addLoan, addLoanPayment, deleteLoan } from "@/actions/loans";
import { getLoans, type LoanRow } from "@/lib/loans";
import { fmtDate, pkr, todayStr } from "@/lib/money";
import { Plus, HandCoins, Check } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import ConfirmDelete from "@/components/ConfirmDelete";
import SubmitButton from "@/components/SubmitButton";
import ErrorToast from "@/components/ErrorToast";
import AmountInput from "@/components/AmountInput";

export const dynamic = "force-dynamic";

/**
 * Loans — informal debts between people, in both directions.
 *
 * Deliberately two lists rather than one: "what I owe" and "what I am owed"
 * are different questions asked at different moments, and merging them into a
 * signed column makes both harder to read.
 */
export default async function LoansPage({
  searchParams
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const sp = await searchParams;
  const { household } = await requireContext();

  const [{ loans, weOwe, owedToUs, net, overdue }, accounts] = await Promise.all([
    getLoans(household.id),
    db()
      .select()
      .from(t.accounts)
      .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false)))
      .orderBy(asc(t.accounts.name))
  ]);

  // Only this household's loans: loan_payments is tenanted through them.
  const [payments, assets] = await Promise.all([
    loans.length
      ? db().select().from(t.loanPayments).where(inArray(t.loanPayments.loanId, loans.map((l) => l.id)))
      : Promise.resolve([]),
    db().select({ id: t.assets.id, name: t.assets.name }).from(t.assets)
      .where(eq(t.assets.householdId, household.id))
  ]);
  const paymentsByLoan = new Map<number, typeof payments>();
  for (const p of payments) {
    paymentsByLoan.set(p.loanId, [...(paymentsByLoan.get(p.loanId) ?? []), p]);
  }
  const assetNames = new Map(assets.map((a) => [a.id, a.name]));

  const weOweList = loans.filter((l) => l.direction === "owed_by_us");
  const owedList = loans.filter((l) => l.direction === "owed_to_us");

  return (
    <Shell back={{ href: "/", label: "Home" }} wide title="Loans">
      <ErrorToast message={sp.e} />

      {/* ── The two totals ───────────────────────────────────────────────── */}
      <section className="zone-ink mb-5">
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          <div>
            <span className="eyebrow text-white/45">You owe</span>
            <p className="num mt-2 whitespace-nowrap text-[18px] font-extrabold text-white sm:text-[26px] lg:text-[32px]">
              {pkr(weOwe, { compact: true })}
            </p>
          </div>
          <div>
            <span className="eyebrow text-white/45">Owed to you</span>
            <p className="num mt-2 whitespace-nowrap text-[18px] font-extrabold text-white sm:text-[26px] lg:text-[32px]">
              {pkr(owedToUs, { compact: true })}
            </p>
          </div>
          <div>
            <span className="eyebrow text-white/45">Net effect</span>
            <p
              className={
                "num mt-2 whitespace-nowrap text-[18px] font-extrabold sm:text-[26px] lg:text-[32px] " +
                (net < 0 ? "text-blush" : "text-acid")
              }
            >
              {net < 0 ? "−" : "+"}
              {pkr(Math.abs(net), { compact: true })}
            </p>
          </div>
        </div>
        <p className="mt-5 text-[13px] font-semibold leading-relaxed text-white/45">
          This net figure is already counted in net worth on the dashboard and the Assets
          page. Only what is still outstanding counts — settled loans drop out.
        </p>
      </section>

      {overdue.length > 0 && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-[13px] font-bold leading-snug text-ink">
          {overdue.length === 1
            ? `${overdue[0].counterparty} — ${pkr(overdue[0].outstanding)} was due ${overdue[0].dueOn}.`
            : `${overdue.length} loans are past their due date.`}
        </p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {loans.length === 0 && (
            <EmptyState
              Icon={HandCoins}
              title="No loans recorded"
              body="Money you owe someone, or that someone owes you. Add the first one with the form — it stays out of your spending and only moves net worth."
            />
          )}

          {weOweList.length > 0 && (
            <LoanGroup
              title="You owe"
              loans={weOweList}
              accounts={accounts}
              paymentsByLoan={paymentsByLoan}
              assetNames={assetNames}
            />
          )}

          {owedList.length > 0 && (
            <LoanGroup
              title="Owed to you"
              loans={owedList}
              accounts={accounts}
              paymentsByLoan={paymentsByLoan}
              assetNames={assetNames}
            />
          )}
        </div>

        {/* ── New loan ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:w-[380px] lg:shrink-0">
          <section className="zone-acid lg:sticky lg:top-8">
            <h2 className="eyebrow">New loan</h2>
            <form action={addLoan} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-ink/5 px-3 py-3 text-[13px] font-bold has-[:checked]:bg-ink has-[:checked]:text-acid">
                  <input
                    type="radio"
                    name="direction"
                    value="owed_by_us"
                    defaultChecked
                    className="sr-only"
                  />
                  I owe
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-ink/5 px-3 py-3 text-[13px] font-bold has-[:checked]:bg-ink has-[:checked]:text-acid">
                  <input type="radio" name="direction" value="owed_to_us" className="sr-only" />
                  Owed to me
                </label>
              </div>
              <input
                name="counterparty"
                placeholder="Who? e.g. Abubakar"
                className="field"
                required
              />
              <AmountInput
                name="principal"
                type="number"
                inputMode="numeric"
                step="0.01"
                placeholder="Amount"
                inputClassName="field num"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="eyebrow text-[10px] text-ink/50">Started</span>
                  <input
                    name="startedOn"
                    type="date"
                    defaultValue={todayStr()}
                    className="field mt-1.5"
                  />
                </label>
                <label className="block">
                  <span className="eyebrow text-[10px] text-ink/50">Due (optional)</span>
                  <input name="dueOn" type="date" className="field mt-1.5" />
                </label>
              </div>
              <input name="note" placeholder="What was it for?" className="field" />
              <SubmitButton className="btn w-full">
                <Plus size={17} strokeWidth={2.75} />
                Add loan
              </SubmitButton>
            </form>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function LoanGroup({
  title,
  loans,
  accounts,
  paymentsByLoan,
  assetNames
}: {
  title: string;
  assetNames: Map<number, string>;
  loans: LoanRow[];
  accounts: Array<{ id: number; name: string }>;
  paymentsByLoan: Map<number, Array<{ id: number; amount: string; paidOn: string; note: string | null }>>;
}) {
  return (
    <section>
      <h2 className="eyebrow mb-3 text-muted">{title}</h2>
      <div className="flex flex-col gap-4">
        {loans.map((l) => {
          const settled = l.outstanding === 0;
          const pct = Math.min(100, Math.round((l.paid / l.principal) * 100));
          const history = paymentsByLoan.get(l.id) ?? [];
          return (
            <div key={l.id} className={"overflow-hidden rounded-[22px] bg-card " + (settled ? "opacity-60" : "")}>
              <div className="p-5 lg:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-page text-[15px] font-extrabold">
                    {l.counterparty.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-bold">{l.counterparty}</span>
                      {settled && <span className="tag-acid shrink-0">settled</span>}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] font-medium text-muted">
                      {l.note ? `${l.note} · ` : ""}since {fmtDate(l.startedOn)}
                      {l.dueOn && ` · due ${fmtDate(l.dueOn)}`}
                    </div>
                    {l.assetId && assetNames.has(l.assetId) && (
                      <Link href={`/assets/${l.assetId}`}
                        className="mt-1 inline-block text-[12.5px] font-bold underline underline-offset-2">
                        For {assetNames.get(l.assetId)}
                      </Link>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-[17px] font-extrabold">
                      {settled ? pkr(l.principal, { compact: true }) : pkr(l.outstanding, { compact: true })}
                    </div>
                    <div className="text-[11.5px] font-bold text-muted">
                      {settled ? "repaid in full" : `left of ${pkr(l.principal, { compact: true })}`}
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-page">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11.5px] font-bold text-muted">
                  <span>{pct}% {l.direction === "owed_by_us" ? "repaid" : "received"}</span>
                  {l.overpaid > 0 && <span className="text-over">{pkr(l.overpaid)} over — check the payments</span>}
                </div>

                {history.length > 0 && (
                  <ul className="mt-4 border-t border-line pt-2">
                    {history
                      .slice()
                      .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
                      .map((p) => (
                        <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                          <span className="min-w-0 truncate text-muted">
                            <span className="font-semibold text-ink">{fmtDate(p.paidOn)}</span>
                            {p.note ? ` · ${p.note}` : ""}
                          </span>
                          <span className="num shrink-0 font-bold">{pkr(Number(p.amount))}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {/* The repayment form stays folded until it's wanted — open on
                  every card, it turned the page into a wall of empty fields. */}
              <div className="flex items-start gap-2 border-t border-line px-5 py-3 lg:px-6">
                {!settled ? (
                  <details className="group min-w-0 flex-1">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-page px-4 py-2 text-[13px] font-bold transition hover:bg-line">
                      <Plus size={14} strokeWidth={2.8} />
                      {l.direction === "owed_by_us" ? "Record a repayment" : "Record money received"}
                    </summary>
                    <form action={addLoanPayment} className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_150px]">
                      <input type="hidden" name="loanId" value={l.id} />
                      <AmountInput name="amount" type="number" inputMode="numeric" step="0.01" required
                        placeholder="Amount" inputClassName="field num" />
                      <input name="paidOn" type="date" defaultValue={todayStr()} className="field" />
                      <select name="accountId" className="field sm:col-span-2" defaultValue="">
                        <option value="">Cash — no bank account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {l.direction === "owed_by_us" ? "From" : "Into"} {a.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[12px] leading-snug text-muted sm:col-span-2">
                        Picking a bank adds a transfer to the ledger so its balance stays right — or, if the bank import already has this payment, turns that row into the transfer. Never counted as spending.
                      </p>
                      <SubmitButton className="btn sm:col-span-2">
                        <Check size={16} strokeWidth={3} /> Save
                      </SubmitButton>
                    </form>
                  </details>
                ) : <span className="flex-1" />}
                <ConfirmDelete
                  action={deleteLoan}
                  id={l.id}
                  label={`${l.counterparty} — ${pkr(l.principal)}`}
                  noun="loan"
                  consequence={
                    history.length > 0
                      ? history.length === 1
                        ? "The payment on it goes too, along with any ledger row it wrote."
                        : `All ${history.length} payments on it go too, along with any ledger rows they wrote.`
                      : undefined
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
