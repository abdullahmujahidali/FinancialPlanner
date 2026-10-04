import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import ConfirmDelete from "@/components/ConfirmDelete";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { addLoanPayment } from "@/actions/loans";
import { loanBalance } from "@/lib/match";
import {
  addInstallments,
  revalueAsset,
  updateAsset,
  deleteAsset,
  deleteAssetValue
} from "@/actions/portfolio";
import { pkr, todayStr } from "@/lib/money";
import { ChevronLeft, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * One asset in full: what it's worth now, what it cost, and every revaluation
 * in between. The list page only has room for the latest figure — this is
 * where the history lives, and where an asset is edited or removed.
 */
export default async function AssetDetailPage({
  params
}: {
  // Next 16 hands route params in as a promise.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assetId = Number(id);
  if (!Number.isInteger(assetId) || assetId <= 0) notFound();

  const { household } = await requireContext();

  const [assetRows, history, photos, plans, accounts] = await Promise.all([
    db().select().from(t.assets)
      .where(and(eq(t.assets.householdId, household.id), eq(t.assets.id, assetId))).limit(1),
    db().select().from(t.assetValues)
      .where(eq(t.assetValues.assetId, assetId))
      .orderBy(desc(t.assetValues.valuedOn), desc(t.assetValues.id)),
    db().select({ id: t.attachments.id, filename: t.attachments.filename, mime: t.attachments.mime })
      .from(t.attachments)
      .where(and(eq(t.attachments.householdId, household.id), eq(t.attachments.assetId, assetId))),
    db().select().from(t.loans)
      .where(and(eq(t.loans.householdId, household.id), eq(t.loans.assetId, assetId))),
    db().select({ id: t.accounts.id, name: t.accounts.name }).from(t.accounts)
      .where(and(eq(t.accounts.householdId, household.id), eq(t.accounts.isArchived, false)))
      .orderBy(asc(t.accounts.name))
  ]);
  // Tenanted through the loans above, which are already this household's.
  const planPayments = plans.length
    ? await db().select().from(t.loanPayments)
        .where(inArray(t.loanPayments.loanId, plans.map((l) => l.id)))
        .orderBy(desc(t.loanPayments.paidOn), desc(t.loanPayments.id))
    : [];

  const asset = assetRows[0];
  // Not ours (or not there) — both are a 404; never confirm another
  // household's ids exist.
  if (!asset) notFound();

  const purchasePrice = Number(asset.purchasePrice);
  const current = history.length ? Number(history[0].value) : purchasePrice;
  const delta = current - purchasePrice;
  const pct = purchasePrice ? (delta / purchasePrice) * 100 : 0;
  const up = delta >= 0;

  // Newest first, with the purchase closing the list so the history reads all
  // the way back to day one. Each row's delta is against the older neighbour.
  const rows: {
    key: string;
    on: string;
    value: number;
    prev: number | null;
    valueId: number | null;
  }[] = history.map((h, i) => {
    const older = history[i + 1];
    return {
      key: `v${h.id}`,
      on: h.valuedOn,
      value: Number(h.value),
      prev: older ? Number(older.value) : null,
      valueId: h.id
    };
  });
  rows.push({
    key: "purchase",
    on: asset.purchaseDate,
    value: purchasePrice,
    prev: null,
    valueId: null
  });
  // A revaluation on the purchase day duplicates the purchase row's figure;
  // the oldest recorded value is measured from the purchase price instead.
  const last = rows[rows.length - 2];
  if (last && last.prev === null) last.prev = purchasePrice;

  const photo = photos.find((p) => p.mime.startsWith("image/"));

  return (
    <Shell
      wide
      title={asset.name}
      titleSlot={
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/assets"
            aria-label="Back to assets"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page"
          >
            <ChevronLeft size={19} strokeWidth={2.4} />
          </Link>
          <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-[-0.03em] lg:text-[34px]">
            {asset.name}
          </h1>
        </div>
      }
      action={<ConfirmDelete id={asset.id} label={asset.name} action={deleteAsset} noun="asset"
        consequence="Its value history and any photos go with it — selling keeps all of that." />}
    >
      {/* ── Current value ────────────────────────────────────────────────── */}
      <section className="zone-ink mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow text-white/45">
            Current value{asset.status === "sold" ? " · sold" : ""}
          </span>
          <span className="num text-[12px] font-bold text-white/45">
            {history.length} valuation{history.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="money-xl mt-4 text-[48px] text-acid lg:text-[68px]">{pkr(current)}</div>
        <div className={"num mt-3 text-[15px] font-bold " + (up ? "text-good" : "text-over")}>
          {up ? "+" : "−"}{pkr(Math.abs(delta))}
          <span className="ml-2 font-medium text-white/55">
            {up ? "+" : "−"}{Math.abs(pct).toFixed(1)}% since purchase
          </span>
        </div>
      </section>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-[57%] lg:shrink-0">
          {/* ── Facts ──────────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-[22px] bg-card">
            <h2 className="eyebrow px-6 pb-2 pt-6 text-muted lg:px-8">Facts</h2>
            <dl className="px-6 pb-4 lg:px-8">
              <Fact label="Purchase date" value={asset.purchaseDate} />
              <Fact label="Purchase price" value={pkr(purchasePrice)} />
              <Fact label="Status" value={asset.status === "sold" ? "Sold" : "Active"} />
              {asset.soldDate && <Fact label="Sold date" value={asset.soldDate} />}
              {asset.soldPrice && <Fact label="Sold price" value={pkr(Number(asset.soldPrice))} />}
              {asset.notes && <Fact label="Notes" value={asset.notes} last />}
            </dl>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/attachment/${photo.id}`}
                alt={asset.name}
                className="max-h-[320px] w-full object-cover"
              />
            )}
          </section>

          {/* ── Value history ──────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-[22px] bg-card">
            <h2 className="eyebrow px-6 pb-2 pt-6 text-muted lg:px-8">Value history</h2>
            <div className="px-6 pb-4 lg:px-8">
              {rows.map((r, i) => {
                const step = r.prev === null ? null : r.value - r.prev;
                return (
                  <div
                    key={r.key}
                    className={
                      "flex items-center justify-between gap-3 py-4 " +
                      (i < rows.length - 1 ? "rule-row" : "")
                    }
                  >
                    <div className="min-w-0">
                      <div className="num text-[15px] font-bold">{pkr(r.value)}</div>
                      <div className="num mt-1 text-[13px] font-medium text-muted">
                        {r.on}
                        {r.valueId === null && " · purchase"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {step !== null && (
                        <span
                          className={
                            "num text-[13px] font-bold " + (step >= 0 ? "text-good" : "text-over")
                          }
                        >
                          {step >= 0 ? "+" : "−"}{pkr(Math.abs(step))}
                        </span>
                      )}
                      {r.valueId !== null && (
                        <form action={deleteAssetValue}>
                          <input type="hidden" name="id" value={r.valueId} />
                          <button
                            aria-label={`Delete valuation from ${r.on}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-blush hover:text-ink"
                          >
                            <Trash2 size={15} strokeWidth={2.2} />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          {/* ── Installments ───────────────────────────────────────────── */}
          {plans.map((plan) => {
            const paid = planPayments.filter((p) => p.loanId === plan.id)
              .reduce((s, p) => s + Number(p.amount), 0);
            const principal = Number(plan.principal);
            const { outstanding } = loanBalance(principal, paid);
            const pct = principal ? Math.min(100, Math.round((paid / principal) * 100)) : 0;
            return (
              <section key={plan.id} className="zone-card">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="eyebrow text-muted">Installments · {plan.counterparty}</h2>
                  <Link href="/loans" className="text-[12px] font-bold text-muted underline underline-offset-2">Loans</Link>
                </div>
                <div className="money-xl mt-4 text-[34px]">{pkr(outstanding)}</div>
                <p className="num mt-1 text-[13px] font-semibold text-muted">
                  {outstanding > 0 ? "left to pay" : "paid in full"} · {pkr(paid)} of {pkr(principal)} paid
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-page">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
                {planPayments.some((p) => p.loanId === plan.id) && (
                  <ul className="mt-4 border-t border-line pt-2">
                    {planPayments.filter((p) => p.loanId === plan.id).map((p) => (
                      <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                        <span className="min-w-0 truncate text-muted">
                          <span className="num font-semibold text-ink">{p.paidOn}</span>
                          {p.note ? ` · ${p.note}` : ""}
                        </span>
                        <span className="num shrink-0 font-bold">{pkr(Number(p.amount))}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {outstanding > 0 && (
                  <form action={addLoanPayment} className="mt-5 space-y-3">
                    <input type="hidden" name="loanId" value={plan.id} />
                    <input type="hidden" name="back" value="asset" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input name="amount" type="number" inputMode="numeric" step="0.01" required
                        placeholder="Installment paid" className="field num" />
                      <input name="paidOn" type="date" defaultValue={todayStr()} className="field" />
                    </div>
                    <select name="accountId" className="field" defaultValue="">
                      <option value="">Paid in cash — no bank account</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>Paid from {a.name}</option>)}
                    </select>
                    <button className="btn w-full">Record installment</button>
                  </form>
                )}
              </section>
            );
          })}

          {plans.length === 0 && asset.status === "active" && (
            <details className="zone-card">
              <summary className="cursor-pointer list-none">
                <span className="eyebrow text-muted">Still paying for this?</span>
                <span className="mt-1 block text-[13px] font-semibold text-muted">
                  Token paid, the rest in installments — track what is left.
                </span>
              </summary>
              <form action={addInstallments} className="mt-5 space-y-3">
                <input type="hidden" name="assetId" value={asset.id} />
                <input name="seller" placeholder="Paying whom? e.g. the dealer or seller" className="field" required />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input name="paidSoFar" type="number" inputMode="numeric" step="0.01"
                    placeholder="Paid so far, e.g. token" className="field num" />
                  <input name="paidOn" type="date" defaultValue={todayStr()} className="field" />
                </div>
                <select name="paidFrom" className="field" defaultValue="">
                  <option value="">Paid in cash — no bank account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>Paid from {a.name}</option>)}
                </select>
                <p className="text-[12px] font-semibold leading-snug text-muted">
                  {pkr(purchasePrice)} minus what you have paid is recorded as owed. If the payment
                  is already in the ledger as an expense, it is turned into a transfer — not counted twice.
                </p>
                <button className="btn w-full">Start tracking installments</button>
              </form>
            </details>
          )}

          {/* ── Revalue ────────────────────────────────────────────────── */}
          <section className="zone-acid">
            <h2 className="eyebrow">Record a new value</h2>
            <form action={revalueAsset} className="mt-6 space-y-4">
              <input type="hidden" name="assetId" value={asset.id} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  name="value"
                  type="number"
                  inputMode="numeric"
                  placeholder="New value"
                  className="field num"
                  required
                />
                <input name="valuedOn" type="date" defaultValue={todayStr()} className="field" />
              </div>
              <button className="btn w-full">Save valuation</button>
            </form>
          </section>

          {/* ── Edit ───────────────────────────────────────────────────── */}
          <section id="edit" className="zone-card scroll-mt-6">
            <h2 className="eyebrow text-muted">Edit name, price or date</h2>
            <form action={updateAsset} className="mt-6 space-y-4">
              <input type="hidden" name="id" value={asset.id} />
              <input name="name" defaultValue={asset.name} className="field" required />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  name="purchasePrice"
                  type="number"
                  inputMode="numeric"
                  defaultValue={purchasePrice}
                  className="field num"
                  required
                />
                <input
                  name="purchaseDate"
                  type="date"
                  defaultValue={asset.purchaseDate}
                  className="field"
                />
              </div>
              <input
                name="notes"
                defaultValue={asset.notes ?? ""}
                placeholder="Notes (optional)"
                className="field"
              />
              <button className="btn w-full">Save changes</button>
            </form>
          </section>

          {/* ── Delete ─────────────────────────────────────────────────── */}
          <section className="zone-blush">
            <h2 className="eyebrow">Delete asset</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink/75">
              Removes {asset.name} and its whole value history. Net worth is recalculated
              from the assets that remain.
            </p>
            <div className="mt-4">
              <ConfirmDelete id={asset.id} label={asset.name} action={deleteAsset} noun="asset"
                consequence="Its value history and any photos go with it — selling keeps all of that." />
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Fact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={
        "flex items-start justify-between gap-4 py-4 text-[15px] " + (last ? "" : "rule-row")
      }
    >
      <dt className="shrink-0 text-[13px] font-medium text-muted">{label}</dt>
      <dd className="num min-w-0 text-right font-bold">{value}</dd>
    </div>
  );
}
