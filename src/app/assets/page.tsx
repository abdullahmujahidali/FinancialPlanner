import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, desc, eq } from "drizzle-orm";
import { addAsset, revalueAsset, sellAsset } from "@/actions/portfolio";
import { pkr, todayStr } from "@/lib/money";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ searchParams }: { searchParams: { e?: string } }) {
  const { household } = await requireContext();
  const assets = await db().select().from(t.assets)
    .where(eq(t.assets.householdId, household.id)).orderBy(desc(t.assets.purchaseDate));

  const values = new Map<number, { latest: number; history: { valuedOn: string; value: string }[] }>();
  for (const a of assets) {
    const h = await db().select().from(t.assetValues).where(eq(t.assetValues.assetId, a.id))
      .orderBy(desc(t.assetValues.valuedOn), desc(t.assetValues.id));
    values.set(a.id, { latest: h.length ? Number(h[0].value) : Number(a.purchasePrice), history: h });
  }
  const photos = await db().select().from(t.attachments).where(eq(t.attachments.householdId, household.id));
  const photoByAsset = new Map(photos.filter(p => p.assetId).map(p => [p.assetId!, p.id]));

  const active = assets.filter(a => a.status === "active");
  const netWorth = active.reduce((s, a) => s + (values.get(a.id)?.latest ?? 0), 0);
  const byYear = new Map<string, typeof assets>();
  for (const a of assets) {
    const y = a.purchaseDate.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), a]);
  }

  return (
    <Shell
      wide
      title="Assets"
      action={<span className="money text-[22px] font-bold lg:text-[26px]">{pkr(netWorth, { compact: true })}</span>}
    >
      {searchParams.e && (
        <p className="mb-4 border-2 border-line bg-blush px-4 py-3 text-[14px] font-bold text-ink">{searchParams.e}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        {/* ── Net worth block ──────────────────────────────────────────── */}
        <section className="lg:col-span-12">
          <div className="border-2 border-line bg-ink px-5 py-5 text-card lg:px-7 lg:py-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow text-card/55">Net worth · {active.length} active</span>
              <span className="num text-[12px] font-bold text-card/55">{assets.length} total</span>
            </div>
            <div className="money-xl mt-3 text-[44px] text-acid lg:text-[64px]">{pkr(netWorth, { compact: true })}</div>
          </div>
        </section>

        {/* ── Asset cards ──────────────────────────────────────────────── */}
        <section className="lg:col-span-7">
          <h2 className="eyebrow mb-2.5">Holdings</h2>
          {assets.length === 0 ? (
            <div className="block-card p-5 text-sm font-semibold text-muted">
              No assets yet — add the first one below.
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map((a) => {
                const v = values.get(a.id)!;
                const delta = v.latest - Number(a.purchasePrice);
                return (
                  <div key={a.id} className={"border-2 border-line bg-card " + (a.status === "sold" ? "opacity-60" : "")}>
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {photoByAsset.has(a.id) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/attachment/${photoByAsset.get(a.id)}`} alt=""
                            className="h-12 w-12 shrink-0 border-2 border-line object-cover" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                            <span className="truncate">{a.name}</span>
                            {a.status === "sold" && <span className="tag bg-paper text-ink">sold</span>}
                          </div>
                          <div className="num mt-1 text-[12px] font-medium text-muted">
                            Bought {a.purchaseDate.slice(0, 4)} for {pkr(Number(a.purchasePrice), { compact: true })}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="money text-[18px] font-bold">{pkr(v.latest, { compact: true })}</div>
                        <div className={"num text-[12px] font-bold " + (delta >= 0 ? "text-good" : "text-over")}>
                          {delta >= 0 ? "+" : ""}{pkr(delta, { compact: true })}
                        </div>
                      </div>
                    </div>
                    {a.status === "active" && (
                      <div className="grid grid-cols-1 gap-2 border-t-2 border-line bg-paper p-3 sm:grid-cols-2">
                        <form action={revalueAsset} className="flex gap-2">
                          <input type="hidden" name="assetId" value={a.id} />
                          <input type="hidden" name="valuedOn" value={todayStr()} />
                          <input name="value" type="number" inputMode="numeric" placeholder="New value"
                            className="field num min-w-0 px-2.5 py-2 text-sm" />
                          <button className="btn btn-sm btn-quiet shrink-0">Revalue</button>
                        </form>
                        <form action={sellAsset} className="flex gap-2">
                          <input type="hidden" name="assetId" value={a.id} />
                          <input type="hidden" name="soldDate" value={todayStr()} />
                          <input name="soldPrice" type="number" inputMode="numeric" placeholder="Sold for"
                            className="field num min-w-0 px-2.5 py-2 text-sm" />
                          <button className="btn btn-sm btn-quiet shrink-0">Sold</button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Right column: by year + add form ─────────────────────────── */}
        <div className="space-y-4 lg:col-span-5">
          {byYear.size > 0 && (
            <section>
              <div className="block-card">
                <h2 className="eyebrow border-b-2 border-line px-4 py-3 lg:px-5">Bought by year</h2>
                {[...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, list], i, arr) => (
                  <div key={year}
                    className={"flex items-start justify-between gap-3 px-4 py-3 text-[15px] lg:px-5 " + (i < arr.length - 1 ? "rule-row" : "")}>
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

          <section className="block-card">
            <h2 className="eyebrow border-b-2 border-line bg-acid px-4 py-3 lg:px-5">Add an asset</h2>
            <form action={addAsset} className="space-y-3 p-4 lg:p-5">
              <input name="name" placeholder="e.g. 10 marla plot, LDA City Ph-1 H-101" className="field" required />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input name="purchasePrice" type="number" inputMode="numeric" placeholder="Purchase price" className="field num" required />
                <input name="purchaseDate" type="date" defaultValue={todayStr()} className="field" />
              </div>
              <input name="notes" placeholder="Notes (optional)" className="field" />
              <label className="block">
                <span className="eyebrow text-muted">Photo / papers — up to 2 MB</span>
                <input name="photo" type="file" accept="image/*,.pdf" className="field mt-1.5" />
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
