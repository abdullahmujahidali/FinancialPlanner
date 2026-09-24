import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, eq } from "drizzle-orm";
import { addLoan, addLoanPayment, deleteLoan } from "@/actions/loans";
import { getLoans, type LoanRow } from "@/lib/loans";
import { pkr, todayStr } from "@/lib/money";
import { Plus, HandCoins, Check } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import ConfirmDelete from "@/components/ConfirmDelete";

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

  const payments = await db().select().from(t.loanPayments);
  const paymentsByLoan = new Map<number, typeof payments>();
  for (const p of payments) {
    if (!loans.some((l) => l.id === p.loanId)) continue; // other households
    paymentsByLoan.set(p.loanId, [...(paymentsByLoan.get(p.loanId) ?? []), p]);
  }

  const weOweList = loans.filter((l) => l.direction === "owed_by_us");
  const owedList = loans.filter((l) => l.direction === "owed_to_us");

  return (
    <Shell back={{ href: "/", label: "Home" }} wide title="Loans">
      {sp.e && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold text-ink">{sp.e}</p>
      )}

      {/* ── The two totals ───────────────────────────────────────────────── */}
      <section className="zone-ink mb-5">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <span className="eyebrow text-white/45">You owe</span>
            <p className="num mt-2 text-[26px] font-extrabold text-white lg:text-[32px]">
              {pkr(weOwe, { compact: true })}
            </p>
          </div>
          <div>
            <span className="eyebrow text-white/45">Owed to you</span>
            <p className="num mt-2 text-[26px] font-extrabold text-white lg:text-[32px]">
              {pkr(owedToUs, { compact: true })}
            </p>
          </div>
          <div>
            <span className="eyebrow text-white/45">Net effect</span>
            <p
              className={
                "num mt-2 text-[26px] font-extrabold lg:text-[32px] " +
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
            />
          )}

          {owedList.length > 0 && (
            <LoanGroup
              title="Owed to you"
              loans={owedList}
              accounts={accounts}
              paymentsByLoan={paymentsByLoan}
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
              <input
                name="principal"
                type="number"
                inputMode="numeric"
                step="0.01"
                placeholder="Amount"
                className="field num"
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
              <button className="btn w-full">
                <Plus size={17} strokeWidth={2.75} />
                Add loan
              </button>
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
  paymentsByLoan
}: {
  title: string;
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
            <div
              key={l.id}
              className={"overflow-hidden rounded-[22px] bg-card " + (settled ? "opacity-60" : "")}
            >
              <div className="p-6 lg:p-7">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5 text-[17px] font-bold">
                    <span className="truncate">{l.counterparty}</span>
                    {settled && <span className="tag-acid shrink-0">settled</span>}
                  </span>
                  <span className="num shrink-0 text-[13px] font-bold text-muted">
                    {pkr(l.paid, { compact: true })} / {pkr(l.principal, { compact: true })}
                  </span>
                </div>

                {l.note && <p className="mt-2 text-[13px] text-muted">{l.note}</p>}
                <div className="eyebrow mt-2 text-muted">
                  since {l.startedOn}
                  {l.dueOn && ` · due ${l.dueOn}`}
                </div>

                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-page">
                  <div className="h-full rounded-full bg-acid" style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[13px] font-bold">
                    {settled ? "Nothing outstanding" : `${pkr(l.outstanding)} still to go`}
                  </span>
                  {l.overpaid > 0 && (
                    <span className="text-[13px] font-bold text-ink">
                      {pkr(l.overpaid)} more than the amount — check the payments
                    </span>
                  )}
                </div>

                {history.length > 0 && (
                  <ul className="mt-5 space-y-1.5 border-t border-ink/5 pt-4">
                    {history
                      .slice()
                      .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
                      .map((p) => (
                        <li
                          key={p.id}
                          className="flex items-baseline justify-between gap-3 text-[13px]"
                        >
                          <span className="text-muted">
                            {p.paidOn}
                            {p.note ? ` · ${p.note}` : ""}
                          </span>
                          <span className="num font-bold">{pkr(Number(p.amount))}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="space-y-4 bg-page p-6 lg:p-7">
                {!settled && (
                  <form action={addLoanPayment} className="space-y-2.5">
                    <input type="hidden" name="loanId" value={l.id} />
                    <div className="flex flex-wrap gap-2.5">
                      <input
                        name="amount"
                        type="number"
                        inputMode="numeric"
                        step="0.01"
                        placeholder={l.direction === "owed_by_us" ? "Repaid" : "Received"}
                        className="field num min-w-0 flex-1"
                      />
                      <input
                        name="paidOn"
                        type="date"
                        defaultValue={todayStr()}
                        className="field w-[150px] shrink-0"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <select name="accountId" className="field min-w-0 flex-1" defaultValue="">
                        <option value="">Cash — no account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            From {a.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn shrink-0 px-4" aria-label="Record payment">
                        <Check size={16} strokeWidth={3} />
                      </button>
                    </div>
                    <p className="text-[12px] leading-snug text-muted">
                      Choosing an account also writes a transfer in the ledger, so the balance
                      stays right. It is never counted as spending.
                    </p>
                  </form>
                )}

                <div className="flex justify-end">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
