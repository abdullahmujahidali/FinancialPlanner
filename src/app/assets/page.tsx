import Link from "next/link";
import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, desc, eq } from "drizzle-orm";
import { addAsset, revalueAsset, sellAsset, deleteAsset } from "@/actions/portfolio";
import { pkr, todayStr } from "@/lib/money";
import { Plus, Building2, ChevronRight, MoreHorizontal } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { getBalances } from "@/lib/balances";
import { getLoanNet } from "@/lib/loans";
import ConfirmDelete from "@/components/ConfirmDelete";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const { household } = await requireContext();
  const rows = await db().select().from(t.assets)
    .where(eq(t.assets.householdId, household.id)).orderBy(desc(t.assets.purchaseDate));
  /**
   * Sold assets sink to the bottom regardless of purchase date. They are
   * history — what the household still owns is what the page is for, and a
   * recently sold car sitting above a live plot buries the thing being looked
   * for. Within each group the newest purchase still leads.
   */
  const assets = [...rows].sort((a, b) => {
    const soldA = a.status === "sold" ? 1 : 0;
    const soldB = b.status === "sold" ? 1 : 0;
    return soldA - soldB;
  });

  const values = new Map<number, { latest: number; history: { valuedOn: string; value: string }[] }>();
  for (const a of assets) {
    const h = await db().select().from(t.assetValues).where(eq(t.assetValues.assetId, a.id))
      .orderBy(desc(t.assetValues.valuedOn), desc(t.assetValues.id));
    values.set(a.id, { latest: h.length ? Number(h[0].value) : Number(a.purchasePrice), history: h });
  }
  const photos = await db().select().from(t.attachments).where(eq(t.attachments.householdId, household.id));
  const photoByAsset = new Map(photos.filter(p => p.assetId).map(p => [p.assetId!, p.id]));

  const active = assets.filter(a => a.status === "active");
  const assetTotal = active.reduce((s, a) => s + (values.get(a.id)?.latest ?? 0), 0);

  /**
   * Net worth is what the household owns PLUS what it actually has. Assets
   * alone answered "what is the plot worth" while ignoring every rupee in the
   * bank, which made the headline figure quietly wrong.
   */
  const { total: cash, incomplete: cashUnknown } = await getBalances(household.id);
  // Debts are part of the picture too: money owed out is not wealth, and money
  // owed in is. Only what is still outstanding counts.
  const { weOwe, owedToUs, net: loanNet } = await getLoanNet(household.id);
  const netWorth = assetTotal + cash + loanNet;
  const byYear = new Map<string, typeof assets>();
  for (const a of assets) {
    const y = a.purchaseDate.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), a]);
  }

  return (
    <Shell
      back={{ href: "/", label: "Home" }}
      wide
      title="Assets"
    >
      {sp.e && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold text-ink">{sp.e}</p>
      )}

      {/* ── Net worth zone ───────────────────────────────────────────────── */}
      <section className="zone-ink mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow text-white/45">Net worth</span>
          <span className="num text-[12px] font-bold text-white/45">{assets.length} assets</span>
        </div>
        <div className="money-xl mt-4 text-[48px] text-acid lg:text-[68px]">{pkr(netWorth, { compact: true })}</div>

        {/* Show the two halves, so the headline is checkable. */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[14px] bg-ink2 px-4 py-3">
            <div className="eyebrow text-white/40">Money on hand</div>
            <div className="money mt-1 text-[19px] font-extrabold text-white">
              {pkr(cash, { compact: true })}
            </div>
            {cashUnknown && (
              <Link href="/settings/accounts" className="mt-1 block text-[11px] font-bold text-blush underline">
                some balances not set
              </Link>
            )}
          </div>
          <div className="rounded-[14px] bg-ink2 px-4 py-3">
            <div className="eyebrow text-white/40">Things owned · {active.length}</div>
            <div className="money mt-1 text-[19px] font-extrabold text-white">
              {pkr(assetTotal, { compact: true })}
            </div>
          </div>
        </div>

        {/* Only shown once a loan exists — an empty row of zeroes would just be
            noise for a household that lends nothing. */}
        {(weOwe > 0 || owedToUs > 0) && (
          <Link href="/loans" className="mt-3 block rounded-[14px] bg-ink2 px-4 py-3 transition hover:opacity-80">
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow text-white/40">Loans</span>
              <span
                className={
                  "money text-[19px] font-extrabold " + (loanNet < 0 ? "text-blush" : "text-acid")
                }
              >
                {loanNet < 0 ? "−" : "+"}
                {pkr(Math.abs(loanNet), { compact: true })}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-white/40">
              {pkr(weOwe, { compact: true })} owed out · {pkr(owedToUs, { compact: true })} owed in
            </p>
          </Link>
        )}
      </section>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Asset cards ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:w-[57%] lg:shrink-0">
          <h2 className="eyebrow text-muted">Holdings</h2>
          {assets.length === 0 ? (
            <EmptyState
              Icon={Building2}
              title="No assets yet"
              body="Assets are the things your household owns — property, vehicles, gold. The latest value of each active asset is what adds up to your net worth."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {assets.map((a) => {
                const v = values.get(a.id)!;
                const delta = v.latest - Number(a.purchasePrice);
                return (
                  <div key={a.id}
                    className={"overflow-hidden rounded-[22px] bg-card " + (a.status === "sold" ? "opacity-60" : "")}>
                    {/* The link and the delete button are siblings: a <form>
                        may never be nested inside an <a>. */}
                    <div className="flex items-start gap-2 p-6 lg:p-7">
                      <Link
                        href={`/assets/${a.id}`}
                        className="flex min-w-0 flex-1 items-start justify-between gap-4 rounded-[14px] transition hover:opacity-70"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          {photoByAsset.has(a.id) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/attachment/${photoByAsset.get(a.id)}`} alt=""
                              className="h-14 w-14 shrink-0 rounded-[14px] object-cover" />
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[16px] font-bold">
                              <span className="truncate">{a.name}</span>
                              {a.status === "sold" && <span className="tag-muted">sold</span>}
                            </div>
                            <div className="num mt-1.5 text-[13px] font-medium text-muted">
                              Bought {a.purchaseDate.slice(0, 4)} for {pkr(Number(a.purchasePrice), { compact: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-right">
                          <div>
                            <div className="money text-[20px] font-bold">{pkr(v.latest, { compact: true })}</div>
                            <div className={"num mt-1 text-[13px] font-bold " + (delta >= 0 ? "text-good" : "text-over")}>
                              {delta >= 0 ? "+" : ""}{pkr(delta, { compact: true })}
                            </div>
                          </div>
                          <ChevronRight size={17} strokeWidth={2.4} className="text-muted" />
                        </div>
                      </Link>
                      {/*
                        Selling is the normal way an asset leaves the books —
                        it keeps the purchase price, the value history and the
                        sale, and only drops out of net worth. Deleting throws
                        all of that away, so it hides behind ⋯ rather than
                        sitting at the same weight as "Sold".
                      */}
                      <details className="group relative shrink-0">
                        <summary
                          aria-label={`More actions for ${a.name}`}
                          className="flex h-9 w-8 cursor-pointer list-none items-center justify-center rounded-full text-muted transition hover:bg-page group-open:bg-page"
                        >
                          <MoreHorizontal size={16} strokeWidth={2.4} />
                        </summary>
                        <div className="absolute right-0 z-10 mt-1 w-[232px] rounded-[16px] bg-card p-3 shadow-soft">
                          <p className="text-[12px] font-semibold leading-snug text-muted">
                            Sold it? Use the <strong className="text-ink">Sold</strong> box
                            below — that keeps the history. Deleting erases this asset and
                            every valuation on it.
                          </p>
                          <div className="mt-2 flex justify-end">
                            <ConfirmDelete id={a.id} label={a.name} action={deleteAsset} />
                          </div>
                        </div>
                      </details>
                    </div>
                    {a.status === "active" && (
                      <div className="grid grid-cols-1 gap-3 bg-page p-6 sm:grid-cols-2 lg:px-7">
                        <form action={revalueAsset} className="flex gap-2.5">
                          <input type="hidden" name="assetId" value={a.id} />
                          <input type="hidden" name="valuedOn" value={todayStr()} />
                          <input name="value" type="number" inputMode="numeric" placeholder="New value"
                            className="field num min-w-0" />
                          <button className="btn-quiet btn-sm shrink-0">Revalue</button>
                        </form>
                        <form action={sellAsset} className="flex gap-2.5">
                          <input type="hidden" name="assetId" value={a.id} />
                          <input type="hidden" name="soldDate" value={todayStr()} />
                          <input name="soldPrice" type="number" inputMode="numeric" placeholder="Sold for"
                            className="field num min-w-0" />
                          <button className="btn-quiet btn-sm shrink-0">Sold</button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right column: by year + add form ─────────────────────────── */}
        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          {byYear.size > 0 && (
            <section className="overflow-hidden rounded-[22px] bg-card">
              <h2 className="eyebrow px-6 pb-2 pt-6 lg:px-8">Bought by year</h2>
              <div className="px-6 pb-4 lg:px-8">
                {[...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, list], i, arr) => (
                  <div key={year}
                    className={"flex items-start justify-between gap-3 py-4 text-[15px] " + (i < arr.length - 1 ? "rule-row" : "")}>
                    <span className="min-w-0">
                      <span className="num font-bold">{year}</span>{" "}
                      <span className="text-[13px] font-medium text-muted">· {list.map(x => x.name).join(", ")}</span>
                    </span>
                    <span className="num shrink-0 font-bold">
                      {pkr(list.reduce((s, x) => s + Number(x.purchasePrice), 0), { compact: true })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="zone-acid">
            <h2 className="eyebrow">Add an asset</h2>
            <form action={addAsset} className="mt-6 space-y-4">
              <input name="name" placeholder="e.g. Car, house, or gold" className="field" required />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input name="purchasePrice" type="number" inputMode="numeric" placeholder="Purchase price" className="field num" required />
                <input name="purchaseDate" type="date" defaultValue={todayStr()} className="field" />
              </div>
              <input name="notes" placeholder="Notes (optional)" className="field" />
              <label className="block">
                <span className="eyebrow text-ink/55">Photo / papers — up to 2 MB</span>
                <input name="photo" type="file" accept="image/*,.pdf" className="field mt-2 py-2.5" />
              </label>
              <button className="btn w-full">
                <Plus size={17} strokeWidth={2.75} />
                Add asset
              </button>
            </form>
          </section>
        </div>
      </div>
    </Shell>
  );
}
