import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, desc, eq } from "drizzle-orm";
import { addAsset, revalueAsset, sellAsset } from "@/actions/portfolio";
import { pkr, todayStr } from "@/lib/money";

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
    <Shell title="Assets" action={<span className="num text-lg font-semibold">{pkr(netWorth, { compact: true })}</span>}>
      {searchParams.e && <p className="mb-4 rounded bg-oversoft px-3 py-2 text-sm text-over">{searchParams.e}</p>}

      <div className="mb-6 space-y-3">
        {assets.map((a) => {
          const v = values.get(a.id)!;
          const delta = v.latest - Number(a.purchasePrice);
          return (
            <div key={a.id} className={"rounded-lg border border-line bg-card p-4 " + (a.status === "sold" ? "opacity-60" : "")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {photoByAsset.has(a.id) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/attachment/${photoByAsset.get(a.id)}`} alt="" className="h-12 w-12 rounded object-cover" />
                  )}
                  <div>
                    <div className="font-medium">{a.name}{a.status === "sold" && <span className="tag ml-2 bg-paper text-muted">sold</span>}</div>
                    <div className="text-xs text-muted num">Bought {a.purchaseDate.slice(0, 4)} for {pkr(Number(a.purchasePrice), { compact: true })}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="num font-semibold">{pkr(v.latest, { compact: true })}</div>
                  <div className={"num text-xs " + (delta >= 0 ? "text-brand" : "text-over")}>{delta >= 0 ? "+" : ""}{pkr(delta, { compact: true })}</div>
                </div>
              </div>
              {a.status === "active" && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                  <form action={revalueAsset} className="flex gap-1.5">
                    <input type="hidden" name="assetId" value={a.id} />
                    <input type="hidden" name="valuedOn" value={todayStr()} />
                    <input name="value" type="number" inputMode="numeric" placeholder="New value" className="field num min-w-0 px-2 py-1.5 text-sm" />
                    <button className="btn-quiet shrink-0">Revalue</button>
                  </form>
                  <form action={sellAsset} className="flex gap-1.5">
                    <input type="hidden" name="assetId" value={a.id} />
                    <input type="hidden" name="soldDate" value={todayStr()} />
                    <input name="soldPrice" type="number" inputMode="numeric" placeholder="Sold for" className="field num min-w-0 px-2 py-1.5 text-sm" />
                    <button className="btn-quiet shrink-0">Sold</button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {byYear.size > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted">Bought by year</h2>
          <div className="rounded-lg border border-line bg-card">
            {[...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, list], i, arr) => (
              <div key={year} className={"flex justify-between px-4 py-2.5 text-[15px] " + (i < arr.length - 1 ? "rule-row" : "")}>
                <span>{year} <span className="text-muted">· {list.map(x => x.name).join(", ")}</span></span>
                <span className="num font-medium">{pkr(list.reduce((s, x) => s + Number(x.purchasePrice), 0), { compact: true })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-line bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Add an asset</h2>
        <form action={addAsset} className="space-y-3">
          <input name="name" placeholder="e.g. 10 marla plot, LDA City Ph-1 H-101" className="field" required />
          <div className="grid grid-cols-2 gap-2">
            <input name="purchasePrice" type="number" inputMode="numeric" placeholder="Purchase price" className="field num" required />
            <input name="purchaseDate" type="date" defaultValue={todayStr()} className="field" />
          </div>
          <input name="notes" placeholder="Notes (optional)" className="field" />
          <label className="block text-sm text-muted">Photo / papers (optional, up to 2 MB)
            <input name="photo" type="file" accept="image/*,.pdf" className="field mt-1" />
          </label>
          <button className="btn w-full">Add asset</button>
        </form>
      </section>
    </Shell>
  );
}
